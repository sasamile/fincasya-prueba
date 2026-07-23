"use client";

/**
 * Bloque "de un vistazo" del modal de reserva — diseño sobrio y profesional.
 * Regla de color: paleta neutra + UN solo acento según el estado de la reserva
 * (evita el "arcoíris"). Los montos van en tono neutro; el color solo aparece en
 * el punto de estado y la barra de progreso. El verde de WhatsApp es la única
 * excepción (color de marca de la acción).
 */
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, MessageCircle, Moon, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentsSummary {
  precioTotal?: number;
  netPaid?: number;
  pending?: number;
  paymentStatus?: string;
}

interface BookingLike {
  nombreCompleto?: string;
  celular?: string;
  fechaEntrada: number | string;
  fechaSalida: number | string;
  numeroPersonas?: number;
  numeroNoches?: number;
  precioTotal?: number;
  paymentStatus?: string;
  status?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

/** Un único acento por estado (texto neutro + punto/barra de color). */
function statusMeta(status: string): { label: string; dot: string; bar: string } {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "COMPLETED")
    return { label: "Pagada", dot: "bg-emerald-500", bar: "bg-emerald-500" };
  if (s === "PARTIAL")
    return { label: "Abono parcial", dot: "bg-amber-500", bar: "bg-amber-500" };
  if (s === "CANCELLED")
    return { label: "Cancelada", dot: "bg-rose-500", bar: "bg-rose-500" };
  return { label: "Confirmada", dot: "bg-sky-500", bar: "bg-sky-500" };
}

function waLink(phone?: string): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("57") ? digits : `57${digits.slice(-10)}`;
  return `https://wa.me/${withCountry}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

export function BookingSummaryHero({
  booking,
  payments,
}: {
  booking: BookingLike;
  payments?: PaymentsSummary | null;
}) {
  const total = payments?.precioTotal ?? booking.precioTotal ?? 0;
  const paid = payments?.netPaid ?? 0;
  const pending = payments?.pending ?? Math.max(0, total - paid);
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const st = statusMeta(
    payments?.paymentStatus ?? booking.paymentStatus ?? booking.status ?? "",
  );

  const entrada = new Date(booking.fechaEntrada);
  const salida = new Date(booking.fechaSalida);
  const nights = Math.max(
    1,
    differenceInCalendarDays(salida, entrada) || booking.numeroNoches || 1,
  );
  const wa = waLink(booking.celular);

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Estado de pago */}
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <Label>Estado de pago</Label>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
            {st.label}
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <Label>Pendiente por pagar</Label>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {money(pending)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums text-foreground">
              {money(paid)}{" "}
              <span className="text-muted-foreground">/ {money(total)}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">abonado del total</p>
          </div>
        </div>

        {/* Barra de progreso — un solo tono */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", st.bar)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Cliente + estadía — mismo estilo neutro */}
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <Label>Cliente</Label>
          <p className="mt-1.5 truncate text-[15px] font-semibold text-foreground">
            {booking.nombreCompleto || "Sin nombre"}
          </p>
          {booking.celular && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
              <Phone className="h-3.5 w-3.5" />
              {booking.celular}
            </p>
          )}
          {booking.celularAdicional && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
              <Phone className="h-3.5 w-3.5 opacity-60" />
              {booking.celularAdicional}
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                adicional
              </span>
            </p>
          )}
          {booking.correo && (
            <p className="mt-1 truncate text-[12px] text-muted-foreground">
              {booking.correo}
            </p>
          )}
          {(booking.city || booking.address) && (
            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
              {[booking.city, booking.address].filter(Boolean).join(" · ")}
            </p>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              Escribir por WhatsApp
            </a>
          )}
        </div>

        <div className="p-5">
          <Label>Estadía</Label>
          <p className="mt-1.5 flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {format(entrada, "d MMM", { locale: es })} →{" "}
            {format(salida, "d MMM yyyy", { locale: es })}
          </p>
          <div className="mt-2 flex items-center gap-4 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5" />
              {nights} {nights === 1 ? "noche" : "noches"}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {booking.numeroPersonas ?? "?"} personas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
