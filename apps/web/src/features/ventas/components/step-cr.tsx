"use client";

/**
 * Paso 5 — Confirmación de reserva (CR). Genera el PDF al instante (server-side)
 * apenas el pago está validado y lo entrega para descargar; luego el cliente
 * continúa al check-in.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { toast } from "sonner";
import { CheckCircle2, Download, FileCheck, Loader2 } from "lucide-react";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
}

export function StepCr({ data, onSubmitted }: Props) {
  const confirmCr = useMutation(api.saleLinks.confirmCr);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  function generate() {
    setGenerating(true);
    setError(null);
    fetch(`/api/sale-links/${data.token}/generate-cr`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) setError(d?.error || "No se pudo generar la confirmación.");
      })
      .catch(() => setError("No se pudo generar la confirmación."))
      .finally(() => setGenerating(false));
  }

  // Genera la CR apenas el pago está validado (una sola vez).
  useEffect(() => {
    if (tried.current || data.crUrl) return;
    if (!data.paymentValidated || !data.clientDataFilled) return;
    tried.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.token, data.crUrl, data.paymentValidated, data.clientDataFilled]);

  async function handleContinue() {
    setConfirming(true);
    try {
      const r = await confirmCr({ token: data.token });
      if (!r.ok) {
        toast.error("Aún no puedes continuar al check-in.");
        return;
      }
      toast.success("¡Confirmación lista! Sigue con tu check-in.");
      onSubmitted();
    } catch {
      toast.error("No se pudo continuar.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Paso 5
        </p>
        <h1 className="text-2xl font-bold">Confirmación de reserva</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu confirmación de reserva (CR) con todos los detalles de tu estadía.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold">Confirmación de reserva</p>
            <p className="text-xs text-muted-foreground">
              Generada para tu reserva {data.contractCode || ""}
            </p>
          </div>
        </div>

        {data.crUrl ? (
          <a
            href={data.crUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white"
          >
            <Download className="h-4 w-4" /> Descargar confirmación (PDF)
          </a>
        ) : generating ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <span>Generando tu confirmación de reserva…</span>
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={generate}
              className="text-sm font-bold text-primary underline"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <span>Preparando tu confirmación…</span>
          </div>
        )}
      </div>

      {data.crUrl ? (
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={confirming}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 text-sm font-bold text-primary disabled:opacity-60"
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Continuar al check-in
        </button>
      ) : null}
    </div>
  );
}
