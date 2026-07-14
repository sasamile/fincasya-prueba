export type ReservationCalendarStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type BookingForSemaphore = {
  status?: string;
  paymentStatus?: string;
  precioTotal?: number;
  pagoPendiente?: number;
  checkinCompleted?: boolean;
  checkinGuests?: Array<{ nombreCompleto?: string }>;
  scheduledMessages?: Array<{ key?: string }>;
  /** Marca manual del equipo: check-in enviado al cliente (etapa morado). */
  checkinSentManualAt?: number;
  /** Soportes de pago subidos por el turista (portal de pago). */
  paymentPortalReceipts?: Array<{ status?: string }>;
  /** Estado de la devolución del depósito de garantía (etapa rosado). */
  depositReturn?: { estado?: string } | null;
};

const CHECKIN_SENT_KEYS = new Set([
  "tourist_checkin_start",
  "tourist_checkin_pending",
  "inicio_checkin_turista",
]);

export const RESERVATION_CALENDAR_LEGEND: Array<{
  stage: ReservationCalendarStage;
  colorClass: string;
  label: string;
}> = [
  {
    stage: 1,
    colorClass: "bg-blue-100 text-blue-900 border-blue-200",
    label: "Azul — reserva creada",
  },
  {
    stage: 2,
    colorClass: "bg-purple-100 text-purple-900 border-purple-200",
    label: "Morado — check-in enviado",
  },
  {
    stage: 3,
    colorClass: "bg-amber-100 text-amber-900 border-amber-200",
    label: "Amarillo — invitados diligenciados",
  },
  {
    stage: 7,
    colorClass: "bg-cyan-100 text-cyan-900 border-cyan-200",
    label: "Turquesa — check-in completado",
  },
  {
    stage: 4,
    colorClass: "bg-emerald-100 text-emerald-900 border-emerald-200",
    label: "Verde — pago al 100%",
  },
  {
    stage: 5,
    colorClass: "bg-pink-100 text-pink-900 border-pink-200",
    label: "Rosado — finalizada, depósito devuelto",
  },
  {
    stage: 6,
    colorClass: "bg-orange-100 text-orange-900 border-orange-300",
    label: "Naranja — soporte de pago por revisar",
  },
];

function hasCheckinSent(booking: BookingForSemaphore): boolean {
  if (booking.checkinSentManualAt) return true;
  return (booking.scheduledMessages ?? []).some((message) => {
    const key = String(message.key ?? "");
    return CHECKIN_SENT_KEYS.has(key) || key.includes("checkin");
  });
}

function hasGuestsFilled(booking: BookingForSemaphore): boolean {
  if (booking.checkinCompleted) return true;
  return (booking.checkinGuests ?? []).some((guest) =>
    Boolean(guest.nombreCompleto?.trim()),
  );
}

function isFullyPaid(booking: BookingForSemaphore): boolean {
  if (booking.paymentStatus === "PAID" || booking.status === "PAID") {
    return true;
  }
  const total = Number(booking.precioTotal) || 0;
  const pending = Number(booking.pagoPendiente);
  return total > 0 && Number.isFinite(pending) && pending <= 0;
}

function isFinishedWithDepositReturned(booking: BookingForSemaphore): boolean {
  return (
    booking.depositReturn?.estado === "devuelto" ||
    booking.status === "COMPLETED" ||
    booking.paymentStatus === "REFUNDED"
  );
}

/** Hay al menos un soporte de pago subido y pendiente de revisar por el asesor. */
function hasPendingPaymentReceipt(booking: BookingForSemaphore): boolean {
  return (booking.paymentPortalReceipts ?? []).some(
    (receipt) => String(receipt?.status ?? "") === "pending",
  );
}

export function getReservationCalendarStage(
  booking: BookingForSemaphore,
): ReservationCalendarStage {
  // Naranja: soporte de pago por revisar. Alerta prioritaria que sobrescribe
  // todas las demás etapas hasta que el asesor lo resuelve.
  if (hasPendingPaymentReceipt(booking)) return 6;
  // Resto por avance del ciclo: gana la etapa más avanzada alcanzada.
  if (isFinishedWithDepositReturned(booking)) return 5;
  if (isFullyPaid(booking)) return 4;
  // Turquesa: el turista TERMINÓ el check-in (distinto de solo haber
  // diligenciado invitados, que sigue en amarillo).
  if (booking.checkinCompleted) return 7;
  if (hasGuestsFilled(booking)) return 3;
  if (hasCheckinSent(booking)) return 2;
  return 1;
}

export function getReservationCalendarStyles(booking: BookingForSemaphore) {
  const stage = getReservationCalendarStage(booking);
  const styles: Record<ReservationCalendarStage, string> = {
    1: "bg-blue-100/95 text-blue-900 border-blue-200 shadow-blue-200/20",
    2: "bg-purple-100/95 text-purple-900 border-purple-200 shadow-purple-200/20",
    3: "bg-amber-100/95 text-amber-900 border-amber-200 shadow-amber-200/20",
    4: "bg-emerald-100/95 text-emerald-900 border-emerald-200 shadow-emerald-200/20",
    5: "bg-pink-100/95 text-pink-900 border-pink-200 shadow-pink-200/20",
    6: "bg-orange-100/95 text-orange-900 border-orange-300 shadow-orange-200/30",
    7: "bg-cyan-100/95 text-cyan-900 border-cyan-200 shadow-cyan-200/20",
  };
  return styles[stage];
}

export function getReservationCalendarLabel(booking: BookingForSemaphore) {
  const stage = getReservationCalendarStage(booking);
  const labels: Record<ReservationCalendarStage, string> = {
    1: "Reserva creada",
    2: "Check-in enviado",
    3: "Invitados diligenciados",
    4: "Pago al 100%",
    5: "Finalizada",
    6: "Soporte por revisar",
    7: "Check-in completado",
  };
  return labels[stage];
}

export function getReservationCalendarBarClass(booking: BookingForSemaphore) {
  const stage = getReservationCalendarStage(booking);
  const bars: Record<ReservationCalendarStage, string> = {
    1: "bg-blue-500",
    2: "bg-purple-500",
    3: "bg-amber-500",
    4: "bg-emerald-500",
    5: "bg-pink-500",
    6: "bg-orange-500",
    7: "bg-cyan-500",
  };
  return bars[stage];
}
