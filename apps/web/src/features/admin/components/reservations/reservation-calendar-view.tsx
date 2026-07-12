"use client";

/**
 * Calendario de reservas estilo Google Calendar (Mes / Semana / Día).
 * Lee las reservas de FincasYa (Convex) directamente — no depende de conectar
 * Google Calendar.
 *
 * Las reservas son rangos de días (entrada → salida). Se pintan como UNA barra
 * continua que abarca todos sus días (no un chip repetido por celda), igual que
 * los eventos multi-día de Google Calendar: esquina redondeada a la izquierda el
 * día de entrada y a la derecha el día de salida, para ver claro cuándo empieza
 * y cuándo termina cada reserva.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarView = "month" | "week" | "day";

export interface CalendarBooking {
  _id: string;
  nombreCompleto?: string;
  fechaEntrada: number;
  fechaSalida: number;
  numeroPersonas?: number;
  precioTotal?: number;
  paymentStatus?: string;
  status?: string;
  reference?: string;
  calendarLabel?: string;
  property?: { title?: string; image?: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Props {
  bookings: CalendarBooking[];
  currentDate: Date;
  view: CalendarView;
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onSelectBooking: (booking: CalendarBooking) => void;
  /** Menú contextual (clic derecho): editar / eliminar. Opcionales. */
  onEditBooking?: (booking: CalendarBooking) => void;
  onDeleteBooking?: (booking: CalendarBooking) => void;
}

/** Callback interno para abrir el menú contextual en (x, y). */
type OpenContextMenu = (
  e: React.MouseEvent,
  booking: CalendarBooking,
) => void;

/** Contexto para que EventBar/DayView disparen el menú sin pasar props. */
const MenuContext = createContext<OpenContextMenu | null>(null);

/** Color del evento según estado de pago/reserva (paleta tipo Google). */
function bookingColor(b: CalendarBooking): {
  bar: string;
  text: string;
  dot: string;
} {
  const s = (b.paymentStatus || b.status || "").toUpperCase();
  if (s === "CANCELLED")
    return {
      bar: "bg-red-500/20 hover:bg-red-500/30 border-l-2 border-red-500",
      text: "text-red-800 dark:text-red-200",
      dot: "bg-red-500",
    };
  if (s === "PAID" || s === "COMPLETED")
    return {
      bar: "bg-emerald-500/20 hover:bg-emerald-500/30 border-l-2 border-emerald-500",
      text: "text-emerald-800 dark:text-emerald-200",
      dot: "bg-emerald-500",
    };
  if (s === "PARTIAL")
    return {
      bar: "bg-amber-500/20 hover:bg-amber-500/30 border-l-2 border-amber-500",
      text: "text-amber-900 dark:text-amber-200",
      dot: "bg-amber-500",
    };
  return {
    bar: "bg-blue-500/20 hover:bg-blue-500/30 border-l-2 border-blue-500",
    text: "text-blue-800 dark:text-blue-200",
    dot: "bg-blue-500",
  };
}

function bookingLabel(b: CalendarBooking): string {
  const code = b.reference || b.calendarLabel || "";
  const name = b.nombreCompleto || "Reserva";
  return code ? `${code} · ${name}` : name;
}

/** ¿Ocupa el día `day`? Rango entrada → salida (incluye día de salida). */
function occupiesDay(b: CalendarBooking, day: Date): boolean {
  const start = startOfDay(new Date(b.fechaEntrada));
  const end = startOfDay(new Date(b.fechaSalida));
  const d = startOfDay(day);
  return d >= start && d <= end;
}

function bookingsForDay(bookings: CalendarBooking[], day: Date): CalendarBooking[] {
  return bookings
    .filter((b) => occupiesDay(b, day))
    .sort((a, b) => a.fechaEntrada - b.fechaEntrada);
}

/**
 * Segmento de una reserva dentro de una semana (fila de 7 días). Calcula en qué
 * columnas empieza/termina la barra dentro de esa semana y en qué "carril" va
 * (para apilar reservas que se solapan sin encimarse).
 */
interface WeekSegment {
  booking: CalendarBooking;
  colStart: number; // 0-6
  colEnd: number; // 0-6
  isStart: boolean; // el día de ENTRADA cae en esta semana
  isEnd: boolean; // el día de SALIDA cae en esta semana
  lane: number;
}

function computeWeekSegments(
  bookings: CalendarBooking[],
  weekStart: Date,
): WeekSegment[] {
  const weekEnd = addDays(weekStart, 6);
  const segs: Omit<WeekSegment, "lane">[] = [];

  for (const b of bookings) {
    const bStart = startOfDay(new Date(b.fechaEntrada));
    const bEnd = startOfDay(new Date(b.fechaSalida));
    // Sin intersección con la semana.
    if (bEnd < weekStart || bStart > weekEnd) continue;

    const segStartDay = bStart < weekStart ? weekStart : bStart;
    const segEndDay = bEnd > weekEnd ? weekEnd : bEnd;
    segs.push({
      booking: b,
      colStart: differenceInCalendarDays(segStartDay, weekStart),
      colEnd: differenceInCalendarDays(segEndDay, weekStart),
      isStart: bStart >= weekStart,
      isEnd: bEnd <= weekEnd,
    });
  }

  // Ordena por inicio y, a igualdad, por duración (más largas primero).
  segs.sort(
    (a, b) =>
      a.colStart - b.colStart ||
      b.colEnd - b.colStart - (a.colEnd - a.colStart),
  );

  // Asigna carriles: el primer carril libre donde no se solape.
  const laneEnds: number[] = [];
  return segs.map((s) => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= s.colStart) lane++;
    laneEnds[lane] = s.colEnd;
    return { ...s, lane };
  });
}

// Alturas del layout (px).
const NUMBER_ROW_H = 30;
const LANE_H = 22;
const LANE_GAP = 3;

// ─── Cabecera común ───

function CalendarHeader({
  currentDate,
  view,
  onNavigate,
  onViewChange,
}: Pick<Props, "currentDate" | "view" | "onNavigate" | "onViewChange">) {
  const title =
    view === "month"
      ? format(currentDate, "MMMM yyyy", { locale: es })
      : view === "week"
        ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d MMM", { locale: es })} – ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "d MMM yyyy", { locale: es })}`
        : format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });

  const step = (dir: 1 | -1) => {
    if (view === "month") onNavigate(addMonths(currentDate, dir));
    else if (view === "week") onNavigate(addWeeks(currentDate, dir));
    else onNavigate(addDays(currentDate, dir));
  };

  const views: { id: CalendarView; label: string }[] = [
    { id: "month", label: "Mes" },
    { id: "week", label: "Semana" },
    { id: "day", label: "Día" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate(new Date())}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          Hoy
        </button>
        <div className="flex items-center">
          <button
            onClick={() => step(-1)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => step(1)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <h2 className="text-lg md:text-xl font-bold capitalize text-foreground">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === v.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Barra continua de una reserva (compartida por Mes y Semana). */
function EventBar({
  seg,
  onSelect,
}: {
  seg: WeekSegment;
  onSelect: (b: CalendarBooking) => void;
}) {
  const c = bookingColor(seg.booking);
  const openMenu = useContext(MenuContext);
  return (
    <button
      onClick={() => onSelect(seg.booking)}
      onContextMenu={(e) => openMenu?.(e, seg.booking)}
      title={bookingLabel(seg.booking)}
      style={{
        gridColumnStart: seg.colStart + 1,
        gridColumnEnd: seg.colEnd + 2,
        gridRowStart: seg.lane + 1,
      }}
      className={cn(
        "pointer-events-auto flex h-[22px] items-center gap-1 truncate px-1.5 text-left text-[11px] font-semibold transition-colors",
        c.bar,
        c.text,
        // Redondeo: izquierda si entra aquí, derecha si sale aquí.
        seg.isStart ? "rounded-l-md" : "rounded-l-none",
        seg.isEnd ? "rounded-r-md" : "rounded-r-none",
        // Si no entra aquí, la barra viene de la semana anterior: sin borde izq.
        !seg.isStart && "border-l-0",
      )}
    >
      <span className="truncate">{bookingLabel(seg.booking)}</span>
    </button>
  );
}

// ─── Vista Mes ───

function MonthView({ bookings, currentDate, onSelectBooking, onNavigate, onViewChange }: Props) {
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const rows: Date[][] = [];
    let d = start;
    while (d <= end) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
      d = addDays(d, 7);
    }
    return rows;
  }, [currentDate]);

  const weekDayNames = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {weekDayNames.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {weeks.map((weekDays, wi) => {
        const segs = computeWeekSegments(bookings, weekDays[0]);
        const laneCount = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
        const minHeight =
          NUMBER_ROW_H + Math.max(1, laneCount) * (LANE_H + LANE_GAP) + 6;

        return (
          <div
            key={wi}
            className="relative border-b border-border last:border-b-0"
            style={{ height: minHeight }}
          >
            {/* Fondo: celdas con borde de rejilla y número de día. En capa
                absoluta para que los bordes verticales corran TODA la altura. */}
            <div className="absolute inset-0 grid grid-cols-7">
              {weekDays.map((day, i) => {
                const inMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={i}
                    className={cn(
                      "border-r border-border last:border-r-0",
                      !inMonth && "bg-muted/20",
                    )}
                    onDoubleClick={() => {
                      onNavigate(day);
                      onViewChange("day");
                    }}
                  >
                    <div className="flex justify-end p-1">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : inMonth
                              ? "text-foreground"
                              : "text-muted-foreground/50",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barras de reservas (una por reserva, abarcando sus días). */}
            <div
              className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-x-1 px-1"
              style={{ top: NUMBER_ROW_H, gridAutoRows: `${LANE_H + LANE_GAP}px` }}
            >
              {segs.map((seg) => (
                <EventBar key={seg.booking._id} seg={seg} onSelect={onSelectBooking} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vista Semana ───

function WeekView({ bookings, currentDate, onSelectBooking, onNavigate, onViewChange }: Props) {
  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 0 }),
    [currentDate],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const segs = useMemo(
    () => computeWeekSegments(bookings, weekStart),
    [bookings, weekStart],
  );
  const laneCount = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      {/* Cabecera de días */}
      <div className="grid grid-cols-7 border-b border-border">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <button
              key={i}
              onClick={() => {
                onNavigate(day);
                onViewChange("day");
              }}
              className="flex flex-col items-center gap-0.5 border-r border-border/60 py-2 last:border-r-0 hover:bg-muted/40 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {format(day, "EEE", { locale: es })}
              </span>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barras de reservas de la semana */}
      <div
        className="relative"
        style={{ minHeight: Math.max(1, laneCount) * (LANE_H + LANE_GAP) + 340 }}
      >
        {/* Líneas divisorias de columnas */}
        <div className="absolute inset-0 grid grid-cols-7">
          {days.map((_, i) => (
            <div key={i} className="border-r border-border/40 last:border-r-0" />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-2 grid grid-cols-7 gap-x-1 px-1"
          style={{ gridAutoRows: `${LANE_H + LANE_GAP}px` }}
        >
          {segs.map((seg) => (
            <EventBar key={seg.booking._id} seg={seg} onSelect={onSelectBooking} />
          ))}
        </div>
        {segs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm font-medium text-muted-foreground">
              Sin reservas esta semana
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Vista Día ───

function DayView({ bookings, currentDate, onSelectBooking }: Props) {
  const openMenu = useContext(MenuContext);
  const dayBookings = useMemo(
    () => bookingsForDay(bookings, currentDate),
    [bookings, currentDate],
  );
  const fmtMoney = (n?: number) =>
    typeof n === "number"
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(n)
      : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {dayBookings.length}{" "}
          {dayBookings.length === 1 ? "reserva activa" : "reservas activas"}
        </p>
      </div>
      {dayBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            Sin reservas este día
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {dayBookings.map((b) => {
            const c = bookingColor(b);
            const isCheckIn = isSameDay(new Date(b.fechaEntrada), currentDate);
            const isCheckOut = isSameDay(new Date(b.fechaSalida), currentDate);
            return (
              <button
                key={b._id}
                onClick={() => onSelectBooking(b)}
                onContextMenu={(e) => openMenu?.(e, b)}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className={cn("h-12 w-1.5 shrink-0 rounded-full", c.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold text-foreground">
                      {bookingLabel(b)}
                    </span>
                    {isCheckIn && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                        Entra hoy
                      </span>
                    )}
                    {isCheckOut && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-300">
                        Sale hoy
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {b.property?.title && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.property.title}
                      </span>
                    )}
                    {typeof b.numeroPersonas === "number" && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {b.numeroPersonas} pax
                      </span>
                    )}
                    <span>
                      {format(new Date(b.fechaEntrada), "d MMM", { locale: es })} →{" "}
                      {format(new Date(b.fechaSalida), "d MMM", { locale: es })}
                    </span>
                  </div>
                </div>
                {typeof b.precioTotal === "number" && (
                  <div className="shrink-0 text-right text-sm font-bold text-foreground">
                    {fmtMoney(b.precioTotal)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ───

export function ReservationCalendarView(props: Props) {
  const { onSelectBooking, onEditBooking, onDeleteBooking } = props;
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    booking: CalendarBooking;
  } | null>(null);

  const openMenu: OpenContextMenu = (e, booking) => {
    e.preventDefault();
    // Ubica el menú donde se hizo clic, sin salirse de la pantalla.
    const x = Math.min(e.clientX, window.innerWidth - 190);
    const y = Math.min(e.clientY, window.innerHeight - 150);
    setMenu({ x, y, booking });
  };

  // Cerrar el menú al hacer clic fuera, hacer scroll o presionar Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <MenuContext.Provider value={openMenu}>
    <div className="space-y-2">
      <CalendarHeader
        currentDate={props.currentDate}
        view={props.view}
        onNavigate={props.onNavigate}
        onViewChange={props.onViewChange}
      />
      {props.view === "month" && <MonthView {...props} />}
      {props.view === "week" && <WeekView {...props} />}
      {props.view === "day" && <DayView {...props} />}

      {/* Menú contextual (clic derecho sobre una reserva) */}
      {menu && (
        <div
          className="fixed z-[100] min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onSelectBooking(menu.booking);
              setMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
            Ver detalle
          </button>
          {onEditBooking && (
            <button
              onClick={() => {
                onEditBooking(menu.booking);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Editar reserva
            </button>
          )}
          {onDeleteBooking && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  onDeleteBooking(menu.booking);
                  setMenu(null);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar reserva
              </button>
            </>
          )}
        </div>
      )}

      {/* Leyenda de colores por estado */}
      <div className="flex flex-wrap items-center gap-4 px-1 py-1 text-[11px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Abono parcial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Pagada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Cancelada
        </span>
      </div>
    </div>
    </MenuContext.Provider>
  );
}
