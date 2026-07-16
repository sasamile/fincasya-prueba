"use client";

/**
 * Paso 6 — Check-in en línea. El cliente registra los huéspedes (nombre y
 * documento), placas de vehículos y observaciones; al enviar se crea la reserva
 * y queda listo el check-in (submitCheckin → finalizeSaleLinkCheckin).
 */
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  DoorOpen,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { GUEST_DOCUMENT_TYPES } from "@/features/checkin/utils/guest-document";
import type { SaleLinkPublicData } from "./venta-page-content";
import { StepHeader, VentaPanel } from "./venta-ui";
import { Button } from "@/components/ui/button";

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
}

type GuestRow = {
  nombreCompleto: string;
  tipoDocumento: string;
  cedula: string;
  esMenor: boolean;
};

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
const labelClass =
  "mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground";

function emptyGuest(): GuestRow {
  return { nombreCompleto: "", tipoDocumento: "CC", cedula: "", esMenor: false };
}

export function StepCheckin({ data, onSubmitted }: Props) {
  const submitCheckin = useMutation(api.saleLinks.submitCheckin);
  const [guests, setGuests] = useState<GuestRow[]>(() => {
    if (data.checkinGuests?.length) {
      return data.checkinGuests.map((g) => ({
        nombreCompleto: g.nombreCompleto ?? "",
        tipoDocumento: g.tipoDocumento ?? "CC",
        cedula: g.cedula ?? "",
        esMenor: Boolean(g.esMenor),
      }));
    }
    // Prellena el titular con los datos del contrato.
    return [
      {
        nombreCompleto: data.clientData?.nombre ?? "",
        tipoDocumento: "CC",
        cedula: data.clientData?.cedula ?? "",
        esMenor: false,
      },
    ];
  });
  const [placas, setPlacas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [sending, setSending] = useState(false);

  const maxGuests = data.property?.maxGuests || 0;

  function update(i: number, patch: Partial<GuestRow>) {
    setGuests((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function addGuest() {
    setGuests((prev) => [...prev, emptyGuest()]);
  }
  function removeGuest(i: number) {
    setGuests((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
  }

  async function handleSubmit() {
    const clean = guests
      .map((g) => ({
        nombreCompleto: g.nombreCompleto.trim(),
        tipoDocumento: g.tipoDocumento,
        cedula: g.cedula.trim(),
        esMenor: g.esMenor,
      }))
      .filter((g) => g.nombreCompleto || g.cedula);

    if (clean.length === 0) {
      toast.error("Agrega al menos un huésped.");
      return;
    }
    for (const g of clean) {
      if (!g.nombreCompleto) {
        toast.error("Completa el nombre de cada huésped.");
        return;
      }
      if (!g.esMenor && !g.cedula) {
        toast.error(`Falta el documento de ${g.nombreCompleto}.`);
        return;
      }
    }

    setSending(true);
    try {
      const res = await submitCheckin({
        token: data.token,
        guests: clean.map((g) => ({
          nombreCompleto: g.nombreCompleto,
          cedula: g.cedula || undefined,
          tipoDocumento: g.tipoDocumento,
          esMenor: g.esMenor,
        })),
        mascotas: data.petCount || undefined,
        placas: placas.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      if (!res.ok) {
        const reasons: Record<string, string> = {
          missing_guests: "Agrega al menos un huésped.",
          missing_name: "Falta el nombre de un huésped.",
          missing_document: "Falta el documento de un huésped.",
          not_ready: "Aún no puedes hacer el check-in.",
          unavailable: "Las fechas ya no están disponibles.",
          not_found: "No encontramos tu reserva.",
        };
        toast.error(
          reasons[String(res.reason)] ?? "No se pudo completar el check-in.",
        );
        return;
      }
      toast.success("¡Check-in completado! Disfruta tu estadía 🎉");
      onSubmitted();
    } catch {
      toast.error("No se pudo completar el check-in.");
    } finally {
      setSending(false);
    }
  }

  // Ya completado → estado de éxito.
  if (data.checkinCompleted) {
    return (
      <div className="space-y-6">
        <StepHeader step={6} title="Check-in" />
        <VentaPanel className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <CheckCircle2 className="h-6 w-6 text-foreground" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            Check-in completado
          </h2>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            Registramos {data.checkinGuests?.length ?? 0} huésped
            {(data.checkinGuests?.length ?? 0) === 1 ? "" : "es"}. Tu asesor te
            compartirá los detalles de ingreso.
          </p>
        </VentaPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader
        step={6}
        title="Check-in"
        description={`Registra a las personas que ingresan a la finca.${maxGuests ? ` Capacidad: ${maxGuests}.` : ""}`}
      />

      <div className="space-y-3">
        {guests.map((g, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Huésped {i + 1}
              </p>
              {guests.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeGuest(i)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Nombre completo *</label>
                <input
                  className={inputClass}
                  value={g.nombreCompleto}
                  onChange={(e) => update(i, { nombreCompleto: e.target.value })}
                  placeholder="Como aparece en el documento"
                />
              </div>
              <div>
                <label className={labelClass}>Tipo de documento</label>
                <select
                  className={inputClass}
                  value={g.tipoDocumento}
                  onChange={(e) => update(i, { tipoDocumento: e.target.value })}
                >
                  {GUEST_DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  N.º de documento {g.esMenor ? "(opcional)" : "*"}
                </label>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={g.cedula}
                  onChange={(e) => update(i, { cedula: e.target.value })}
                  placeholder="Ej: 1234567890"
                />
              </div>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={g.esMenor}
                onChange={(e) => update(i, { esMenor: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Menor de 2 años
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={addGuest}
          disabled={maxGuests > 0 && guests.length >= maxGuests}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-3 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar huésped
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3">
          <div>
            <label className={labelClass}>Placas de vehículos (opcional)</label>
            <input
              className={inputClass}
              value={placas}
              onChange={(e) => setPlacas(e.target.value)}
              placeholder="Ej: ABC123, XYZ789"
            />
          </div>
          <div>
            <label className={labelClass}>Observaciones (opcional)</label>
            <textarea
              className="min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Hora estimada de llegada, requerimientos especiales, etc."
            />
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={sending}
        className="h-11 w-full"
        size="lg"
      >
        {sending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <DoorOpen className="mr-2 h-4 w-4" />
        )}
        Completar check-in
      </Button>
    </div>
  );
}
