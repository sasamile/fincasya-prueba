"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saleLinkDocumentPreviewSrc } from "@/lib/sale-link-document-preview";
import { SaleLinkDocumentViewerDialog } from "./sale-link-document-viewer";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  data: SaleLinkPublicData;
  onPolled: () => void;
  onViewStep?: (stepId: number) => void;
}

export function StepEnRevision({ data, onViewStep }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const submittedAt = data.paymentProofSubmittedAt
    ? format(new Date(data.paymentProofSubmittedAt), "d 'de' MMMM, h:mm a", {
        locale: es,
      })
    : null;

  const proofFileName = data.paymentProofFileName?.trim() || "comprobante";
  const proofPreviewSrc = saleLinkDocumentPreviewSrc(
    data.token,
    "payment-proof",
  );
  const proofMime =
    data.paymentProofs?.find((p) => p.fileName === proofFileName)?.mimeType ??
    data.paymentProofs?.[0]?.mimeType;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
          Paso 3
        </p>
        <h1 className="text-2xl font-bold">Pago en revisión</h1>
      </div>

      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-emerald-900">
              Tu comprobante sí fue recibido
            </h2>
            <p className="text-sm text-emerald-800 mt-1">
              No necesitas enviarlo de nuevo. Estamos verificando que el pago
              haya llegado a nuestras cuentas.
            </p>
          </div>
        </div>
        {submittedAt ? (
          <p className="text-xs text-emerald-700 pl-9">
            Enviado el {submittedAt}
            {data.paymentProofFileName
              ? ` · ${data.paymentProofFileName}`
              : ""}
          </p>
        ) : null}
      </div>

      {data.paymentProofSubmitted ? (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Tu comprobante</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {proofFileName}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setViewerOpen(true)}
            className="w-full sm:w-auto"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver comprobante aquí
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>
        <div>
          <h2 className="font-bold text-lg text-amber-900">
            Tu pago está en revisión
          </h2>
          <p className="text-sm text-amber-700 mt-1">
            El equipo está verificando que el pago haya llegado a nuestras
            cuentas. Este proceso puede demorar un poco, especialmente fuera de
            horario laboral.
          </p>
          <p className="text-sm text-amber-700 mt-2">
            Cuando validen tu pago, podrás continuar con el contrato. Este
            enlace seguirá activo — puedes volver cuando quieras y la página se
            actualiza sola.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          En revisión — te avisamos cuando esté listo
        </div>
      </div>

   

      <div className="rounded-xl bg-card p-4 space-y-3 shadow-sm">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          ¿Qué sigue?
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-none">
          {[
            "El equipo valida tu comprobante y aprueba el pago.",
            "Podrás descargar el contrato de arrendamiento.",
            "Deberás firmarlo y enviarnos una copia.",
            "Recibirás la Confirmación de Reserva (CR) oficial.",
            "Finalmente completarás el check-in con los datos de tus acompañantes.",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      </div>

      {(data.clientDataFilled || data.clientName) && (
        <div className="rounded-xl bg-muted/30 p-4 space-y-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Datos enviados
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">
              {data.clientData?.nombre ?? data.clientName ?? "—"}
            </span>
            {data.clientData?.email ? (
              <>
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{data.clientData.email}</span>
              </>
            ) : null}
            {data.clientData?.telefono ? (
              <>
                <span className="text-muted-foreground">Teléfono</span>
                <span className="font-medium">{data.clientData.telefono}</span>
              </>
            ) : null}
            <span className="text-muted-foreground">Pago</span>
            <span className="font-medium text-emerald-700">
              {data.paymentProofSubmitted
                ? "✓ Comprobante recibido"
                : "—"}
            </span>
          </div>
        </div>
      )}

      {onViewStep ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onViewStep(1)}
          >
            Ver resumen
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onViewStep(2)}
          >
            Ver mis datos enviados
          </Button>
        </div>
      ) : null}

      <SaleLinkDocumentViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title="Tu comprobante de pago"
        fileName={proofFileName}
        mimeType={proofMime}
        previewSrc={proofPreviewSrc}
      />
    </div>
  );
}
