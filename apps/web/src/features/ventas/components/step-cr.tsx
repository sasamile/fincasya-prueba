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
import { Button } from "@/components/ui/button";
import type { SaleLinkPublicData } from "./venta-page-content";
import { StepHeader, VentaCallout, VentaPanel } from "./venta-ui";

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
    <div className="space-y-6">
      <StepHeader
        step={5}
        title="Confirmación de reserva"
        description="Tu CR con los detalles de la estadía."
      />

      <VentaPanel className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <FileCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Confirmación de reserva</p>
            <p className="text-xs text-muted-foreground">
              Generada para tu reserva {data.contractCode || ""}
            </p>
          </div>
        </div>

        {data.crUrl ? (
          <Button asChild className="h-11 w-full">
            <a href={data.crUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Descargar confirmación (PDF)
            </a>
          </Button>
        ) : generating ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span>Generando tu confirmación de reserva…</span>
          </div>
        ) : error ? (
          <VentaCallout tone="destructive" className="space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={generate}
              className="text-sm font-medium underline underline-offset-2"
            >
              Reintentar
            </button>
          </VentaCallout>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span>Preparando tu confirmación…</span>
          </div>
        )}
      </VentaPanel>

      {data.crUrl ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => void handleContinue()}
          disabled={confirming}
        >
          {confirming ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Continuar al check-in
        </Button>
      ) : null}
    </div>
  );
}
