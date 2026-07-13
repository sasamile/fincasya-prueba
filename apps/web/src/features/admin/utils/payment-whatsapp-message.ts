import type { BankAccount } from "../store/contract-settings.store";
import { formatPriceInput } from "@/lib/utils";
import {
  parseEconomicAdjustments,
  type EconomicAdjustment,
} from "@/features/admin/utils/economic-adjustments";

export interface PaymentBreakdownLine {
  label: string;
  amount: number;
  highlight?: boolean;
}

export interface ReservationPaymentWhatsAppInput {
  clientName?: string;
  propertyName?: string;
  checkInDate?: string;
  breakdown: PaymentBreakdownLine[];
  total: number;
  pendingAmount?: number;
  depositAmount?: number;
  selectedAccounts: BankAccount[];
  /** @deprecated Usar checkinLink: el pago va integrado en el check-in. */
  paymentLink?: string;
  checkinLink?: string;
  /** Google Maps — solo cuando se envía check-in. */
  checkinUbicacionUrl?: string;
  /** Waze — solo cuando se envía check-in. */
  checkinWazeUrl?: string;
  checkinIndicacionesLlegada?: string;
  checkinRecomendaciones?: string;
  checkinUbicacionImageUrl?: string;
  includePaymentInstructions?: boolean;
}

const fmtCOP = (value: number) =>
  `$ ${formatPriceInput(value)}`;

function formatBankAccountLine(account: BankAccount): string {
  const type = account.accountType?.trim();
  const bank = account.bankName?.trim();
  const parts = [
    account.ownerName?.trim(),
    account.ownerCedula ? `C.C. ${account.ownerCedula}` : "",
    type || bank ? `${[type, bank].filter(Boolean).join(" ")}`.trim() : "",
    account.accountNumber ? `N° ${account.accountNumber}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildPaymentPortalUrl(reference: string): string {
  const ref = reference.trim();
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/pago`
      : process.env.NEXT_PUBLIC_PAYMENT_PORTAL_BASE_URL ||
        "https://fincasya.com/pago";
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(ref)}`;
}

export function buildCheckinPortalUrl(reference: string): string {
  const ref = reference.trim();
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkin`
      : process.env.NEXT_PUBLIC_CHECKIN_PORTAL_BASE_URL ||
        "https://fincasya.com/checkin";
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(ref)}`;
}

/** Mensaje corto de invitación al portal de check-in (copiar / WhatsApp / inbox). */
export function buildSimpleCheckinInviteMessage(booking: {
  _id: string;
  reference?: string | null;
  nombreCompleto?: string;
  property?: { title?: string } | null;
  propertyTitle?: string;
  fechaEntrada?: number;
  horaEntrada?: string;
}): string {
  const ref = (booking.reference || booking._id).trim();
  const nombre =
    (booking.nombreCompleto || "").trim().split(/\s+/)[0] || "viajero";
  const finca =
    booking.property?.title || booking.propertyTitle || "tu finca";

  let fechaLarga = "";
  if (booking.fechaEntrada) {
    const raw = new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Bogota",
    }).format(new Date(booking.fechaEntrada));
    fechaLarga = raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  const horaRaw = String(booking.horaEntrada ?? "").trim();
  const horaMatch = /^(\d{1,2}):(\d{2})$/.exec(horaRaw);
  let hora = "";
  if (horaMatch) {
    let h = parseInt(horaMatch[1], 10);
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    hora = `${h}:${horaMatch[2]} ${ap}`;
  } else if (horaRaw) {
    hora = horaRaw;
  } else if (booking.fechaEntrada) {
    hora = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(new Date(booking.fechaEntrada));
  }

  const link = buildCheckinPortalUrl(ref);
  return (
    `¡Hola, ${nombre}! 👋\n` +
    `🌴 Ya casi llega el momento de disfrutar de ${finca}.\n` +
    (fechaLarga ? `📅 Llegada: ${fechaLarga}\n` : "") +
    (hora ? `🕒 Ingreso: ${hora}\n` : "") +
    `Para continuar con tu proceso de ingreso, por favor realiza tu check-in aquí:\n` +
    `👉 ${link}\n` +
    `⚠️ Importante: El check-in debe completarse mínimo 36 horas antes de tu llegada. Sin este proceso no podremos autorizar el ingreso a la propiedad.\n` +
    `🏡 FincasYa.com`
  );
}

export function buildReservationPaymentWhatsAppMessage(
  input: ReservationPaymentWhatsAppInput,
): string {
  const lines: string[] = [];

  lines.push(
    input.checkinLink
      ? "*FincasYa.com* — Check-in y pago"
      : "*FincasYa.com* — Resumen de pago",
  );
  lines.push("");

  if (input.clientName?.trim()) {
    lines.push(`Hola ${input.clientName.trim()},`);
    lines.push("");
  }

  if (input.propertyName?.trim()) {
    lines.push(`Finca: *${input.propertyName.trim()}*`);
  }
  if (input.checkInDate?.trim()) {
    lines.push(`Ingreso: ${input.checkInDate.trim()}`);
  }
  if (input.propertyName?.trim() || input.checkInDate?.trim()) {
    lines.push("");
  }

  lines.push("*Valor Total Reservado*");
  lines.push(fmtCOP(input.total));
  lines.push("");

  const visibleBreakdown = input.breakdown.filter((row) => row.amount !== 0);
  if (visibleBreakdown.length > 0) {
    lines.push("*Desglose de la reserva*");
    for (const row of visibleBreakdown) {
      const suffix = row.highlight ? " *" : "";
      lines.push(`${row.label}${suffix}: ${fmtCOP(row.amount)}`);
    }
    lines.push("");
  }

  if (input.depositAmount != null && input.depositAmount > 0) {
    lines.push(`Abono registrado: ${fmtCOP(input.depositAmount)}`);
  }
  if (input.pendingAmount != null && input.pendingAmount > 0) {
    lines.push(`*Saldo pendiente:* ${fmtCOP(input.pendingAmount)}`);
    lines.push("");
  }

  if (input.selectedAccounts.length > 0) {
    lines.push("*Medios de pago*");
    if (input.includePaymentInstructions !== false) {
      lines.push(
        input.checkinLink
          ? "Realiza la consignación o transferencia a:"
          : "Para confirmar tu reserva, realiza la consignación o transferencia a:",
      );
    }
    for (const account of input.selectedAccounts) {
      lines.push(`- ${formatBankAccountLine(account)}`);
    }
    lines.push("");
  }

  if (input.checkinLink?.trim()) {
    lines.push("*Check-in*");
    lines.push(
      "Registra invitados, consulta saldo pendiente y copia las cuentas aquí:",
    );
    lines.push(input.checkinLink.trim());
    lines.push("");
    if (input.checkinUbicacionUrl?.trim()) {
      lines.push("*Ubicación exacta de la finca*");
      lines.push("Google Maps:");
      lines.push(input.checkinUbicacionUrl.trim());
      lines.push("");
    }
    if (input.checkinWazeUrl?.trim()) {
      if (!input.checkinUbicacionUrl?.trim()) {
        lines.push("*Ubicación exacta de la finca*");
      }
      lines.push("Waze:");
      lines.push(input.checkinWazeUrl.trim());
      lines.push("");
    }
    if (input.checkinIndicacionesLlegada?.trim()) {
      lines.push("*Indicaciones de llegada*");
      lines.push(input.checkinIndicacionesLlegada.trim());
      lines.push("");
    }
    if (input.checkinRecomendaciones?.trim()) {
      lines.push("*Recomendaciones de la finca*");
      lines.push(input.checkinRecomendaciones.trim());
      lines.push("");
    }
    if (input.checkinUbicacionImageUrl?.trim()) {
      lines.push("*Foto o mapa de referencia*");
      lines.push(input.checkinUbicacionImageUrl.trim());
      lines.push("");
    }
  } else if (input.paymentLink?.trim()) {
    lines.push("*Portal de pago*");
    lines.push(
      "Consulta el detalle, medios de pago con imagen y sube tu soporte aquí:",
    );
    lines.push(input.paymentLink.trim());
    lines.push("");
  }

  lines.push(
    "* El depósito reembolsable se devuelve al finalizar la estadía según las condiciones del contrato.",
  );
  lines.push("");
  lines.push("Quedamos atentos. Gracias por tu confianza!");

  return lines.join("\n");
}

/** Mensaje unificado para WhatsApp: resumen de pago + link de check-in. */
export function buildCheckinWhatsAppMessage(
  input: Omit<ReservationPaymentWhatsAppInput, "paymentLink"> & {
    checkinLink: string;
  },
): string {
  return buildReservationPaymentWhatsAppMessage({
    ...input,
    paymentLink: undefined,
  });
}

type PaymentPortalAccount = {
  id: string;
  bankName: string;
  accountType?: string;
  accountNumber: string;
  ownerName: string;
  ownerCedula?: string;
};

type PaymentPortalSnapshot = {
  breakdown?: PaymentBreakdownLine[];
  precioTotal?: number;
  pagoTotal?: number;
  pagoPendiente?: number;
  bankAccounts?: PaymentPortalAccount[];
};

export async function fetchCheckinLink(bookingId: string): Promise<string | null> {
  const res = await fetch(
    `/api/bookings/checkin/${encodeURIComponent(bookingId)}/link`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { link?: string };
  return data.link?.trim() || null;
}

export async function fetchCheckinShareMessage(input: {
  bookingId: string;
  reference: string;
  clientName?: string;
  propertyName?: string;
  checkInDate?: string;
  breakdown?: PaymentBreakdownLine[];
  total?: number;
}): Promise<string | null> {
  const ref = input.reference.trim();
  if (!ref) return null;

  const [linkRes, paymentRes] = await Promise.all([
    fetch(`/api/bookings/checkin/${encodeURIComponent(input.bookingId)}/link`, {
      cache: "no-store",
    }),
    fetch(`/api/payment/${encodeURIComponent(ref)}`, { cache: "no-store" }),
  ]);

  if (!linkRes.ok) return null;
  const linkData = (await linkRes.json()) as {
    link?: string;
    checkinUbicacionUrl?: string;
    checkinWazeUrl?: string;
    checkinIndicacionesLlegada?: string;
    checkinRecomendaciones?: string;
    checkinUbicacionImageUrl?: string;
  };
  const checkinLink = linkData.link?.trim();
  if (!checkinLink) return null;
  const checkinUbicacionUrl = linkData.checkinUbicacionUrl?.trim() || undefined;
  const checkinWazeUrl = linkData.checkinWazeUrl?.trim() || undefined;
  const checkinIndicacionesLlegada =
    linkData.checkinIndicacionesLlegada?.trim() || undefined;
  const checkinRecomendaciones =
    linkData.checkinRecomendaciones?.trim() || undefined;
  const checkinUbicacionImageUrl =
    linkData.checkinUbicacionImageUrl?.trim() || undefined;

  let portal: PaymentPortalSnapshot | null = null;
  if (paymentRes.ok) {
    portal = (await paymentRes.json()) as PaymentPortalSnapshot;
  }

  const selectedAccounts: BankAccount[] = (portal?.bankAccounts ?? []).map(
    (account) => ({
      id: account.id,
      bankName: account.bankName,
      accountType: account.accountType ?? "",
      accountNumber: account.accountNumber,
      ownerName: account.ownerName,
      ownerCedula: account.ownerCedula ?? "",
    }),
  );

  return buildCheckinWhatsAppMessage({
    clientName: input.clientName,
    propertyName: input.propertyName,
    checkInDate: input.checkInDate,
    breakdown: portal?.breakdown?.length
      ? portal.breakdown
      : (input.breakdown ?? []),
    total: portal?.precioTotal ?? input.total ?? 0,
    pendingAmount: portal?.pagoPendiente,
    depositAmount: portal?.pagoTotal,
    selectedAccounts,
    checkinLink,
    checkinUbicacionUrl,
    checkinWazeUrl,
    checkinIndicacionesLlegada,
    checkinRecomendaciones,
    checkinUbicacionImageUrl,
  });
}

/** Misma logica que el desglose del modal de reserva (incluye deposito por diferencia). */
export function computeReservationBreakdownLines(booking: {
  subtotal?: number;
  depositoAseo?: number;
  depositoGarantia?: number;
  costoMascotas?: number;
  costoPersonalServicio?: number;
  discountAmount?: number;
  precioTotal?: number;
  economicAdjustments?: EconomicAdjustment[] | unknown;
}): PaymentBreakdownLine[] {
  const rows: PaymentBreakdownLine[] = [
    { label: "Valor alquiler", amount: booking.subtotal || 0 },
    { label: "Limpieza general", amount: booking.depositoAseo || 0 },
    {
      label: "Valor depósito reembolsable",
      amount: booking.depositoGarantia || 0,
      highlight: true,
    },
    { label: "Recargo por mascotas", amount: booking.costoMascotas || 0 },
    {
      label: "Personal de servicio",
      amount: booking.costoPersonalServicio || 0,
    },
    { label: "Descuento", amount: -(booking.discountAmount || 0) },
  ].filter((row) => row.amount !== 0);

  const adjustments = parseEconomicAdjustments(booking.economicAdjustments);
  for (const item of adjustments) {
    rows.push({
      label:
        item.type === "INCREMENT"
          ? `Ajuste: ${item.description}`
          : `Descuento: ${item.description}`,
      amount: item.type === "INCREMENT" ? item.amount : -item.amount,
    });
  }

  const sum = rows.reduce((acc, row) => acc + row.amount, 0);
  const diff = (booking.precioTotal || 0) - sum;
  const hasDepositRow = rows.some((row) =>
    row.label.toLowerCase().includes("depósito reembolsable"),
  );

  if (diff !== 0 && adjustments.length === 0) {
    if (!hasDepositRow && diff > 0) {
      rows.push({
        label: "Valor depósito reembolsable",
        amount: diff,
        highlight: true,
      });
    } else {
      rows.push({ label: "Otros ajustes", amount: diff });
    }
  }

  return rows;
}

export function buildWhatsAppUrl(
  text: string,
  phone?: string | null,
): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  let normalized: string | null = null;
  if (digits) {
    if (digits.startsWith("57") && digits.length >= 12) normalized = digits;
    else if (digits.length === 10 && digits.startsWith("3"))
      normalized = `57${digits}`;
    else if (digits.length > 10)
      normalized = digits.startsWith("57") ? digits : `57${digits.slice(-10)}`;
  }
  return normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function openWhatsAppWithMessage(
  text: string,
  phone?: string | null,
): void {
  window.open(buildWhatsAppUrl(text, phone), "_blank", "noopener,noreferrer");
}

export async function readImageFileAsDataUrl(
  file: File,
  maxBytes = 600_000,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se permiten imágenes.");
  }
  if (file.size > maxBytes) {
    throw new Error("La imagen es muy grande (máx. ~600 KB).");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}
