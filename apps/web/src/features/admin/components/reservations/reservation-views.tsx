"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWeekend,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getReservationCalendarBarClass,
  getReservationCalendarLabel,
  getReservationCalendarStyles,
} from "@/features/admin/utils/reservation-calendar-semaphore";

export const ReservationListItem = ({
  b,
  index,
  delayBase = 0,
  onSelect,
  isChecked = false,
  onToggleCheck,
}: {
  b: any;
  index: number;
  delayBase?: number;
  onSelect: (b: any) => void;
  isChecked?: boolean;
  onToggleCheck?: (id: string) => void;
}) => (
  <motion.div
    key={b._id}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delayBase + index * 0.03 }}
    className={cn(
      "p-3 md:p-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-muted/10 transition-colors group cursor-pointer",
      isChecked && "bg-emerald-50/60 hover:bg-emerald-50",
    )}
    onClick={() => onSelect(b)}
  >
    {onToggleCheck && (
      <input
        type="checkbox"
        checked={isChecked}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleCheck(b._id)}
        className="h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer"
        aria-label="Seleccionar reserva"
      />
    )}
    <div
      className={cn(
        "w-1.5 h-12 rounded-full hidden md:block shrink-0",
        getReservationCalendarBarClass(b),
      )}
    />

    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-bold text-xs md:text-sm text-foreground group-hover:text-primary transition-colors truncate max-w-[120px] md:max-w-none">
          {b.nombreCompleto}
        </h3>
        <Badge
          variant="secondary"
          className="rounded-md text-[8px] md:text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border-none px-1.5 py-0.5"
        >
          {b.status}
        </Badge>
        {b.isDirect && (
          <Badge className="rounded-md bg-indigo-500/10 text-indigo-600 border-none px-1.5 py-0.5 text-[8px] md:text-[9px] font-black uppercase">
            Directa
          </Badge>
        )}
        {b.paymentStatus && b.paymentStatus !== "PENDING" && (
          <Badge
            className={cn(
              "rounded-md border-none px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold uppercase hidden xs:flex",
              b.paymentStatus === "PAID"
                ? "bg-emerald-500/10 text-emerald-600"
                : b.paymentStatus === "PARTIAL"
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <CreditCard className="h-2.5 w-2.5 md:mr-1" />
            <span className="hidden md:inline">
              {b.paymentStatus === "PAID"
                ? "Pagado"
                : b.paymentStatus === "PARTIAL"
                  ? "Abonado"
                  : b.paymentStatus}
            </span>
          </Badge>
        )}
        {b.checkinCompleted && (
          <Badge className="rounded-md bg-sky-500/10 text-sky-700 border-none px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold hidden xs:flex">
            <CheckCircle2 className="h-2.5 w-2.5 md:mr-1" />
            <span className="hidden md:inline">Check-in</span>
          </Badge>
        )}
        {b.googleEventId && (
          <Badge className="rounded-md bg-emerald-500/10 text-emerald-600 border-none px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold hidden xs:flex">
            <CheckCircle2 className="h-2.5 w-2.5 md:mr-1" />
            <span className="hidden md:inline">Sync</span>
          </Badge>
        )}
      </div>

      <div className="flex flex-col space-y-0.5">
        <p className="text-[10px] md:text-xs text-primary/80 font-bold truncate">
          {b.property?.title || b.propertyTitle || "Propiedad s/n"}
        </p>
        <div className="flex items-center gap-x-3 text-[10px] md:text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3 opacity-60" />
            {format(new Date(b.fechaEntrada), "dd LLL", { locale: es })} —{" "}
            {format(new Date(b.fechaSalida), "dd LLL", { locale: es })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 opacity-60" />
            {b.numeroPersonas}
          </span>
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 pt-2 md:pt-0 border-t md:border-none border-border/50">
      <div className="text-left md:text-right">
        <p className="text-sm md:text-base font-bold text-foreground">
          ${b.precioTotal?.toLocaleString("es-CO")}
        </p>
        <p className="hidden md:block text-[9px] md:text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
          ID {b._id?.slice(-6)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-xl h-8 w-8 md:h-9 md:w-9 hover:bg-muted transition-colors shrink-0"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  </motion.div>
);

export const CalendarGridView = ({
  isLoadingProps,
  isLoading,
  filteredProperties,
  reservations,
  calendarColumns,
  groupBy,
  date,
  onSelectBooking,
  isScrolling,
  scrollRef,
  onMouseDown,
  onMouseLeave,
  onMouseUp,
  onMouseMove,
  selectedBookingIds = [],
  onToggleCheck,
  highlightedBookingId = null,
  dayFilter = null,
  onDayClick,
  onMonthClick,
}: any) => {
  if (isLoadingProps || isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-sm font-medium text-muted-foreground/70">
        <Loader2 className="h-6 w-6 animate-spin mb-3 text-primary" />
        Cargando grilla de reservas...
      </div>
    );
  }

  if ((filteredProperties || []).length === 0) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center bg-muted/10 border border-dashed border-border m-4 rounded-xl sticky left-4 max-w-sm">
        <Building2 className="h-6 w-6 text-muted-foreground/60 mb-4" />
        <p className="text-sm font-bold text-foreground">Aún no hay reservas</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 overflow-auto bg-background selection:bg-transparent cursor-grab scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        isScrolling && "select-none",
      )}
      ref={scrollRef}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      <div className="min-w-max w-full">
        {/* Header Row */}
        <div className="flex border-b border-border/60 bg-white sticky top-0 z-40 h-12 md:h-16">
          <div className="hidden md:flex w-[260px] shrink-0 p-4 border-r border-border/60 bg-white sticky left-0 z-50 shadow-[1px_0_0_0_rgb(var(--border))] items-center">
            <span className="text-[11px] font-medium text-muted-foreground">
              Propiedad
            </span>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {calendarColumns.map((col: Date, idx: number) => {
              const isToday =
                groupBy === "days"
                  ? isSameDay(col, new Date())
                  : groupBy === "weeks"
                    ? isWithinInterval(new Date(), {
                        start: startOfWeek(col, { weekStartsOn: 1 }),
                        end: endOfWeek(col, { weekStartsOn: 1 }),
                      })
                    : isSameMonth(col, new Date());

              const isDayFilterable = groupBy === "days";
              const isMonthFilterable = groupBy === "months";
              const isSelectedDay =
                isDayFilterable && dayFilter && isSameDay(col, dayFilter);
              const isSelectedMonth =
                isMonthFilterable && isSameMonth(col, date);

              const isWeekendDay = groupBy === "days" && isWeekend(col);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isDayFilterable) onDayClick?.(col);
                    else if (isMonthFilterable) onMonthClick?.(col);
                  }}
                  title={
                    isDayFilterable
                      ? "Ver reservas que ingresan este día"
                      : isMonthFilterable
                        ? "Ver reservas de este mes"
                        : undefined
                  }
                  className={cn(
                    "flex-1 min-w-[36px] md:min-w-[44px] flex flex-col items-center justify-center py-1 md:py-2.5 border-r border-border/40",
                    isWeekendDay && "bg-[#f8f9fa]",
                    isToday && "bg-[#e8f0fe]/60",
                    isDayFilterable && "cursor-pointer hover:bg-[#e8f0fe]",
                    isMonthFilterable && "cursor-pointer hover:bg-[#e8f0fe]",
                    isSelectedDay &&
                      "bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-300",
                    isSelectedMonth &&
                      "bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-300",
                    groupBy === "weeks" && "min-w-[100px] md:min-w-[120px]",
                    groupBy === "months" && "min-w-[80px] md:min-w-[100px]",
                  )}
                >
                  <span
                    className={cn(
                      "text-[8px] md:text-[10px] uppercase font-medium",
                      isToday ? "text-[#1a73e8]" : "opacity-70",
                    )}
                  >
                    {groupBy === "days"
                      ? format(col, "eee", { locale: es })
                      : groupBy === "weeks"
                        ? "Sem"
                        : format(col, "MMM", { locale: es })}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 w-fit min-w-5 h-5 md:min-w-7 md:h-7 flex items-center justify-center rounded-full px-1 md:px-2",
                      isToday
                        ? "bg-[#1a73e8] text-white shadow-sm"
                        : "text-foreground",
                    )}
                  >
                    {groupBy === "days"
                      ? format(col, "d")
                      : groupBy === "weeks"
                        ? differenceInCalendarWeeks(col, startOfMonth(date), {
                            weekStartsOn: 1,
                          }) + 1
                        : format(col, "yyyy")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Display */}
        <div className="divide-y divide-border/80">
          {filteredProperties.map((property: any) => {
            const propertyBookings = (
              reservations?.filter(
                (b: any) =>
                  b.propertyId === property._id ||
                  b.property?.id === property._id,
              ) || []
            ).filter(
              (b: any) =>
                !dayFilter ||
                groupBy !== "days" ||
                bookingStartsOnDay(b, dayFilter),
            );

            const placementsWithLanes = calculateLanePlacements(
              propertyBookings,
              calendarColumns,
              groupBy,
            );
            const maxLane = placementsWithLanes.reduce(
              (max: number, item: any) => Math.max(max, item.laneIndex),
              0,
            );
            const rowHeight =
              (placementsWithLanes.length > 0 ? maxLane + 1 : 1) * 64 + 8;

            return (
              <div
                key={property._id}
                className="flex flex-col group relative bg-background border-b border-border/30"
              >
                <div className="flex md:hidden items-center justify-between px-3 py-2 bg-muted/10 border-b border-border/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="h-3 w-3 text-primary/40" />
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-tighter truncate text-primary/80">
                      {property.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-bold px-2 py-0.5 rounded-full bg-muted/40">
                    <MapPin className="h-2.5 w-2.5" />
                    {property.location?.split(",")[0]}
                  </div>
                </div>

                <div className="flex w-full">
                  <div
                    className="hidden md:flex w-[260px] shrink-0 p-4 border-r border-border bg-background items-center gap-4 sticky left-0 z-30 shadow-[1px_0_0_0_rgb(var(--border))]"
                    style={{ minHeight: `${rowHeight}px` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0 shadow-inner">
                      {property.image ? (
                        <img
                          src={property.image}
                          alt=""
                          className="w-full h-full object-cover grayscale-[0.2]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-foreground truncate group-hover:text-primary transition-all">
                        {property.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5 opacity-80">
                        <MapPin className="h-3 w-3" /> {property.location}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex-1 relative min-h-[64px] md:min-h-[72px]"
                    style={{ height: `${rowHeight}px` }}
                  >
                    {calendarColumns.map((col: Date, idx: number) => {
                      const isTodayCol =
                        groupBy === "days" && isSameDay(col, new Date());
                      const isWeekendCol =
                        groupBy === "days" && isWeekend(col);
                      return (
                      <div
                        key={idx}
                        className={cn(
                          "absolute top-0 bottom-0 border-r border-border/40 transition-colors",
                          isWeekendCol && "bg-[#f8f9fa]/80",
                          isTodayCol &&
                            "bg-[#e8f0fe]/30 after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-[#1a73e8]/40",
                          groupBy === "weeks" &&
                            "min-w-[100px] md:min-w-[120px]",
                          groupBy === "months" &&
                            "min-w-[80px] md:min-w-[100px]",
                          groupBy === "days" && "min-w-[36px] md:min-w-[44px]",
                        )}
                        style={{
                          left: `${(idx / calendarColumns.length) * 100}%`,
                          width: `${(1 / calendarColumns.length) * 100}%`,
                        }}
                      />
                    );})}

                    {placementsWithLanes.map((item: any) => {
                      const { booking, laneIndex } = item;
                      const isChecked = (selectedBookingIds || []).includes(
                        booking._id,
                      );
                      const isHighlighted =
                        highlightedBookingId &&
                        booking._id === highlightedBookingId;
                      return (
                        <div
                          key={booking._id}
                          className={cn(
                            "absolute p-1 z-10 h-14 transition-all hover:z-20 cursor-pointer",
                            isHighlighted && "z-20",
                          )}
                          style={{
                            left: `${item.leftPercentage}%`,
                            width: `${item.widthPercentage}%`,
                            top: `${laneIndex * 64 + 4}px`,
                          }}
                          onClick={() => onSelectBooking(booking)}
                        >
                          <div
                            className={cn(
                              "relative w-full h-full rounded-md border-l-[3px] flex flex-col justify-center px-2.5 overflow-hidden shadow-sm transition-all hover:shadow-md hover:z-30",
                              getReservationCalendarStyles(booking),
                              isChecked && "ring-2 ring-offset-1 ring-amber-400",
                              isHighlighted &&
                                "ring-2 ring-offset-2 ring-[#1a73e8] animate-pulse",
                            )}
                          >
                            {onToggleCheck && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => onToggleCheck(booking._id)}
                                className="absolute top-1 right-1 h-3.5 w-3.5 accent-amber-500 cursor-pointer z-10"
                                aria-label="Seleccionar reserva"
                              />
                            )}
                            <p className="text-[10px] font-bold truncate pr-4">
                              {booking.calendarLabel &&
                              booking.calendarLabel !== "Reserva:"
                                ? `${booking.calendarLabel} `
                                : booking.reference
                                  ? `${booking.reference} `
                                  : ""}
                              {booking.nombreCompleto}
                            </p>
                            <p className="text-[8px] opacity-80 truncate uppercase tracking-widest mt-0.5">
                              {getReservationCalendarLabel(booking)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const ListViewContent = ({
  isLoading,
  searchTerm,
  setSearchTerm,
  groupBy,
  setGroupBy,
  filteredReservations,
  groupedBookings,
  onSelectBooking,
  showDirectOnly,
  setShowDirectOnly,
  selectedBookingIds = [],
  onToggleCheck,
}: {
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  groupBy: "days" | "weeks" | "months";
  setGroupBy: (v: "days" | "weeks" | "months") => void;
  filteredReservations: any[];
  groupedBookings: any[];
  onSelectBooking: (v: any) => void;
  showDirectOnly: boolean;
  setShowDirectOnly: (v: boolean) => void;
  selectedBookingIds?: string[];
  onToggleCheck?: (id: string) => void;
}) => {
  return (
    <>
      <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row items-center gap-3 md:gap-4 bg-muted/20">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por cliente o propiedad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-muted/40 border border-border rounded-xl md:rounded-2xl pl-11 pr-10 py-2.5 md:py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-background/50 p-1 rounded-xl border border-border/50">
            {(["days", "weeks", "months"] as const).map((type) => (
              <button
                key={type}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  groupBy === type
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setGroupBy(type)}
              >
                {type === "days" ? "D" : type === "weeks" ? "S" : "M"}
              </button>
            ))}
          </div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/40 px-2 py-1.5 rounded-lg border border-border/50">
            {filteredReservations?.length || 0} resultados
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDirectOnly(!showDirectOnly)}
            className={cn(
              "h-8 rounded-lg text-[10px] font-black uppercase tracking-wider px-3",
              showDirectOnly
                ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {showDirectOnly ? "Ver Todas" : "Solo Directas"}
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border overflow-y-auto custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 md:p-6 flex gap-4">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
              <Skeleton className="h-6 w-24 rounded" />
            </div>
          ))
        ) : (filteredReservations || []).length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Sin resultados
            </p>
          </div>
        ) : groupBy === "days" ? (
          filteredReservations.map((b: any, index: number) => (
            <ReservationListItem
              key={b._id}
              b={b}
              index={index}
              onSelect={onSelectBooking}
              isChecked={selectedBookingIds.includes(b._id)}
              onToggleCheck={onToggleCheck}
            />
          ))
        ) : (
          groupedBookings.map((group: any, gIdx: number) => (
            <div key={group.name} className="flex flex-col">
              <div className="bg-muted/30 px-4 md:px-6 py-2 border-y border-border/50 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                  {group.name}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] border-primary/20 text-primary bg-primary/5 font-bold"
                >
                  {group.items.length} Reservas
                </Badge>
              </div>
              <div className="divide-y divide-border/30">
                {group.items.map((b: any, index: number) => (
                  <ReservationListItem
                    key={b._id}
                    b={b}
                    index={index}
                    delayBase={gIdx * 0.1}
                    onSelect={onSelectBooking}
                    isChecked={selectedBookingIds.includes(b._id)}
                    onToggleCheck={onToggleCheck}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

// --- Helper Functions for Lane Stacking ---

/** Reserva cuyo ingreso (fechaEntrada) es ese día — no estadías que empezaron antes. */
export const bookingStartsOnDay = (
  b: { fechaEntrada: number | string | Date },
  day: Date,
) => isSameDay(new Date(b.fechaEntrada), day);

export const calculateLanePlacements = (
  propertyBookings: any[],
  calendarColumns: Date[],
  groupBy: string,
) => {
  const bookingPlacements: any[] = [];
  const lanes: { start: number; end: number }[][] = [];

  propertyBookings.forEach((booking: any) => {
    const start = new Date(booking.fechaEntrada);
    const end = booking.fechaSalida ? new Date(booking.fechaSalida) : start;

    const startOfStart =
      groupBy === "days"
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate())
        : groupBy === "weeks"
          ? startOfWeek(start, { weekStartsOn: 1 })
          : startOfMonth(start);

    const startOfEnd =
      groupBy === "days"
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate())
        : groupBy === "weeks"
          ? startOfWeek(end, { weekStartsOn: 1 })
          : startOfMonth(end);

    const columnMatches = (col: Date, target: Date) =>
      groupBy === "months"
        ? isSameMonth(col, target)
        : isSameDay(col, target);

    let startIndex = calendarColumns.findIndex((c) =>
      columnMatches(c, startOfStart),
    );
    let endIndex = calendarColumns.findIndex((c) =>
      columnMatches(c, startOfEnd),
    );

    const viewStart = calendarColumns[0];
    const lastCol = calendarColumns[calendarColumns.length - 1];
    const viewEnd =
      groupBy === "weeks"
        ? endOfWeek(lastCol, { weekStartsOn: 1 })
        : groupBy === "months"
          ? endOfMonth(lastCol)
          : lastCol;

    if (!(end < viewStart || start > viewEnd)) {
      if (startIndex === -1 && start < viewStart) startIndex = 0;
      if (endIndex === -1 && end > viewEnd)
        endIndex = calendarColumns.length - 1;

      bookingPlacements.push({
        booking,
        start: startIndex,
        end: endIndex,
        leftPercentage: (startIndex / calendarColumns.length) * 100,
        widthPercentage:
          (Math.max(1, endIndex - startIndex + 1) / calendarColumns.length) *
          100,
      });
    }
  });

  // Sort placements for consistent lane assignment
  bookingPlacements.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );

  return bookingPlacements.map((item) => {
    let laneIndex = 0;
    while (true) {
      if (!lanes[laneIndex]) {
        lanes[laneIndex] = [{ start: item.start, end: item.end }];
        return { ...item, laneIndex };
      }
      const overlaps = lanes[laneIndex].some(
        (prev) => item.start <= prev.end && item.end >= prev.start,
      );
      if (!overlaps) {
        lanes[laneIndex].push({ start: item.start, end: item.end });
        return { ...item, laneIndex };
      }
      laneIndex++;
    }
  });
};
