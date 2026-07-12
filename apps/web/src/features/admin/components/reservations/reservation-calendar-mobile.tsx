"use client";

/**
 * ReservationCalendarMobile — Vista Día/Agenda para móvil, estilo Google Calendar.
 *
 * Es ADITIVA y AISLADA: se monta SOLO en móvil (useIsMobile) en lugar del timeline
 * horizontal `CalendarGridView`. No cambia el modelo de datos ni la lógica:
 *   - Reutiliza el semáforo de etapas (getReservationCalendarBarClass / Label).
 *   - Reutiliza los campos existentes: fechaEntrada, fechaSalida, nombreCompleto,
 *     reference, calendarLabel, _id, property.title.
 *   - Reutiliza onSelectBooking para abrir el detalle ya existente.
 *
 * Aporta usabilidad GCal en móvil: barra de día compacta y sticky, tira de semana,
 * swipe ← → para cambiar de día, y la agenda del día agrupada en
 * Ingresan / Salen / En curso.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
  MoonStar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getReservationCalendarBarClass,
  getReservationCalendarLabel,
} from "@/features/admin/utils/reservation-calendar-semaphore";

type Booking = any;

interface Props {
  isLoading?: boolean;
  reservations: Booking[];
  date: Date;
  setDate: (d: Date) => void;
  onSelectBooking: (b: Booking) => void;
}

const SWIPE_THRESHOLD = 60;
const parse = (d: unknown): Date | null => (d ? new Date(d as string) : null);

export function ReservationCalendarMobile({
  isLoading,
  reservations,
  date,
  setDate,
  onSelectBooking,
}: Props) {
  const day = startOfDay(date);
  const [dir, setDir] = useState(0);

  // Agrupa las reservas activas en el día: ingresan / salen / en curso
  const { arrivals, departures, ongoing } = useMemo(() => {
    const arrivals: Booking[] = [];
    const departures: Booking[] = [];
    const ongoing: Booking[] = [];
    for (const b of reservations || []) {
      const inD = parse(b.fechaEntrada);
      if (!inD) continue;
      const outD = parse(b.fechaSalida);
      const inDay = startOfDay(inD);
      const outDay = outD ? startOfDay(outD) : inDay;
      if (isSameDay(inDay, day)) arrivals.push(b);
      else if (outD && isSameDay(outDay, day)) departures.push(b);
      else if (inDay < day && outDay > day) ongoing.push(b);
    }
    const byName = (a: Booking, b: Booking) =>
      (a.nombreCompleto || "").localeCompare(b.nombreCompleto || "");
    return {
      arrivals: arrivals.sort(byName),
      departures: departures.sort(byName),
      ongoing: ongoing.sort(byName),
    };
  }, [reservations, day]);

  // Tira de semana (lunes a domingo) para salto rápido + puntos de ocupación
  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(day, { weekStartsOn: 1 }),
        end: endOfWeek(day, { weekStartsOn: 1 }),
      }),
    [day],
  );

  const countForDay = (d: Date) =>
    (reservations || []).filter((b: Booking) => {
      const inD = parse(b.fechaEntrada);
      if (!inD) return false;
      const outD = parse(b.fechaSalida);
      const inDay = startOfDay(inD);
      const outDay = outD ? startOfDay(outD) : inDay;
      return d >= inDay && d <= outDay;
    }).length;

  const go = (n: 1 | -1) => {
    setDir(n);
    setDate(addDays(day, n));
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) go(1);
    else if (info.offset.x > SWIPE_THRESHOLD) go(-1);
  };

  const total = arrivals.length + departures.length + ongoing.length;

  return (
    <div className="flex flex-col">
      {/* Barra de día compacta y sticky */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => go(1)}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="flex-1 truncate text-sm font-bold capitalize text-foreground">
            {format(day, "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          {!isToday(day) && (
            <button
              onClick={() => setDate(startOfDay(new Date()))}
              className="rounded-full border border-border px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-muted"
            >
              Hoy
            </button>
          )}
        </div>

        {/* Tira de semana */}
        <div className="mt-2 flex gap-1">
          {weekDays.map((d) => {
            const active = isSameDay(d, day);
            const count = countForDay(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDate(startOfDay(d))}
                className={cn(
                  "flex flex-1 flex-col items-center rounded-xl py-1.5",
                  active ? "bg-primary text-white" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "text-[9px] uppercase",
                    active ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {format(d, "eee", { locale: es })}
                </span>
                <span className="text-sm font-bold">{format(d, "d")}</span>
                <span
                  className={cn(
                    "mt-0.5 h-1 w-1 rounded-full",
                    count > 0
                      ? active
                        ? "bg-white"
                        : "bg-primary"
                      : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Agenda del día (con swipe) */}
      <div className="min-h-[50vh] overflow-hidden px-3 py-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
            Cargando reservas...
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={day.toISOString()}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.18 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={onDragEnd}
              className="touch-pan-y space-y-5"
            >
              {total === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <CalendarDays className="mb-3 h-8 w-8 opacity-40" />
                  <p className="text-sm font-semibold">Sin reservas este día</p>
                  <p className="mt-1 text-xs opacity-70">
                    Desliza ← → para cambiar de día
                  </p>
                </div>
              ) : (
                <>
                  <Section
                    title="Ingresan hoy"
                    icon={<LogIn className="h-3.5 w-3.5" />}
                    items={arrivals}
                    onSelectBooking={onSelectBooking}
                  />
                  <Section
                    title="Salen hoy"
                    icon={<LogOut className="h-3.5 w-3.5" />}
                    items={departures}
                    onSelectBooking={onSelectBooking}
                  />
                  <Section
                    title="En curso"
                    icon={<MoonStar className="h-3.5 w-3.5" />}
                    items={ongoing}
                    onSelectBooking={onSelectBooking}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  onSelectBooking,
}: {
  title: string;
  icon: React.ReactNode;
  items: Booking[];
  onSelectBooking: (b: Booking) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground/70">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((b) => (
          <ReservationCard key={b._id} booking={b} onSelectBooking={onSelectBooking} />
        ))}
      </div>
    </div>
  );
}

function ReservationCard({
  booking,
  onSelectBooking,
}: {
  booking: Booking;
  onSelectBooking: (b: Booking) => void;
}) {
  const inD = parse(booking.fechaEntrada);
  const outD = parse(booking.fechaSalida);
  const ref =
    booking.calendarLabel && booking.calendarLabel !== "Reserva:"
      ? booking.calendarLabel
      : booking.reference || "";
  const propertyTitle =
    booking.property?.title || booking.propertyTitle || "Propiedad s/n";

  return (
    <button
      onClick={() => onSelectBooking(booking)}
      className="flex w-full items-stretch gap-2.5 rounded-2xl border border-border bg-background p-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <span
        className={cn(
          "w-1.5 shrink-0 rounded-full",
          getReservationCalendarBarClass(booking),
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {ref ? <span className="text-primary">{ref} </span> : null}
          {booking.nombreCompleto || "Sin nombre"}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{propertyTitle}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {inD ? format(inD, "d MMM", { locale: es }) : "—"}
          {outD ? ` – ${format(outD, "d MMM", { locale: es })}` : ""}
        </p>
      </div>
      <span className="self-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {getReservationCalendarLabel(booking)}
      </span>
    </button>
  );
}
