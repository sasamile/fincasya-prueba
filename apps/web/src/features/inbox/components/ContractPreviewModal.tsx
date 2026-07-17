'use client';

/**
 * Modal de contrato — abre la PLANTILLA real (QUINTA OLAYA .docx) en un editor
 * Word dentro del navegador (SuperDoc). El asesor puede editar el documento
 * como en Word manteniendo el formato/tipografía de la plantilla, y luego:
 *   - Descargarlo (Word o PDF)
 *   - Enviarlo por WhatsApp (se exporta el docx editado → PDF → se envía)
 * NO usa el HTML de la página de contratos.
 */
import { useEffect, useRef, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { toast } from 'sonner';
import { Download, FileWarning, Loader2, Send, X } from 'lucide-react';
import '@harbour-enterprises/superdoc/style.css';
import type { ConversationRow } from '@/features/inbox/types';
import { buildInboxContractUpsertArgs } from '@/features/inbox/utils/persist-inbox-contract';
import { toStoredCopLabel } from '@/features/admin/components/contracts/cop-money-input';

export type PreviewDraft = {
  fincaId: string;
  contractCode: string;
  pricePerNight: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  guests: string;
  extraGuests?: string;
  petCount: string;
  petDeposit?: string;
  petServiceFee?: string;
  petCleaningFee?: string;
  cleaningFee: string;
  refundableDeposit: string;
  extraPersonFee?: string;
  manillaCondominio: string;
  otherCharges: string;
  clientName: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientDocType?: string;
  clientCedula: string;
  clientDocIssuedAt?: string;
  clientPhone: string;
  clientEmail: string;
  clientCity: string;
  clientAddress: string;
};

const EDITOR_ID = 'superdoc-contract-editor';
const TOOLBAR_ID = 'superdoc-contract-toolbar';

// SuperDoc se carga dinámico (solo cliente); su API no está tipada aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperDocInstance = any;

export function ContractPreviewModal({
  draft,
  selectedBankIds,
  conversation,
  propertyTitle,
  propertyLocation,
  onClose,
}: {
  draft: PreviewDraft;
  selectedBankIds: string[];
  conversation: ConversationRow | null;
  propertyTitle?: string;
  propertyLocation?: string;
  onClose: () => void;
}) {
  const sendDocument = useAction(api.advisorDocuments.sendDocumentToConversation);
  const upsertContract = useMutation(api.contracts.upsert);
  const superdocRef = useRef<SuperDocInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'send' | 'pdf' | 'docx'>(null);
  const [baseName, setBaseName] = useState('contrato');

  const persistContract = async (
    estado: 'borrador' | 'enviado',
    extra?: { pdfUrl?: string; pdfFilename?: string },
  ) => {
    try {
      await upsertContract(
        buildInboxContractUpsertArgs(draft, {
          estado,
          conversationId: conversation?.conversationId,
          propertyTitle,
          propertyLocation,
          pdfUrl: extra?.pdfUrl,
          pdfFilename: extra?.pdfFilename,
        }),
      );
    } catch (err) {
      console.error('[inbox] no se pudo guardar el contrato en la lista', err);
    }
  };
  // 1) Genera el .docx desde la plantilla y 2) lo abre en el editor Word.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      setReady(false);
      try {
        const nights = (() => {
          const a = new Date(`${draft.checkIn}T12:00:00`).getTime();
          const b = new Date(`${draft.checkOut}T12:00:00`).getTime();
          return Number.isFinite(a) && Number.isFinite(b) && b > a
            ? Math.max(1, Math.round((b - a) / 86400000))
            : 1;
        })();
        const perNight = Number(draft.pricePerNight) || 0;

        // Pedimos el .docx y precargamos SuperDoc en paralelo.
        const modulesPromise = Promise.all([
          import('@harbour-enterprises/superdoc'),
          import('@superdoc-dev/fonts'),
        ]);

        const res = await fetch(
          `/api/fincas/${draft.fincaId}/direct-booking-contract`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              outputFormat: 'docx',
              propertyId: draft.fincaId,
              contractNumber: draft.contractCode,
              nightlyPrice: String(perNight),
              totalPrice: String(perNight * nights),
              clientName: String(draft.clientName || '').trim().toUpperCase(),
              clientFirstName: String(draft.clientFirstName || '').trim().toUpperCase(),
              clientLastName: String(draft.clientLastName || '').trim().toUpperCase(),
              clientId: draft.clientCedula,
              clientDocType: draft.clientDocType || 'CC',
              clientDocIssuedAt: draft.clientDocIssuedAt || '',
              clientEmail: draft.clientEmail,
              clientPhone: draft.clientPhone,
              clientCity: draft.clientCity,
              clientAddress: draft.clientAddress,
              checkInDate: draft.checkIn,
              checkOutDate: draft.checkOut,
              checkInTime: draft.checkInTime,
              checkOutTime: draft.checkOutTime,
              guests: Number(draft.guests) || 1,
              petCount: Number(draft.petCount) || 0,
              petDeposit: Number(draft.petDeposit) || 0,
              petSurcharge: Number(draft.petServiceFee) || 0,
              petCleaningFee: Number(draft.petCleaningFee) || 0,
              cleaningFee: Number(draft.cleaningFee) || 0,
              refundableDeposit: Number(draft.refundableDeposit) || 0,
              manillaCondominio: Number(draft.manillaCondominio) || 0,
              otherCharges: Number(draft.otherCharges) || 0,
              extraPersonFeeLabel: toStoredCopLabel(
                (() => {
                  const digits = String(draft.extraPersonFee || '').replace(
                    /\D/g,
                    '',
                  );
                  return !digits || digits === '50000' ? '120000' : digits;
                })(),
              ),
              bankAccountIds: selectedBankIds,
            }),
          },
        );
        const data = (await res.json()) as {
          fileBase64?: string;
          filename?: string;
          error?: string;
        };
        if (!res.ok || !data.fileBase64) {
          throw new Error(data.error || 'No se pudo generar el contrato.');
        }
        if (cancelled) return;

        const filename = data.filename || 'contrato.docx';
        setBaseName(filename.replace(/\.docx$/i, ''));
        void persistContract('borrador');

        const [{ SuperDoc }, fontsMod] = await modulesPromise;
        if (cancelled) return;
        setLoading(false);

        const bytes = Uint8Array.from(atob(data.fileBase64), (c) =>
          c.charCodeAt(0),
        );
        const file = new File([bytes], filename, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const fonts = fontsMod.createSuperDocFonts();
        (fonts as { resolveAssetUrl?: (c: { file: string }) => string }).resolveAssetUrl =
          (c) => `/superdoc-fonts/${c.file}`;

        const instance = new SuperDoc({
          selector: `#${EDITOR_ID}`,
          toolbar: `#${TOOLBAR_ID}`,
          documentMode: 'editing',
          fonts,
          documents: [{ id: 'contract', type: 'docx', data: file }],
          onReady: () => {
            if (!cancelled) setReady(true);
          },
        });
        superdocRef.current = instance;
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
          setError(e instanceof Error ? e.message : 'Error al generar.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      try {
        superdocRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      superdocRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedBankIds]);

  /** Exporta el docx editado del editor como Blob. */
  async function exportEditedDocx(): Promise<Blob> {
    const sd = superdocRef.current;
    if (!sd) throw new Error('El editor no está listo.');
    const blob = await sd.export({ exportType: ['docx'], exportedName: baseName });
    if (!(blob instanceof Blob)) throw new Error('No se pudo exportar el Word.');
    return blob;
  }

  async function handleDownloadDocx() {
    if (!ready) return;
    setBusy('docx');
    try {
      const blob = await exportEditedDocx();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success('Word descargado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar.');
    } finally {
      setBusy(null);
    }
  }

  /** Exporta docx editado → PDF (servidor). Devuelve {base64, filename}. */
  async function exportEditedPdf(): Promise<{ base64: string; filename: string }> {
    const docxBlob = await exportEditedDocx();
    const fd = new FormData();
    fd.append('file', new File([docxBlob], `${baseName}.docx`, { type: docxBlob.type }));
    const res = await fetch('/api/fincas/contract-docx-to-pdf', {
      method: 'POST',
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as {
      fileBase64?: string;
      filename?: string;
      error?: string;
    };
    if (!res.ok || !data.fileBase64) {
      throw new Error(data.error || 'No se pudo convertir a PDF.');
    }
    return { base64: data.fileBase64, filename: data.filename || `${baseName}.pdf` };
  }

  async function handleDownloadPdf() {
    if (!ready) return;
    setBusy('pdf');
    try {
      const { base64, filename } = await exportEditedPdf();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: 'application/pdf' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar PDF.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!ready) return;
    if (!conversation) {
      toast.error('Abre la conversación del cliente para enviar.');
      return;
    }
    setBusy('send');
    try {
      // Exportar lo EDITADO → PDF → subir a S3 → enviar por WhatsApp.
      const { base64, filename } = await exportEditedPdf();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append('file', new File([bytes], filename, { type: 'application/pdf' }));
      fd.append('folder', 'documents');
      const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const upData = (await up.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!up.ok || !upData.url) {
        throw new Error(upData.error || 'No se pudo subir el documento.');
      }
      const result = await sendDocument({
        conversationId: conversation.conversationId,
        documentUrl: upData.url,
        filename,
        caption: `Contrato ${draft.contractCode || ''}`.trim(),
      });
      if (!result.ok) throw new Error(result.error || 'No se pudo enviar.');
      await persistContract('enviado', {
        pdfUrl: upData.url,
        pdfFilename: filename,
      });
      toast.success(
        `Contrato enviado a ${conversation.name || conversation.phone}.`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Contrato · editor Word</h2>
            <p className="text-[11px] text-muted-foreground">
              Plantilla oficial (QUINTA OLAYA) · edítala como en Word y envíala.
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

        {/* Barra de herramientas del editor Word (la llena SuperDoc) */}
        <div
          id={TOOLBAR_ID}
          className="shrink-0 overflow-x-auto border-b border-border bg-background"
        />

        <div className="relative flex-1 overflow-auto bg-muted/40">
          {/* Contenedor del editor Word (SuperDoc) */}
          <div id={EDITOR_ID} className="min-h-full" />

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Abriendo el contrato en el editor Word…
              </p>
            </div>
          )}
          {!loading && !ready && !error && (
            <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-background/70 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Cargando el documento…
              </span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <FileWarning className="h-7 w-7 text-destructive" />
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => void handleDownloadDocx()}
            disabled={!ready || busy !== null}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {busy === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Word
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={!ready || busy !== null}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {busy === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!ready || busy !== null || !conversation}
            title={
              conversation
                ? `Enviar a ${conversation.name || conversation.phone}`
                : 'Abre una conversación para enviar'
            }
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy === 'send' ? (
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
