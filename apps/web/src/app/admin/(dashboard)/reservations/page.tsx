"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar as CalendarIcon,
  RefreshCcw,
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  List as ListIcon,
  Settings2,
  LogOut,
  User,
  Upload,
  Trash2,
  Pencil,
  Users,
  MapPin,
  Loader2,
  X,
  Info,
  FileText,
  Sparkles,
  Send,
  MessageCircle,
  Copy,
  Check,
  CreditCard,
  Download,
  Mail,
  UserCheck,
  FileSpreadsheet,
  Wallet,
  Landmark,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import { DetailSection } from "@/features/admin/components/reservations/booking-detail-section";
import { downloadCheckinGuestsPdf } from "@/features/admin/utils/download-checkin-guests-pdf";
import {
  downloadDailyReservationsExcel,
  type ReportBookingRow,
  parseDateInputValue,
  formatDateInputValue,
  calendarDateToday,
} from "@/features/admin/utils/report-csv";
import { colombiaDayRangeBounds } from "@/features/admin/utils/daily-reservations-excel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfYear,
  endOfYear,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameMonth,
  getWeek,
  getWeekOfMonth,
  differenceInCalendarWeeks,
  differenceInCalendarDays,
  isWithinInterval,
  isWeekend,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { propietarioTratoLabel } from "@/lib/owner-salutation";
import axios from "axios";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ManualReservationModal } from "@/features/admin/components/reservations/manual-reservation-modal";
import { BookingPaymentsSection } from "@/features/admin/components/reservations/booking-payments-section";
import { PendingReceiptsReviewCard } from "@/features/admin/components/reservations/pending-receipts-review-card";
import { ReservationPaymentMethodsSection } from "@/features/admin/components/reservations/reservation-payment-methods-section";
import { OwnerPayoutSection } from "@/features/admin/components/reservations/owner-payout-section";
import { AdminGuestListEditor } from "@/features/admin/components/reservations/admin-guest-list-editor";
import { DepositReturnSection } from "@/features/admin/components/reservations/deposit-return-section";
import { computeReservationBreakdownLines, fetchCheckinLink, fetchCheckinShareMessage, openWhatsAppWithMessage } from "@/features/admin/utils/payment-whatsapp-message";
import { Link2 } from "lucide-react";
import {
  getReservationCalendarBarClass,
  getReservationCalendarLabel,
  getReservationCalendarStyles,
  RESERVATION_CALENDAR_LEGEND,
} from "@/features/admin/utils/reservation-calendar-semaphore";
import { ReservationCalendarMobile } from "@/features/admin/components/reservations/reservation-calendar-mobile";
import { normalizedIncludes } from "@/lib/property/property-search";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReservationsList,
  useCalendarStatus,
  usePropertiesSimple,
  useBookingPriceDetails,
} from "@/features/admin/queries/bookings.queries";
import {
  useAction,
  useConvex,
  useMutation as useConvexMutation,
  useQuery as useConvexQuery,
} from "convex/react";
import { api as convexApi } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { BookingSummaryHero } from "@/features/admin/components/reservations/booking-summary-hero";
import { BookingDocumentsSection } from "@/features/admin/components/reservations/booking-documents-section";
import {
  ReservationCalendarView,
  type CalendarView,
  type CalendarBooking,
} from "@/features/admin/components/reservations/reservation-calendar-view";

const ReservationListItem = ({
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

// --- Sub-components for better structural parsing ---

const CalendarGridView = ({
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

const ListViewContent = ({
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
const bookingStartsOnDay = (
  b: { fechaEntrada: number | string | Date },
  day: Date,
) => isSameDay(new Date(b.fechaEntrada), day);

const calculateLanePlacements = (
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

/** Plantillas Meta que van al propietario (no al turista). */
const OWNER_CHECKIN_TEMPLATE_KEYS = new Set([
  "owner_week_reminder",
  "owner_arrival_tomorrow",
]);

export default function ReservationsPage() {
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [groupBy, setGroupBy] = useState<"days" | "weeks" | "months">("days");
  // Vista del calendario estilo Google (mes/semana/día).
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const isMobile = useIsMobile();
  const [listSearchTerm, setListSearchTerm] = useState("");
  const [fincaDropdownSearch, setFincaDropdownSearch] = useState("");
  const [showDirectOnly, setShowDirectOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFincas, setSelectedFincas] = useState<string[]>([]);
  const [sendClientTemplateKey, setSendClientTemplateKey] =
    useState<string>("tourist_checkin_start");
  const [sendOwnerTemplateKey, setSendOwnerTemplateKey] =
    useState<string>("owner_arrival_tomorrow");
  const [templateAction, setTemplateAction] = useState<{
    key: string;
    type: "send" | "copy" | "share";
  } | null>(null);
  const [copiedTemplateKey, setCopiedTemplateKey] = useState<string | null>(
    null,
  );
  const [isSendingCheckinEmail, setIsSendingCheckinEmail] = useState(false);
  const [isMarkingCheckinSent, setIsMarkingCheckinSent] = useState(false);
  const [ownerMsgCopied, setOwnerMsgCopied] = useState(false);
  const [checkinReminderCopied, setCheckinReminderCopied] = useState(false);
  const [dayBeforeReminderCopied, setDayBeforeReminderCopied] = useState(false);
  const [dayFilter, setDayFilter] = useState<Date | null>(null);
  const [dailyExportFrom, setDailyExportFrom] = useState<Date>(() =>
    calendarDateToday(),
  );
  const [dailyExportTo, setDailyExportTo] = useState<Date>(() =>
    calendarDateToday(),
  );
  const [isDownloadingDaily, setIsDownloadingDaily] = useState(false);
  const [dailyDownloadDone, setDailyDownloadDone] = useState(false);
  // Buscador del calendario (estilo Google): CR / cliente / finca → salta a la reserva.
  const [calendarSearch, setCalendarSearch] = useState("");
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(
    null,
  );
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [bulkTemplateKey, setBulkTemplateKey] = useState<string>(
    "tourist_checkin_start",
  );
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isResyncingCalendar, setIsResyncingCalendar] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "resumen" | "pagos" | "mensajes" | "docs"
  >("resumen");
  // Pestaña Mensajes: solo el mensaje principal visible; el resto se despliega.
  const [showMoreMessages, setShowMoreMessages] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [checkoutMsgCopied, setCheckoutMsgCopied] = useState(false);
  const [checkoutLinkCopied, setCheckoutLinkCopied] = useState(false);
  const [shareGuestListWithOwner, setShareGuestListWithOwner] = useState(true);
  const [savingGuestListShare, setSavingGuestListShare] = useState(false);

  useEffect(() => {
    setDetailTab("resumen");
  }, [selectedBooking?._id]);

  useEffect(() => {
    setShareGuestListWithOwner(
      selectedBooking?.ownerPortalShare?.showGuestList !== false,
    );
  }, [
    selectedBooking?._id,
    selectedBooking?.ownerPortalShare?.showGuestList,
  ]);

  const handleQuickCopyCheckinLink = async () => {
    if (!selectedBooking?._id) return;
    // El link es determinista (mismo formato que el portal público), así que se
    // arma sin esperar al servidor: evita perder la "activación transitoria" del
    // clic, que en varios navegadores impide escribir en el portapapeles tras un await.
    const ref = selectedBooking.reference || selectedBooking._id;
    const link = `https://fincasya.com/checkin/${encodeURIComponent(ref)}`;
    const markCopied = () => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success("Link de check-in copiado");
    };
    try {
      await navigator.clipboard.writeText(link);
      markCopied();
    } catch {
      // Fallback para contextos sin Clipboard API.
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        ta.remove();
        markCopied();
      } catch {
        toast.error("No se pudo copiar el link.");
      }
    }
  };

  // Mensaje de invitación al check-in (texto que se copia / envía al cliente).
  const buildCheckinInviteMessage = (): string => {
    if (!selectedBooking?._id) return "";
    const ref = selectedBooking.reference || selectedBooking._id;
    const nombre = (selectedBooking.nombreCompleto || "").trim().split(/\s+/)[0];
    const finca =
      selectedBooking.property?.title ||
      selectedBooking.propertyTitle ||
      "tu finca";
    const fechaLargaRaw = selectedBooking.fechaEntrada
      ? format(
          new Date(selectedBooking.fechaEntrada),
          "EEEE d 'de' MMMM 'de' yyyy",
          { locale: es },
        )
      : "";
    const fechaLarga = fechaLargaRaw
      ? fechaLargaRaw.charAt(0).toUpperCase() + fechaLargaRaw.slice(1)
      : "";
    // Hora de ingreso: usa horaEntrada (texto) y cae al timestamp de llegada.
    const horaRaw = String(selectedBooking.horaEntrada ?? "").trim();
    const horaMatch = /^(\d{1,2}):(\d{2})$/.exec(horaRaw);
    let hora = "";
    if (horaMatch) {
      let h = parseInt(horaMatch[1], 10);
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      hora = `${h}:${horaMatch[2]} ${ap}`;
    } else if (horaRaw) {
      hora = horaRaw;
    } else if (selectedBooking.fechaEntrada) {
      hora = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Bogota",
      }).format(new Date(selectedBooking.fechaEntrada));
    }
    const link = `https://fincasya.com/checkin/${encodeURIComponent(ref)}`;
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
  };

  const handleCopyCheckinInvite = async () => {
    const message = buildCheckinInviteMessage();
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
      toast.success("Mensaje de check-in copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje.");
    }
  };

  const handleQuickShareWhatsApp = async () => {
    const message = buildCheckinInviteMessage();
    if (!message) {
      toast.error("No se pudo armar el mensaje de check-in.");
      return;
    }
    openWhatsAppWithMessage(message, selectedBooking.celular);
  };

  // Check-out: enlace + mensaje de devolución del depósito para el cliente.
  const buildCheckoutLink = (): string => {
    if (!selectedBooking?._id) return "";
    const ref = selectedBooking.reference || selectedBooking._id;
    return `https://fincasya.com/checkout/${encodeURIComponent(ref)}`;
  };

  const buildCheckoutMessage = (): string => {
    if (!selectedBooking?._id) return "";
    const nombre = (selectedBooking.nombreCompleto || "").trim().split(/\s+/)[0];
    const finca =
      selectedBooking.property?.title ||
      selectedBooking.propertyTitle ||
      "tu finca";
    const fecha = selectedBooking.fechaSalida
      ? format(new Date(selectedBooking.fechaSalida), "d 'de' MMMM", {
          locale: es,
        })
      : "";
    return (
      `Hola${nombre ? " " + nombre : ""} 👋\n` +
      `Para tu salida de *${finca}*${fecha ? ` el ${fecha}` : ""}, aquí están las reglas de salida y el formulario para la devolución de tu depósito 👉\n` +
      `${buildCheckoutLink()}\n\n` +
      `🏡 FincasYa.com`
    );
  };

  const handleCopyCheckoutLink = async () => {
    const link = buildCheckoutLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCheckoutLinkCopied(true);
      setTimeout(() => setCheckoutLinkCopied(false), 2000);
      toast.success("Link de check-out copiado");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  };

  const handleCopyCheckoutMessage = async () => {
    const msg = buildCheckoutMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setCheckoutMsgCopied(true);
      setTimeout(() => setCheckoutMsgCopied(false), 2000);
      toast.success("Mensaje de check-out copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje.");
    }
  };

  const handleShareCheckoutWhatsApp = () => {
    const msg = buildCheckoutMessage();
    if (!msg) return;
    openWhatsAppWithMessage(msg, selectedBooking.celular);
  };

  const toWhatsAppPhone = (phone: string): string | null => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("57") && digits.length >= 12) return digits;
    if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
    if (digits.length === 11 && digits.startsWith("3")) return `57${digits}`;
    if (digits.length > 10) {
      return digits.startsWith("57") ? digits : `57${digits.slice(-10)}`;
    }
    return null;
  };

  const fetchTemplatePreview = async (
    templateKey: string,
  ): Promise<string | null> => {
    if (!selectedBooking || !templateKey) return null;
    const preview = await loadTemplatePreview(
      selectedBooking._id,
      templateKey,
    );
    if (!preview) {
      toast.error("No se pudo generar el texto del mensaje.");
    }
    return preview;
  };

  const isTemplateBusy = (key: string, type: "send" | "copy" | "share") =>
    templateAction?.key === key && templateAction?.type === type;
  const [isDownloadingGuestsPdf, setIsDownloadingGuestsPdf] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Show status toasts based on query params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const migrate = searchParams.get("migrate");
    if (success) {
      if (migrate === "1") {
        toast.success(
          "Calendario conectado. Usa «Migrar reservas» para copiarlas al nuevo calendario.",
          { duration: 9000 },
        );
      } else {
        toast.success("¡Google Calendar conectado correctamente!");
      }
      router.replace("/admin/reservations");
    }
    if (error) {
      toast.error(`Error de conexión: ${error}`);
      router.replace("/admin/reservations");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (dayFilter) {
      const day = new Date(
        dayFilter.getFullYear(),
        dayFilter.getMonth(),
        dayFilter.getDate(),
      );
      setDailyExportFrom(day);
      setDailyExportTo(day);
    }
  }, [dayFilter]);

  // Fincas (lista simple) — Convex directo, reactivo.
  const { data: properties, isLoading: isLoadingProps } = usePropertiesSimple();

  // Fetch reservations (mes completo en días/semanas; año completo en vista meses)
  const reservationsScope =
    groupBy === "months"
      ? format(date, "yyyy")
      : format(date, "yyyy-MM");

  // Reservas del período — Convex directo y REACTIVO: se actualizan en vivo
  // cuando cambia cualquier reserva (ya no hace falta el polling de 30s).
  const {
    data: reservations,
    isLoading,
    refetch: refetchBookings,
  } = useReservationsList(
    groupBy === "months"
      ? { year: format(date, "yyyy") }
      : { month: format(date, "MM"), year: format(date, "yyyy") },
  );

  // Auto-open booking from URL
  useEffect(() => {
    const bookingId = searchParams.get("bookingId");
    if (bookingId && reservations && !selectedBooking) {
      const booking = (reservations as any[]).find((b) => b._id === bookingId);
      if (booking) {
        setSelectedBooking(booking);
        // Clear param to avoid re-opening if user closes modal
        const params = new URLSearchParams(searchParams.toString());
        params.delete("bookingId");
        const newSearch = params.toString();
        router.replace(
          `/admin/reservations${newSearch ? `?${newSearch}` : ""}`,
        );
      }
    }
  }, [searchParams, reservations, selectedBooking, router]);

  // Estado de Google Calendar — Convex directo, reactivo.
  const {
    data: calendarStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useCalendarStatus();

  // Desglose de precio de la reserva seleccionada — Convex directo, reactivo.
  const {
    data: selectedBookingPriceDetails,
  } = useBookingPriceDetails(selectedBooking);

  // Cliente Convex para queries imperativas dentro de handlers (Excel, etc.).
  const convex = useConvex();
  const removeBookingMut = useConvexMutation(convexApi.bookings.remove);

  // Resumen de abonos de la reserva seleccionada — reactivo (para el bloque
  // "de un vistazo" del modal: total / abonado / pendiente).
  const selectedBookingPayments = useConvexQuery(
    convexApi.bookings.getPaymentsByBooking,
    selectedBooking?._id
      ? { bookingId: selectedBooking._id as Id<"bookings"> }
      : "skip",
  );

  // Plantillas de WhatsApp (check-in / salida) para envío manual
  const { data: checkinTemplates } = useQuery({
    queryKey: ["checkin-templates"],
    queryFn: async () => {
      const { data } = await axios.get("/api/bookings/checkin/templates");
      return (Array.isArray(data) ? data : []) as Array<{
        key: string;
        name: string;
        bodyText: string;
        paramKeys: string[];
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const clientCheckinTemplates = useMemo(
    () =>
      (checkinTemplates || []).filter(
        (t) => !OWNER_CHECKIN_TEMPLATE_KEYS.has(t.key),
      ),
    [checkinTemplates],
  );

  const ownerCheckinTemplates = useMemo(
    () =>
      (checkinTemplates || []).filter((t) =>
        OWNER_CHECKIN_TEMPLATE_KEYS.has(t.key),
      ),
    [checkinTemplates],
  );

  const loadTemplatePreview = async (
    bookingId: string,
    templateKey: string,
  ): Promise<string | null> => {
    const { data } = await axios.post(
      `/api/bookings/checkin/${bookingId}/send`,
      { templateKey, dryRun: true },
    );
    if (!data?.ok || !data?.preview) return null;
    return data.preview as string;
  };

  const { data: clientTemplatePreview, isLoading: isLoadingClientTemplatePreview } =
    useQuery({
      queryKey: [
        "template-preview",
        selectedBooking?._id,
        sendClientTemplateKey,
      ],
      queryFn: () =>
        loadTemplatePreview(selectedBooking!._id, sendClientTemplateKey),
      enabled:
        Boolean(selectedBooking?._id && sendClientTemplateKey) &&
        detailTab === "mensajes",
      staleTime: 60_000,
    });

  const { data: ownerTemplatePreview, isLoading: isLoadingOwnerTemplatePreview } =
    useQuery({
      queryKey: [
        "template-preview",
        selectedBooking?._id,
        sendOwnerTemplateKey,
      ],
      queryFn: () =>
        loadTemplatePreview(selectedBooking!._id, sendOwnerTemplateKey),
      enabled:
        Boolean(selectedBooking?._id && sendOwnerTemplateKey) &&
        detailTab === "mensajes",
      staleTime: 60_000,
    });

  const handleSendTemplate = async (templateKey: string) => {
    if (!selectedBooking || !templateKey) return;
    setTemplateAction({ key: templateKey, type: "send" });
    try {
      const { data } = await axios.post(
        `/api/bookings/checkin/${selectedBooking._id}/send`,
        { templateKey },
      );
      if (data?.ok) {
        toast.success(
          `Plantilla enviada por WhatsApp a ${data.to || "el destinatario"}`,
        );
      } else {
        toast.error(data?.error || "No se pudo enviar la plantilla");
      }
    } catch {
      toast.error(
        "Error al enviar la plantilla. Verifica que esté aprobada en Meta.",
      );
    } finally {
      setTemplateAction(null);
    }
  };

  const handleSendCheckinEmail = async () => {
    if (!selectedBooking?._id) return;
    setIsSendingCheckinEmail(true);
    try {
      const { data } = await axios.post(
        `/api/bookings/checkin/${selectedBooking._id}/send-email`,
      );
      if (data?.ok) {
        toast.success(`Correo de check-in enviado a ${data.to}`);
      } else {
        toast.error(data?.error || "No se pudo enviar el correo");
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Error al enviar el correo de check-in";
      toast.error(msg);
    } finally {
      setIsSendingCheckinEmail(false);
    }
  };

  const buildOwnerMessage = (): { msg: string; phone: string | null } => {
    if (!selectedBooking?._id) return { msg: "", phone: null };
    const ref = selectedBooking.reference || selectedBooking._id;
    const finca =
      selectedBooking.property?.title ||
      selectedBooking.propertyTitle ||
      "tu finca";
    // Saludo: "señor/a + nombre y primer apellido" (no nombre completo).
    const ownerParts = (selectedBooking.property?.propietarioNombre || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const ownerNombreApellido = ownerParts.slice(0, 2).join(" ");
    const trato = propietarioTratoLabel(
      selectedBooking.property?.propietarioTratamiento,
    );
    const saludo = ownerNombreApellido
      ? `Hola, ${trato} ${ownerNombreApellido} 👋\n`
      : `Hola 👋\n`;
    const fmtCOP = (n: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(n);
    const op = selectedBooking.ownerPayout || {};
    const valorAcordado = Number(op.valorAcordado || 0);
    const abonoFromList = Array.isArray(op.abonos)
      ? op.abonos.reduce(
          (sum: number, a: { amount?: number }) =>
            sum + (Number(a.amount) || 0),
          0,
        )
      : 0;
    const abonoProp =
      abonoFromList > 0 ? abonoFromList : Number(op.abono || 0);
    const saldoProp = Math.max(0, valorAcordado - abonoProp);
    const saldoLinea =
      valorAcordado > 0
        ? `💵 Saldo pendiente por pagarte: *${fmtCOP(saldoProp)}* (total ${fmtCOP(valorAcordado)}, abono ${fmtCOP(abonoProp)}).\n\n`
        : "";
    const fecha = selectedBooking.fechaEntrada
      ? format(new Date(selectedBooking.fechaEntrada), "EEEE d 'de' MMMM", {
          locale: es,
        })
      : "";
    const fechaSalida = selectedBooking.fechaSalida
      ? format(new Date(selectedBooking.fechaSalida), "EEEE d 'de' MMMM", {
          locale: es,
        })
      : "";
    const horaRaw = String(selectedBooking.horaEntrada ?? "").trim();
    const horaMatch = /^(\d{1,2}):(\d{2})$/.exec(horaRaw);
    let hora = "";
    if (horaMatch) {
      let h = parseInt(horaMatch[1], 10);
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      hora = `${h}:${horaMatch[2]} ${ap}`;
    } else if (horaRaw) {
      hora = horaRaw;
    }
    const personas = selectedBooking.numeroPersonas;
    const listadoListo =
      Boolean(selectedBooking.checkinCompleted) ||
      (Array.isArray(selectedBooking.checkinGuests) &&
        selectedBooking.checkinGuests.length > 0);
    const guestListRequired =
      selectedBooking.property?.requiresGuestList !== false;
    const showGuestListToOwner =
      selectedBooking.ownerPortalShare?.showGuestList !== false;
    const link = `https://fincasya.com/anfitrion/${encodeURIComponent(ref)}`;
    const fechasLinea =
      fecha && fechaSalida
        ? `📅 Entrada: ${fecha} · Salida: ${fechaSalida}\n`
        : fecha
          ? `📅 Entrada: ${fecha}\n`
          : "";
    // Lo que pidió el turista en el check-in: empleada + nota de servicios,
    // mascotas y novedad. Se incluye en el propio mensaje para que el
    // propietario lo vea de una vez (no solo dentro del enlace).
    const empleadaSolicitada = selectedBooking.checkinNeedsTeam
      ? "Sí, varias"
      : selectedBooking.checkinNeedsEmpleada
        ? "Sí"
        : null;
    const serviciosNota = String(
      selectedBooking.checkinServiciosNota ?? "",
    ).trim();
    const numMascotas =
      typeof selectedBooking.checkinMascotas === "number"
        ? selectedBooking.checkinMascotas
        : Number(selectedBooking.numeroMascotas) || 0;
    const obsTurista = String(
      selectedBooking.checkinObservaciones ?? "",
    ).trim();
    const solicitudesLineas = [
      empleadaSolicitada
        ? `🧹 Empleada de servicio: ${empleadaSolicitada}${serviciosNota ? ` — "${serviciosNota}"` : ""}`
        : serviciosNota
          ? `🧹 Servicio solicitado: "${serviciosNota}"`
          : "",
      numMascotas > 0
        ? `🐾 Mascotas: sí, van ${numMascotas} mascota${numMascotas === 1 ? "" : "s"}`
        : "",
      obsTurista ? `📝 Nota del turista: ${obsTurista}` : "",
    ].filter(Boolean);
    const solicitudesBloque =
      solicitudesLineas.length > 0
        ? `🔔 *Lo que pidió el turista:*\n${solicitudesLineas.join("\n")}\n\n`
        : "";
    const msg =
      saludo +
      (guestListRequired && showGuestListToOwner
        ? `Tienes una reserva en tu finca *${finca}*. En este enlace encontrarás la *lista de invitados, placas de vehículos, posible hora de llegada* y toda la información de tu reserva.\n\n`
        : `Tienes una reserva en tu finca *${finca}*. En este enlace encontrarás *placas de vehículos, posible hora de llegada* y toda la información de tu reserva.\n\n`) +
      fechasLinea +
      (personas ? `👥 Personas: ${personas}\n` : "") +
      (hora
        ? `🕒 Hora de llegada: ${hora}\n`
        : `🕒 Hora de llegada: aún sin confirmar (la validamos con el turista).\n`) +
      `\n` +
      saldoLinea +
      (guestListRequired && showGuestListToOwner
        ? listadoListo
          ? `📋 Mira el estado del check-in y *descarga el PDF de invitados* aquí 👉\n${link}\n\n`
          : `📋 El listado de invitados lo enviaremos máximo 24 h antes de la llegada. Míralo aquí 👉\n${link}\n\n`
        : `📋 Mira el estado de tu reserva aquí 👉\n${link}\n\n`) +
      solicitudesBloque +
      `🔑 ¿Quién recibe a los turistas ese día? Déjanos el nombre y contacto en el enlace.\n\n` +
      `🔄 Siempre puedes entrar aquí a validar el estado de tu reserva.\n` +
      `💬 Cualquier duda, escríbenos por *Soporte*. 🏡 FincasYa`;
    const phone = toWhatsAppPhone(
      selectedBooking.property?.propietarioTelefono || "",
    );
    return { msg, phone };
  };

  const handleSendOwnerLink = () => {
    const { msg, phone } = buildOwnerMessage();
    if (!msg) return;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(
      phone
        ? "Abriendo WhatsApp con el mensaje al propietario"
        : "Abriendo WhatsApp — elige el propietario y envía",
    );
  };

  const handleCopyOwnerMessage = async () => {
    const { msg } = buildOwnerMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setOwnerMsgCopied(true);
      setTimeout(() => setOwnerMsgCopied(false), 2000);
      toast.success("Mensaje copiado — pégalo donde quieras");
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  };

  const handleToggleGuestListShare = async (enabled: boolean) => {
    if (!selectedBooking?._id) return;
    setShareGuestListWithOwner(enabled);
    setSavingGuestListShare(true);
    try {
      await axios.post(
        `/api/bookings/${selectedBooking._id}/owner-portal-share`,
        { showGuestList: enabled },
      );
      setSelectedBooking((prev: any) =>
        prev
          ? {
              ...prev,
              ownerPortalShare: {
                ...(prev.ownerPortalShare ?? {}),
                showGuestList: enabled,
              },
            }
          : prev,
      );
      toast.success(
        enabled
          ? "El propietario verá el listado de invitados en su enlace"
          : "Listado de invitados oculto para el propietario",
      );
    } catch {
      setShareGuestListWithOwner(!enabled);
      toast.error("No se pudo guardar la preferencia");
    } finally {
      setSavingGuestListShare(false);
    }
  };

  // Override del equipo: habilitar/bloquear la edición de la lista de invitados.
  const [savingGuestUnlock, setSavingGuestUnlock] = useState(false);
  const handleToggleGuestListUnlock = async (enabled: boolean) => {
    if (!selectedBooking?._id) return;
    setSavingGuestUnlock(true);
    try {
      await axios.post(
        `/api/bookings/${selectedBooking._id}/guest-list-unlock`,
        { unlocked: enabled },
      );
      setSelectedBooking((prev: any) =>
        prev ? { ...prev, guestListUnlocked: enabled } : prev,
      );
      toast.success(
        enabled
          ? "Edición de invitados habilitada. El turista ya puede editar su lista."
          : "Edición de invitados bloqueada de nuevo.",
      );
    } catch {
      toast.error("No se pudo cambiar el bloqueo de invitados.");
    } finally {
      setSavingGuestUnlock(false);
    }
  };

  // Recordatorio al cliente para finalizar el check-in (check-in + listado pendientes).
  const buildCheckinReminderMessage = (): {
    msg: string;
    phone: string | null;
  } => {
    if (!selectedBooking?._id) return { msg: "", phone: null };
    const ref = selectedBooking.reference || selectedBooking._id;
    const finca =
      selectedBooking.property?.title ||
      selectedBooking.propertyTitle ||
      "tu finca";
    const nombre = (selectedBooking.nombreCompleto || "").trim().split(/\s+/)[0];
    const fechaIngreso = selectedBooking.fechaEntrada
      ? format(new Date(selectedBooking.fechaEntrada), "d 'de' MMMM", {
          locale: es,
        })
      : "";
    const fechaSalida = selectedBooking.fechaSalida
      ? format(new Date(selectedBooking.fechaSalida), "d 'de' MMMM", {
          locale: es,
        })
      : "";
    const rango = fechaIngreso
      ? fechaSalida
        ? `del *${fechaIngreso}* al *${fechaSalida}*`
        : `del *${fechaIngreso}*`
      : "";
    const guests = Array.isArray(selectedBooking.checkinGuests)
      ? selectedBooking.checkinGuests
      : [];
    const estadoCheckin = selectedBooking.checkinCompleted
      ? "✅ Completado"
      : "⏳ Pendiente";
    const estadoListado =
      guests.length > 0
        ? `✅ ${guests.length} ${guests.length === 1 ? "registrado" : "registrados"}`
        : "⏳ Pendiente";
    const link = `https://fincasya.com/checkin/${encodeURIComponent(ref)}`;
    const msg =
      `🚨 *Hola${nombre ? ", " + nombre : ""}*\n\n` +
      `Te damos la bienvenida a *${finca}*. Estamos preparando todo para tu llegada${rango ? " " + rango : ""} y, para que tu ingreso sea ágil y sin contratiempos, aún necesitamos que completes:\n\n` +
      `📋 *Check-in:* ${estadoCheckin}\n` +
      `👥 *Listado de invitados:* ${estadoListado}\n\n` +
      `🧹 *¿Quieres servicio de empleada doméstica?* Las solicitudes no confirmadas con anticipación quedan sujetas a disponibilidad; si no la confirmas pronto, es posible que ya no podamos garantizar su asignación.\n\n` +
      `👉 Completa lo pendiente aquí:\n${link}\n\n` +
      `Quedamos atentos para apoyarte en lo que necesites. ¡Te esperamos en *${finca}*! 🏡`;
    const phone = toWhatsAppPhone(selectedBooking.celular || "");
    return { msg, phone };
  };

  const handleCopyCheckinReminder = async () => {
    const { msg } = buildCheckinReminderMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setCheckinReminderCopied(true);
      setTimeout(() => setCheckinReminderCopied(false), 2000);
      toast.success("Recordatorio copiado — pégalo donde quieras");
    } catch {
      toast.error("No se pudo copiar el recordatorio");
    }
  };

  const handleSendCheckinReminderWhatsApp = () => {
    const { msg, phone } = buildCheckinReminderMessage();
    if (!msg) return;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(
      phone
        ? "Abriendo WhatsApp con el recordatorio para el cliente"
        : "Abriendo WhatsApp — elige el cliente y envía",
    );
  };

  // Recordatorio "un día antes": el ingreso es mañana, el check-in debe quedar hoy.
  const buildDayBeforeReminderMessage = (): {
    msg: string;
    phone: string | null;
  } => {
    if (!selectedBooking?._id) return { msg: "", phone: null };
    const ref = selectedBooking.reference || selectedBooking._id;
    const nombre = (selectedBooking.nombreCompleto || "").trim().split(/\s+/)[0];
    const finca =
      selectedBooking.property?.title ||
      selectedBooking.propertyTitle ||
      "tu finca";
    const link = `https://fincasya.com/checkin/${encodeURIComponent(ref)}`;
    const fechaLargaRaw = selectedBooking.fechaEntrada
      ? format(
          new Date(selectedBooking.fechaEntrada),
          "EEEE d 'de' MMMM 'de' yyyy",
          { locale: es },
        )
      : "";
    const fechaLarga = fechaLargaRaw
      ? fechaLargaRaw.charAt(0).toUpperCase() + fechaLargaRaw.slice(1)
      : "";
    const diaIngreso = selectedBooking.fechaEntrada
      ? `el ${format(new Date(selectedBooking.fechaEntrada), "EEEE", {
          locale: es,
        })}`
      : "mañana";
    const horaRaw = String(selectedBooking.horaEntrada ?? "").trim();
    const horaMatch = /^(\d{1,2}):(\d{2})$/.exec(horaRaw);
    let hora = "";
    if (horaMatch) {
      let h = parseInt(horaMatch[1], 10);
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      hora = `${h}:${horaMatch[2]} ${ap}`;
    } else if (horaRaw) {
      hora = horaRaw;
    } else if (selectedBooking.fechaEntrada) {
      hora = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Bogota",
      }).format(new Date(selectedBooking.fechaEntrada));
    }
    const horaBloque = hora
      ? `🕒 Hora de ingreso: ${hora}*\n*Puedes ir actualizando tu hora de llegada en el check-in a medida que planees tu viaje.\n\n`
      : "";
    const msg =
      `Hola, ${nombre || "👋"}. 😊\n` +
      `Queremos que tu llegada *${diaIngreso}* a *${finca}* sea cómoda y organizada. El check-in debe quedar *completado hoy*.\n\n` +
      (fechaLarga ? `📅 ${fechaLarga}\n` : "") +
      horaBloque +
      `⚠️ Sin el check-in finalizado no podremos garantizar tu ingreso a la propiedad. Si ya lo realizaste, ¡no te preocupes! Todo está listo y en orden para tu llegada. ¡Te esperamos!\n\n` +
      `⏰ Importante: ${diaIngreso}, cuando inicies tu viaje, avísanos e indícanos tu tiempo por *GPS*. Confírmanos cuando estés a tan solo *40 minutos* de la propiedad.\n\n` +
      `✅ Pago: no necesitas realizarlo con 36 horas de anticipación, pero sí debe estar efectuado y confirmado al 100% *antes de la entrega formal del inventario*.\n\n` +
      `👉 Completa o revisa tu check-in aquí:\n${link}\n\n` +
      `Gracias por tu colaboración. Quedamos atentos si tienes algún requerimiento especial. 🤝`;
    const phone = toWhatsAppPhone(selectedBooking.celular || "");
    return { msg, phone };
  };

  const handleCopyDayBeforeReminder = async () => {
    const { msg } = buildDayBeforeReminderMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setDayBeforeReminderCopied(true);
      setTimeout(() => setDayBeforeReminderCopied(false), 2000);
      toast.success("Recordatorio (un día antes) copiado");
    } catch {
      toast.error("No se pudo copiar el recordatorio");
    }
  };

  const handleSendDayBeforeReminderWhatsApp = () => {
    const { msg, phone } = buildDayBeforeReminderMessage();
    if (!msg) return;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(
      phone
        ? "Abriendo WhatsApp con el recordatorio de un día antes"
        : "Abriendo WhatsApp — elige el cliente y envía",
    );
  };

  const handleMarkCheckinSent = async () => {
    if (!selectedBooking?._id) return;
    const sent = !selectedBooking.checkinSentManualAt;
    setIsMarkingCheckinSent(true);
    try {
      await axios.post(
        `/api/bookings/checkin/${selectedBooking._id}/mark-sent`,
        { sent },
      );
      setSelectedBooking((prev: any) =>
        prev ? { ...prev, checkinSentManualAt: sent ? Date.now() : null } : prev,
      );
      toast.success(
        sent
          ? "Reserva marcada como check-in enviado (morado)"
          : "Marca de check-in enviado retirada",
      );
      void refetchBookings();
    } catch {
      toast.error("No se pudo actualizar el estado del check-in");
    } finally {
      setIsMarkingCheckinSent(false);
    }
  };

  const handleCopyTemplateText = async (templateKey: string) => {
    if (!selectedBooking || !templateKey) return;
    setTemplateAction({ key: templateKey, type: "copy" });
    try {
      const preview = await fetchTemplatePreview(templateKey);
      if (!preview) return;
      await navigator.clipboard.writeText(preview);
      setCopiedTemplateKey(templateKey);
      setTimeout(() => setCopiedTemplateKey(null), 2000);
      toast.success("Texto copiado — pégalo en WhatsApp u otro chat");
    } catch {
      toast.error("No se pudo copiar el texto.");
    } finally {
      setTemplateAction(null);
    }
  };

  const handleShareTemplateWhatsApp = async (
    templateKey: string,
    audience: "client" | "owner",
  ) => {
    if (!selectedBooking || !templateKey) return;
    setTemplateAction({ key: templateKey, type: "share" });
    try {
      const preview = await fetchTemplatePreview(templateKey);
      if (!preview) return;
      const phone =
        audience === "owner"
          ? toWhatsAppPhone(selectedBooking.property?.propietarioTelefono || "")
          : toWhatsAppPhone(selectedBooking.celular || "");
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(preview)}`
        : `https://wa.me/?text=${encodeURIComponent(preview)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(
        phone
          ? audience === "owner"
            ? "Abriendo WhatsApp con el mensaje al propietario"
            : "Abriendo WhatsApp con el mensaje listo para enviar"
          : audience === "owner"
            ? "Abriendo WhatsApp — elige el propietario y envía"
            : "Abriendo WhatsApp — elige el contacto y envía el mensaje",
      );
    } catch {
      toast.error("No se pudo abrir WhatsApp.");
    } finally {
      setTemplateAction(null);
    }
  };

  const templateHasCheckinLink = (templateKey: string) =>
    checkinTemplates
      ?.find((t) => t.key === templateKey)
      ?.paramKeys?.includes("linkCheckin") ?? false;

  // Copiar mensaje de check-in (resumen + cuentas + link) de la reserva abierta.
  const handleCopySingleLink = async () => {
    if (!selectedBooking?._id) return;
    setIsCopyingLink(true);
    try {
      const message = await fetchCheckinShareMessage({
        bookingId: selectedBooking._id,
        reference: selectedBooking.reference || selectedBooking._id,
        clientName: selectedBooking.nombreCompleto,
        propertyName:
          selectedBooking.property?.title || selectedBooking.propertyTitle,
        checkInDate: selectedBooking.fechaEntrada
          ? format(new Date(selectedBooking.fechaEntrada), "dd MMM yyyy", {
              locale: es,
            })
          : undefined,
        breakdown: computeReservationBreakdownLines(selectedBooking),
        total: selectedBooking.precioTotal || 0,
      });
      if (!message) {
        toast.error("No se pudo armar el mensaje de check-in.");
        return;
      }
      await navigator.clipboard.writeText(message);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Mensaje de check-in copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje.");
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleDownloadGuestsPdf = async () => {
    if (!selectedBooking) return;
    const guests = Array.isArray(selectedBooking.checkinGuests)
      ? selectedBooking.checkinGuests
      : [];
    if (guests.length === 0) {
      toast.error("No hay invitados registrados para exportar.");
      return;
    }

    setIsDownloadingGuestsPdf(true);
    try {
      const result = await downloadCheckinGuestsPdf({
        propertyTitle:
          selectedBooking.property?.title ||
          selectedBooking.propertyTitle ||
          "Propiedad",
        propertyLocation: selectedBooking.property?.location || undefined,
        guestName: selectedBooking.nombreCompleto || "—",
        contractNumber: selectedBooking.reference || undefined,
        checkInDate: format(
          new Date(selectedBooking.fechaEntrada),
          "d 'de' MMMM 'de' yyyy",
          { locale: es },
        ),
        checkOutDate: format(
          new Date(selectedBooking.fechaSalida),
          "d 'de' MMMM 'de' yyyy",
          { locale: es },
        ),
        guests,
        minorsUnder2: selectedBooking.checkinMenoresDe2 || undefined,
        vehiclePlates: selectedBooking.checkinPlacas || undefined,
        petsAllowed: Boolean(
          selectedBooking.checkinMascotas != null ||
            selectedBooking.tieneMascotas ||
            (selectedBooking.numeroMascotas ?? 0) > 0,
        ),
        petCount:
          selectedBooking.checkinMascotas ??
          selectedBooking.numeroMascotas ??
          0,
        needsEmpleada: selectedBooking.checkinNeedsEmpleada || undefined,
        needsTeam: selectedBooking.checkinNeedsTeam || undefined,
        servicesNote: selectedBooking.checkinServiciosNota || undefined,
        checkinCompleted: selectedBooking.checkinCompleted || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Lista de invitados descargada en PDF.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo descargar el PDF.";
      toast.error(message);
    } finally {
      setIsDownloadingGuestsPdf(false);
    }
  };

  const handleDownloadDailyReservations = async () => {
    setIsDownloadingDaily(true);
    setDailyDownloadDone(false);
    const loadingId = toast.loading("Generando Excel de reservas…", {
      description: "Esto puede tardar unos segundos.",
    });
    try {
      const { dateFrom, dateTo } = colombiaDayRangeBounds(
        dailyExportFrom,
        dailyExportTo,
      );
      // Datos del reporte — Convex directo (antes /api/bookings/reports → 405).
      const data = await convex.query(convexApi.bookings.listForReports, {
        dateFrom,
        dateTo,
        ...(selectedFincas.length === 1
          ? { propertyId: selectedFincas[0] as Id<"properties"> }
          : {}),
      });
      let rows: ReportBookingRow[] = Array.isArray(data?.rows)
        ? (data.rows as ReportBookingRow[])
        : [];

      if (selectedFincas.length > 1) {
        const fincaSet = new Set(selectedFincas);
        rows = rows.filter((r) => r.propertyId && fincaSet.has(r.propertyId));
      }

      rows = rows.filter(
        (r) => r.fechaEntrada >= dateFrom && r.fechaEntrada <= dateTo,
      );

      if (rows.length === 0) {
        toast.dismiss(loadingId);
        toast.info("No hay reservas con ingreso en ese rango de fechas.", {
          duration: 5000,
        });
        return;
      }

      const from = dailyExportFrom.getTime() <= dailyExportTo.getTime()
        ? dailyExportFrom
        : dailyExportTo;
      const to = dailyExportFrom.getTime() <= dailyExportTo.getTime()
        ? dailyExportTo
        : dailyExportFrom;

      const { filename, rowCount } = await downloadDailyReservationsExcel(
        from,
        to,
        rows,
      );

      toast.dismiss(loadingId);
      const sameDay = isSameDay(from, to);
      toast.success("Excel descargado correctamente", {
        description: sameDay
          ? `${rowCount} reserva${rowCount === 1 ? "" : "s"} del ${format(from, "d 'de' MMMM", { locale: es })} · ${filename}`
          : `${rowCount} reservas del ${format(from, "d MMM", { locale: es })} al ${format(to, "d MMM", { locale: es })} · ${filename}`,
        duration: 8000,
      });
      setDailyDownloadDone(true);
      window.setTimeout(() => setDailyDownloadDone(false), 3000);
    } catch (error) {
      toast.dismiss(loadingId);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo descargar el reporte.";
      toast.error("No se pudo generar el Excel", {
        description: message,
        duration: 7000,
      });
    } finally {
      setIsDownloadingDaily(false);
    }
  };

  const toggleBookingSelection = (id: string) =>
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleBulkSend = async () => {
    if (selectedBookingIds.length === 0 || !bulkTemplateKey) return;
    setIsBulkSending(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedBookingIds) {
      try {
        const { data } = await axios.post(
          `/api/bookings/checkin/${id}/send`,
          { templateKey: bulkTemplateKey },
        );
        if (data?.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setIsBulkSending(false);
    if (ok > 0) {
      toast.success(
        `Plantilla enviada a ${ok} reserva(s)${fail ? `, ${fail} con error` : ""}`,
      );
      setSelectedBookingIds([]);
    } else {
      toast.error(
        "No se pudo enviar a ninguna reserva. Verifica teléfonos y que la plantilla esté aprobada en Meta.",
      );
    }
  };

  // Copiar link(s) de check-in al portapapeles, sin enviar por WhatsApp.
  const handleBulkCopy = async () => {
    if (selectedBookingIds.length === 0) return;
    setIsCopyingLink(true);
    try {
      const links: string[] = [];
      for (const id of selectedBookingIds) {
        try {
          const link = await fetchCheckinLink(id);
          if (link) links.push(link);
        } catch {
          /* omitir la que falle */
        }
      }
      if (links.length === 0) {
        toast.error("No se pudo obtener el link de check-in.");
        return;
      }
      await navigator.clipboard.writeText(links.join("\n"));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success(
        links.length === 1
          ? "Link de check-in copiado"
          : `${links.length} links copiados`,
      );
    } catch {
      toast.error("No se pudo copiar el link.");
    } finally {
      setIsCopyingLink(false);
    }
  };

  // Google Calendar — acciones/mutations Convex directas (OAuth).
  const generateAuthUrlAction = useAction(convexApi.googleCalendar.generateAuthUrl);
  const disconnectCalendarMut = useConvexMutation(
    convexApi.googleCalendar.disconnect,
  );
  const resyncCalendarAction = useAction(
    convexApi.googleCalendar.resyncAllBookingsToCalendar,
  );

  const handleConnect = async () => {
    try {
      // El callback debe apuntar al MISMO origin (dev: :3789, prod: dominio real)
      // y estar registrado en Google Cloud Console como redirect URI autorizado.
      const redirectUri = `${window.location.origin}/api/admin/calendar-callback`;
      const url = await generateAuthUrlAction({ redirectUri });
      if (url) {
        window.location.href = url;
      }
    } catch {
      toast.error("No se pudo iniciar la conexión con Google");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectCalendarMut({});
      toast.success("Integración desconectada");
      // Convex reactivo: el estado se refresca solo; refetchStatus queda no-op.
    } catch {
      toast.error("Error al desconectar");
    }
  };

  const handleResyncCalendar = async () => {
    if (!isConnected) {
      toast.error("Primero conecta el calendario comercial@fincasya.com");
      return;
    }
    const confirmed = window.confirm(
      "Esto volverá a crear los eventos de reserva en el calendario conectado (comercial@fincasya.com). Las reservas en FincasYa no se borran. ¿Continuar?",
    );
    if (!confirmed) return;

    setIsResyncingCalendar(true);
    try {
      const data = await resyncCalendarAction({ includePast: true });
      toast.success(
        `Migración iniciada: ${data?.scheduled ?? 0} reservas en cola para ${data?.connectedEmail || "el calendario conectado"}.`,
        { duration: 8000 },
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo migrar las reservas al calendario",
      );
    } finally {
      setIsResyncingCalendar(false);
    }
  };

  // --- DRAG TO SCROLL LOGIC ---
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isScrolling, setIsScrolling] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDown.current = true;
    setIsScrolling(true);
    scrollRef.current.classList.add("cursor-grabbing");
    scrollRef.current.classList.remove("cursor-grab");
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };
  const onMouseLeave = () => {
    if (!scrollRef.current) return;
    isDown.current = false;
    setIsScrolling(false);
    scrollRef.current.classList.add("cursor-grab");
    scrollRef.current.classList.remove("cursor-grabbing");
  };
  const onMouseUp = () => {
    if (!scrollRef.current) return;
    isDown.current = false;
    setIsScrolling(false);
    scrollRef.current.classList.add("cursor-grab");
    scrollRef.current.classList.remove("cursor-grabbing");
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };
  // -----------------------------

  const calendarColumns = useMemo(() => {
    if (groupBy === "days") {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
    if (groupBy === "weeks") {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      return eachWeekOfInterval(
        { start: monthStart, end: monthEnd },
        { weekStartsOn: 1 },
      );
    }
    if (groupBy === "months") {
      return eachMonthOfInterval({
        start: startOfYear(date),
        end: endOfYear(date),
      });
    }
    return [];
  }, [groupBy, date]);

  // Scroll to today only when the calendar context changes (not on booking selection)
  useEffect(() => {
    if (view !== "calendar" || !scrollRef.current || isLoading || isLoadingProps)
      return;

    const today = new Date();
    const todayIndex = calendarColumns.findIndex((col) =>
      groupBy === "days"
        ? isSameDay(col, today)
        : groupBy === "weeks"
          ? isWithinInterval(today, {
              start: startOfWeek(col, { weekStartsOn: 1 }),
              end: endOfWeek(col, { weekStartsOn: 1 }),
            })
          : isSameMonth(col, today),
    );

    if (todayIndex <= 0) return;

    const colWidth = window.innerWidth >= 768 ? 44 : 36;
    scrollRef.current.scrollLeft = Math.max(0, todayIndex * colWidth - colWidth * 2);
  }, [view, groupBy, date, isLoading, isLoadingProps, calendarColumns]);

  const isConnected = calendarStatus?.connected;
  const needsReauth = calendarStatus?.needsReauth;

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    setIsDeleting(true);
    try {
      await removeBookingMut({ id: selectedBooking._id as Id<"bookings"> });
      toast.success("Reserva eliminada con éxito");
      setSelectedBooking(null);
      // Convex reactivo: la lista se actualiza sola.
    } catch {
      toast.error("Error al eliminar la reserva");
    } finally {
      setIsDeleting(false);
    }
  };

  // Eliminar desde el menú contextual (clic derecho en el calendario).
  const handleContextDeleteBooking = (b: {
    _id: string;
    nombreCompleto?: string;
  }) => {
    const ok = window.confirm(
      `¿Eliminar la reserva de ${b.nombreCompleto || "este cliente"}? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    removeBookingMut({ id: b._id as Id<"bookings"> })
      .then(() => {
        toast.success("Reserva eliminada.");
        if (selectedBooking?._id === b._id) setSelectedBooking(null);
      })
      .catch(() => toast.error("No se pudo eliminar la reserva."));
  };

  let filteredProperties = properties?.filter((p: any) =>
    selectedFincas.length === 0 ? true : selectedFincas.includes(p._id),
  );

  if (selectedFincas.length === 0 && reservations && filteredProperties) {
    const activeProperties = filteredProperties.filter((p: any) =>
      reservations.some(
        (b: any) => b.propertyId === p._id || b.property?.id === p._id,
      ),
    );
    if (activeProperties.length > 0) {
      filteredProperties = activeProperties;
    }
  }

  // Filtro por día (clic en el encabezado de una fecha en vista "Días"):
  // solo propiedades con reserva que INGRESA ese día (fechaEntrada), no estadías en curso.
  if (dayFilter && groupBy === "days" && reservations && filteredProperties) {
    filteredProperties = filteredProperties.filter((p: any) =>
      reservations.some(
        (b: any) =>
          (b.propertyId === p._id || b.property?.id === p._id) &&
          bookingStartsOnDay(b, dayFilter),
      ),
    );
  }

  const filteredReservations = reservations?.filter((b: any) => {
    const matchesSearch =
      normalizedIncludes(b.nombreCompleto ?? "", listSearchTerm) ||
      normalizedIncludes(b.property?.title ?? "", listSearchTerm) ||
      normalizedIncludes(b.propertyTitle ?? "", listSearchTerm);

    const matchesDirect = showDirectOnly ? b.isDirect === true : true;

    return matchesSearch && matchesDirect;
  });

  // Buscador del calendario: coincidencias por CR / cliente / finca (estilo Google).
  const calendarSearchResults = (() => {
    const q = calendarSearch.trim();
    if (!q || !reservations) return [] as any[];
    return reservations
      .filter((b: any) => {
        const ref = String(b.reference || "");
        const name = String(b.nombreCompleto || "");
        const finca = String(b.property?.title || b.propertyTitle || "");
        return (
          normalizedIncludes(ref, q) ||
          normalizedIncludes(name, q) ||
          normalizedIncludes(finca, q)
        );
      })
      .sort(
        (a: any, b: any) =>
          new Date(a.fechaEntrada).getTime() -
          new Date(b.fechaEntrada).getTime(),
      )
      .slice(0, 8);
  })();

  // Salta a la reserva: navega el calendario a su fecha, la resalta y abre su ventana.
  const goToBooking = (b: any) => {
    if (b?.fechaEntrada) {
      setDate(new Date(b.fechaEntrada));
      setGroupBy("days");
      setDayFilter(null);
    }
    setSelectedBooking(b);
    setHighlightedBookingId(b._id);
    setCalendarSearch("");
    window.setTimeout(() => setHighlightedBookingId(null), 6000);
  };

  // Grouped reservations for list view
  const groupedBookings = (() => {
    if (!filteredReservations || groupBy === "days") return [];

    const groups: Record<string, any[]> = {};
    [...filteredReservations]
      .sort(
        (a, b) =>
          new Date(a.fechaEntrada).getTime() -
          new Date(b.fechaEntrada).getTime(),
      )
      .forEach((b: any) => {
        const d = new Date(b.fechaEntrada);
        const key =
          groupBy === "weeks"
            ? `Semana ${differenceInCalendarWeeks(d, startOfMonth(date), { weekStartsOn: 1 }) + 1} - ${format(d, "MMMM", { locale: es })}`
            : format(d, "MMMM yyyy", { locale: es });
        if (!groups[key]) groups[key] = [];
        groups[key].push(b);
      });

    return Object.entries(groups).map(([name, items]) => ({
      name,
      items,
    }));
  })();

  return (
    <div className="py-4 px-5 sm:p-4 md:p-8 lg:p-12 space-y-4 md:space-y-10 bg-transparent min-h-[calc(100vh-4rem)] relative w-full flex-1 min-w-0 max-w-[100vw] overflow-x-hidden">
      {/* Page Header */}
      <div className="space-y-4 relative z-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Reservas
            </h1>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-bold uppercase tracking-wider opacity-60">
              Línea de Vida y Calendario por Fincas
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 active:scale-[0.98] border-b-4 border-primary-dark"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Reserva</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between rounded-2xl border border-border/70 bg-muted/25 px-3 py-3 md:px-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Google Calendar Status */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      isConnected
                        ? needsReauth
                          ? "bg-red-400"
                          : "bg-emerald-400"
                        : "bg-orange-400",
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      isConnected
                        ? needsReauth
                          ? "bg-red-500"
                          : "bg-emerald-500"
                        : "bg-orange-500",
                    )}
                  />
                </div>
                <span className="text-[11px] font-semibold text-foreground/70 whitespace-nowrap">
                  {isLoadingStatus
                    ? "Verificando..."
                    : isConnected
                      ? needsReauth
                        ? "Re-conexión requerida"
                        : "Google Calendar"
                      : "Sin conectar"}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-lg hover:bg-muted transition-colors">
                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-2xl border-border shadow-xl"
                >
                  <DropdownMenuLabel className="flex items-center gap-2 py-2.5">
                    <User className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold truncate">
                        {calendarStatus?.connectedName || "Sin cuenta"}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {calendarStatus?.connectedEmail || "No conectado"}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => refetchStatus()}
                    className="cursor-pointer gap-2 py-2 text-xs font-medium"
                  >
                    <RefreshCcw
                      className={cn(
                        "h-3.5 w-3.5",
                        isLoadingStatus && "animate-spin",
                      )}
                    />
                    Actualizar Estado
                  </DropdownMenuItem>
                  {isConnected ? (
                    <>
                      {needsReauth && (
                        <DropdownMenuItem
                          onClick={handleConnect}
                          className="cursor-pointer gap-2 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/10 focus:text-red-700"
                        >
                          <RefreshCcw className="h-3.5 w-3.5 animate-pulse" />
                          Re-conectar cuenta
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={handleConnect}
                        className="cursor-pointer gap-2 py-2 text-xs font-medium"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Cambiar Cuenta
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleResyncCalendar}
                        disabled={isResyncingCalendar}
                        className="cursor-pointer gap-2 py-2 text-xs font-medium text-primary focus:text-primary"
                      >
                        <CalendarIcon
                          className={cn(
                            "h-3.5 w-3.5",
                            isResyncingCalendar && "animate-spin",
                          )}
                        />
                        {isResyncingCalendar
                          ? "Migrando reservas..."
                          : "Migrar reservas al calendario"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDisconnect}
                        className="cursor-pointer gap-2 py-2 text-xs font-medium text-red-600 focus:text-red-700"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Desconectar
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleConnect}
                      className="cursor-pointer gap-2 py-2 text-xs font-bold text-primary"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Conectar Google
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View Toggle */}
            <div className="flex bg-background p-1 rounded-xl border border-border">
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all text-center",
                  view === "calendar"
                    ? "bg-muted shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("calendar")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Grilla</span>
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all text-center",
                  view === "list"
                    ? "bg-muted shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("list")}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>Lista</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end border-t border-border/60 pt-3 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
              Exportar Excel
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="export-from"
                type="date"
                value={formatDateInputValue(dailyExportFrom)}
                onChange={(e) => {
                  const next = parseDateInputValue(e.target.value);
                  if (next) setDailyExportFrom(next);
                }}
                className="h-9 min-w-38 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground"
                aria-label="Desde"
              />
              <span className="text-xs font-semibold text-muted-foreground">
                a
              </span>
              <input
                id="export-to"
                type="date"
                value={formatDateInputValue(dailyExportTo)}
                onChange={(e) => {
                  const next = parseDateInputValue(e.target.value);
                  if (next) setDailyExportTo(next);
                }}
                className="h-9 min-w-38 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground"
                aria-label="Hasta"
              />
              <button
                type="button"
                onClick={() => void handleDownloadDailyReservations()}
                disabled={isDownloadingDaily}
                className={cn(
                  "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg font-semibold text-xs border transition-all disabled:opacity-60",
                  dailyDownloadDone
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-background text-foreground border-border hover:bg-muted/60",
                )}
              >
                {isDownloadingDaily ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando…</span>
                  </>
                ) : dailyDownloadDone ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Descargado</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Descargar reservas</span>
                    <span className="sm:hidden">Descargar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="rounded-2xl md:rounded-4xl bg-background border border-border shadow-sm flex flex-col w-full max-w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-23rem)] overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "calendar" ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Timeline Header Toolbar */}
              <div className="p-3 md:p-6 border-b border-border flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-muted/20">
                <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                  {/* Título, flechas y "Hoy" viven ahora en el header del
                      calendario (ReservationCalendarView) — aquí se quitaron
                      para no duplicarlos. Se conserva solo el buscador. */}

                  {/* Buscador estilo Google: CR / cliente / finca → salta a la reserva */}
                  <div className="relative w-full sm:w-72 lg:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={calendarSearch}
                      onChange={(e) => setCalendarSearch(e.target.value)}
                      placeholder="Buscar CR, cliente o finca..."
                      className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                    />
                    {calendarSearch.trim() ? (
                      <button
                        type="button"
                        onClick={() => setCalendarSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                        aria-label="Limpiar búsqueda"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    {calendarSearch.trim() ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                        {calendarSearchResults.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                            Sin resultados para “{calendarSearch.trim()}”
                          </p>
                        ) : (
                          <>
                            <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {calendarSearchResults.length} resultado
                              {calendarSearchResults.length === 1 ? "" : "s"}
                            </p>
                            <div className="max-h-80 overflow-y-auto">
                              {calendarSearchResults.map((b: any) => (
                                <button
                                  key={b._id}
                                  type="button"
                                  onClick={() => goToBooking(b)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                                >
                                  {b.reference ? (
                                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                      {b.reference}
                                    </span>
                                  ) : null}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-semibold text-foreground">
                                      {b.nombreCompleto || "Sin nombre"}
                                    </span>
                                    <span className="block truncate text-[10px] text-muted-foreground">
                                      {b.property?.title ||
                                        b.propertyTitle ||
                                        "Propiedad s/n"}
                                      {b.fechaEntrada
                                        ? ` · ${format(new Date(b.fechaEntrada), "d MMM", { locale: es })}`
                                        : ""}
                                      {b.fechaSalida
                                        ? `–${format(new Date(b.fechaSalida), "d MMM", { locale: es })}`
                                        : ""}
                                    </span>
                                  </span>
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                  {/* Las pestañas de vista (Mes/Semana/Día) viven ahora en el
                      header del calendario — se quitaron aquí para no duplicar. */}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 w-full sm:w-[220px] justify-between text-xs bg-muted/20 border-border font-bold"
                      >
                        <span className="truncate">
                          {selectedFincas.length === 0
                            ? "Seleccionar Fincas..."
                            : selectedFincas.length === 1
                              ? "1 Finca Seleccionada"
                              : `${selectedFincas.length} Fincas Seleccionadas`}
                        </span>
                        <ChevronRight className="ml-2 h-4 w-4 opacity-50 rotate-90" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-[260px] p-0 rounded-xl"
                      align="end"
                    >
                      <div className="p-2 border-b border-border/50 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            placeholder="Buscar finca..."
                            value={fincaDropdownSearch}
                            onChange={(e) =>
                              setFincaDropdownSearch(e.target.value)
                            }
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full h-8 pl-8 pr-8 text-xs border-none rounded-md bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                          {fincaDropdownSearch ? (
                            <button
                              type="button"
                              onClick={() => setFincaDropdownSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Limpiar búsqueda"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                        {selectedFincas.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedFincas([])}
                            className="w-full rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          >
                            Limpiar selección ({selectedFincas.length})
                          </button>
                        ) : null}
                      </div>
                      <div className="max-h-[240px] overflow-y-auto p-1">
                        {properties
                          ?.filter((p: any) =>
                            p.title
                              ?.toLowerCase()
                              .includes(fincaDropdownSearch.toLowerCase()),
                          )
                          .map((property: any) => {
                            const isSelected = selectedFincas.includes(
                              property._id,
                            );
                            return (
                              <DropdownMenuItem
                                key={property._id}
                                className="px-3 py-2 text-xs flex items-center justify-between cursor-pointer rounded-lg hover:bg-muted/60"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (isSelected) {
                                    setSelectedFincas(
                                      selectedFincas.filter(
                                        (id) => id !== property._id,
                                      ),
                                    );
                                  } else {
                                    setSelectedFincas([
                                      ...selectedFincas,
                                      property._id,
                                    ]);
                                  }
                                }}
                              >
                                <span className="truncate flex-1 font-medium">
                                  {property.title}
                                </span>
                                {isSelected && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Calendario estilo Google Calendar — lee las reservas de FincasYa
                  (Convex) directo, sin depender de conectar Google. */}
              <div className="px-3 pb-4 pt-1 md:px-4">
                <ReservationCalendarView
                  bookings={reservations as unknown as CalendarBooking[]}
                  currentDate={date}
                  view={calendarView}
                  onNavigate={setDate}
                  onViewChange={setCalendarView}
                  onSelectBooking={(b) => {
                    setSelectedBooking(b);
                    setDetailTab("resumen");
                  }}
                  onEditBooking={(b) => {
                    setEditingBooking(b);
                    setIsEditModalOpen(true);
                  }}
                  onDeleteBooking={handleContextDeleteBooking}
                />
              </div>
              {false && (
                <>
                <div className="mx-3 mb-3 mt-1 rounded-2xl border border-border/60 bg-background px-4 py-3 shadow-sm md:mx-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    🎨 Semáforo de la reserva (calendario admin)
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {RESERVATION_CALENDAR_LEGEND.map((item) => (
                      <span
                        key={item.stage}
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                          item.colorClass,
                        )}
                      >
                        {item.stage} · {item.label}
                      </span>
                    ))}
                  </div>
                </div>
                {groupBy === "days" && dayFilter && (
                  <div className="mb-2 flex items-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-900">
                      Mostrando ingresos del{" "}
                      {format(dayFilter as Date, "EEEE d 'de' MMMM", { locale: es })}
                      <button
                        type="button"
                        onClick={() => setDayFilter(null)}
                        className="rounded-full px-1.5 py-0.5 text-orange-900/80 hover:bg-orange-200"
                      >
                        Quitar ✕
                      </button>
                    </span>
                  </div>
                )}
                {selectedFincas.length > 0 && (
                  <div className="mb-2 flex items-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#c2e7ff] bg-[#e8f0fe] px-3 py-1 text-[11px] font-semibold text-[#1a73e8]">
                      {selectedFincas.length === 1
                        ? "1 finca seleccionada"
                        : `${selectedFincas.length} fincas seleccionadas`}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFincas([]);
                          setFincaDropdownSearch("");
                        }}
                        className="rounded-full px-1.5 py-0.5 text-[#1a73e8]/80 hover:bg-[#c2e7ff]"
                      >
                        Quitar ✕
                      </button>
                    </span>
                  </div>
                )}
                {isMobile ? (
                  <ReservationCalendarMobile
                    isLoading={isLoading}
                    reservations={reservations}
                    date={date}
                    setDate={setDate}
                    onSelectBooking={setSelectedBooking}
                  />
                ) : (
                  <CalendarGridView
                    isLoadingProps={isLoadingProps}
                    isLoading={isLoading}
                    filteredProperties={filteredProperties}
                    reservations={reservations}
                    calendarColumns={calendarColumns}
                    groupBy={groupBy}
                    date={date}
                    onSelectBooking={setSelectedBooking}
                    isScrolling={isScrolling}
                    scrollRef={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeave}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                    selectedBookingIds={selectedBookingIds}
                    onToggleCheck={toggleBookingSelection}
                    highlightedBookingId={highlightedBookingId}
                    dayFilter={dayFilter}
                    onDayClick={(day: Date) =>
                      setDayFilter((prev) =>
                        prev && isSameDay(prev, day) ? null : day,
                      )
                    }
                    onMonthClick={(month: Date) => {
                      setDayFilter(null);
                      setDate(startOfMonth(month));
                    }}
                  />
                )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <ListViewContent
                isLoading={isLoading}
                searchTerm={listSearchTerm}
                setSearchTerm={setListSearchTerm}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                filteredReservations={filteredReservations}
                groupedBookings={groupedBookings}
                onSelectBooking={setSelectedBooking}
                showDirectOnly={showDirectOnly}
                setShowDirectOnly={setShowDirectOnly}
                selectedBookingIds={selectedBookingIds}
                onToggleCheck={toggleBookingSelection}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Barra de acción en lote: enviar plantilla a las reservas seleccionadas */}
      <AnimatePresence>
        {selectedBookingIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-2xl"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl px-3 py-2.5">
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full bg-emerald-600 text-white text-xs font-bold">
                  {selectedBookingIds.length}
                </span>
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                  seleccionada(s)
                </span>
              </div>
              <select
                value={bulkTemplateKey}
                onChange={(e) => setBulkTemplateKey(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {clientCheckinTemplates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedBookingIds([])}
                  className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground"
                >
                  Limpiar
                </Button>
                {templateHasCheckinLink(bulkTemplateKey) ? (
                  <Button
                    variant="outline"
                    onClick={handleBulkCopy}
                    disabled={isCopyingLink}
                    className="h-10 px-3 rounded-xl font-semibold text-xs"
                    title="Copiar solo el link de check-in"
                  >
                    {isCopyingLink ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copiar link
                      </>
                    )}
                  </Button>
                ) : null}
                <Button
                  onClick={handleBulkSend}
                  disabled={isBulkSending}
                  className="h-10 px-4 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isBulkSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Enviar check-in
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ManualReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          refetchBookings();
        }}
      />

      <ManualReservationModal
        isOpen={isEditModalOpen}
        bookingId={editingBooking?._id}
        initialData={editingBooking ?? undefined}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingBooking(null);
          refetchBookings();
        }}
        onSaved={async (bookingId) => {
          const result = await refetchBookings();
          const list = Array.isArray(result.data) ? result.data : [];
          const updated = list.find((b: { _id: string }) => b._id === bookingId);
          if (updated) {
            setEditingBooking(updated);
            setSelectedBooking((prev: { _id: string } | null) =>
              prev?._id === bookingId ? updated : prev,
            );
          }
        }}
      />

      <Sheet
        open={!!selectedBooking}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedBooking(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 border-l bg-background p-0 sm:max-w-2xl flex flex-col"
        >
          <SheetTitle className="sr-only">Detalles de la Reserva</SheetTitle>
          {selectedBooking && (
            <>
              {/* Header compacto + acciones + pestañas (fijo) */}
              <div className="sticky top-0 z-20 shrink-0 bg-background/95 backdrop-blur-md border-b border-border/60">
              <div className="px-4 sm:px-5 pt-3 pb-2">
                {(() => {
                  const code =
                    selectedBooking.calendarLabel &&
                    selectedBooking.calendarLabel !== "Reserva:"
                      ? selectedBooking.calendarLabel
                      : selectedBooking.reference;
                  if (!code) return null;
                  return (
                    <p className="text-center text-[11px] font-bold tracking-wide text-muted-foreground mb-1.5">
                      {/^CR[-:\s]/i.test(String(code)) ? code : `CR: ${code}`}
                    </p>
                  );
                })()}
                <div className="flex items-center gap-3 pr-8">
                  <div className="w-12 h-12 rounded-lg border border-border bg-muted overflow-hidden shrink-0">
                    {selectedBooking.property?.image ? (
                      <img
                        src={selectedBooking.property.image}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/30">
                        <Building2 className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-semibold bg-muted/50 text-muted-foreground border-none px-1.5 py-0"
                      >
                        {/^\s*temporada/i.test(
                          String(selectedBooking.temporada || ""),
                        )
                          ? selectedBooking.temporada
                          : `Temporada ${selectedBooking.temporada}`}
                      </Badge>
                      {selectedBooking.isDirect && (
                        <Badge className="text-[9px] font-semibold bg-muted text-foreground border-none px-1.5 py-0">
                          Reserva Directa
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug line-clamp-2">
                      {selectedBooking.property?.title ||
                        selectedBooking.propertyTitle ||
                        "Propiedad s/n"}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 opacity-70 shrink-0" />
                      <span className="truncate">
                        {selectedBooking.property?.location ||
                          "Ubicación no especificada"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-5 pb-1.5">
                <p className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Enviar check-in al cliente
                </p>
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant="outline"
                    onClick={() => void handleQuickCopyCheckinLink()}
                    className={cn(
                      "h-7 px-1 rounded-md font-medium text-[10px]",
                      linkCopied &&
                        "border-foreground/40 bg-muted text-foreground",
                    )}
                    title="Copiar solo el link de check-in"
                  >
                    {linkCopied ? (
                      <Check className="w-3 h-3 mr-1" />
                    ) : (
                      <Link2 className="w-3 h-3 mr-1" />
                    )}
                    {linkCopied ? "Copiado" : "Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCopyCheckinInvite()}
                    className={cn(
                      "h-7 px-1 rounded-md font-medium text-[10px]",
                      inviteCopied &&
                        "border-foreground/40 bg-muted text-foreground",
                    )}
                    title="Copiar el mensaje de invitación al check-in"
                  >
                    {inviteCopied ? (
                      <Check className="w-3 h-3 mr-1" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    Mensaje
                  </Button>
                  <Button
                    onClick={() => void handleQuickShareWhatsApp()}
                    className="h-7 px-1 rounded-md font-medium text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    title="Abrir WhatsApp con el mensaje de check-in"
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSendCheckinEmail}
                    disabled={isSendingCheckinEmail || !selectedBooking.correo}
                    className="h-7 px-1 rounded-md font-medium text-[10px]"
                    title="Enviar correo de check-in"
                  >
                    {isSendingCheckinEmail ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Mail className="w-3 h-3 mr-1" />
                    )}
                    Correo
                  </Button>
                </div>
                <div className="flex items-stretch -mx-4 sm:-mx-5 mt-1">
                  {(
                    [
                      { key: "resumen", label: "Resumen" },
                      { key: "pagos", label: "Pagos" },
                      { key: "mensajes", label: "Mensajes" },
                      { key: "docs", label: "Documentos" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setDetailTab(t.key)}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-[11px] font-semibold transition-colors border-b-2",
                        detailTab === t.key
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              </div>

              {/* Contenido scrolleable */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar min-h-0">
                <div className="flex flex-col gap-6">
                  {detailTab === "resumen" && (
                    <>
                  {/* Resumen "de un vistazo": estado de pago + cliente + fechas. */}
                  <BookingSummaryHero
                    booking={selectedBooking}
                    payments={selectedBookingPayments}
                  />

                  <div className="flex flex-col w-full">
                    {/* Sección Cliente */}
                    <DetailSection
                      icon={<User />}
                      title="Información del cliente"
                      hint="Nombre, documento y contacto"
                      defaultOpen
                    >
                      <div className="grid grid-cols-1 gap-5">
                        <div className="transition-all">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Nombre Completo
                          </p>
                          <p className="text-sm font-medium text-foreground uppercase">
                            {selectedBooking.nombreCompleto}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              Identificación
                            </p>
                            <p className="text-sm font-medium text-foreground uppercase">
                              {selectedBooking.cedula || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              Celular
                            </p>
                            <p className="text-sm font-medium text-foreground uppercase">
                              {selectedBooking.celular || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Correo Electrónico
                          </p>
                          <p className="text-sm font-medium text-foreground truncate uppercase">
                            {selectedBooking.correo || "N/A"}
                          </p>
                        </div>
                        {selectedBooking.city && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              Ciudad
                            </p>
                            <p className="text-sm font-medium text-foreground uppercase">
                              {selectedBooking.city}
                            </p>
                          </div>
                        )}
                      </div>
                    </DetailSection>

                    {/* Sección Estancia */}
                    <DetailSection
                      icon={<Users />}
                      title="Detalles de estancia"
                      hint="Huéspedes, mascotas y servicios"
                    >
                      <div className="grid grid-cols-2 gap-5">
                        <div className="transition-all">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Huéspedes
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {selectedBooking.numeroPersonas} Personas
                          </p>
                          {selectedBooking.personasAdicionales > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              + {selectedBooking.personasAdicionales}{" "}
                              adicionales
                            </p>
                          )}
                        </div>
                        {(selectedBooking.purpose || selectedBooking.groupType) && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              Motivo del viaje
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {selectedBooking.purpose ||
                                selectedBooking.groupType}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Mascotas
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {selectedBooking.tieneMascotas
                              ? `Sí (${selectedBooking.numeroMascotas || 1} mascota/s)`
                              : "No"}
                          </p>
                        </div>
                        {selectedBooking.costoPersonalServicio > 0 && (
                          <div className="col-span-2 pt-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                              <User className="w-3 h-3 text-muted-foreground" />{" "}
                              Personal de Servicio (sujeto a disponibilidad)
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              Servicio incluido ($
                              {selectedBooking.costoPersonalServicio.toLocaleString(
                                "es-CO",
                              )}
                              )
                            </p>
                          </div>
                        )}
                      </div>
                    </DetailSection>

                    {/* Check-in del turista (lista de invitados + servicios) */}
                    <DetailSection
                      icon={<UserCheck />}
                      title="Check-in del turista"
                      hint="Lista de invitados, servicios y placas"
                      badge={
                        selectedBooking.checkinCompleted ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold text-foreground"
                          >
                            Completado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold text-muted-foreground"
                          >
                            Pendiente
                          </Badge>
                        )
                      }
                    >
                        <div className="space-y-4">
                          <div className="flex items-center justify-end gap-3">
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                           
                              {Array.isArray(selectedBooking.checkinGuests) &&
                              selectedBooking.checkinGuests.length > 0 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleDownloadGuestsPdf()}
                                  disabled={isDownloadingGuestsPdf}
                                  className="h-8 px-3 rounded-lg font-semibold text-[11px]"
                                  title="Descargar lista de invitados en PDF para el propietario"
                                >
                                  {isDownloadingGuestsPdf ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="w-3 h-3 mr-1" />
                                      PDF invitados
                                    </>
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          {selectedBooking.property?.requiresGuestList !==
                          false ? (
                            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  Enviar listado al propietario
                                </p>
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                  {shareGuestListWithOwner
                                    ? "El propietario verá invitados y PDF en /anfitrion."
                                    : "Oculto: el propietario no verá nombres ni PDF de invitados."}
                                </p>
                              </div>
                              <Switch
                                checked={shareGuestListWithOwner}
                                onCheckedChange={(v) =>
                                  void handleToggleGuestListShare(v)
                                }
                                disabled={savingGuestListShare}
                                className="shrink-0"
                              />
                            </label>
                          ) : null}

                          <AdminGuestListEditor
                            key={selectedBooking._id}
                            bookingId={selectedBooking._id}
                            initialGuests={selectedBooking.checkinGuests}
                            numeroPersonas={selectedBooking.numeroPersonas}
                            onSaved={(guests) =>
                              setSelectedBooking((prev: any) =>
                                prev
                                  ? { ...prev, checkinGuests: guests }
                                  : prev,
                              )
                            }
                          />

                          {selectedBooking.property?.requiresGuestList !==
                          false ? (
                            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  Habilitar edición de invitados
                                </p>
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                  {selectedBooking.guestListUnlocked
                                    ? "Desbloqueada: el turista puede editar su lista aunque falten menos de 24 h."
                                    : "Normal: la lista se bloquea 24 h antes de la llegada (12 h si es de 1 noche)."}
                                </p>
                              </div>
                              <Switch
                                checked={!!selectedBooking.guestListUnlocked}
                                onCheckedChange={(v) =>
                                  void handleToggleGuestListUnlock(v)
                                }
                                disabled={savingGuestUnlock}
                                className="shrink-0"
                              />
                            </label>
                          ) : null}

                          {(selectedBooking.checkinNeedsEmpleada ||
                            selectedBooking.checkinNeedsTeam ||
                            selectedBooking.checkinServiciosNota) && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Servicios solicitados
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {selectedBooking.checkinNeedsEmpleada && (
                                  <Badge variant="secondary">
                                    Empleada de servicio
                                  </Badge>
                                )}
                                {selectedBooking.checkinNeedsTeam && (
                                  <Badge variant="secondary">Team</Badge>
                                )}
                              </div>
                              {selectedBooking.checkinServiciosNota && (
                                <p className="text-xs text-muted-foreground">
                                  “{selectedBooking.checkinServiciosNota}”
                                </p>
                              )}
                            </div>
                          )}

                          {selectedBooking.checkinPlacas?.trim() && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Placas de vehículos
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {selectedBooking.checkinPlacas
                                  .split(/[,\n]+/)
                                  .map((p: string) => p.trim())
                                  .filter(Boolean)
                                  .map((placa: string, i: number) => (
                                    <Badge key={i} variant="secondary">
                                      {placa.toUpperCase()}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          )}

                          {selectedBooking.checkinObservaciones?.trim() && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Novedad / nota del cliente
                              </p>
                              <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
                                {selectedBooking.checkinObservaciones.trim()}
                              </p>
                            </div>
                          )}

                      {/* Quién recibe a los turistas (diligenciado por el propietario) */}
                      {selectedBooking.ownerReceiver &&
                      (selectedBooking.ownerReceiver.nombre ||
                        selectedBooking.ownerReceiver.contacto) ? (
                        <div className="pt-2">
                          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <UserCheck className="w-3.5 h-3.5" /> Quién recibe a
                              los turistas
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                  Nombre
                                </p>
                                <p className="text-sm font-medium text-foreground">
                                  {selectedBooking.ownerReceiver.nombre || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                  Contacto
                                </p>
                                <p className="text-sm font-medium text-foreground">
                                  {selectedBooking.ownerReceiver.contacto || "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                        </div>
                    </DetailSection>

                    {/* Valor y desglose de la reserva */}
                    <DetailSection
                      icon={<CreditCard />}
                      title="Valor y desglose"
                      hint={new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        minimumFractionDigits: 0,
                      }).format(selectedBooking.precioTotal || 0)}
                    >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-border/50 pb-4">
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-tight">
                              Valor Total Reservado
                            </span>
                            <span className="text-2xl font-bold text-foreground tracking-tight">
                              {new Intl.NumberFormat("es-CO", {
                                style: "currency",
                                currency: "COP",
                                minimumFractionDigits: 0,
                              }).format(selectedBooking.precioTotal)}
                            </span>
                          </div>

                          {/* DESGLOSE DE COMPONENTES DE LA RESERVA */}
                          {(selectedBooking.subtotal || 0) > 0 &&
                            (() => {
                              const fmtCOP = (v: number) =>
                                new Intl.NumberFormat("es-CO", {
                                  style: "currency",
                                  currency: "COP",
                                  minimumFractionDigits: 0,
                                }).format(v);
                              const rows = [
                                {
                                  label: "Valor alquiler",
                                  value: selectedBooking.subtotal || 0,
                                },
                                {
                                  label: "Limpieza general",
                                  value: selectedBooking.depositoAseo || 0,
                                },
                                {
                                  label: "Depósito reembolsable",
                                  value: selectedBooking.depositoGarantia || 0,
                                  emerald: true,
                                },
                                {
                                  label: "Recargo por mascotas",
                                  value: selectedBooking.costoMascotas || 0,
                                },
                                {
                                  label: "Personal de servicio",
                                  value:
                                    selectedBooking.costoPersonalServicio || 0,
                                },
                                {
                                  label: "Descuento",
                                  value: -(
                                    selectedBooking.discountAmount || 0
                                  ),
                                },
                              ].filter((r) => r.value !== 0);
                              const sum = rows.reduce(
                                (acc, r) => acc + r.value,
                                0,
                              );
                              const diff =
                                (selectedBooking.precioTotal || 0) - sum;
                              return (
                                <div className="space-y-2 pt-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Desglose de la reserva
                                  </p>
                                  {rows.map((r) => (
                                    <div
                                      key={r.label}
                                      className="flex justify-between items-center text-sm"
                                    >
                                      <span className="text-muted-foreground">
                                        {r.label}
                                      </span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          r.emerald
                                            ? "text-foreground"
                                            : "text-foreground",
                                        )}
                                      >
                                        {fmtCOP(r.value)}
                                      </span>
                                    </div>
                                  ))}
                                  {diff !== 0 &&
                                    (() => {
                                      const hasDepositRow = rows.some(
                                        (r) =>
                                          r.label === "Depósito reembolsable",
                                      );
                                      const isDeposit =
                                        !hasDepositRow && diff > 0;
                                      return (
                                        <div className="flex justify-between items-center text-sm">
                                          <span
                                            className={cn(
                                              "text-muted-foreground",
                                              !isDeposit && "italic text-[13px]",
                                            )}
                                          >
                                            {isDeposit
                                              ? "Valor depósito reembolsable *"
                                              : "Otros ajustes"}
                                          </span>
                                          <span
                                            className={
                                              isDeposit
                                                ? "font-medium text-foreground"
                                                : "text-foreground/80 text-[13px]"
                                            }
                                          >
                                            {fmtCOP(diff)}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                </div>
                              );
                            })()}

                          {/* DESGLOSE DE MASCOTAS PARA REEMBOLSOS */}
                          {(selectedBooking.numeroMascotas > 0 ||
                            (selectedBookingPriceDetails?.pets?.total || 0) >
                              0) && (
                            <div className="space-y-3 pt-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                                Seguimiento de Mascotas
                              </p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">
                                    Depósito Reembolsable
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {new Intl.NumberFormat("es-CO", {
                                      style: "currency",
                                      currency: "COP",
                                      minimumFractionDigits: 0,
                                    }).format(
                                      selectedBooking.depositoGarantia ||
                                        selectedBookingPriceDetails?.pets
                                          ?.refundable ||
                                        0,
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[13px]">
                                  <span className="text-muted-foreground">
                                    Recargo por Mascotas (No Reembolsable)
                                  </span>
                                  <span className="text-foreground">
                                    {new Intl.NumberFormat("es-CO", {
                                      style: "currency",
                                      currency: "COP",
                                      minimumFractionDigits: 0,
                                    }).format(
                                      selectedBooking.costoMascotas ||
                                        selectedBookingPriceDetails?.pets
                                          ?.serviceFee ||
                                        0,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CARGO POR PERSONAL DE SERVICIO */}
                          {selectedBooking.costoPersonalServicio > 0 && (
                            <div className="space-y-3 pt-4 border-t border-border/10">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                                Servicios Adicionales
                              </p>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                  Cargo por Personal de Servicio
                                </span>
                                <span className="font-medium text-foreground">
                                  {new Intl.NumberFormat("es-CO", {
                                    style: "currency",
                                    currency: "COP",
                                    minimumFractionDigits: 0,
                                  }).format(
                                    selectedBooking.costoPersonalServicio,
                                  )}
                                </span>
                              </div>
                            </div>
                          )}

                        </div>
                    </DetailSection>
                  </div>
                    </>
                  )}

                  {detailTab === "pagos" && (
                    <div className="flex w-full flex-col">
                      {/* Alerta: soportes de pago pendientes de revisar (solo si hay) */}
                      <PendingReceiptsReviewCard
                        bookingId={selectedBooking._id}
                        receipts={selectedBooking.paymentPortalReceipts ?? []}
                        onReviewed={() => {
                          setSelectedBooking((prev: any) =>
                            prev
                              ? {
                                  ...prev,
                                  paymentPortalReceipts: (
                                    prev.paymentPortalReceipts ?? []
                                  ).map((r: any) =>
                                    r.status === "pending"
                                      ? { ...r, status: "approved" }
                                      : r,
                                  ),
                                }
                              : prev,
                          );
                          void refetchBookings();
                        }}
                      />

                      <DetailSection
                        icon={<Wallet />}
                        title="Abonos y pagos"
                        hint="Registrar abonos y validar pagos del cliente"
                        defaultOpen
                      >
                        <BookingPaymentsSection
                          bookingId={selectedBooking._id}
                          precioTotal={selectedBooking.precioTotal}
                          onPaymentStatusChange={(paymentStatus) => {
                            setSelectedBooking((prev: any) =>
                              prev ? { ...prev, paymentStatus } : prev,
                            );
                            void refetchBookings();
                          }}
                        />
                      </DetailSection>

                      <DetailSection
                        icon={<Landmark />}
                        title="Métodos de pago"
                        hint="Cuentas bancarias y link de pago que ve el cliente"
                      >
                        <ReservationPaymentMethodsSection
                        bookingId={selectedBooking._id}
                        propertyId={selectedBooking.propertyId}
                        bookingReference={
                          selectedBooking.reference || selectedBooking._id
                        }
                        clientName={selectedBooking.nombreCompleto}
                        clientPhone={selectedBooking.celular}
                        propertyName={
                          selectedBooking.property?.title ||
                          selectedBooking.propertyTitle
                        }
                        checkInDate={
                          selectedBooking.fechaEntrada
                            ? format(
                                new Date(selectedBooking.fechaEntrada),
                                "dd MMM yyyy",
                                { locale: es },
                              )
                            : undefined
                        }
                        total={selectedBooking.precioTotal || 0}
                        breakdown={computeReservationBreakdownLines(
                          selectedBooking,
                        )}
                        initialBankAccountIds={
                          selectedBooking.paymentPortalConfig?.bankAccountIds
                        }
                        initialExtraBankAccounts={
                          selectedBooking.paymentPortalConfig?.extraBankAccounts
                        }
                        initialBoldLink={
                          selectedBooking.paymentPortalConfig?.boldLink
                        }
                        initialBoldSurcharge={
                          selectedBooking.paymentPortalConfig?.boldSurcharge
                        }
                        receipts={selectedBooking.paymentPortalReceipts ?? []}
                      />
                      </DetailSection>

                      <DetailSection
                        icon={<Banknote />}
                        title="Pago al propietario"
                        hint="Valor acordado y abonos al dueño de la finca"
                      >
                      <OwnerPayoutSection
                        key={selectedBooking._id}
                        bookingId={selectedBooking._id}
                        initialClientObservaciones={
                          selectedBooking.clientObservaciones
                        }
                        initialClientObservacionesUpdatedAt={
                          selectedBooking.clientObservacionesUpdatedAt
                        }
                        initialClientObservacionesLog={
                          selectedBooking.clientObservacionesLog
                        }
                        initialOwnerPayout={selectedBooking.ownerPayout}
                        initialOwnerPortalShare={
                          selectedBooking.ownerPortalShare
                        }
                        onResend={handleSendOwnerLink}
                        onSaved={(payout) => {
                          setSelectedBooking((prev: any) =>
                            prev
                              ? {
                                  ...prev,
                                  ownerPayout: {
                                    ...(prev.ownerPayout ?? {}),
                                    ...payout,
                                  },
                                }
                              : prev,
                          );
                          refetchBookings();
                        }}
                        onShareSaved={(share) => {
                          setSelectedBooking((prev: any) =>
                            prev
                              ? { ...prev, ownerPortalShare: share }
                              : prev,
                          );
                          setShareGuestListWithOwner(share.showGuestList);
                        }}
                      />
                      </DetailSection>

                      <DetailSection
                        icon={<ShieldCheck />}
                        title="Devolución del depósito"
                        hint="Depósito reembolsable al turista"
                      >
                      <DepositReturnSection
                        key={`dr-${selectedBooking._id}`}
                        bookingId={selectedBooking._id}
                        depositoGarantia={selectedBooking.depositoGarantia || 0}
                        initialDepositReturn={selectedBooking.depositReturn}
                        onResend={handleShareCheckoutWhatsApp}
                      />
                      </DetailSection>
                    </div>
                  )}

                  {detailTab === "docs" && (
                    <div className="flex flex-col gap-6 w-full">
                  {/* Event Details */}
                  {selectedBooking.isEvento &&
                    selectedBooking.detallesEvento && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                          <Sparkles className="w-4 h-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground tracking-tight">
                            Detalles del Evento
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            {
                              label: "Sonido Adicional",
                              value: selectedBooking.detallesEvento.extraSound,
                            },
                            {
                              label: "Música en Vivo",
                              value: selectedBooking.detallesEvento.liveMusic,
                            },
                            {
                              label: "DJ",
                              value: selectedBooking.detallesEvento.dj,
                            },
                            {
                              label: "Decoración",
                              value: selectedBooking.detallesEvento.decoration,
                            },
                            {
                              label: "Invitados Extra",
                              value:
                                selectedBooking.detallesEvento.additionalGuests,
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="p-3 rounded-xl bg-muted/30 border border-border/60"
                            >
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                {item.label}
                              </p>
                              <p className="text-xs font-black text-foreground">
                                {item.value === "SI" ? "SÍ" : "NO"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Documentos de la reserva — subir / ver / eliminar */}
                  <BookingDocumentsSection
                    bookingId={selectedBooking._id}
                    files={selectedBooking.multimedia ?? []}
                    onChange={(docs) =>
                      setSelectedBooking((prev: any) =>
                        prev ? { ...prev, multimedia: docs } : prev,
                      )
                    }
                  />

                  {/* Observaciones reales (sin líneas auto de saldo que desactualizan) */}
                  {(() => {
                    const raw = String(selectedBooking.observaciones || "").trim();
                    const cleaned = raw
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(
                        (line) =>
                          line &&
                          !/^Saldo pendiente/i.test(line),
                      )
                      .join("\n");
                    if (!cleaned) return null;
                    return (
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                          Notas y Observaciones
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                          {cleaned}
                        </p>
                      </div>
                    );
                  })()}
                    </div>
                  )}

                  {detailTab === "mensajes" && (
                    <div className="flex flex-col gap-6 w-full">
                  {/* ───── AL CLIENTE ───── */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">
                        Al cliente
                      </h3>
                    </div>

                    {/* Check-in (mensaje principal) — sobrio */}
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          🔑 Check-in (mensaje principal)
                        </p>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
                          lo más usado
                        </span>
                      </div>
                      <p className="whitespace-pre-line rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-foreground/80">
                        {buildCheckinInviteMessage()}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void handleCopyCheckinInvite()}
                          variant="outline"
                          className={cn(
                            "h-9 px-3 rounded-xl font-semibold text-xs bg-white",
                            inviteCopied &&
                              "border-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {inviteCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />
                              Copiar texto
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => void handleQuickShareWhatsApp()}
                          className="h-9 px-4 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          WhatsApp
                        </Button>
                        <Button
                          onClick={handleSendCheckinEmail}
                          disabled={
                            isSendingCheckinEmail || !selectedBooking.correo
                          }
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-semibold text-xs bg-white"
                          title={
                            selectedBooking.correo
                              ? `Enviar correo a ${selectedBooking.correo}`
                              : "Sin correo registrado"
                          }
                        >
                          {isSendingCheckinEmail ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5 mr-1.5" />
                              Enviar correo
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Correo a{" "}
                        {selectedBooking.correo || "sin correo registrado"}.
                      </p>
                    </div>

                    {/* Toggle: ver más plantillas (recordatorios) */}
                    <button
                      type="button"
                      onClick={() => setShowMoreMessages((v) => !v)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {showMoreMessages ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Ocultar otras plantillas
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Ver más plantillas
                          (recordatorios, propietario)
                        </>
                      )}
                    </button>

                    {showMoreMessages && (
                      <>
                    {/* Recordar finalizar el check-in */}
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                      <p className="text-[11px] text-foreground/80 leading-snug">
                        ⏰ Recordar finalizar el check-in (listado de invitados)
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={handleCopyCheckinReminder}
                          variant="outline"
                          className={cn(
                            "h-9 px-3 rounded-xl font-semibold text-xs",
                            checkinReminderCopied &&
                              "border-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {checkinReminderCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />
                              Copiar texto
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleSendCheckinReminderWhatsApp}
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-semibold text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>

                    {/* Recordatorio un día antes (ingreso es mañana) */}
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-foreground/80">
                        📅 Recordatorio un día antes (tu ingreso es mañana)
                      </p>
                      <p className="whitespace-pre-line rounded-lg border border-border/60 bg-background px-3 py-2 text-[11px] leading-relaxed text-orange-950/80">
                        {buildDayBeforeReminderMessage().msg}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleCopyDayBeforeReminder}
                          variant="outline"
                          className={cn(
                            "h-9 px-3 rounded-xl font-semibold text-xs",
                            dayBeforeReminderCopied &&
                              "border-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {dayBeforeReminderCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />
                              Copiar texto
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleSendDayBeforeReminderWhatsApp}
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-semibold text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>

                    {/* Check-out: devolución del depósito */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                      <p className="text-[12px] font-semibold text-blue-900">
                        🧳 Check-out (devolución del depósito)
                      </p>
                      <p className="text-[10px] text-blue-800/80 leading-relaxed">
                        Reglas de salida + formulario para la devolución del
                        depósito. Enlace:{" "}
                        <span className="font-mono">
                          /checkout/
                          {selectedBooking.reference || selectedBooking._id}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => void handleCopyCheckoutLink()}
                          variant="outline"
                          className={cn(
                            "h-9 px-3 rounded-xl font-semibold text-xs",
                            checkoutLinkCopied &&
                              "border-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {checkoutLinkCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5 mr-1.5" />
                              Copiar link
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => void handleCopyCheckoutMessage()}
                          variant="outline"
                          className={cn(
                            "h-9 px-3 rounded-xl font-semibold text-xs",
                            checkoutMsgCopied &&
                              "border-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {checkoutMsgCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />
                              Copiar mensaje
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleShareCheckoutWhatsApp}
                          className="h-9 px-4 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>

                    {/* Plantilla oficial (Meta) — cliente */}
                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-foreground">
                        Plantilla oficial (Meta) — incluye salida / checkout
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Envía una plantilla aprobada a{" "}
                        {selectedBooking.celular || "N/A"}, o cópiala / ábrela en
                        WhatsApp con los datos ya rellenados.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={sendClientTemplateKey}
                          onChange={(e) =>
                            setSendClientTemplateKey(e.target.value)
                          }
                          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {clientCheckinTemplates.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          onClick={() =>
                            void handleSendTemplate(sendClientTemplateKey)
                          }
                          disabled={
                            isTemplateBusy(sendClientTemplateKey, "send") ||
                            !sendClientTemplateKey
                          }
                          className="h-10 px-5 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                          {isTemplateBusy(sendClientTemplateKey, "send") ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 mr-1.5" />
                              Enviar por WhatsApp
                            </>
                          )}
                        </Button>
                      </div>
                      {sendClientTemplateKey && (
                        <div className="rounded-lg bg-background/70 border border-border/60 p-2.5 space-y-2">
                          {isLoadingClientTemplatePreview ? (
                            <div className="flex items-center gap-2 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                Generando vista previa…
                              </span>
                            </div>
                          ) : clientTemplatePreview ? (
                            <p className="text-[11px] text-foreground whitespace-pre-line leading-relaxed">
                              {clientTemplatePreview}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">
                              No se pudo generar la vista previa.
                            </p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleCopyTemplateText(sendClientTemplateKey)
                              }
                              disabled={
                                isTemplateBusy(sendClientTemplateKey, "copy") ||
                                isTemplateBusy(sendClientTemplateKey, "share") ||
                                !sendClientTemplateKey
                              }
                              className="h-8 px-3 rounded-lg font-semibold text-[11px]"
                            >
                              {isTemplateBusy(sendClientTemplateKey, "copy") ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : copiedTemplateKey === sendClientTemplateKey ? (
                                <>
                                  <Check className="w-3 h-3 mr-1 text-foreground" />
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copiar texto
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleShareTemplateWhatsApp(
                                  sendClientTemplateKey,
                                  "client",
                                )
                              }
                              disabled={
                                isTemplateBusy(sendClientTemplateKey, "share") ||
                                isTemplateBusy(sendClientTemplateKey, "copy") ||
                                !sendClientTemplateKey
                              }
                              className="h-8 px-3 rounded-lg font-semibold text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            >
                              {isTemplateBusy(sendClientTemplateKey, "share") ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <MessageCircle className="w-3 h-3 mr-1" />
                                  WhatsApp
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Marca manual: check-in enviado → morado en el calendario */}
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-purple-900">
                          {selectedBooking.checkinSentManualAt
                            ? "Check-in marcado como enviado"
                            : "Marcar check-in como enviado"}
                        </p>
                        <p className="text-[10px] leading-snug text-purple-700/80">
                          Pasa la reserva a morado en el calendario tras
                          copiar/enviar el check-in al cliente.
                        </p>
                      </div>
                      <Button
                        onClick={handleMarkCheckinSent}
                        disabled={isMarkingCheckinSent}
                        variant="outline"
                        className="h-9 px-4 rounded-xl font-semibold text-xs shrink-0 border-purple-300 text-purple-800 hover:bg-purple-100"
                      >
                        {isMarkingCheckinSent ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : selectedBooking.checkinSentManualAt ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Marcado · quitar
                          </>
                        ) : (
                          "Marcar enviado"
                        )}
                      </Button>
                    </div>
                      </>
                    )}
                  </div>

                  {/* ───── AL PROPIETARIO ───── */}
                  {showMoreMessages && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">
                        Al propietario
                      </h3>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-foreground">
                        Enlace con el estado del check-in
                      </p>
                      {selectedBooking.property?.requiresGuestList !== false ? (
                        <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              Enviar listado al propietario
                            </p>
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              {shareGuestListWithOwner
                                ? "Verá invitados y PDF en /anfitrion antes de enviar."
                                : "Oculto: no verá nombres ni PDF de invitados."}
                            </p>
                          </div>
                          <Switch
                            checked={shareGuestListWithOwner}
                            onCheckedChange={(v) =>
                              void handleToggleGuestListShare(v)
                            }
                            disabled={savingGuestListShare}
                            className="shrink-0"
                          />
                        </label>
                      ) : null}
                      <p className="whitespace-pre-line rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] leading-relaxed text-foreground">
                        {buildOwnerMessage().msg}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleCopyOwnerMessage}
                          variant="outline"
                          className={cn(
                            "h-9 px-3 rounded-xl font-semibold text-xs",
                            ownerMsgCopied &&
                              "border-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {ownerMsgCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />
                              Copiar mensaje
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleSendOwnerLink}
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-semibold text-xs"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Enviar
                        </Button>
                      </div>
                    </div>

                    <OwnerPayoutSection
                      key={`owner-payout-msg-${selectedBooking._id}`}
                      mode="payout-only"
                      bookingId={selectedBooking._id}
                      initialOwnerPayout={selectedBooking.ownerPayout}
                      onResend={handleSendOwnerLink}
                      onSaved={(payout) => {
                        setSelectedBooking((prev: any) =>
                          prev
                            ? {
                                ...prev,
                                ownerPayout: {
                                  ...(prev.ownerPayout ?? {}),
                                  ...payout,
                                },
                              }
                            : prev,
                        );
                        refetchBookings();
                      }}
                    />

                    {ownerCheckinTemplates.length > 0 ? (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-foreground">
                          Plantilla oficial (Meta)
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Envía una plantilla aprobada a{" "}
                          {selectedBooking.property?.propietarioTelefono ||
                            "sin teléfono de propietario"}
                          , o cópiala / ábrela en WhatsApp con los datos ya
                          rellenados.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={sendOwnerTemplateKey}
                            onChange={(e) =>
                              setSendOwnerTemplateKey(e.target.value)
                            }
                            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {ownerCheckinTemplates.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            onClick={() =>
                              void handleSendTemplate(sendOwnerTemplateKey)
                            }
                            disabled={
                              isTemplateBusy(sendOwnerTemplateKey, "send") ||
                              !sendOwnerTemplateKey
                            }
                            className="h-10 px-5 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                          >
                            {isTemplateBusy(sendOwnerTemplateKey, "send") ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5 mr-1.5" />
                                Enviar por WhatsApp
                              </>
                            )}
                          </Button>
                        </div>
                        {sendOwnerTemplateKey && (
                          <div className="rounded-lg bg-background/70 border border-border/60 p-2.5 space-y-2">
                            {isLoadingOwnerTemplatePreview ? (
                              <div className="flex items-center gap-2 py-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                  Generando vista previa…
                                </span>
                              </div>
                            ) : ownerTemplatePreview ? (
                              <p className="text-[11px] text-foreground whitespace-pre-line leading-relaxed">
                                {ownerTemplatePreview}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                No se pudo generar la vista previa.
                              </p>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void handleCopyTemplateText(sendOwnerTemplateKey)
                                }
                                disabled={
                                  isTemplateBusy(sendOwnerTemplateKey, "copy") ||
                                  isTemplateBusy(sendOwnerTemplateKey, "share") ||
                                  !sendOwnerTemplateKey
                                }
                                className="h-8 px-3 rounded-lg font-semibold text-[11px]"
                              >
                                {isTemplateBusy(sendOwnerTemplateKey, "copy") ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : copiedTemplateKey === sendOwnerTemplateKey ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-foreground" />
                                    Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copiar texto
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void handleShareTemplateWhatsApp(
                                    sendOwnerTemplateKey,
                                    "owner",
                                  )
                                }
                                disabled={
                                  isTemplateBusy(sendOwnerTemplateKey, "share") ||
                                  isTemplateBusy(sendOwnerTemplateKey, "copy") ||
                                  !sendOwnerTemplateKey
                                }
                                className="h-8 px-3 rounded-lg font-semibold text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              >
                                {isTemplateBusy(sendOwnerTemplateKey, "share") ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <MessageCircle className="w-3 h-3 mr-1" />
                                    WhatsApp
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  )}
                    </div>
                  )}

                  {/* Área debajo (Metadatos visuales) */}
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 pt-6 mt-4 gap-4">
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                      {selectedBooking.googleEventId ? (
                        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sincronizado
                          con Google Calendar
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          Sin sincronización de calendario
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 font-mono">
                        ID: {selectedBooking._id}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="h-10 px-4 rounded-xl font-semibold text-sm border-border text-foreground hover:bg-muted/40"
                        onClick={() => {
                          setEditingBooking(selectedBooking);
                          setIsEditModalOpen(true);
                          setSelectedBooking(null);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            disabled={isDeleting}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-10 px-4 rounded-xl text-xs font-semibold"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Eliminar"
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-4xl border-none shadow-2xl p-8 max-w-sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                              ¿Eliminar reserva?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              Esta acción eliminará permanentemente la reserva
                              de {selectedBooking.nombreCompleto}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-6 flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="rounded-xl font-semibold border-border hover:bg-muted">
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteBooking}
                              className="rounded-xl font-semibold bg-red-600! text-white! hover:bg-red-700! border-none px-6"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        variant="outline"
                        className="h-10 px-8 rounded-xl font-semibold text-sm border-border hover:bg-muted"
                        onClick={() => setSelectedBooking(null)}
                      >
                        Cerrar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
