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
import { useAction, useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { SaleLinkPublicData } from "./venta-page-content";
import {
  StepHeader,
  VentaCallout,
  VentaPanel,
} from "./venta-ui";
import { materializeProofFile } from "@/features/ventas/utils/venta-draft-storage";
import { generatePdfPagesForAi } from "@/lib/pdf-preview";

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

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

async function dataUrlToJpegFile(
  dataUrl: string,
  baseName: string,
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const safe = baseName.replace(/\.[^.]+$/, "") || "contrato";
  return new File([blob], `${safe}.jpg`, { type: "image/jpeg" });
}

/**
 * Prepara JPG(s) para visión: última página del PDF (firma) + primera si hay
 * varias páginas. Imágenes se suben tal cual.
 */
async function prepareSignedContractImagesForAi(
  file: File,
): Promise<File[]> {
  if (isPdfFile(file)) {
    const pdfFile =
      file.type === "application/pdf"
        ? file
        : new File([await file.arrayBuffer()], file.name.replace(/\.pdf$/i, "") + ".pdf", {
            type: "application/pdf",
          });
    const pages = await generatePdfPagesForAi(pdfFile);
    const last = await dataUrlToJpegFile(pages.lastPage, `${file.name}-firma`);
    if (pages.pageCount <= 1) return [last];
    const first = await dataUrlToJpegFile(
      pages.firstPage,
      `${file.name}-portada`,
    );
    return [last, first];
  }
  return [file];
}

const SIGNED_CONTRACT_REJECT_MESSAGES: Record<string, string> = {
  not_a_contract:
    "Eso no parece el contrato de arrendamiento. Debes subir el PDF o la foto del contrato firmado (no listas de invitados ni otros documentos).",
  missing_signature:
    "El contrato no muestra la firma del cliente. Fírmalo (firma manuscrita o digital) y vuelve a subirlo.",
  pdf_not_allowed:
    "No pudimos leer ese PDF. Sube una foto clara de la página de firmas, o un PDF del contrato firmado.",
  unreadable:
    "No pudimos leer ese archivo. Sube una foto o PDF más claro del contrato firmado.",
  ai_unavailable:
    "No pudimos validar el contrato ahora. Espera un momento e intenta de nuevo.",
  inactive: "Este link ya no está activo. Contacta a tu asesor.",
  not_found: "El link ya no existe.",
  contract_not_verified:
    "Debes validar el contrato firmado antes de continuar.",
  contract_rejected:
    "El archivo no fue aceptado como contrato firmado. Sube el documento correcto.",
};

function signedContractRejectMessage(reason: string | undefined): string {
  if (!reason) return SIGNED_CONTRACT_REJECT_MESSAGES.not_a_contract;
  return (
    SIGNED_CONTRACT_REJECT_MESSAGES[reason] ??
    SIGNED_CONTRACT_REJECT_MESSAGES.not_a_contract
  );
}

export function StepContrato({ data, onSubmitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generateAttemptedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitSignedContract = useMutation(api.saleLinks.submitSignedContract);
  const verifySignedContract = useAction(api.saleLinks.verifySignedContract);

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
    setStatusLabel("Subiendo…");
    try {
      const stable = await materializeProofFile(file);

      setStatusLabel("Preparando para validación…");
      let forAi: File[];
      try {
        forAi = await prepareSignedContractImagesForAi(stable);
      } catch {
        toast.error(
          "No pudimos leer ese archivo. Sube una foto (JPG/PNG) o un PDF del contrato firmado.",
        );
        return;
      }

      const uploadedOriginal = await uploadDocument(stable);

      setStatusLabel("Validando firma…");
      const photoUrls: string[] = [];
      for (const img of forAi) {
        const up = await uploadDocument(img);
        photoUrls.push(up.url);
      }

      const verdict = await verifySignedContract({
        token: data.token,
        documentUrl: uploadedOriginal.url,
        photoUrls,
      });

      if (!verdict.allow) {
        toast.error(signedContractRejectMessage(verdict.reason));
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      setStatusLabel("Enviando…");
      const r = await submitSignedContract({
        token: data.token,
        signedContractUrl: uploadedOriginal.url,
        signedContractFileName: stable.name,
      });
      if (!r.ok) {
        toast.error(signedContractRejectMessage(r.reason));
        return;
      }
      toast.success("¡Contrato firmado recibido! Gracias.");
      onSubmitted();
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
      setStatusLabel(null);
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader
        step={4}
        title="Tu contrato"
        description="Descarga el contrato, fírmalo y súbelo aquí."
      />

      <VentaPanel className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Contrato de arrendamiento</p>
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
          <VentaCallout tone="destructive" className="space-y-2">
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
          </VentaCallout>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {generating
              ? "Generando tu contrato PDF..."
              : "Preparando tu contrato..."}
          </div>
        )}
      </VentaPanel>

      <VentaCallout>
        <p className="mb-1.5 font-medium">Instrucciones</p>
        <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>Descarga el contrato PDF</li>
          <li>Imprímelo o fírmalo digitalmente</li>
          <li>Toma una foto o escanea el contrato firmado (debe verse tu firma)</li>
          <li>Súbelo a continuación — se valida que sea el contrato firmado</li>
        </ol>
      </VentaCallout>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Subir contrato firmado</p>
        <div
          role="button"
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl border border-dashed border-border p-6 text-center transition-colors duration-150 hover:border-foreground/30"
        >
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-foreground" />
              <span className="text-sm font-medium">{file.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-7 w-7" />
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
          className="h-11 w-full"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {statusLabel ?? "Enviando..."}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar contrato firmado
            </>
          )}
        </Button>
        {!data.contractUrl && (
          <p className="text-center text-xs text-muted-foreground">
            Espera a que el contrato esté disponible para descargarlo primero
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Solo se acepta el contrato con tu firma. Otros documentos (listas,
          comprobantes, etc.) serán rechazados.
        </p>
      </div>

      {data.signedContractSubmitted ? (
        <VentaCallout>
          Contrato firmado recibido. Continúa al siguiente paso.
        </VentaCallout>
      ) : null}
    </div>
  );
}
