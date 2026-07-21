import { ArrowRight, CalendarDays, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  daysUntilLabel,
  formatDate,
  nightsBetween,
} from "@/features/owner/lib/owner-format";

export type OwnerBooking = {
  id: string;
  reference: string;
  propertyTitle: string;
  fechaEntrada: number;
  fechaSalida: number;
  numeroPersonas: number | null;
  guestCount: number;
  guests: Array<{ nombre: string }>;
  canViewGuests: boolean;
  checkinCompleted: boolean;
  anfitrionUrl: string;
};

/** Tarjeta de una reserva con fechas, estado de check-in y lista de invitados. */
export function OwnerBookingCard({ booking }: { booking: OwnerBooking }) {
  const nights = nightsBetween(booking.fechaEntrada, booking.fechaSalida);
  const soon = daysUntilLabel(booking.fechaEntrada);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-tight">
              {booking.propertyTitle}
            </h3>
            {soon ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {soon}
              </span>
            ) : null}
            {booking.checkinCompleted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Check-in completo
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Ref. {booking.reference}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {formatDate(booking.fechaEntrada)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">
              {formatDate(booking.fechaSalida)}
            </span>
            <span className="text-muted-foreground">
              · {nights} {nights === 1 ? "noche" : "noches"}
              {booking.numeroPersonas
                ? ` · ${booking.numeroPersonas} personas`
                : ""}
            </span>
          </p>
        </div>

        <a
          href={booking.anfitrionUrl}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ver detalle
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="border-t border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Invitados ({booking.guestCount})
        </div>
        {!booking.canViewGuests ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            La lista se habilita cuando aceptes la oferta y administración
            active el acceso.
          </p>
        ) : booking.guests.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aún no hay invitados cargados en el check-in.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {booking.guests.map((g, i) => (
              <li
                key={`${booking.id}-${i}`}
                className={cn(
                  "rounded-lg bg-background px-2 py-1 text-xs",
                  "border border-border",
                )}
              >
                {g.nombre || "Sin nombre"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
