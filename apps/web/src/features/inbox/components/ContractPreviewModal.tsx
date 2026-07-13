'use client';

/**
 * Modal de vista previa EDITABLE del contrato (tipo Word). Arma el HTML con la
 * misma plantilla de la página de contratos (buildContractHTML), lo muestra en
 * una hoja A4 editable inline, y al enviar/descargar genera el PDF de ESE HTML
 * editado (html-to-pdf).
 */
import { useMemo, useRef, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { ConversationRow } from '@/features/inbox/types';
import { toast } from 'sonner';
import { FileText, Loader2, Send, X } from 'lucide-react';
import Image from 'next/image';
import { buildContractHTML } from '@/features/admin/utils/contract-utils';
import { buildReservationPreviewFincaData } from '@/features/admin/utils/contract-preview-helpers';
import { CONTRACT_DOCUMENT_CSS } from '@/features/admin/utils/contract-document-styles';
import {
  CONTRACT_LOGO_HEIGHT,
  CONTRACT_LOGO_SRC,
  CONTRACT_LOGO_WIDTH,
} from '@/features/admin/utils/contract-logo';

function money(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

function formatFeatures(features: unknown[]): string {
  return (features ?? [])
    .map((f) =>
      typeof f === 'string'
        ? f
        : ((f as { name?: string }).name ?? '').toUpperCase(),
    )
    .filter(Boolean)
    .join('\n');
}

export type PreviewDraft = {
  fincaId: string;
  contractCode: string;
  pricePerNight: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  cleaningFee: string;
  refundableDeposit: string;
  manillaCondominio: string;
  otherCharges: string;
  clientName: string;
  clientCedula: string;
  clientPhone: string;
  clientEmail: string;
  clientCity: string;
  clientAddress: string;
};

export function ContractPreviewModal({
  draft,
  settings,
  selectedBankIds,
  conversation,
  onClose,
}: {
  draft: PreviewDraft;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any;
  selectedBankIds: string[];
  conversation: ConversationRow | null;
  onClose: () => void;
}) {
  const finca = useQuery(api.adminProperties.getById, { id: draft.fincaId }) as
    | {
        title?: string;
        location?: string;
        capacity?: number;
        code?: string;
        features?: unknown[];
      }
    | null
    | undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const sendDocument = useAction(api.advisorDocuments.sendDocumentToConversation);

  const html = useMemo(() => {
    if (!finca) return '';
    const nights = (() => {
      const a = new Date(`${draft.checkIn}T12:00:00`).getTime();
      const b = new Date(`${draft.checkOut}T12:00:00`).getTime();
      return Number.isFinite(a) && Number.isFinite(b) && b > a
        ? Math.max(1, Math.round((b - a) / 86400000))
        : 1;
    })();
    const perNight = Number(draft.pricePerNight) || 0;
    const total =
      perNight * nights +
      (Number(draft.cleaningFee) || 0) +
      (Number(draft.refundableDeposit) || 0) +
      (Number(draft.manillaCondominio) || 0) +
      (Number(draft.otherCharges) || 0);

    const fincaData = buildReservationPreviewFincaData(
      {
        title: finca.title ?? '',
        location: finca.location ?? '',
        capacity: finca.capacity ?? 0,
        code: finca.code ?? '',
        features: finca.features ?? [],
      },
      '',
      {
        contractNumber: draft.contractCode,
        clientName: draft.clientName,
        clientId: draft.clientCedula,
        clientCity: draft.clientCity,
        clientEmail: draft.clientEmail,
        clientPhone: draft.clientPhone,
        clientAddress: draft.clientAddress,
        checkInDate: draft.checkIn,
        checkOutDate: draft.checkOut,
        checkInTime: draft.checkInTime,
        checkOutTime: draft.checkOutTime,
      },
      nights,
      total,
      money,
      formatFeatures,
    );

    return buildContractHTML(
      settings?.adminSettings ?? {},
      settings?.bankAccounts ?? [],
      selectedBankIds,
      settings?.clauses ?? [],
      fincaData,
      {
        chargeLabels: {
          precioAseoFinal:
            Number(draft.cleaningFee) > 0 ? money(Number(draft.cleaningFee)) : undefined,
          depositoGarantia:
            Number(draft.refundableDeposit) > 0
              ? money(Number(draft.refundableDeposit))
              : undefined,
        },
        manillaCondominioCop: Number(draft.manillaCondominio) || 0,
        otherChargesCop: Number(draft.otherCharges) || 0,
        formatCop: money,
      },
    );
  }, [finca, draft, settings, selectedBankIds]);

  const pdfName = `contrato-${draft.contractCode || 'fincasya'}.pdf`;

  /** PDF del HTML tal como quedó editado en la hoja. */
  async function makePdfBlob(): Promise<Blob> {
    const edited = rootRef.current?.innerHTML ?? html;
    if (!edited.trim()) throw new Error('El contrato está vacío.');
    const res = await fetch('/api/fincas/contract-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: edited, filename: pdfName }),
    });
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(e.error || 'No se pudo generar el PDF.');
    }
    return res.blob();
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await makePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('PDF generado y descargado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!conversation) {
      toast.error('Abre la conversación del cliente para enviar.');
      return;
    }
    setSending(true);
    try {
      // 1) PDF del HTML editado.
      const blob = await makePdfBlob();
      // 2) Subir a S3 (link público que WhatsApp puede descargar).
      const fd = new FormData();
      fd.append('file', new File([blob], pdfName, { type: 'application/pdf' }));
      fd.append('folder', 'documents');
      const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const upData = (await up.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!up.ok || !upData.url) {
        throw new Error(upData.error || 'No se pudo subir el PDF.');
      }
      // 3) Enviarlo al chat por WhatsApp.
      const result = await sendDocument({
        conversationId: conversation.conversationId,
        documentUrl: upData.url,
        filename: pdfName,
        caption: `Contrato ${draft.contractCode || ''}`.trim(),
      });
      if (!result.ok) throw new Error(result.error || 'No se pudo enviar.');
      toast.success(`Contrato enviado a ${conversation.name || conversation.phone}.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Vista previa del contrato</h2>
            <p className="text-[11px] text-muted-foreground">
              Editable como Word — corrige lo que necesites antes de enviar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-muted/40 p-4">
          {!finca ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="contract-document-preview mx-auto">
              <style dangerouslySetInnerHTML={{ __html: CONTRACT_DOCUMENT_CSS }} />
              <article className="contract-document-page">
                <header className="contract-document-header">
                  <Image
                    src={CONTRACT_LOGO_SRC}
                    alt="FincasYa"
                    width={CONTRACT_LOGO_WIDTH}
                    height={CONTRACT_LOGO_HEIGHT}
                    priority
                    unoptimized
                    className="contract-document-logo"
                  />
                </header>
                <div
                  ref={rootRef}
                  className="contract-doc-root"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </article>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={busy || !finca}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || busy || !finca || !conversation}
            title={
              conversation
                ? `Enviar a ${conversation.name || conversation.phone}`
                : 'Abre una conversación para enviar'
            }
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar por WhatsApp
          </button>
        </footer>
      </div>
    </div>
  );
}
