"use client";

import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Send,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
}

async function uploadDocument(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "documents");
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.url) throw new Error(d.error || "No se pudo subir el archivo.");
  return { url: d.url as string };
}

export function StepContrato({ data, onSubmitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generateAttemptedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitSignedContract = useMutation(api.saleLinks.submitSignedContract);

  const requestContractGeneration = async () => {
    if (data.contractUrl || !data.paymentValidated) return;

    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(
        `/api/sale-links/${encodeURIComponent(data.token)}/generate-contract`,
        { method: "POST" },
      );
      const result = (await res.json()) as {
        ok?: boolean;
        error?: string;
        contractUrl?: string;
      };

      if (res.ok && result.ok) {
        onSubmitted();
        return;
      }

      setGenerateError(
        result.error ??
          "No se pudo generar el contrato. Si el problema continúa, contacta a tu asesor.",
      );
    } catch {
      setGenerateError(
        "Error de conexión al generar el contrato. Recarga la página o intenta en unos segundos.",
      );
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (data.contractUrl || !data.paymentValidated) return;

    if (!generateAttemptedRef.current) {
      generateAttemptedRef.current = true;
      void requestContractGeneration();
      return;
    }

    const interval = setInterval(() => {
      onSubmitted();
    }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.token, data.contractUrl, data.paymentValidated]);

  const handleUploadSigned = async () => {
    if (!file) {
      toast.error("Adjunta el contrato firmado");
      return;
    }
    setSubmitting(true);
    try {
      const { url } = await uploadDocument(file);
      const r = await submitSignedContract({
        token: data.token,
        signedContractUrl: url,
        signedContractFileName: file.name,
      });
      if (!r.ok) {
        toast.error("No se pudo enviar el contrato firmado.");
        return;
      }
      toast.success("¡Contrato firmado recibido! Gracias.");
      onSubmitted();
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
          Paso 4
        </p>
        <h1 className="text-2xl font-bold">Tu contrato</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descarga el contrato, fírmalo y súbelo aquí
        </p>
      </div>

      {/* Descargar contrato */}
      <div className="rounded-xl bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Contrato de arrendamiento</p>
            <p className="text-xs text-muted-foreground">
              Generado para tu reserva
            </p>
          </div>
        </div>

        {data.contractUrl ? (
          <a
            href={data.contractUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <Button className="w-full gap-2">
              <Download className="w-4 h-4" />
              Descargar contrato PDF
            </Button>
          </a>
        ) : generateError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 space-y-2">
            <p>{generateError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={generating}
              onClick={() => {
                generateAttemptedRef.current = true;
                void requestContractGeneration();
              }}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                "Reintentar generación"
              )}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground text-center">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            {generating
              ? "Generando tu contrato PDF..."
              : "Preparando tu contrato..."}
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-1.5">
        <p className="font-semibold">Instrucciones:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Descarga el contrato PDF</li>
          <li>Imprímelo o fírmalo digitalmente</li>
          <li>Toma una foto o escanea el contrato firmado</li>
          <li>Súbelo a continuación</li>
        </ol>
      </div>

      {/* Subir contrato firmado */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Subir contrato firmado</p>
        <div
          role="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors p-6 text-center cursor-pointer"
        >
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700">
                {file.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <p className="text-sm">Foto del contrato firmado o PDF</p>
              <p className="text-xs">JPG, PNG o PDF · Máx. 20 MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />

        <Button
          onClick={handleUploadSigned}
          disabled={submitting || !file || !data.contractUrl}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Enviar contrato firmado
            </>
          )}
        </Button>
        {!data.contractUrl && (
          <p className="text-xs text-center text-muted-foreground">
            Espera a que el contrato esté disponible para descargarlo primero
          </p>
        )}
      </div>

      {data.signedContractSubmitted && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-800">
            ¡Contrato firmado recibido! Continúa al siguiente paso.
          </p>
        </div>
      )}
    </div>
  );
}
