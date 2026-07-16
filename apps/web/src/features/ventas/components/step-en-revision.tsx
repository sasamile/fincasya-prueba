"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saleLinkDocumentPreviewSrc } from "@/lib/sale-link-document-preview";
import { SaleLinkDocumentViewerDialog } from "./sale-link-document-viewer";
import type { SaleLinkPublicData } from "./venta-page-content";
import {
  StepHeader,
  VentaCallout,
  VentaMetaRow,
  VentaPanel,
  VentaPanelTitle,
} from "./venta-ui";

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
      <StepHeader
        step={3}
        title="Pago en revisión"
        description="Recibimos tu comprobante. Estamos verificando el pago."
      />

      <VentaPanel className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">Esperando validación</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Puede demorar un poco, sobre todo fuera de horario laboral. Este
              enlace sigue activo: puedes volver cuando quieras y la página se
              actualiza sola.
            </p>
            {submittedAt ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Enviado el {submittedAt}
                {data.paymentProofFileName
                  ? ` · ${data.paymentProofFileName}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      </VentaPanel>

      {data.paymentProofSubmitted ? (
        <VentaPanel className="space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Tu comprobante</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
            <Eye className="mr-2 h-4 w-4" />
            Ver comprobante
          </Button>
        </VentaPanel>
      ) : null}

      <VentaPanel>
        <VentaPanelTitle>Qué sigue</VentaPanelTitle>
        <ol className="space-y-3">
          {[
            "Validamos tu comprobante y aprobamos el pago.",
            "Descargas el contrato de arrendamiento.",
            "Lo firmas y nos envías una copia.",
            "Recibes la Confirmación de Reserva (CR).",
            "Completas el check-in con tus acompañantes.",
          ].map((item, i) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-muted-foreground leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ol>
      </VentaPanel>

      {(data.clientDataFilled || data.clientName) && (
        <VentaPanel className="space-y-2.5">
          <VentaPanelTitle>Datos enviados</VentaPanelTitle>
          <VentaMetaRow
            label="Nombre"
            value={data.clientData?.nombre ?? data.clientName ?? "—"}
          />
          {data.clientData?.email ? (
            <VentaMetaRow label="Email" value={data.clientData.email} />
          ) : null}
          {data.clientData?.telefono ? (
            <VentaMetaRow label="Teléfono" value={data.clientData.telefono} />
          ) : null}
          {data.clientData?.telefonoRespaldo ? (
            <VentaMetaRow
              label="Teléfono de respaldo"
              value={data.clientData.telefonoRespaldo}
            />
          ) : null}
          <VentaMetaRow
            label="Pago"
            value={
              data.paymentProofSubmitted
                ? "Comprobante recibido"
                : "Pendiente"
            }
          />
        </VentaPanel>
      )}

      <VentaCallout>
        No necesitas reenviar el comprobante. Te avisamos cuando esté validado.
      </VentaCallout>

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
            Ver mis datos
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
