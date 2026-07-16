"use client";

/**
 * Previsualización del contrato (borrador, solo lectura) antes del pago.
 * Sin numeración ni valor contractual — el PDF definitivo se genera al validar.
 */
import { useEffect, useState } from "react";
import { BadgeCheck, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RntCertificateModal,
  RNT_NUMBER,
} from "@/features/landing/components/RntCertificateModal";
import { StepHeader, VentaCallout } from "./venta-ui";

type ClientSnapshot = {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
  ciudad: string;
  direccion: string;
};

type Props = {
  token: string;
  client: ClientSnapshot;
  onContinueToPayment: () => void;
  onBackToDatos: () => void;
  readOnly?: boolean;
};

export function StepContratoPreview({
  token,
  client,
  onContinueToPayment,
  onBackToDatos,
  readOnly,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [rntOpen, setRntOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      try {
        const res = await fetch(`/api/sale-links/${token}/generate-contract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "preview",
            client: {
              nombre: client.nombre,
              cedula: client.cedula,
              email: client.email,
              telefono: client.telefono,
              ciudad: client.ciudad,
              direccion: client.direccion,
            },
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          fileBase64?: string;
          mimeType?: string;
          error?: string;
        };
        if (!res.ok || !data.fileBase64) {
          throw new Error(
            data.error || "No se pudo generar la previsualización.",
          );
        }
        const binary = atob(data.fileBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], {
          type: data.mimeType || "application/pdf",
        });
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPdfUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el borrador del contrato.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    token,
    client.nombre,
    client.cedula,
    client.email,
    client.telefono,
    client.ciudad,
    client.direccion,
    reloadKey,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <StepHeader
          step={2}
          title="Revisa tu contrato"
          description="Borrador de solo lectura, sin numeración. Si estás de acuerdo, continúa al pago."
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full shrink-0 gap-2 rounded-xl border-primary/25 bg-primary/5 font-semibold text-primary hover:bg-primary/10 sm:mt-1 sm:w-auto"
          onClick={() => setRntOpen(true)}
        >
          <BadgeCheck className="h-4 w-4" />
          Ver RNT FincasYa
        </Button>
      </div>

      <VentaCallout tone="neutral" className="text-sm text-muted-foreground">
        Este documento es una previsualización del régimen de arrendamiento con
        tus datos. El contrato definitivo (con número) se genera después de
        validar el pago.
      </VentaCallout>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Borrador del contrato</p>
          </div>
          <button
            type="button"
            onClick={() => setRntOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            RNT {RNT_NUMBER} · agencia verificada
          </button>
        </div>

        <div className="relative min-h-[55vh] bg-zinc-100 dark:bg-zinc-950">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              Generando previsualización…
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="max-w-sm text-sm text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Reintentar
              </Button>
            </div>
          ) : pdfUrl ? (
            <iframe
              title="Previsualización del contrato"
              src={`${pdfUrl}#toolbar=0`}
              className="h-[70vh] w-full border-0"
            />
          ) : null}
        </div>
      </div>

      {!readOnly ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            className="h-11 w-full sm:flex-1"
            size="lg"
            disabled={loading || Boolean(error) || !pdfUrl}
            onClick={onContinueToPayment}
          >
            Continuar con el pago
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            onClick={onBackToDatos}
          >
            Volver a mis datos
          </Button>
        </div>
      ) : null}

      <RntCertificateModal open={rntOpen} onOpenChange={setRntOpen} />
    </div>
  );
}
