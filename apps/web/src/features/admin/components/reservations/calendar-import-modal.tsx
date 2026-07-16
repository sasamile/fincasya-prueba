"use client";

/**
 * Pantalla de REVISIÓN del Google Calendar → bloqueos.
 *
 * Las reservas que el equipo lleva en su Google Calendar no están en la base,
 * así que el bot no sabe que esas fincas están ocupadas y las sigue ofreciendo.
 * Aquí se listan los eventos del mes con la finca SUGERIDA (los títulos son
 * libres: "CHIMBI OCUPADA", "2666 JAIME CASTILLO, MONTEBELLO 04 NOCHES"), el
 * operador confirma o corrige, y al guardar se crean los bloqueos.
 *
 * Los matches de confianza alta/media los importa SOLO el cron
 * (googleCalendar.autoImportHighConfidence); aquí aterrizan los dudosos: el
 * apellido del cliente choca con nombres de finca ("CAROL ROJAS" vs finca
 * "Casa Rojas"). Los VETADOS (el operador borró un bloqueo que vino de Google)
 * se marcan: el cron no los trae, pero cargarlos a mano levanta el veto.
 */
import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { CalendarCheck, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  summary: string;
  startMs: number;
  endMs: number;
  suggestedPropertyId: string | null;
  confidence: "alta" | "media" | "baja" | "ninguna";
  matchedOn: string | null;
  alreadyImported: boolean;
  skipped: boolean;
};

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}

const CONFIDENCE_BADGE: Record<Candidate["confidence"], { label: string; cls: string }> = {
  alta: { label: "Sugerida", cls: "bg-emerald-500/15 text-emerald-700" },
  media: { label: "Revisar", cls: "bg-amber-500/15 text-amber-700" },
  baja: { label: "Dudosa", cls: "bg-amber-500/15 text-amber-700" },
  ninguna: { label: "Elige la finca", cls: "bg-slate-500/15 text-slate-600" },
};

export function CalendarImportModal({
  rangeStartMs,
  rangeEndMs,
  periodLabel,
  onClose,
}: {
  rangeStartMs: number;
  rangeEndMs: number;
  periodLabel: string;
  onClose: () => void;
}) {
  const listCandidates = useAction(api.googleCalendar.listImportCandidates);
  const importBlocks = useMutation(api.googleCalendar.importEventsAsBlocks);
  const fincas = useQuery(api.propertyBlocks.listBlockableFincas, {});

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  /** eventId → propertyId elegido ("" = no importar). */
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCandidates({ timeMinMs: rangeStartMs, timeMaxMs: rangeEndMs })
      .then((rows) => {
        if (cancelled) return;
        const list = rows as Candidate[];
        setCandidates(list);
        // Pre-selecciona SOLO las de confianza alta; el resto lo elige el operador.
        const initial: Record<string, string> = {};
        for (const c of list) {
          if (c.alreadyImported) continue;
          if (c.skipped) continue; // el operador lo descartó: no re-seleccionar
          if (c.confidence === "alta" && c.suggestedPropertyId) {
            initial[c.id] = c.suggestedPropertyId;
          }
        }
        setPicks(initial);
      })
      .catch((err) => {
        console.error(err);
        toast.error("No se pudieron leer los eventos del calendario.");
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listCandidates, rangeStartMs, rangeEndMs]);

  const pending = useMemo(
    () => (candidates ?? []).filter((c) => !c.alreadyImported),
    [candidates],
  );
  const doneCount = (candidates?.length ?? 0) - pending.length;
  const selectedCount = Object.values(picks).filter(Boolean).length;

  const save = async () => {
    const items = pending
      .filter((c) => picks[c.id])
      .map((c) => ({
        eventId: c.id,
        propertyId: picks[c.id] as Id<"properties">,
        fechaEntrada: c.startMs,
        fechaSalida: c.endMs,
        summary: c.summary,
      }));
    if (items.length === 0) {
      toast.error("Elige al menos una finca.");
      return;
    }
    setSaving(true);
    try {
      const res = await importBlocks({ items });
      toast.success(
        `${res.creados} finca(s) bloqueadas — el bot ya no las va a ofrecer esos días.` +
          (res.omitidos ? ` ${res.omitidos} omitida(s) (ya estaban).` : ""),
        { duration: 8000 },
      );
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron crear los bloqueos.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Cargar reservas del Google Calendar
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirma a qué finca corresponde cada evento de{" "}
              <span className="font-semibold">{periodLabel}</span>. Al guardar, esos
              días quedan bloqueados y el bot deja de ofrecer esas fincas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {candidates === null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el calendario…
            </div>
          ) : pending.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
              No hay eventos pendientes por cargar en {periodLabel}.
              {doneCount > 0 && (
                <p className="mt-1">
                  {doneCount} ya está(n) cargado(s) como bloqueo.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((c) => {
                const badge = CONFIDENCE_BADGE[c.confidence];
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-2xl border p-3 transition-colors",
                      picks[c.id]
                        ? "border-primary/40 bg-primary/[0.03]"
                        : "border-border bg-background",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.summary}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmt(c.startMs)} → {fmt(c.endMs)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {c.skipped && (
                          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                            Vetado
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            badge.cls,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    {c.skipped && (
                      <p className="mt-1 text-xs text-rose-600">
                        Se borró el bloqueo de este evento, así que la carga
                        automática lo ignora. Si eliges una finca y guardas, se
                        vuelve a bloquear.
                      </p>
                    )}
                    <select
                      value={picks[c.id] ?? ""}
                      onChange={(e) =>
                        setPicks((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                    >
                      <option value="">— No cargar este evento —</option>
                      {(fincas ?? []).map((f) => (
                        <option key={String(f.id)} value={String(f.id)}>
                          {f.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            {selectedCount} de {pending.length} evento(s) por cargar
            {doneCount > 0 && ` · ${doneCount} ya cargado(s)`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-10 rounded-xl px-4 text-sm font-semibold hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={() => void save()}
              disabled={saving || selectedCount === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck className="h-4 w-4" />
              )}
              Bloquear {selectedCount > 0 ? selectedCount : ""} finca(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
