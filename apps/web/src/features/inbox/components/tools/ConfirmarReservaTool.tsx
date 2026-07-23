'use client';

/**
 * Herramienta "Confirmar reserva" del rail: busca el contrato por su código
 * (ej. CR 2041), muestra el resumen y envía al chat la confirmación oficial
 * (mensaje + PDF de confirmación si el contrato lo tiene).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Search,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';
import type { ConversationRow } from '@/features/inbox/types';
import { carpetaDeContrato } from '@/lib/contract-folder';
import { CopMoneyInput } from '@/features/admin/components/contracts/cop-money-input';

type Contract = {
  _id: Id<'contracts'>;
  contractNumber: string;
  propertyTitle?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  valorTotal?: number;
  fechaEntrada?: string;
  fechaSalida?: string;
  estado: string;
  confirmationPdfUrl?: string;
  confirmationPdfFilename?: string;
  clienteCedula?: string;
  clienteEmail?: string;
  clienteDireccion?: string;
  propertyLocation?: string;
  draftJson?: string;
};

/** Datos de la estadía guardados con el contrato (para armar el CR). */
type DraftEstadia = {
  guests?: string;
  nights?: number;
  pricePerNight?: string;
  checkInTime?: string;
  checkOutTime?: string;
  cleaningFee?: string;
  refundableDeposit?: string;
  petCount?: string;
  petDeposit?: string;
};

/** Métodos de pago del CR (la X va en la columna elegida). */
const METODOS_PAGO = [
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'bbva', label: 'BBVA' },
  { value: 'davivienda', label: 'Davivienda' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'pse', label: 'PSE' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
] as const;

const GRUPO_DEFECTO = 'Descanso familiar';

/** YYYY-MM-DD de hoy, hora local. */
function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function parseDraft(draftJson?: string): DraftEstadia {
  if (!draftJson?.trim()) return {};
  try {
    const parsed = JSON.parse(draftJson) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as DraftEstadia) : {};
  } catch {
    return {};
  }
}

/** "1.200.000" → 1200000 */
function parseCop(raw: string): number {
  const n = Number((raw || '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function digits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function phonesMatch(a?: string | null, b?: string | null) {
  const d1 = digits(a ?? '');
  const d2 = digits(b ?? '');
  if (d1.length < 7 || d2.length < 7) return false;
  return d1.endsWith(d2.slice(-10)) || d2.endsWith(d1.slice(-10));
}

function money(n?: number) {
  if (!n) return null;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

/** Mensaje oficial de confirmación (tuteo + emojis del equipo). */
function buildConfirmationMessage(
  c: Contract,
  abono?: number,
  checkinUrl?: string,
): string {
  const lines: string[] = ['🎉 ¡Tu reserva está confirmada! ✅', ''];
  lines.push(`📄 Código de confirmación: *${c.contractNumber}*`);
  if (c.propertyTitle) lines.push(`🏡 Finca: ${c.propertyTitle}`);
  if (c.fechaEntrada && c.fechaSalida) {
    lines.push(`📅 Entrada: ${c.fechaEntrada} · Salida: ${c.fechaSalida}`);
  }
  const total = money(c.valorTotal);
  if (total) lines.push(`💰 Valor total: ${total}`);
  if (abono && abono > 0) {
    lines.push(`✅ Abono recibido: ${money(abono)}`);
    const saldo = Math.max((c.valorTotal ?? 0) - abono, 0);
    if (saldo > 0) lines.push(`🧾 Saldo pendiente: ${money(saldo)}`);
  }
  lines.push('');
  if (c.confirmationPdfUrl) {
    lines.push('Adjunto encontrarás tu documento de confirmación 📎');
  }
  // Link de check-in: el cliente registra a sus acompañantes antes de llegar.
  if (checkinUrl) {
    lines.push(
      `👉 Ya puedes hacer tu *check-in* y registrar a tus invitados aquí:\n${checkinUrl}`,
    );
    lines.push('');
  }
  lines.push(
    'Guarda este código para tu check-in y cualquier consulta. ¡Gracias por reservar con *FincasYa.com*! 💚',
  );
  return lines.join('\n');
}

export function ConfirmarReservaTool({
  conversation,
  onOpenChat,
}: {
  conversation: ConversationRow | null;
  onOpenChat?: (phone: string) => void | Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [selectedId, setSelectedId] = useState<Id<'contracts'> | null>(null);
  const [sending, setSending] = useState(false);
  // Campos editables del CR antes de generar (Adriana, 22-jul).
  const [abonoRaw, setAbonoRaw] = useState('');
  const [fechaAbono, setFechaAbono] = useState(hoyIso());
  const [fechaSaldo, setFechaSaldo] = useState('');
  const [metodoPago, setMetodoPago] = useState<string>('bancolombia');
  const [tipoGrupo, setTipoGrupo] = useState(GRUPO_DEFECTO);
  /** Modal a pantalla completa: 'edit' (ajustar números) o 'preview' (ver PDF). */
  const [modal, setModal] = useState<null | 'edit' | 'preview'>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewBlobRef = useRef<{ blob: Blob; filename: string } | null>(null);

  const sendMessage = useMutation(api.inbox.sendAdvisorMessage);
  const sendDocument = useMutation(api.inbox.sendAdvisorDocumentByUrl);
  const registerDocument = useMutation(api.contractDocuments.registerDocument);
  const crearReserva = useMutation(api.bookings.createFromConfirmation);
  // Actor logueado — viaja en las mutaciones para el historial de atención.
  const { data: session } = authClient.useSession();
  const actorId = session?.user?.id ? String(session.user.id) : undefined;
  const actorName = session?.user?.name ?? undefined;

  const trimmed = code.trim();
  const results = useQuery(
    api.contracts.list,
    trimmed.length >= 2 ? { search: trimmed, limit: 6 } : 'skip',
  ) as { items: Contract[] } | undefined;

  const matches = results?.items ?? [];
  const selected = useMemo(() => {
    if (selectedId) return matches.find((c) => c._id === selectedId) ?? null;
    if (matches.length === 1) return matches[0];
    return null;
  }, [selectedId, matches]);

  const chatMatchesSelected =
    Boolean(conversation) &&
    Boolean(selected?.clienteTelefono) &&
    phonesMatch(conversation!.phone, selected!.clienteTelefono);

  // Sin teléfono en el contrato no podemos validar: se permite enviar al chat
  // abierto, con aviso.
  const canSend =
    Boolean(conversation && selected) &&
    (chatMatchesSelected || !selected?.clienteTelefono);

  /**
   * VALOR ALQUILER = lo que cuesta la estadía sin aseo ni depósito. Antes salía
   * $0 porque no se enviaba (Adriana, 22-jul). Se toma del precio por noche ×
   * noches; si no está, se deduce del total (total − aseo − depósito).
   */
  const rentAmount = useMemo(() => {
    if (!selected) return 0;
    const draft = parseDraft(selected.draftJson);
    const total = selected.valorTotal ?? 0;
    const cleaning = parseCop(draft.cleaningFee ?? '');
    const deposit = parseCop(draft.refundableDeposit ?? '');
    const porNoche = parseCop(draft.pricePerNight ?? '');
    const noches = Number(draft.nights) || 0;
    if (porNoche > 0 && noches > 0) return porNoche * noches;
    return Math.max(total - cleaning - deposit, 0);
  }, [selected]);

  /**
   * Genera el PDF de la confirmación con TODOS los campos editables (SIN
   * subirlo). Se usa para la vista previa: el asesor lo revisa antes de enviar.
   */
  async function generarBlob(
    c: Contract,
  ): Promise<{ blob: Blob; filename: string }> {
    const draft = parseDraft(c.draftJson);
    const total = c.valorTotal ?? 0;
    const abono = parseCop(abonoRaw);
    const { inboxService } = await import('@/features/inbox/api/inbox.api');
    return inboxService.generateReservationConfirmationPreview(
      conversation?.conversationId ?? '',
      {
        contractNumber: c.contractNumber,
        clientName: c.clienteNombre,
        clientId: c.clienteCedula,
        clientEmail: c.clienteEmail,
        clientPhone: c.clienteTelefono,
        clientAddress: c.clienteDireccion,
        propertyName: c.propertyTitle,
        propertyLocation: c.propertyLocation,
        checkInDate: c.fechaEntrada,
        checkOutDate: c.fechaSalida,
        checkInTime: draft.checkInTime || '10:00 AM',
        checkOutTime: draft.checkOutTime || '04:00 PM',
        guests: Number(draft.guests) || undefined,
        nights: Number(draft.nights) || undefined,
        precioTotal: total,
        rentAmount: rentAmount || undefined,
        cleaningFee: parseCop(draft.cleaningFee ?? '') || undefined,
        refundableDeposit: parseCop(draft.refundableDeposit ?? '') || undefined,
        petCount: Number(draft.petCount) || undefined,
        depositoMascotas: parseCop(draft.petDeposit ?? '') || undefined,
        depositAmount: abono || undefined,
        depositDate: fechaAbono || undefined,
        balanceAmount: Math.max(total - abono, 0) || undefined,
        balanceDate: fechaSaldo || undefined,
        paymentMethod: metodoPago,
        groupType: tipoGrupo.trim() || GRUPO_DEFECTO,
        paymentStatus: abono >= total && total > 0 ? 'paid' : 'pending',
      },
    );
  }

  /** Sube a la carpeta del contrato el blob YA revisado en la vista previa. */
  async function subirBlob(
    c: Contract,
    blob: Blob,
    filename: string,
  ): Promise<string | null> {
    const fd = new FormData();
    fd.append('file', new File([blob], filename, { type: 'application/pdf' }));
    fd.append('folder', 'documents');
    fd.append(
      'subpath',
      `${carpetaDeContrato(c.contractNumber)}/confirmaciones`,
    );
    const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const upData = (await up.json().catch(() => ({}))) as { url?: string };
    if (!up.ok || !upData.url) return null;
    return upData.url;
  }

  function limpiarPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    previewBlobRef.current = null;
  }

  /** Regenera el PDF con los campos actuales y salta a la vista previa. */
  async function verConfirmacion() {
    if (!selected) return;
    setPreviewing(true);
    try {
      const { blob, filename } = await generarBlob(selected);
      previewBlobRef.current = { blob, filename };
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setModal('preview');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo generar la vista previa.',
      );
    } finally {
      setPreviewing(false);
    }
  }

  /** Abre el modal para AJUSTAR los números (no genera nada aún). */
  function abrirEditor() {
    limpiarPreview();
    setModal('edit');
  }

  function cerrarModal() {
    limpiarPreview();
    setModal(null);
  }

  async function handleSend() {
    if (!conversation || !selected) return;
    setSending(true);
    try {
      const abono = parseCop(abonoRaw);

      // Si el contrato ya trae CR hecho, se usa ese. Si no, se envía EL MISMO
      // PDF que el asesor aprobó en la vista previa (o se genera si no lo vio).
      let pdfUrl = selected.confirmationPdfUrl;
      let pdfName =
        selected.confirmationPdfFilename ??
        `Confirmacion-${selected.contractNumber.replace(/\s+/g, '-')}.pdf`;
      if (!pdfUrl) {
        const revisado =
          previewBlobRef.current ?? (await generarBlob(selected));
        pdfName = revisado.filename;
        const url = await subirBlob(selected, revisado.blob, revisado.filename);
        if (url) pdfUrl = url;
      }

      // Crea la RESERVA en el calendario (bloquea la finca esas fechas) y arma
      // el link de check-in. Idempotente: reenviar no duplica la reserva.
      let checkinUrl: string | undefined;
      const reserva = await crearReserva({
        contractNumber: selected.contractNumber,
        montoAbonado: abono || undefined,
      });
      if (reserva.ok && reserva.reference) {
        checkinUrl = `${window.location.origin}/checkin/${encodeURIComponent(reserva.reference)}`;
      } else if (reserva.error) {
        // No frena el envío: la confirmación sale, pero se avisa del problema.
        toast.warning(`Confirmación enviada, pero la reserva no se creó: ${reserva.error}`);
      }

      await sendMessage({
        conversationId: conversation.conversationId,
        content: buildConfirmationMessage(selected, abono, checkinUrl),
        actorId,
        actorName,
      });
      if (pdfUrl) {
        await sendDocument({
          conversationId: conversation.conversationId,
          documentUrl: pdfUrl,
          filename: pdfName,
          actorId,
          actorName,
        });
        // Queda archivada en la carpeta del contrato, con su abono.
        try {
          await registerDocument({
            contractNumber: selected.contractNumber,
            tipo: 'confirmacion',
            estado: 'enviado',
            url: pdfUrl,
            filename: pdfName,
            conversationId: conversation.conversationId,
            montoAbonado: abono || undefined,
          });
        } catch (err) {
          console.error('[inbox] no se pudo archivar la confirmación', err);
        }
      }
      toast.success(
        pdfUrl
          ? 'Confirmación enviada (mensaje + PDF) y archivada'
          : 'Confirmación enviada en el chat',
      );
      cerrarModal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo enviar la confirmación.',
      );
    } finally {
      setSending(false);
    }
  }

  // Si cambia cualquier campo del CR, la vista previa vieja ya no corresponde:
  // se descarta para no enviar un PDF que no coincide con lo que se ve.
  useEffect(() => {
    limpiarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abonoRaw, fechaAbono, fechaSaldo, metodoPago, tipoGrupo, selectedId]);

  // Suelta el objectURL del PDF al desmontar.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const abono = parseCop(abonoRaw);
  const totalSel = selected?.valorTotal ?? 0;

  return (
    <>
      {/* Modal centrado: editar los números (tarjeta chica) o ver el PDF (grande) */}
      {modal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className={cn(
              'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl',
              modal === 'preview' ? 'h-[90vh] max-w-4xl' : 'max-w-lg',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  Confirmación {selected.contractNumber}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {modal === 'edit'
                    ? 'Ajusta los datos antes de generar'
                    : 'Revísala antes de enviarla al cliente'}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal === 'preview' && previewUrl ? (
              <iframe
                src={previewUrl}
                title="Vista previa de la confirmación"
                className="flex-1 w-full bg-muted/40"
              />
            ) : (
              <div className="flex-1 overflow-auto p-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Valor abonado
                    </label>
                    <div className="mt-1">
                      <CopMoneyInput
                        value={abonoRaw}
                        onChange={setAbonoRaw}
                        placeholder="Ej. 1.200.000"
                        className="h-11 rounded-xl border-border bg-background text-sm"
                      />
                    </div>
                  </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Fecha de abono
                    </label>
                    <input
                      type="date"
                      value={fechaAbono}
                      onChange={(e) => setFechaAbono(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Fecha de saldo
                    </label>
                    <input
                      type="date"
                      value={fechaSaldo}
                      onChange={(e) => setFechaSaldo(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Método de pago
                    </label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                    >
                      {METODOS_PAGO.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Tipo de grupo
                    </label>
                    <input
                      value={tipoGrupo}
                      onChange={(e) => setTipoGrupo(e.target.value)}
                      placeholder={GRUPO_DEFECTO}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                    />
                  </div>
                </div>

                {/* Calculados: no se editan, se muestran para revisar */}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Valor alquiler</dt>
                    <dd className="font-bold">{money(rentAmount) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Valor total</dt>
                    <dd className="font-bold">{money(totalSel) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Abono</dt>
                    <dd className="font-bold">{money(abono) ?? '$0'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Saldo</dt>
                    <dd className="font-bold">
                      {money(Math.max(totalSel - abono, 0)) ?? '$0'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            {modal === 'preview' ? (
              <>
                <button
                  type="button"
                  onClick={abrirEditor}
                  disabled={sending}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-bold disabled:opacity-60"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !canSend}
                  className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar confirmación
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void verConfirmacion()}
                disabled={previewing}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {previewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Ver confirmación
              </button>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Buscador por código de contrato */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5" /> Código del contrato
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Ej. CR 2041"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {trimmed.length >= 2 && (
          <div className="mt-2 space-y-1.5">
            {results === undefined ? (
              <div className="grid place-items-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
                Ningún contrato coincide con “{trimmed}”.
              </p>
            ) : (
              matches.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c._id);
                    if (c.clienteTelefono) onOpenChat?.(c.clienteTelefono);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition',
                    selected?._id === c._id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {c.contractNumber}
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        {c.clienteNombre ?? 'Sin cliente'}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.propertyTitle ?? 'Sin finca'} · {c.estado}
                      {c.confirmationPdfUrl ? ' · PDF ✓' : ''}
                    </p>
                  </div>
                  <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {/* Resumen y envío */}
      {selected && (
        <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Confirmación a enviar
          </h3>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <p className="text-sm font-bold">{selected.contractNumber}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-semibold">
                  {selected.clienteNombre ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Finca</dt>
                <dd className="font-semibold">
                  {selected.propertyTitle ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entrada</dt>
                <dd className="font-semibold">{selected.fechaEntrada ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Salida</dt>
                <dd className="font-semibold">{selected.fechaSalida ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valor total</dt>
                <dd className="font-semibold">
                  {money(selected.valorTotal) ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">PDF confirmación</dt>
                <dd className="font-semibold text-emerald-600">
                  {selected.confirmationPdfUrl
                    ? 'Se adjunta'
                    : 'Se genera al enviar'}
                </dd>
              </div>
            </dl>

            {!conversation ? (
              <p className="mt-2 text-[11px] text-amber-600">
                Abre el chat del cliente para enviar la confirmación.
              </p>
            ) : selected.clienteTelefono && !chatMatchesSelected ? (
              <p className="mt-2 text-[11px] text-amber-600">
                El chat abierto no coincide con el celular del contrato (
                {selected.clienteTelefono}). Toca el contrato para abrir el chat
                correcto.
              </p>
            ) : !selected.clienteTelefono ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                El contrato no tiene celular registrado: se enviará al chat
                abierto.
              </p>
            ) : null}
          </div>

          {/* Si el CR se genera aquí, primero se ve; si ya viene hecho, se
              manda directo. */}
          {selected.confirmationPdfUrl ? (
            <button
              type="button"
              disabled={!canSend || sending}
              onClick={() => void handleSend()}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar confirmación en este chat
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSend}
              onClick={abrirEditor}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              Preparar y enviar confirmación
            </button>
          )}
        </section>
      )}

      {!selected && trimmed.length < 2 && (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Escribe el código del contrato (ej. CR 2041), revisa el resumen y
          envía la confirmación de reserva al chat del cliente.
        </section>
      )}
    </>
  );
}
