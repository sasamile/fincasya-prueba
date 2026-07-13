'use client';

/**
 * Herramienta "Check-ins" del rail: lista reservas sin check-in y, cuando hay
 * chat abierto, muestra el resumen de la reserva vinculada y acciones para
 * enviar el mensaje de check-in.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { toast } from 'sonner';
import {
  CalendarRange,
  Check,
  CheckCircle2,
  Copy,
  DoorOpen,
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationRow } from '@/features/inbox/types';
import {
  buildCheckinPortalUrl,
  buildSimpleCheckinInviteMessage,
  computeReservationBreakdownLines,
  fetchCheckinShareMessage,
  openWhatsAppWithMessage,
} from '@/features/admin/utils/payment-whatsapp-message';

type Booking = {
  _id: string;
  reference?: string | null;
  nombreCompleto?: string;
  celular?: string;
  horaEntrada?: string;
  fechaEntrada: number;
  fechaSalida: number;
  precioTotal?: number;
  numeroPersonas?: number;
  status?: string;
  paymentStatus?: string;
  checkinCompleted?: boolean;
  checkinSentManualAt?: number;
  subtotal?: number;
  depositoAseo?: number;
  depositoGarantia?: number;
  costoMascotas?: number;
  costoPersonalServicio?: number;
  discountAmount?: number;
  economicAdjustments?: unknown;
  property?: { title?: string } | null;
};

function digits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function phonesMatch(a: string, b: string) {
  const d1 = digits(a);
  const d2 = digits(b);
  if (d1.length < 7 || d2.length < 7) return false;
  return d1.endsWith(d2.slice(-10)) || d2.endsWith(d1.slice(-10));
}

function dayLabel(ms: number): { label: string; urgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: 'En curso', urgent: true };
  if (diff === 0) return { label: 'Hoy', urgent: true };
  if (diff === 1) return { label: 'Mañana', urgent: true };
  return { label: `En ${diff} días`, urgent: diff <= 3 };
}

function money(n?: number) {
  if (!n) return '—';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function fmtShort(ms: number) {
  return new Date(ms).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  });
}

export function CheckinTool({
  conversation,
  onOpenChat,
}: {
  conversation: ConversationRow | null;
  onOpenChat?: (phone: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'copy' | null>(null);
  const [copied, setCopied] = useState(false);

  const sendMessage = useMutation(api.inbox.sendAdvisorMessage);

  const data = useQuery(api.bookings.list, { limit: 500 }) as
    | { bookings: Booking[] }
    | undefined;

  const pending = useMemo(() => {
    const now = Date.now();
    return (data?.bookings ?? [])
      .filter(
        (b) =>
          b.status !== 'CANCELLED' &&
          !b.checkinCompleted &&
          b.fechaSalida >= now,
      )
      .sort((a, b) => a.fechaEntrada - b.fechaEntrada)
      .slice(0, 40);
  }, [data]);

  const chatMatches = useMemo(() => {
    if (!conversation?.phone) return [];
    return pending.filter(
      (b) => b.celular && phonesMatch(conversation.phone, b.celular),
    );
  }, [pending, conversation?.phone]);

  const selectedBooking = useMemo(() => {
    if (selectedId) {
      return pending.find((b) => b._id === selectedId) ?? null;
    }
    if (chatMatches.length >= 1) return chatMatches[0];
    return null;
  }, [selectedId, pending, chatMatches]);

  useEffect(() => {
    if (!conversation) {
      setSelectedId(null);
      return;
    }
    if (chatMatches.length === 1) {
      setSelectedId(chatMatches[0]._id);
    } else if (
      chatMatches.length > 1 &&
      (!selectedId || !chatMatches.some((b) => b._id === selectedId))
    ) {
      setSelectedId(chatMatches[0]._id);
    }
  }, [conversation?.conversationId, chatMatches, selectedId]);

  const resolveMessage = useCallback(async (booking: Booking) => {
    const ref = (booking.reference || booking._id).trim();
    const checkInDate = booking.fechaEntrada
      ? new Intl.DateTimeFormat('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Bogota',
        }).format(new Date(booking.fechaEntrada))
      : undefined;

    const rich = await fetchCheckinShareMessage({
      bookingId: booking._id,
      reference: ref,
      clientName: booking.nombreCompleto,
      propertyName: booking.property?.title,
      checkInDate,
      breakdown: computeReservationBreakdownLines(booking),
      total: booking.precioTotal,
    });
    return rich || buildSimpleCheckinInviteMessage(booking);
  }, []);

  const chatMatchesSelected =
    Boolean(conversation) &&
    Boolean(selectedBooking?.celular) &&
    phonesMatch(conversation!.phone, selectedBooking!.celular!);

  async function handleCopy() {
    if (!selectedBooking) return;
    setBusy('copy');
    try {
      const text = await resolveMessage(selectedBooking);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Mensaje de check-in copiado');
    } catch {
      toast.error('No se pudo copiar el mensaje.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSendInChat() {
    if (!conversation || !selectedBooking) return;
    if (!chatMatchesSelected) {
      toast.error('El chat abierto no coincide con el celular de esta reserva.');
      return;
    }
    setBusy('send');
    try {
      const text = await resolveMessage(selectedBooking);
      await sendMessage({
        conversationId: conversation.conversationId,
        content: text,
      });
      toast.success('Mensaje de check-in enviado en el chat');
    } catch {
      toast.error('No se pudo enviar el mensaje.');
    } finally {
      setBusy(null);
    }
  }

  function handleOpenLink() {
    if (!selectedBooking) return;
    const ref = (selectedBooking.reference || selectedBooking._id).trim();
    window.open(buildCheckinPortalUrl(ref), '_blank', 'noopener,noreferrer');
  }

  async function handleWhatsApp() {
    if (!selectedBooking) return;
    const text = await resolveMessage(selectedBooking);
    openWhatsAppWithMessage(text, selectedBooking.celular ?? conversation?.phone);
  }

  function selectBooking(b: Booking) {
    setSelectedId(b._id);
    if (b.celular) onOpenChat?.(b.celular);
  }

  return (
    <>
      {/* Resumen de la reserva seleccionada / del chat */}
      {conversation ? (
        <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" /> Reserva de este chat
          </h3>

          {!selectedBooking ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              Este contacto no tiene un check-in pendiente. Elige una reserva de
              la lista para ver el resumen y enviar el mensaje.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {selectedBooking.nombreCompleto || 'Sin nombre'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedBooking.property?.title ?? 'Sin finca'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                      dayLabel(selectedBooking.fechaEntrada).urgent
                        ? 'bg-orange-500/15 text-orange-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {dayLabel(selectedBooking.fechaEntrada).label}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Entrada</dt>
                    <dd className="font-semibold">
                      {fmtShort(selectedBooking.fechaEntrada)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Salida</dt>
                    <dd className="font-semibold">
                      {fmtShort(selectedBooking.fechaSalida)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Huéspedes</dt>
                    <dd className="flex items-center gap-1 font-semibold">
                      <Users className="h-3 w-3" />
                      {selectedBooking.numeroPersonas ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-semibold">
                      {money(selectedBooking.precioTotal)}
                    </dd>
                  </div>
                </dl>

                {selectedBooking.checkinSentManualAt ? (
                  <p className="mt-2 text-[11px] font-medium text-emerald-600">
                    Check-in marcado como enviado
                  </p>
                ) : null}

                {!chatMatchesSelected ? (
                  <p className="mt-2 text-[11px] text-amber-600">
                    El número del chat no coincide con el de esta reserva. Abre
                    el chat del huésped o selecciona la reserva correcta.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!chatMatchesSelected || busy === 'send'}
                  onClick={() => void handleSendInChat()}
                  className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy === 'send' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar en este chat
                </button>
                <button
                  type="button"
                  disabled={busy === 'copy'}
                  onClick={() => void handleCopy()}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold transition hover:bg-muted"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copiar mensaje
                </button>
                <button
                  type="button"
                  onClick={() => void handleWhatsApp()}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold transition hover:bg-muted"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleOpenLink}
                  className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold transition hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir portal de check-in
                </button>
              </div>

              {chatMatches.length > 1 ? (
                <p className="text-[11px] text-muted-foreground">
                  Este contacto tiene {chatMatches.length} reservas pendientes.
                  Elige otra en la lista de abajo.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Abre un chat a la derecha o toca una reserva para ver el resumen y
          enviar el mensaje de check-in.
        </section>
      )}

      {/* Lista de pendientes */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <DoorOpen className="h-3.5 w-3.5" /> Check-ins pendientes ·{' '}
          {pending.length}
        </h3>
        {data === undefined ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <p className="text-xs text-muted-foreground">
              Todas las reservas próximas tienen su check-in al día. 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pending.map((b) => {
              const d = dayLabel(b.fechaEntrada);
              const isSelected = selectedBooking?._id === b._id;
              const matchesChat =
                conversation?.phone &&
                b.celular &&
                phonesMatch(conversation.phone, b.celular);
              return (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => selectBooking(b)}
                  title={
                    b.celular
                      ? 'Ver resumen y abrir chat del huésped'
                      : 'La reserva no tiene celular'
                  }
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                      d.urgent
                        ? 'bg-orange-500/15 text-orange-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {d.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {b.nombreCompleto || 'Sin nombre'}
                      {matchesChat ? (
                        <span className="ml-1 text-[10px] font-bold text-primary">
                          · este chat
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {b.property?.title ?? ''} · {fmtShort(b.fechaEntrada)}
                      {b.checkinSentManualAt ? ' · check-in enviado' : ''}
                    </p>
                  </div>
                  <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
