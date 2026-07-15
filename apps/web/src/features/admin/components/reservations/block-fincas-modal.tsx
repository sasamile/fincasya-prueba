"use client";

/**
 * Modal para BLOQUEAR fincas por fechas (evita que el bot las envíe en el
 * catálogo cuando ya están tomadas pero la reserva no se cargó al sistema).
 * Permite seleccionar 1 o más fincas con búsqueda e imagen.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  Check,
  ImageIcon,
  Lock,
  Loader2,
  Search,
  Trash2,
  X,
  CalendarOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { propertyMatchesSearchQuery } from "@/lib/property/property-search";

function toMs(dateStr: string): number | null {
  if (!dateStr) return null;
  const ms = new Date(`${dateStr}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type BlockableFinca = {
  id: Id<"properties">;
  title: string;
  code: string | null;
  location: string;
  image: string | null;
};

export function BlockFincasModal({ onClose }: { onClose: () => void }) {
  const fincas = useQuery(api.propertyBlocks.listBlockableFincas, {});
  const blocks = useQuery(api.propertyBlocks.listBlocks, {});
  const blockMany = useMutation(api.propertyBlocks.blockProperties);
  const unblock = useMutation(api.propertyBlocks.unblockProperty);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [fe, setFe] = useState("");
  const [fs, setFs] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = (fincas ?? []) as BlockableFinca[];
    const q = search.trim();
    if (!q) return list;
    return list.filter((f) =>
      propertyMatchesSearchQuery(
        {
          title: f.title,
          code: f.code,
          location: f.location,
        },
        q,
      ),
    );
  }, [fincas, search]);

  const selectedFincas = useMemo(() => {
    const map = new Map(
      ((fincas ?? []) as BlockableFinca[]).map((f) => [String(f.id), f]),
    );
    return selectedIds
      .map((id) => map.get(id))
      .filter((f): f is BlockableFinca => Boolean(f));
  }, [fincas, selectedIds]);

  const canSubmit = useMemo(() => {
    const entrada = toMs(fe);
    const salida = toMs(fs);
    return (
      selectedIds.length > 0 &&
      entrada != null &&
      salida != null &&
      salida > entrada
    );
  }, [selectedIds, fe, fs]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const submit = async () => {
    const entradaMs = toMs(fe);
    const salidaMs = toMs(fs);
    if (selectedIds.length === 0 || !entradaMs || !salidaMs) {
      toast.error("Elige al menos una finca y las dos fechas.");
      return;
    }
    if (salidaMs <= entradaMs) {
      toast.error("La fecha de salida debe ser posterior a la de entrada.");
      return;
    }
    setSaving(true);
    try {
      const res = await blockMany({
        propertyIds: selectedIds as Id<"properties">[],
        fechaEntrada: entradaMs,
        fechaSalida: salidaMs,
        reason: reason.trim() || undefined,
      });
      toast.success(
        res.count === 1
          ? "Finca bloqueada. El bot no la enviará en esas fechas."
          : `${res.count} fincas bloqueadas. El bot no las enviará en esas fechas.`,
      );
      setSelectedIds([]);
      setSearch("");
      setFe("");
      setFs("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo bloquear.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await unblock({ blockId: id as Id<"propertyAvailability"> });
      toast.success("Bloqueo quitado. La finca vuelve a estar disponible.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
              <Lock className="h-5 w-5 text-red-600" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Bloquear fincas</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona 1 o más fincas y un rango de fechas. El bot no las
                enviará en el catálogo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Búsqueda + lista con imágenes */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Fincas
              </span>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Quitar selección ({selectedIds.length})
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Puedes marcar varias
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, código o zona…"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-base outline-none focus:border-foreground/40 sm:text-sm"
              />
            </div>

            {selectedFincas.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedFincas.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(String(f.id))}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-foreground"
                    title="Quitar de la selección"
                  >
                    <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
                      {f.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-3 w-3 text-muted-foreground" />
                        </span>
                      )}
                    </span>
                    <span className="truncate">{f.title}</span>
                    <X className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-background">
              {fincas === undefined ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando fincas…
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin resultados para “{search}”
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((f) => {
                    const id = String(f.id);
                    const checked = selectedIds.includes(id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors hover:bg-muted/50",
                            checked && "bg-red-500/5",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                              checked
                                ? "border-red-600 bg-red-600 text-white"
                                : "border-border bg-background",
                            )}
                          >
                            {checked ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {f.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.image}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {f.title}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {[f.code, f.location].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Desde
              </span>
              <input
                type="date"
                value={fe}
                onChange={(e) => setFe(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-base sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Hasta
              </span>
              <input
                type="date"
                value={fs}
                onChange={(e) => setFs(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-base sm:text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Motivo (opcional)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: reservada por fuera del sistema"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-base sm:text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit || saving}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {selectedIds.length > 1
              ? `Bloquear ${selectedIds.length} fincas`
              : "Bloquear finca"}
          </button>

          {/* Bloqueos activos */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <CalendarOff className="h-3.5 w-3.5" /> Bloqueos activos
            </p>
            {blocks === undefined ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            ) : blocks.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                No hay fincas bloqueadas manualmente.
              </p>
            ) : (
              <div className="space-y-2">
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2"
                  >
                    <Lock className="h-4 w-4 shrink-0 text-red-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.finca}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(b.fechaEntrada)} → {fmt(b.fechaSalida)}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(b.id)}
                      disabled={removing === b.id}
                      title="Quitar bloqueo"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/20"
                    >
                      {removing === b.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
