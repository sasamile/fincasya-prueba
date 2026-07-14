'use client';

/**
 * Herramienta "Check-ins" del rail: mensajes al huésped o al propietario
 * (portal /anfitrion), con listas de quién falta.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { toast } from 'sonner';
import {
  Building2,
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
import { Switch } from '@/components/ui/switch';
import type { ConversationRow } from '@/features/inbox/types';
import {
  buildCheckinPortalUrl,
  buildSimpleCheckinInviteMessage,
  computeReservationBreakdownLines,
  fetchCheckinShareMessage,
  openWhatsAppWithMessage,
} from '@/features/admin/utils/payment-whatsapp-message';
import {
  buildOwnerWhatsAppMessage,
  toWhatsAppPhone,
} from '@/features/admin/utils/owner-whatsapp-message';
import { AdminGuestListEditor } from '@/features/admin/components/reservations/admin-guest-list-editor';

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
  numeroMascotas?: number;
  status?: string;
  paymentStatus?: string;
  checkinCompleted?: boolean;
  checkinSentManualAt?: number;
  ownerPortalSentAt?: number;
  guestListUnlocked?: boolean;
  checkinNeedsEmpleada?: boolean;
  checkinNeedsTeam?: boolean;
  checkinServiciosNota?: string | null;
  checkinObservaciones?: string | null;
  checkinMascotas?: number;
  checkinGuests?: unknown[];
  clientPaymentProofUploadEnabled?: boolean;
  ownerPortalShare?: { showGuestList?: boolean };
  ownerPayout?: {
    valorAcordado?: number;
    abono?: number;
    abonos?: Array<{ amount?: number }>;
  };
  subtotal?: number;
  depositoAseo?: number;
  depositoGarantia?: number;
  costoMascotas?: number;
  costoPersonalServicio?: number;
  discountAmount?: number;
  economicAdjustments?: unknown;
  property?: {
    title?: string;
    requiresGuestList?: boolean | null;
    propietarioNombre?: string | null;
    propietarioTelefono?: string | null;
    propietarioTratamiento?: string | null;
  } | null;
};

type Audience = 'guest' | 'owner';

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

function ownerPhoneOf(b: Booking) {
  return b.property?.propietarioTelefono?.trim() || '';
}

function abonoPropietarioOf(b: Booking) {
  const op = b.ownerPayout ?? {};
  const fromList = (op.abonos ?? []).reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0,
  );
  return fromList > 0 ? fromList : Number((op as { abono?: number }).abono || 0);
}

export function CheckinTool({
  conversation,
  onOpenChat,
}: {
  conversation: ConversationRow | null;
  onOpenChat?: (phone: string) => void | Promise<void>;
}) {
  const [audience, setAudience] = useState<Audience>('guest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'copy' | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [savingUnlock, setSavingUnlock] = useState(false);
  const [savingProofUpload, setSavingProofUpload] = useState(false);

  const sendMessage = useMutation(api.inbox.sendAdvisorMessage);
  const markOwnerSent = useMutation(api.bookings.markOwnerPortalSent);
  const markCheckinSent = useMutation(api.bookings.markCheckinSent);
  const saveOwnerPortalShare = useMutation(api.bookings.saveOwnerPortalShare);
  const setGuestListUnlocked = useMutation(api.bookings.setGuestListUnlocked);
  const setClientPaymentProofUpload = useMutation(
    api.bookings.setClientPaymentProofUpload,
  );

  const data = useQuery(api.bookings.list, { limit: 500 }) as
    | { bookings: Booking[] }
    | undefined;

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (data?.bookings ?? [])
      .filter((b) => b.status !== 'CANCELLED' && b.fechaSalida >= now)
      .sort((a, b) => a.fechaEntrada - b.fechaEntrada);
  }, [data]);

  const pendingGuests = useMemo(
    () => upcoming.filter((b) => !b.checkinCompleted).slice(0, 40),
    [upcoming],
  );

  /** Propietarios a notificar: próxima llegada y aún sin marcar envío del link. */
  const pendingOwners = useMemo(
    () =>
      upcoming
        .filter((b) => ownerPhoneOf(b) && !b.ownerPortalSentAt)
        .slice(0, 40),
    [upcoming],
  );

  const list = audience === 'guest' ? pendingGuests : pendingOwners;

  const chatMatches = useMemo(() => {
    if (!conversation?.phone) return [];
    if (audience === 'guest') {
      return pendingGuests.filter(
        (b) => b.celular && phonesMatch(conversation.phone, b.celular),
      );
    }
    return pendingOwners.filter((b) =>
      phonesMatch(conversation.phone, ownerPhoneOf(b)),
    );
  }, [audience, pendingGuests, pendingOwners, conversation?.phone]);

  const selectedBooking = useMemo(() => {
    if (selectedId) {
      return (
        list.find((b) => b._id === selectedId) ??
        upcoming.find((b) => b._id === selectedId) ??
        null
      );
    }
    if (chatMatches.length >= 1) return chatMatches[0];
    return null;
  }, [selectedId, list, upcoming, chatMatches]);

  useEffect(() => {
    setSelectedId(null);
  }, [audience]);

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
  }, [conversation?.conversationId, chatMatches, selectedId, audience]);

  const resolveGuestMessage = useCallback(async (booking: Booking) => {
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

  const resolveOwnerMessage = useCallback((booking: Booking) => {
    const ref = (booking.reference || booking._id).trim();
    return buildOwnerWhatsAppMessage({
      reference: ref,
      propertyTitle: booking.property?.title || 'tu finca',
      propietarioNombre: booking.property?.propietarioNombre,
      propietarioTratamiento: booking.property?.propietarioTratamiento,
      fechaEntrada: booking.fechaEntrada,
      fechaSalida: booking.fechaSalida,
      horaEntrada: booking.horaEntrada,
      numeroPersonas: booking.numeroPersonas ?? 0,
      valorAcordado: Number(booking.ownerPayout?.valorAcordado || 0),
      abonoPropietario: abonoPropietarioOf(booking),
      checkinCompleted: booking.checkinCompleted,
      checkinNeedsEmpleada: booking.checkinNeedsEmpleada,
      checkinNeedsTeam: booking.checkinNeedsTeam,
      checkinServiciosNota: booking.checkinServiciosNota,
      checkinObservaciones: booking.checkinObservaciones,
      checkinMascotas:
        booking.checkinMascotas ?? booking.numeroMascotas ?? 0,
      requiresGuestList: booking.property?.requiresGuestList !== false,
      showGuestListToOwner: booking.ownerPortalShare?.showGuestList !== false,
      appBaseUrl:
        typeof window !== 'undefined' ? window.location.origin : undefined,
    });
  }, []);

  const chatMatchesSelected = useMemo(() => {
    if (!conversation || !selectedBooking) return false;
    if (audience === 'guest') {
      return Boolean(
        selectedBooking.celular &&
          phonesMatch(conversation.phone, selectedBooking.celular),
      );
    }
    const ownerPhone = ownerPhoneOf(selectedBooking);
    return Boolean(ownerPhone && phonesMatch(conversation.phone, ownerPhone));
  }, [audience, conversation, selectedBooking]);

  async function handleCopy() {
    if (!selectedBooking) return;
    setBusy('copy');
    try {
      const text =
        audience === 'guest'
          ? await resolveGuestMessage(selectedBooking)
          : resolveOwnerMessage(selectedBooking);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(
        audience === 'guest'
          ? 'Mensaje de check-in copiado'
          : 'Mensaje al propietario copiado',
      );
    } catch {
      toast.error('No se pudo copiar el mensaje.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSendInChat() {
    if (!conversation || !selectedBooking) return;
    if (!chatMatchesSelected) {
      toast.error(
        audience === 'guest'
          ? 'El chat abierto no coincide con el celular de esta reserva.'
          : 'El chat abierto no coincide con el teléfono del propietario.',
      );
      return;
    }
    setBusy('send');
    try {
      const text =
        audience === 'guest'
          ? await resolveGuestMessage(selectedBooking)
          : resolveOwnerMessage(selectedBooking);
      await sendMessage({
        conversationId: conversation.conversationId,
        content: text,
      });
      if (audience === 'owner') {
        await markOwnerSent({
          id: selectedBooking._id as Id<'bookings'>,
          sent: true,
        });
      } else if (!selectedBooking.checkinSentManualAt) {
        await markCheckinSent({
          id: selectedBooking._id as Id<'bookings'>,
          sent: true,
        }).catch(() => undefined);
      }
      toast.success(
        audience === 'guest'
          ? 'Mensaje de check-in enviado en el chat'
          : 'Mensaje al propietario enviado',
      );
    } catch {
      toast.error('No se pudo enviar el mensaje.');
    } finally {
      setBusy(null);
    }
  }

  function handleOpenLink() {
    if (!selectedBooking) return;
    const ref = (selectedBooking.reference || selectedBooking._id).trim();
    const url =
      audience === 'guest'
        ? buildCheckinPortalUrl(ref)
        : `${typeof window !== 'undefined' ? window.location.origin : 'https://fincasya.com'}/anfitrion/${encodeURIComponent(ref)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleWhatsApp() {
    if (!selectedBooking) return;
    const text =
      audience === 'guest'
        ? await resolveGuestMessage(selectedBooking)
        : resolveOwnerMessage(selectedBooking);
    const phone =
      audience === 'guest'
        ? selectedBooking.celular ?? conversation?.phone
        : toWhatsAppPhone(ownerPhoneOf(selectedBooking)) ??
          conversation?.phone;
    openWhatsAppWithMessage(text, phone);
    if (audience === 'owner') {
      void markOwnerSent({
        id: selectedBooking._id as Id<'bookings'>,
        sent: true,
      }).catch(() => undefined);
    }
  }

  function selectBooking(b: Booking) {
    setSelectedId(b._id);
    if (audience === 'guest' && b.celular) onOpenChat?.(b.celular);
    if (audience === 'owner') {
      const phone = ownerPhoneOf(b);
      if (phone) onOpenChat?.(phone);
    }
  }

  const requiresGuestList =
    selectedBooking?.property?.requiresGuestList !== false;

  const shareGuestList =
    selectedBooking?.ownerPortalShare?.showGuestList !== false;

  const guestCount = Array.isArray(selectedBooking?.checkinGuests)
    ? selectedBooking.checkinGuests.length
    : 0;
  const guestCap = Math.max(1, Number(selectedBooking?.numeroPersonas) || 1);

  async function handleToggleGuestListShare(enabled: boolean) {
    if (!selectedBooking) return;
    setSavingShare(true);
    try {
      await saveOwnerPortalShare({
        id: selectedBooking._id as Id<'bookings'>,
        showGuestList: enabled,
      });
      toast.success(
        enabled
          ? 'El propietario verá el listado en /anfitrion'
          : 'Listado oculto para el propietario',
      );
    } catch {
      toast.error('No se pudo guardar la preferencia');
    } finally {
      setSavingShare(false);
    }
  }

  async function handleToggleGuestListUnlock(enabled: boolean) {
    if (!selectedBooking) return;
    setSavingUnlock(true);
    try {
      await setGuestListUnlocked({
        bookingId: selectedBooking._id as Id<'bookings'>,
        unlocked: enabled,
      });
      toast.success(
        enabled
          ? 'Edición de invitados habilitada para el turista'
          : 'Edición de invitados bloqueada de nuevo',
      );
    } catch {
      toast.error('No se pudo actualizar el desbloqueo');
    } finally {
      setSavingUnlock(false);
    }
  }

  async function handleTogglePaymentProofUpload(enabled: boolean) {
    if (!selectedBooking) return;
    setSavingProofUpload(true);
    try {
      await setClientPaymentProofUpload({
        bookingId: selectedBooking._id as Id<'bookings'>,
        enabled,
      });
      toast.success(
        enabled
          ? 'El cliente puede cargar soportes en el check-in'
          : 'Carga deshabilitada: envío por WhatsApp',
      );
    } catch {
      toast.error('No se pudo guardar la preferencia de soportes');
    } finally {
      setSavingProofUpload(false);
    }
  }

  const missingCount =
    audience === 'guest'
      ? pendingGuests.filter((b) => !b.checkinSentManualAt).length
      : pendingOwners.length;

  return (
    <>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setAudience('guest')}
          className={cn(
            'flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition',
            audience === 'guest'
              ? 'bg-emerald-600 text-white'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Clientes
        </button>
        <button
          type="button"
          onClick={() => setAudience('owner')}
          className={cn(
            'flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition',
            audience === 'owner'
              ? 'bg-violet-600 text-white'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          Propietarios
        </button>
      </div>

      <p className="rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {audience === 'guest' ? (
          <>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              Cliente / turista
            </span>
            {' — '}
            mensaje de check-in (plantilla{' '}
            <code className="font-mono text-[10px]">inicio_checkin_turista</code>
            ). Horarios automáticos en Automatizaciones.
          </>
        ) : (
          <>
            <span className="font-bold text-violet-700 dark:text-violet-400">
              Propietario
            </span>
            {' — '}
            aviso de llegada (plantilla{' '}
            <code className="font-mono text-[10px]">aviso_llegada_propietario</code>
            ). Horarios automáticos en Automatizaciones.
          </>
        )}
      </p>

      {conversation ? (
        <section className="rounded-2xl border border-border bg-card p-3">
          <h3 className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {audience === 'guest'
              ? 'Reserva de este chat'
              : 'Propietario de este chat'}
            <span
              className={cn(
                'ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal',
                audience === 'guest'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
              )}
            >
              {audience === 'guest' ? '→ Cliente' : '→ Propietario'}
            </span>
          </h3>

          {!selectedBooking ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              {audience === 'guest'
                ? 'Este contacto no tiene un check-in pendiente. Elige una reserva de la lista.'
                : 'Este chat no coincide con un propietario pendiente. Elige uno de la lista.'}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {audience === 'guest'
                        ? selectedBooking.nombreCompleto || 'Sin nombre'
                        : selectedBooking.property?.propietarioNombre ||
                          'Propietario'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedBooking.property?.title ?? 'Sin finca'}
                      {audience === 'owner' && selectedBooking.nombreCompleto
                        ? ` · ${selectedBooking.nombreCompleto}`
                        : ''}
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
                    <dt className="text-muted-foreground">
                      {audience === 'guest' ? 'Total' : 'Acordado'}
                    </dt>
                    <dd className="font-semibold">
                      {audience === 'guest'
                        ? money(selectedBooking.precioTotal)
                        : money(
                            Number(
                              selectedBooking.ownerPayout?.valorAcordado || 0,
                            ) || undefined,
                          )}
                    </dd>
                  </div>
                </dl>

                {audience === 'guest' && selectedBooking.checkinSentManualAt ? (
                  <p className="mt-2 text-[11px] font-medium text-emerald-600">
                    Check-in marcado como enviado
                  </p>
                ) : null}
                {audience === 'owner' && selectedBooking.ownerPortalSentAt ? (
                  <p className="mt-2 text-[11px] font-medium text-emerald-600">
                    Link al propietario marcado como enviado
                  </p>
                ) : null}

                {!chatMatchesSelected ? (
                  <p className="mt-2 text-[11px] text-amber-600">
                    {audience === 'guest'
                      ? 'El número del chat no coincide con el de esta reserva.'
                      : 'El número del chat no coincide con el del propietario.'}
                  </p>
                ) : null}
              </div>

              {requiresGuestList ? (
                <div className="space-y-2.5 rounded-xl border border-border bg-background p-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Invitados ({guestCount}/{guestCap})
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {guestCount === 0
                        ? 'El turista aún no ha registrado su lista de invitados'
                        : `${guestCount} invitado${guestCount === 1 ? '' : 's'} registrado${guestCount === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        Enviar listado al propietario
                      </p>
                      <p className="text-[10px] leading-snug text-muted-foreground">
                        {shareGuestList
                          ? 'El propietario verá invitados y PDF en /anfitrion.'
                          : 'Oculto: el propietario no verá nombres ni PDF.'}
                      </p>
                    </div>
                    <Switch
                      checked={shareGuestList}
                      onCheckedChange={(v) => void handleToggleGuestListShare(v)}
                      disabled={savingShare}
                      className="shrink-0 data-[state=checked]:bg-emerald-600"
                    />
                  </label>

                  <AdminGuestListEditor
                    key={`guests-${selectedBooking._id}`}
                    bookingId={selectedBooking._id}
                    initialGuests={
                      selectedBooking.checkinGuests as
                        | Array<{
                            nombreCompleto?: string;
                            cedula?: string;
                            tipoDocumento?: string;
                            esMenor?: boolean;
                          }>
                        | undefined
                    }
                    numeroPersonas={selectedBooking.numeroPersonas}
                  />

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        Habilitar edición de invitados
                      </p>
                      <p className="text-[10px] leading-snug text-muted-foreground">
                        {selectedBooking.guestListUnlocked
                          ? 'Desbloqueada: el turista puede editar aunque falten menos de 24 h.'
                          : 'Normal: la lista se bloquea 24 h antes (12 h si es 1 noche).'}
                      </p>
                    </div>
                    <Switch
                      checked={!!selectedBooking.guestListUnlocked}
                      onCheckedChange={(v) =>
                        void handleToggleGuestListUnlock(v)
                      }
                      disabled={savingUnlock}
                      className="shrink-0"
                    />
                  </label>
                </div>
              ) : null}

              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    Cargar soportes de pago en el check-in
                  </p>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {selectedBooking.clientPaymentProofUploadEnabled !== false
                      ? 'Activo: el turista ve y sube comprobantes en el portal.'
                      : 'Apagado: WhatsApp (sigue pudiendo ver soportes ya cargados).'}
                  </p>
                </div>
                <Switch
                  checked={
                    selectedBooking.clientPaymentProofUploadEnabled !== false
                  }
                  onCheckedChange={(v) =>
                    void handleTogglePaymentProofUpload(v)
                  }
                  disabled={savingProofUpload}
                  className="shrink-0 data-[state=checked]:bg-emerald-600"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!chatMatchesSelected || busy === 'send'}
                  onClick={() => void handleSendInChat()}
                  className={cn(
                    'col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50',
                    audience === 'guest'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-violet-600 hover:bg-violet-700',
                  )}
                >
                  {busy === 'send' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {audience === 'guest'
                    ? 'Enviar check-in (cliente)'
                    : 'Enviar aviso (propietario)'}
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
                  {audience === 'guest'
                    ? 'Abrir portal de check-in'
                    : 'Abrir portal del propietario'}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Abre un chat o toca una fila para ver el resumen y enviar el mensaje.
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {audience === 'guest' ? (
            <DoorOpen className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-violet-600" />
          )}
          {audience === 'guest'
            ? `Check-ins pendientes · ${pendingGuests.length}`
            : `Propietarios por avisar · ${pendingOwners.length}`}
          {missingCount > 0 && audience === 'guest' ? (
            <span className="ml-auto font-semibold normal-case tracking-normal text-orange-500">
              {missingCount} sin mensaje
            </span>
          ) : null}
        </h3>
        {data === undefined ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <p className="text-xs text-muted-foreground">
              {audience === 'guest'
                ? 'Todas las reservas próximas tienen su check-in al día.'
                : 'No hay propietarios pendientes de avisar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {list.map((b) => {
              const d = dayLabel(b.fechaEntrada);
              const isSelected = selectedBooking?._id === b._id;
              const matchesChat =
                conversation?.phone &&
                (audience === 'guest'
                  ? b.celular && phonesMatch(conversation.phone, b.celular)
                  : phonesMatch(conversation.phone, ownerPhoneOf(b)));
              const title =
                audience === 'guest'
                  ? b.nombreCompleto || 'Sin nombre'
                  : b.property?.propietarioNombre || 'Propietario';
              const subtitle =
                audience === 'guest'
                  ? `${b.property?.title ?? ''} · ${fmtShort(b.fechaEntrada)}${
                      b.checkinSentManualAt ? ' · check-in enviado' : ''
                    }`
                  : `${b.property?.title ?? ''} · ${fmtShort(b.fechaEntrada)} · ${
                      b.nombreCompleto || 'huésped'
                    }`;
              return (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => selectBooking(b)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition',
                    isSelected
                      ? audience === 'guest'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-violet-500 bg-violet-500/10'
                      : 'border-border hover:bg-muted/40',
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
                      {title}
                      {matchesChat ? (
                        <span className="ml-1 text-[10px] font-bold text-primary">
                          · este chat
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {subtitle}
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
