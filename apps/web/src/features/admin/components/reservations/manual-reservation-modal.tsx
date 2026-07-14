"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  Search,
  ChevronDown,
  Building2,
  MapPin,
  Hash,
  CalendarIcon,
  User,
  Plus,
  X,
  FileText,
  Upload,
  Trash2,
  Sparkles,
  Minus,
  LayoutGrid,
  CreditCard,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  usePropertiesForBooking,
  useContactsSearch,
  useVerifiedGuests,
} from "@/features/admin/queries/bookings.queries";
import { sileo } from "sileo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatCOP, formatPriceInput, parseCOP } from "@/lib/utils";
import {
  createEconomicAdjustment,
  parseEconomicAdjustments,
  sumEconomicAdjustments,
  type EconomicAdjustment,
} from "@/features/admin/utils/economic-adjustments";
import { getGuestCapacityWarning } from "@/features/admin/utils/guest-capacity-warning";
import { GuestCapacityWarningAlert } from "@/features/admin/components/shared/guest-capacity-warning-alert";
import { computePetFees } from "@/lib/pet-fees";
import { toClientFieldUpper } from "@/lib/client-field-normalize";
import { propertyMatchesSearchQuery } from "@/lib/property/property-search";
import {
  formatOperatorLabel,
  getCurrentUser,
} from "@/features/auth/api/auth.api";

const PAYMENT_FIELD_CLASS = "h-10 w-full rounded-xl";

/** IA / CRM pueden mandar yyyy-MM-dd, ISO completo, dd/MM/yyyy, etc. */
function toReservationIsoDate(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return format(new Date(value), "yyyy-MM-dd");
  }
  let s = String(value).trim();
  if (!s) return "";
  const isoStart = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoStart) {
    const part = isoStart[1];
    const t = new Date(`${part}T12:00:00`).getTime();
    return Number.isNaN(t) ? "" : part;
  }
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dm) {
    const y = dm[3];
    const mo = dm[2].padStart(2, "0");
    const d = dm[1].padStart(2, "0");
    const part = `${y}-${mo}-${d}`;
    const t = new Date(`${part}T12:00:00`).getTime();
    return Number.isNaN(t) ? "" : part;
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "yyyy-MM-dd");
}

function reservationDateAtNoon(isoYmd: string): Date | undefined {
  if (!isoYmd || !/^\d{4}-\d{2}-\d{2}$/.test(isoYmd)) return undefined;
  const d = new Date(`${isoYmd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatReservationDateLabel(isoYmd: string): string | null {
  const d = reservationDateAtNoon(isoYmd);
  if (!d) return null;
  return format(d, "dd MMM yyyy", { locale: es });
}

/** type="time" requiere HH:mm; la IA a veces manda "03:00 PM". */
function to24hTime(value: unknown, fallback = "15:00"): string {
  const s = String(value ?? "").trim();
  if (!s) return fallback;
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return fallback;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23) return fallback;
  return `${String(h).padStart(2, "0")}:${min}`;
}

type PaymentMethod =
  | "bbva"
  | "bancolombia"
  | "davivienda"
  | "nequi"
  | "pse"
  | "tarjeta_credito";

type PaymentStatus = "pending" | "paid";

type VerifiedGuestHistory = {
  id: string;
  nombre: string;
  cedula: string;
  celular: string;
  correo: string;
  city: string;
  address?: string;
  fechaNacimiento?: string;
  reference: string;
  propertyTitle: string;
  source: "checkin" | "payment" | "sale-link";
  sourceLabel: string;
  lastVerifiedAt: number;
  lastVerifiedAmount: number;
  lastVerifiedBy: string;
};

function guestPickerKey(cedula?: string, phone?: string): string {
  const c = String(cedula ?? "").replace(/\D/g, "");
  if (c.length >= 6) return `ced:${c}`;
  const p = String(phone ?? "").replace(/\D/g, "");
  if (p.length >= 10) return `tel:${p.slice(-10)}`;
  return "";
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "bbva", label: "BBVA" },
  { value: "bancolombia", label: "Bancolombia" },
  { value: "davivienda", label: "Davivienda" },
  { value: "nequi", label: "Nequi" },
  { value: "pse", label: "PSE" },
  { value: "tarjeta_credito", label: "Tarjeta Crédito" },
];

const EMPTY_PAYMENT_FORM = {
  address: "",
  contractNumber: "",
  issueDate: "",
  rentAmount: 0,
  cleaningFee: 0,
  refundableDeposit: 0,
  totalAmount: 0,
  depositAmount: 0,
  depositDate: "",
  depositPaymentMethod: "bancolombia" as PaymentMethod,
  balanceAmount: 0,
  paymentStatus: "pending" as PaymentStatus,
  economicAdjustments: [] as EconomicAdjustment[],
};

/** Depósito reembolsable = daños de la finca + depósito por mascotas (regla comercial). */
function resolveRefundableDepositAmount(
  damageDeposit: number,
  petCount: number,
  apiPetRefundable?: number,
): number {
  const petRef =
    apiPetRefundable != null && Number.isFinite(apiPetRefundable)
      ? Math.round(apiPetRefundable)
      : computePetFees(petCount).deposit;
  return Math.round(Math.max(0, damageDeposit) + Math.max(0, petRef));
}

/** Desglose visual: depósito de la finca vs depósito por mascotas. */
function resolveDepositBreakdown(input: {
  totalDeposit: number;
  damageDeposit: number;
  petCount: number;
  apiPetRefundable?: number;
  storedHouse?: number;
  storedPet?: number;
}): { house: number; pets: number } {
  const {
    totalDeposit,
    damageDeposit,
    petCount,
    apiPetRefundable,
    storedHouse = 0,
    storedPet = 0,
  } = input;

  const petRef =
    apiPetRefundable != null && Number.isFinite(apiPetRefundable)
      ? Math.round(apiPetRefundable)
      : petCount > 0
        ? computePetFees(petCount).deposit
        : 0;

  if (storedHouse > 0 || storedPet > 0) {
    const storedTotal = storedHouse + storedPet;
    if (totalDeposit <= 0 || Math.abs(storedTotal - totalDeposit) <= 1000) {
      return { house: storedHouse, pets: storedPet };
    }
  }

  if (petRef > 0 && totalDeposit > 0) {
    const derivedHouse = Math.max(0, totalDeposit - petRef);
    const house =
      Math.abs(derivedHouse - damageDeposit) <= 1000
        ? Math.round(Math.max(0, damageDeposit))
        : derivedHouse;
    return { house, pets: petRef };
  }

  const total =
    totalDeposit > 0 ? totalDeposit : Math.round(Math.max(0, damageDeposit));
  return { house: total, pets: 0 };
}

function parseNumericField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number(String(value ?? "").replace(/[^\d]/g, "") || "0");
  return Number.isFinite(n) ? n : 0;
}

function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

// Normaliza un medio de pago (texto libre del registro de pago, p. ej.
// "Davivienda", "Nequi") al enum del formulario. Devuelve null si no reconoce
// nada, para que el llamador decida el fallback.
function normalizePaymentMethod(v: unknown): PaymentMethod | null {
  const s = String(v ?? "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!s) return null;
  if (s.includes("bbva")) return "bbva";
  if (s.includes("bancolombia")) return "bancolombia";
  if (s.includes("davivienda")) return "davivienda";
  if (s.includes("nequi")) return "nequi";
  if (s.includes("pse")) return "pse";
  if (s.includes("tarjeta")) return "tarjeta_credito";
  return null;
}

function denormalizePaymentMethod(label: unknown): PaymentMethod {
  return normalizePaymentMethod(label) ?? "bancolombia";
}

function parsePaymentNotes(notes?: string | null): {
  depositDate: string;
  issueDate: string;
} {
  const result = { depositDate: "", issueDate: "" };
  if (!notes) return result;
  const abonoMatch = notes.match(/Fecha abono:\s*([^·]+)/i);
  const issueMatch = notes.match(/Fecha emisi[oó]n:\s*([^·]+)/i);
  if (abonoMatch) result.depositDate = toReservationIsoDate(abonoMatch[1]);
  if (issueMatch) result.issueDate = toReservationIsoDate(issueMatch[1]);
  return result;
}

type BookingPaymentsSummary = {
  precioTotal: number;
  paymentStatus?: string;
  netPaid: number;
  pending: number;
  payments: Array<{
    type: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
    createdAt: number;
  }>;
};

function hydratePaymentFieldsFromSummary(
  summary: BookingPaymentsSummary,
  bookingIssueDate?: string,
): Partial<typeof EMPTY_PAYMENT_FORM> {
  const paidTypes = new Set(["ABONO_50", "SALDO_50", "COMPLETO"]);
  const abonoPayments = summary.payments.filter((p) => paidTypes.has(p.type));
  const primary = abonoPayments[0] ?? summary.payments[0];
  const noteDates = parsePaymentNotes(primary?.notes);

  const paymentStatus: PaymentStatus =
    summary.paymentStatus === "PAID" ? "paid" : "pending";

  return {
    depositAmount: summary.netPaid,
    balanceAmount: summary.pending,
    depositDate: noteDates.depositDate,
    issueDate: bookingIssueDate || noteDates.issueDate,
    depositPaymentMethod: denormalizePaymentMethod(primary?.paymentMethod),
    paymentStatus,
  };
}

function extractContractFromObservaciones(obs?: string | null): string {
  if (!obs) return "";
  const match = obs.match(/contrato\s*:\s*([^\s\n\r]+)/i);
  return match?.[1]?.trim() ?? "";
}

/** Separa Nº contrato interno vs código de reserva al cargar una reserva existente. */
function mapInitialReservationCodes(raw: Record<string, unknown>): {
  contractNumber: string;
  calendarLabel: string;
  preserveCalendarLabel: boolean;
} {
  const reference = String(raw.reference ?? "").trim();
  const calRaw = String(raw.calendarLabel ?? "").trim();
  const isDefaultCal = !calRaw || calRaw === "Reserva:";
  const fromObs = extractContractFromObservaciones(String(raw.observaciones ?? ""));
  const explicitContract = String(
    raw.contractNumber ?? raw.contrato ?? "",
  ).trim();

  const calendarLabel = isDefaultCal
    ? reference || "Reserva:"
    : calRaw;

  let contractNumber = explicitContract || fromObs || reference;

  // Si el calendario ya tiene otro código (ej. 89012), el contrato suele ser el reference previo (1010).
  if (!isDefaultCal && calRaw !== reference && !explicitContract && !fromObs) {
    contractNumber = reference;
  }

  return {
    contractNumber,
    calendarLabel,
    preserveCalendarLabel: !isDefaultCal && calendarLabel !== contractNumber,
  };
}

/**
 * Nº contrato (interno) vs código de reserva (check-in / calendario) pueden
 * diferir. Si hay código de calendario distinto al default, ese es el reference.
 */
function resolveReservationCode(form: {
  contractNumber: string;
  calendarLabel: string;
  observaciones: string;
}): { reference: string; calendarLabel: string; observaciones: string } {
  const contractNum = form.contractNumber.trim();
  const calLabel = form.calendarLabel.trim();
  const isDefaultCal = !calLabel || calLabel === "Reserva:";

  let code = "";
  if (!isDefaultCal) {
    code = calLabel;
  } else if (contractNum) {
    code = contractNum;
  }

  let observaciones = form.observaciones.trim();
  if (contractNum && code && contractNum !== code) {
    const note = `Contrato: ${contractNum}`;
    if (!observaciones.includes(note)) {
      observaciones = observaciones ? `${observaciones}\n${note}` : note;
    }
  }

  return {
    reference: code,
    calendarLabel: code || (isDefaultCal ? "Reserva:" : calLabel),
    observaciones,
  };
}

function resolveRefundableDepositFromBooking(
  raw: Record<string, unknown>,
): number {
  const garantia =
    parseNumericField(raw.depositoGarantia) ||
    parseNumericField(raw.depositoGarantiaCop) ||
    parseNumericField(raw.refundableDeposit);
  const petStored = parseNumericField(raw.depositoMascotas);
  const petCount =
    parseNumericField(raw.numeroMascotas) || parseNumericField(raw.petCount);
  const petDep =
    petStored > 0
      ? petStored
      : petCount > 0
        ? computePetFees(petCount).deposit
        : 0;

  const rent =
    parseNumericField(raw.rentAmount) ||
    parseNumericField(raw.subtotal) ||
    parseNumericField(raw.subtotalAlojamientoCop);
  const cleaning =
    parseNumericField(raw.cleaningFee) ||
    parseNumericField(raw.aseoFinalCop) ||
    parseNumericField(raw.depositoAseo);
  const total =
    parseNumericField(raw.totalAmount) ||
    parseNumericField(raw.precioTotal) ||
    parseNumericField(raw.totalPrice);
  const extras =
    parseNumericField(raw.costoMascotas) +
    parseNumericField(raw.costoPersonalServicio) -
    parseNumericField(raw.discountAmount);
  const impliedFromTotal =
    total > 0 && rent > 0
      ? Math.max(0, total - rent - cleaning - extras)
      : 0;

  if (petStored > 0) {
    return garantia + petStored;
  }

  if (garantia > 0 && petDep > 0) {
    if (impliedFromTotal > 0 && Math.abs(impliedFromTotal - garantia) <= 1000) {
      return garantia;
    }
    if (
      impliedFromTotal > 0 &&
      Math.abs(impliedFromTotal - (garantia + petDep)) <= 1000
    ) {
      return garantia + petDep;
    }
    return garantia + petDep;
  }

  if (garantia > 0) return garantia;
  if (impliedFromTotal > 0) return impliedFromTotal;
  return petDep;
}

function mapInitialPaymentFields(raw: Record<string, unknown>) {
  const rent =
    parseNumericField(raw.rentAmount) ||
    parseNumericField(raw.subtotal) ||
    parseNumericField(raw.subtotalAlojamientoCop);
  const cleaning =
    parseNumericField(raw.cleaningFee) ||
    parseNumericField(raw.aseoFinalCop) ||
    parseNumericField(raw.depositoAseo);
  const refundable = resolveRefundableDepositFromBooking(raw);
  const total =
    parseNumericField(raw.totalAmount) ||
    parseNumericField(raw.precioTotal) ||
    parseNumericField(raw.totalPrice) ||
    rent + cleaning + refundable;
  const deposit =
    parseNumericField(raw.depositAmount) ||
    parseNumericField(raw.valorAbono) ||
    parseNumericField(raw.abono);
  const balance =
    parseNumericField(raw.balanceAmount) ||
    parseNumericField(raw.valorSaldo) ||
    parseNumericField(raw.saldo) ||
    (total > 0 && deposit > 0 ? Math.max(total - deposit, 0) : 0);

  return {
    address: String(raw.address || raw.clientAddress || raw.direccion || "").trim(),
    contractNumber: String(raw.contractNumber ?? "").trim(),
    issueDate: toReservationIsoDate(raw.issueDate || raw.fechaEmision),
    rentAmount: rent,
    cleaningFee: cleaning,
    refundableDeposit: refundable,
    totalAmount: total,
    depositAmount: deposit,
    depositDate: toReservationIsoDate(raw.depositDate || raw.fechaAbono),
    depositPaymentMethod: denormalizePaymentMethod(
      raw.depositPaymentMethod || raw.paymentMethod || raw.medioPago,
    ),
    balanceAmount: balance,
    paymentStatus:
      raw.paymentStatus === "paid" ||
      raw.paymentStatus === "PAID" ||
      raw.paymentStatus === "PARTIAL"
        ? raw.paymentStatus === "PAID" || raw.paymentStatus === "paid"
          ? ("paid" as PaymentStatus)
          : ("pending" as PaymentStatus)
        : ("pending" as PaymentStatus),
    economicAdjustments: parseEconomicAdjustments(raw.economicAdjustments),
  };
}

interface ManualReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tras guardar en edición: recargar datos y mantener el modal abierto. */
  onSaved?: (bookingId: string) => void | Promise<void>;
  initialData?: any;
  bookingId?: string;
  conversationId?: string;
}

const WIZARD_STEPS = [
  { id: 1, label: "Finca y fechas" },
  { id: 2, label: "Huésped" },
  { id: 3, label: "Precio y pagos" },
  { id: 4, label: "Confirmación" },
] as const;

const PetStepper = ({
  value,
  onChange,
  label = "Mascotas",
  description = "Sobre-cargo ajustable",
}: {
  value: number;
  onChange: (val: number) => void;
  label?: string;
  description?: string;
}) => {
  return (
    <div className="flex items-center justify-between transition-colors rounded-xl">
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">
          {description}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className="h-8 w-8 rounded-full border-border hover:border-foreground/20 transition-colors shadow-sm"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-4 text-center text-sm font-bold text-foreground">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-full border-border hover:border-foreground/20 transition-colors shadow-sm"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export function ManualReservationModal({
  isOpen,
  onClose,
  onSaved,
  initialData,
  bookingId,
  conversationId,
}: ManualReservationModalProps) {
  const isEditMode = Boolean(bookingId);
  const [loading, setLoading] = useState(false);
  const [operatorLabel, setOperatorLabel] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceData, setPriceData] = useState<any>(null);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [multimediaFiles, setMultimediaFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [calendarLabelTouched, setCalendarLabelTouched] = useState(false);
  const [adjustmentDraft, setAdjustmentDraft] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    amount: "",
    type: "INCREMENT" as "INCREMENT" | "DISCOUNT",
  });
  const editHydratedRef = useRef(false);
  const loadedAbonoSnapshotRef = useRef<{
    depositAmount: number;
    depositDate: string;
    depositPaymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
  } | null>(null);

  useEffect(() => {
    if (multimediaFiles.length === 0) {
      setPreviews([]);
      return;
    }
    const newPreviews = multimediaFiles.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    );
    setPreviews(newPreviews);
    // Cleanup URLs to avoid memory leaks
    return () => newPreviews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [multimediaFiles]);

  useEffect(() => {
    if (!isOpen) return;
    getCurrentUser()
      .then((user) => setOperatorLabel(formatOperatorLabel(user)))
      .catch(() => {});
  }, [isOpen]);

  const [formData, setFormData] = useState({
    propertyId: "",
    nombreCompleto: "",
    cedula: "",
    celular: "",
    correo: "",
    city: "",
    fechaNacimiento: "",
    purpose: "Descanso familiar",
    fechaEntrada: "",
    fechaSalida: "",
    horaEntrada: "10:00",
    horaSalida: "16:00",
    numeroPersonas: 1,
    numeroMascotas: 0,
    precioTotal: 0,
    temporada: "ESTANDAR",
    observaciones: "",
    calendarLabel: "Reserva:",
    incluirServicio: false,
    ...EMPTY_PAYMENT_FORM,
  });

  // Marca qué montos editó el usuario a mano, para que el recálculo automático
  // de precio no los pise. Se resetea al cambiar finca o fechas (cotización nueva).
  const userEditedPriceRef = useRef({
    rent: false,
    cleaning: false,
    deposit: false,
  });
  // El usuario ESCRIBIÓ un monto a mano (distinto de "cargado al editar"): solo
  // entonces recalculamos el total = suma de componentes.
  const userTypedPriceRef = useRef({
    rent: false,
    cleaning: false,
    deposit: false,
  });
  // Al editar una reserva existente, saltamos el primer "reset" (que se dispara
  // porque al cargar cambian finca/fechas) para no tratarla como cotización nueva.
  const skipNextPriceResetRef = useRef(false);
  // Firma "finca|entrada|salida" de la reserva cargada al editar. Mientras la
  // finca y las fechas no cambien, NO aplicamos el precio sugerido: se conservan
  // los montos REGISTRADOS. Es un guard determinista (no depende del orden de
  // los efectos), por eso es más confiable que las refs anteriores.
  const loadedReservationSigRef = useRef<string | null>(null);
  const loadedPetCountRef = useRef<number | null>(null);

  const setNumericPaymentField = (
    field:
      | "rentAmount"
      | "cleaningFee"
      | "refundableDeposit"
      | "depositAmount"
      | "balanceAmount",
    value: string,
  ) => {
    if (field === "rentAmount") {
      userEditedPriceRef.current.rent = true;
      userTypedPriceRef.current.rent = true;
    }
    if (field === "cleaningFee") {
      userEditedPriceRef.current.cleaning = true;
      userTypedPriceRef.current.cleaning = true;
    }
    if (field === "refundableDeposit") {
      userEditedPriceRef.current.deposit = true;
      userTypedPriceRef.current.deposit = true;
    }
    setFormData((prev) => ({
      ...prev,
      [field]: parseCOP(value),
    }));
  };

  // Pre-fill form if initialData is provided
  useEffect(() => {
    if (isOpen && initialData) {
      const raw = initialData as Record<string, unknown>;
      const fechaEntrada = toReservationIsoDate(
        raw.fechaEntrada ?? raw.checkInDate,
      );
      const fechaSalida = toReservationIsoDate(
        raw.fechaSalida ?? raw.checkOutDate,
      );
      // Editando una reserva existente: bloqueamos los montos cargados para que el
      // precio sugerido NO los pise, y guardamos la firma finca|entrada|salida.
      const editingExisting = Boolean(raw._id || bookingId);
      if (editingExisting) {
        userEditedPriceRef.current = {
          rent: true,
          cleaning: true,
          deposit: true,
        };
        userTypedPriceRef.current = {
          rent: false,
          cleaning: false,
          deposit: false,
        };
        skipNextPriceResetRef.current = true;
        const loadedPropertyId = String(raw.propertyId ?? "");
        loadedReservationSigRef.current = `${loadedPropertyId}|${fechaEntrada}|${fechaSalida}`;
        loadedPetCountRef.current =
          parseNumericField(raw.numeroMascotas) ||
          parseNumericField(raw.petCount);
      } else {
        loadedReservationSigRef.current = null;
        loadedPetCountRef.current = null;
      }
      const paymentFields = mapInitialPaymentFields(raw);
      const reservationCodes = mapInitialReservationCodes(raw);
      setCalendarLabelTouched(reservationCodes.preserveCalendarLabel);
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        ...paymentFields,
        contractNumber: reservationCodes.contractNumber,
        calendarLabel: reservationCodes.calendarLabel,
        fechaEntrada,
        fechaSalida,
        horaEntrada: to24hTime(
          raw.horaEntrada ?? raw.checkInTime,
          prev.horaEntrada,
        ),
        horaSalida: to24hTime(
          raw.horaSalida ?? raw.checkOutTime,
          prev.horaSalida,
        ),
        nombreCompleto: toClientFieldUpper(
          String(initialData.nombreCompleto ?? prev.nombreCompleto ?? ""),
        ),
        cedula: toClientFieldUpper(String(initialData.cedula ?? prev.cedula ?? "")),
        celular: toClientFieldUpper(String(initialData.celular ?? prev.celular ?? "")),
        correo: toClientFieldUpper(String(initialData.correo ?? prev.correo ?? "")),
        city: toClientFieldUpper(String(initialData.city ?? prev.city ?? "")),
        fechaNacimiento: String(
          initialData.fechaNacimiento ?? prev.fechaNacimiento ?? "",
        ).trim(),
        address: toClientFieldUpper(
          String(initialData.address ?? prev.address ?? ""),
        ),
        numeroMascotas:
          initialData.numeroMascotas ??
          initialData.petCount ??
          prev.numeroMascotas,
        numeroPersonas:
          initialData.numeroPersonas ??
          initialData.guests ??
          prev.numeroPersonas,
        precioTotal:
          paymentFields.totalAmount ||
          parseNumericField(initialData.precioTotal) ||
          prev.precioTotal,
        economicAdjustments: paymentFields.economicAdjustments,
      }));
      userEditedPriceRef.current = {
        rent: true,
        cleaning: true,
        deposit: true,
      };
      editHydratedRef.current = true;
    } else if (!isOpen) {
      // Reset form when closing
      setFormData({
        propertyId: "",
        nombreCompleto: "",
        cedula: "",
        celular: "",
        correo: "",
        city: "",
        fechaNacimiento: "",
        purpose: "Descanso familiar",
        fechaEntrada: "",
        fechaSalida: "",
        horaEntrada: "10:00",
        horaSalida: "16:00",
        numeroPersonas: 1,
        numeroMascotas: 0,
        precioTotal: 0,
        temporada: "ESTANDAR",
        observaciones: "",
        calendarLabel: "Reserva:",
        incluirServicio: false,
        ...EMPTY_PAYMENT_FORM,
      });
      setMultimediaFiles([]);
      setStep(1);
      setCalendarLabelTouched(false);
      editHydratedRef.current = false;
      loadedAbonoSnapshotRef.current = null;
      loadedReservationSigRef.current = null;
      loadedPetCountRef.current = null;
    }
  }, [isOpen, initialData]);

  // En edición, cargar abonos reales desde la tabla payments.
  useEffect(() => {
    if (!isOpen || !bookingId || !editHydratedRef.current) return;

    let cancelled = false;
    const loadPayments = async () => {
      try {
        const { data } = await axios.get<BookingPaymentsSummary>(
          `/api/bookings/${bookingId}/payments`,
        );
        if (cancelled || !data) return;
        const hydrated = hydratePaymentFieldsFromSummary(
          data,
          String((initialData as Record<string, unknown>)?.issueDate ?? ""),
        );
        setFormData((prev) => {
          const next = {
            ...prev,
            ...hydrated,
            balanceAmount: data.pending,
          };
          loadedAbonoSnapshotRef.current = {
            depositAmount: next.depositAmount ?? 0,
            depositDate: next.depositDate ?? "",
            depositPaymentMethod: next.depositPaymentMethod ?? "bancolombia",
            paymentStatus: next.paymentStatus ?? "pending",
          };
          return next;
        });
      } catch (error) {
        console.error("Error cargando abonos de la reserva:", error);
      }
    };

    void loadPayments();
    return () => {
      cancelled = true;
    };
  }, [isOpen, bookingId, initialData]);

  // Fincas — Convex directo (reactivo).
  const { data: properties, isLoading: isLoadingProps } =
    usePropertiesForBooking();

  // Contactos del CRM — Convex directo, filtro por búsqueda.
  const { data: contacts, isLoading: isLoadingContacts } = useContactsSearch(
    clientSearchTerm,
    clientSearchTerm.length > 1,
  );

  // Clientes conocidos (reserva pagada) — Convex directo.
  const { data: verifiedGuests, isLoading: isLoadingVerifiedGuests } =
    useVerifiedGuests(clientSearchTerm, clientSearchTerm.length > 1) as {
      data: VerifiedGuestHistory[];
      isLoading: boolean;
    };

  const verifiedGuestKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const guest of verifiedGuests ?? []) {
      const key = guestPickerKey(guest.cedula, guest.celular);
      if (key) keys.add(key);
    }
    return keys;
  }, [verifiedGuests]);

  const bookingDetail = useConvexQuery(
    api.bookings.getById,
    isOpen && bookingId
      ? { id: bookingId as Id<"bookings"> }
      : "skip",
  );

  useEffect(() => {
    if (!isOpen || !bookingId || !bookingDetail) return;
    setFormData((prev) => ({
      ...prev,
      fechaNacimiento: String(
        bookingDetail.fechaNacimiento ?? prev.fechaNacimiento ?? "",
      ).trim(),
      address: toClientFieldUpper(
        String(bookingDetail.address ?? prev.address ?? ""),
      ),
    }));
  }, [
    isOpen,
    bookingId,
    bookingDetail?._id,
    bookingDetail?.fechaNacimiento,
    bookingDetail?.address,
  ]);

  const crmContactsFiltered = useMemo(() => {
    if (!contacts?.length) return [];
    return contacts.filter((c: { cedula?: string; phone?: string }) => {
      const key = guestPickerKey(c.cedula, c.phone);
      return !key || !verifiedGuestKeys.has(key);
    });
  }, [contacts, verifiedGuestKeys]);

  const applyGuestFromPicker = (guest: {
    nombre?: string;
    name?: string;
    cedula?: string;
    celular?: string;
    phone?: string;
    correo?: string;
    email?: string;
    city?: string;
    address?: string;
    fechaNacimiento?: string;
  }) => {
    setFormData({
      ...formData,
      nombreCompleto: toClientFieldUpper(
        guest.nombre || guest.name || "",
      ),
      cedula: toClientFieldUpper(guest.cedula || ""),
      celular: toClientFieldUpper(guest.celular || guest.phone || ""),
      correo: toClientFieldUpper(guest.correo || guest.email || ""),
      city: toClientFieldUpper(guest.city || ""),
      address: toClientFieldUpper(guest.address || ""),
      fechaNacimiento: String(guest.fechaNacimiento ?? "").trim(),
    });
    setIsClientPickerOpen(false);
    setClientSearchTerm("");
    sileo.success({
      description: "Huésped seleccionado correctamente.",
      fill: "#f0fdf4",
    });
  };

  // Al cambiar finca o fechas es una cotización nueva: olvidar ediciones
  // manuales para que el recálculo automático vuelva a llenar los montos.
  // Excepción: el primer disparo al ABRIR una reserva existente (no es cambio del
  // usuario), donde conservamos los montos guardados.
  useEffect(() => {
    if (skipNextPriceResetRef.current) {
      skipNextPriceResetRef.current = false;
      return;
    }
    userEditedPriceRef.current = {
      rent: false,
      cleaning: false,
      deposit: false,
    };
    userTypedPriceRef.current = {
      rent: false,
      cleaning: false,
      deposit: false,
    };
  }, [formData.propertyId, formData.fechaEntrada, formData.fechaSalida]);

  // Calculate price automatically (solo en creación; en edición se preservan montos guardados)
  useEffect(() => {
    if (isEditMode) return;

    const calculatePrice = async () => {
      if (
        formData.propertyId &&
        formData.fechaEntrada &&
        formData.fechaSalida
      ) {
        setLoadingPrice(true);
        try {
          const { data } = await axios.get(
            `/api/fincas/${formData.propertyId}/calculate-stay-price`,
            {
              params: {
                fechaEntrada: formData.fechaEntrada,
                fechaSalida: formData.fechaSalida,
                numeroPersonas: formData.numeroPersonas,
                numeroMascotas: formData.numeroMascotas,
                incluirServicio: formData.incluirServicio,
              },
            },
          );
          if (data.total !== undefined) {
            // Guard determinista: si estamos editando una reserva y la finca y
            // las fechas siguen siendo las cargadas, conservamos los montos
            // REGISTRADOS y no aplicamos el precio sugerido. Si el usuario
            // cambia finca o fechas, la firma deja de coincidir y sí se aplica
            // la cotización nueva.
            const currentSig = `${formData.propertyId}|${formData.fechaEntrada}|${formData.fechaSalida}`;
            if (
              loadedReservationSigRef.current !== null &&
              currentSig === loadedReservationSigRef.current
            ) {
              setPriceData(data);
              setLoadingPrice(false);
              return;
            }
            const uniqueTemporadas =
              [
                ...new Set((data.nights || []).map((n: any) => n.ruleName)),
              ].join(" y ") || "ESTANDAR";
            const property = properties?.find(
              (p: { _id: string }) => p._id === formData.propertyId,
            );
            const rentSubtotal = Math.round(
              Number(data.subtotal ?? data.total ?? 0) -
                Number(data.pets?.serviceFee || 0) -
                Number(data.pets?.cleaningFee || 0),
            );
            const cleaningFee = Math.round(
              Number(
                data.cleaningFee ||
                  data.pets?.cleaningFee ||
                  data.petCleaningFee ||
                  0,
              ),
            );
            const damageDeposit = Math.round(
              Number(
                data.damageDeposit ?? property?.depositoDanosReembolsable ?? 0,
              ),
            );
            const refundableDeposit = resolveRefundableDepositAmount(
              damageDeposit,
              formData.numeroMascotas,
              Number(data.pets?.refundable || 0),
            );
            const totalAmount =
              rentSubtotal + cleaningFee + refundableDeposit || data.total;
            const edited = userEditedPriceRef.current;
            setFormData((prev) => {
              const nextRent = edited.rent
                ? prev.rentAmount
                : rentSubtotal || prev.rentAmount;
              const nextCleaning = edited.cleaning
                ? prev.cleaningFee
                : cleaningFee || prev.cleaningFee;
              const nextDeposit = edited.deposit
                ? prev.refundableDeposit
                : refundableDeposit || prev.refundableDeposit;
              // Si los tres montos están bloqueados (reserva existente sin cambios
              // del usuario), conservamos el total guardado en vez de recalcularlo.
              const allLocked =
                edited.rent && edited.cleaning && edited.deposit;
              const userTyped =
                userTypedPriceRef.current.rent ||
                userTypedPriceRef.current.cleaning ||
                userTypedPriceRef.current.deposit;
              const nextTotal =
                allLocked && !userTyped
                  ? prev.totalAmount ||
                    prev.precioTotal ||
                    nextRent + nextCleaning + nextDeposit
                  : nextRent + nextCleaning + nextDeposit;
              return {
                ...prev,
                precioTotal: nextTotal,
                totalAmount: nextTotal,
                rentAmount: nextRent,
                cleaningFee: nextCleaning,
                refundableDeposit: nextDeposit,
                temporada: uniqueTemporadas,
              };
            });
            setPriceData(data);
          }
        } catch (error) {
          console.error("Error calculating price:", error);
        } finally {
          setLoadingPrice(false);
        }
      }
    };

    calculatePrice();
  }, [
    isEditMode,
    formData.propertyId,
    formData.fechaEntrada,
    formData.fechaSalida,
    formData.numeroPersonas,
    formData.numeroMascotas,
    formData.incluirServicio,
    properties,
  ]);

  // Al cambiar mascotas (crear o editar), sumar el depósito de mascotas al
  // depósito reembolsable base, salvo que el usuario lo haya escrito a mano
  // o ya venga cargado al editar una reserva existente.
  useEffect(() => {
    if (!isOpen || !formData.propertyId) return;
    if (userTypedPriceRef.current.deposit) return;
    if (
      loadedReservationSigRef.current !== null &&
      formData.refundableDeposit > 0 &&
      formData.numeroMascotas === loadedPetCountRef.current
    ) {
      return;
    }

    const property = properties?.find(
      (p: { _id: string }) => p._id === formData.propertyId,
    );
    const damageDeposit = Math.round(
      Number(priceData?.damageDeposit ?? property?.depositoDanosReembolsable ?? 0),
    );
    const apiPetRef =
      priceData?.pets?.count === formData.numeroMascotas
        ? Number(priceData.pets.refundable || 0)
        : undefined;
    const nextDeposit = resolveRefundableDepositAmount(
      damageDeposit,
      formData.numeroMascotas,
      apiPetRef,
    );
    if (nextDeposit === formData.refundableDeposit) return;

    setFormData((prev) => {
      const adjustmentsNet = sumEconomicAdjustments(prev.economicAdjustments);
      const nextTotal =
        prev.rentAmount + prev.cleaningFee + nextDeposit + adjustmentsNet;
      return {
        ...prev,
        refundableDeposit: nextDeposit,
        totalAmount: nextTotal > 0 ? nextTotal : prev.totalAmount,
        precioTotal: nextTotal > 0 ? nextTotal : prev.precioTotal,
      };
    });
  }, [
    isOpen,
    formData.propertyId,
    formData.numeroMascotas,
    formData.refundableDeposit,
    properties,
    priceData?.damageDeposit,
    priceData?.pets,
  ]);

  const selectedProperty = properties?.find(
    (p: any) => p._id === formData.propertyId,
  );

  const stayNights = useMemo(() => {
    const entrada = reservationDateAtNoon(formData.fechaEntrada);
    const salida = reservationDateAtNoon(formData.fechaSalida);
    if (!entrada || !salida) return 1;
    return Math.max(
      1,
      Math.ceil((salida.getTime() - entrada.getTime()) / 86400000),
    );
  }, [formData.fechaEntrada, formData.fechaSalida]);

  const serviceStaffUnitPrice = selectedProperty?.serviceStaffPrice ?? 0;
  const serviceStaffStayTotal = serviceStaffUnitPrice * stayNights;

  const guestCapacityWarning = useMemo(
    () =>
      getGuestCapacityWarning(formData.numeroPersonas, selectedProperty),
    [formData.numeroPersonas, selectedProperty],
  );

  useEffect(() => {
    // Solo recalcular el total cuando el usuario edita manualmente alquiler/limpieza/
    // depósito. Al ABRIR la reserva NO se recalcula, para conservar el total guardado
    // (si no, editar sobrescribiría el total con la suma de componentes y se perderían
    // valores, como el excedente que el desglose muestra como "depósito"/"otros ajustes").
    const typed = userTypedPriceRef.current;
    if (!typed.rent && !typed.cleaning && !typed.deposit) return;
    const baseTotal =
      formData.rentAmount + formData.cleaningFee + formData.refundableDeposit;
    const adjustmentsNet = sumEconomicAdjustments(formData.economicAdjustments);
    const total = baseTotal + adjustmentsNet;
    if (total > 0 && total !== formData.totalAmount) {
      setFormData((prev) => ({
        ...prev,
        totalAmount: total,
        precioTotal: total,
      }));
    }
  }, [
    formData.rentAmount,
    formData.cleaningFee,
    formData.refundableDeposit,
    formData.economicAdjustments,
    formData.totalAmount,
  ]);

  useEffect(() => {
    const total = formData.totalAmount || formData.precioTotal;
    if (total <= 0) return;
    const pending = Math.max(0, total - (formData.depositAmount || 0));
    if (pending !== formData.balanceAmount) {
      setFormData((prev) => ({ ...prev, balanceAmount: pending }));
    }
  }, [
    formData.totalAmount,
    formData.precioTotal,
    formData.depositAmount,
    formData.balanceAmount,
  ]);

  useEffect(() => {
    if (selectedProperty?.serviceStaffMandatory && !formData.incluirServicio) {
      setFormData((prev) => ({ ...prev, incluirServicio: true }));
    }
  }, [selectedProperty?.serviceStaffMandatory, formData.incluirServicio]);

  // Sincroniza contrato → calendario mientras el usuario no haya fijado a mano un
  // código de reserva distinto. Si editó el campo de calendario, `calendarLabelTouched`
  // queda en true y se respeta ese código; de lo contrario el código de reserva
  // (reference) sigue siempre al Nº de contrato (incluido al editarlo).
  useEffect(() => {
    if (calendarLabelTouched) return;
    const code = formData.contractNumber.trim();
    if (!code) return;
    if (code !== formData.calendarLabel.trim()) {
      setFormData((prev) => ({ ...prev, calendarLabel: code }));
    }
  }, [formData.contractNumber, formData.calendarLabel, calendarLabelTouched]);

  // Validación por paso del wizard
  const stepMissingFields = useMemo(() => {
    const missing: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
    if (!formData.propertyId) missing[1].push("finca");
    if (!formData.fechaEntrada) missing[1].push("fecha de entrada");
    if (!formData.fechaSalida) missing[1].push("fecha de salida");
    if (!formData.nombreCompleto.trim()) missing[2].push("nombre completo");
    if (!formData.celular.trim()) missing[2].push("celular");
    if ((formData.totalAmount || formData.precioTotal) <= 0)
      missing[3].push("total de la reserva");
    return missing;
  }, [
    formData.propertyId,
    formData.fechaEntrada,
    formData.fechaSalida,
    formData.nombreCompleto,
    formData.celular,
    formData.totalAmount,
    formData.precioTotal,
  ]);

  const missingForCurrentStep = stepMissingFields[step] ?? [];
  const missingAll = [1, 2, 3].flatMap((s) => stepMissingFields[s]);

  const canGoToStep = (target: number) => {
    if (target <= step) return true;
    for (let s = 1; s < target; s++) {
      if (stepMissingFields[s].length > 0) return false;
    }
    return true;
  };

  const goNext = () => {
    if (missingForCurrentStep.length > 0) {
      sileo.error({
        title: "Campos incompletos",
        description: `Falta: ${missingForCurrentStep.join(", ")}.`,
        fill: "#fee2e2",
      });
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  // Al cambiar de paso, volver al inicio del modal
  useEffect(() => {
    document
      .getElementById("reservation-wizard-top")
      ?.scrollIntoView({ block: "start" });
  }, [step]);

  const filteredProperties = properties?.filter((p: any) =>
    propertyMatchesSearchQuery(
      { title: p.title, location: p.location, code: p.code },
      searchTerm,
    ),
  );

  const handleSubmit = async () => {
    if (
      !formData.propertyId ||
      !formData.fechaEntrada ||
      !formData.fechaSalida ||
      !formData.nombreCompleto ||
      !formData.celular
    ) {
      sileo.error({
        title: "Campos incompletos",
        description: "Finca, fechas, nombre y celular son obligatorios.",
        fill: "#fee2e2",
      });
      return;
    }

    setLoading(true);
    try {
      const verifiedBy =
        operatorLabel || formatOperatorLabel(await getCurrentUser()) || undefined;
      const isoIn = toReservationIsoDate(formData.fechaEntrada);
      const isoOut = toReservationIsoDate(formData.fechaSalida);
      const timeIn = to24hTime(formData.horaEntrada);
      const timeOut = to24hTime(formData.horaSalida);
      if (!isoIn || !isoOut) {
        sileo.error({
          title: "Fechas inválidas",
          description:
            "Revisa fecha de entrada y salida (formato o valores vacíos).",
          fill: "#fee2e2",
        });
        setLoading(false);
        return;
      }
      const newEntrada = new Date(`${isoIn}T${timeIn}:00`).getTime();
      const newSalida = new Date(`${isoOut}T${timeOut}:00`).getTime();
      if (Number.isNaN(newEntrada) || Number.isNaN(newSalida)) {
        sileo.error({
          title: "Fechas inválidas",
          description: "No se pudo interpretar la hora o la fecha.",
          fill: "#fee2e2",
        });
        setLoading(false);
        return;
      }

      // Check overlaps thoroughly against Database (Backend)
      const res = await axios.post("/api/bookings/check-availability", {
        propertyId: formData.propertyId,
        fechaEntrada: newEntrada,
        fechaSalida: newSalida,
        ...(bookingId ? { excludeBookingId: bookingId } : {}),
      });

      if (res.data && res.data.available === false) {
        sileo.warning({
          title: "Fechas ocupadas",
          description: `La finca ya está reservada para estas fechas.`,
          fill: "#fffbeb",
        });
        setLoading(false);
        return;
      }

      if (guestCapacityWarning) {
        sileo.warning({
          title: "Cupo excedido",
          description: guestCapacityWarning,
          fill: "#fffbeb",
        });
      }

      const effectiveTotal =
        formData.totalAmount > 0 ? formData.totalAmount : formData.precioTotal;

      // Use FormData to support file uploads
      const data = new FormData();
      const paymentOnlyKeys = new Set([
        "rentAmount",
        "cleaningFee",
        "refundableDeposit",
        "totalAmount",
        "depositAmount",
        "depositDate",
        "depositPaymentMethod",
        "balanceAmount",
        "paymentStatus",
        "issueDate",
        "contractNumber",
        "economicAdjustments",
        // Claves financieras del booking que entran por `...initialData` al
        // editar. Las excluimos del loop genérico para que NO se dupliquen con
        // valores viejos; se envían explícitamente abajo con data.set.
        "subtotal",
        "precioTotal",
        "depositoGarantia",
        "depositoAseo",
        "costoMascotas",
        "depositoMascotas",
        "sobrecargoMascotas",
        "discountAmount",
      ]);
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "incluirServicio" || paymentOnlyKeys.has(key)) return;
        data.append(key, value.toString());
      });

      // Override dates with timestamp format
      data.set("fechaEntrada", newEntrada.toString());
      data.set("fechaSalida", newSalida.toString());
      data.set("precioTotal", String(effectiveTotal));
      if (formData.address.trim()) {
        data.set("address", formData.address.trim());
      }
      if (formData.fechaNacimiento.trim()) {
        data.set("fechaNacimiento", formData.fechaNacimiento.trim());
      }
      if (formData.issueDate) {
        data.set("issueDate", formData.issueDate);
      }
      data.set(
        "economicAdjustments",
        JSON.stringify(formData.economicAdjustments),
      );

      const { reference, calendarLabel, observaciones } =
        resolveReservationCode(formData);
      if (reference) {
        data.set("reference", reference);
      }
      data.set("calendarLabel", calendarLabel);
      if (observaciones) {
        data.set("observaciones", observaciones);
      }

      // Noches calendario (diferencia de fechas sin horas): evita la "noche
      // fantasma" de Math.ceil cuando la hora de salida es mayor a la de entrada.
      const nochesCalendario = Math.max(
        1,
        Math.round(
          (new Date(`${isoOut}T12:00:00`).getTime() -
            new Date(`${isoIn}T12:00:00`).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      data.append("numeroNoches", nochesCalendario.toString());
      data.set(
        "subtotal",
        String(
          formData.rentAmount > 0
            ? formData.rentAmount
            : effectiveTotal - (priceData?.pets?.total || 0),
        ),
      );
      if (formData.cleaningFee > 0) {
        data.set("depositoAseo", String(formData.cleaningFee));
      }
      const petDepositForSave =
        formData.numeroMascotas > 0
          ? computePetFees(formData.numeroMascotas).deposit
          : 0;
      const depositoGarantiaFinal =
        formData.refundableDeposit > 0
          ? formData.refundableDeposit
          : petDepositForSave;
      if (depositoGarantiaFinal > 0) {
        if (petDepositForSave > 0) {
          data.set("depositoMascotas", String(petDepositForSave));
          data.set(
            "depositoGarantia",
            String(
              Math.max(0, formData.refundableDeposit - petDepositForSave),
            ),
          );
        } else {
          data.set("depositoGarantia", String(depositoGarantiaFinal));
        }
      }

      const resolvedStatus =
        formData.paymentStatus === "paid"
          ? "PAID"
          : isEditMode && initialData?.status
            ? String(initialData.status)
            : "CONFIRMED";
      data.append("status", resolvedStatus);

      const initialPetCount =
        initialData?.numeroMascotas ?? initialData?.petCount ?? 0;
      const petsChanged =
        !isEditMode || formData.numeroMascotas !== initialPetCount;

      // Add pet breakdown for financial tracking (solo si cambió en edición)
      if (priceData?.pets && petsChanged) {
        data.append("costoMascotas", priceData.pets.serviceFee.toString());
        // No sobrescribimos depositoGarantia aquí: ya se resolvió arriba
        // priorizando el valor discriminado por el usuario.
        data.append("tieneMascotas", (formData.numeroMascotas > 0).toString());
      } else if (formData.numeroMascotas > 0) {
        data.append("tieneMascotas", "true");
      }

      // Add service staff tracking
      if (priceData?.serviceStaff?.included) {
        data.append(
          "costoPersonalServicio",
          priceData.serviceStaff.fee.toString(),
        );
      }

      // Add multimedia files
      multimediaFiles.forEach((file) => {
        data.append("multimedia", file);
      });

      let savedBookingId: string | undefined;

      if (isEditMode && bookingId) {
        const res = await axios.put(`/api/bookings/${bookingId}`, data);
        savedBookingId = res.data?.bookingId ?? bookingId;

        const abonoNotes = [
          formData.depositDate ? `Fecha abono: ${formData.depositDate}` : "",
          formData.issueDate ? `Fecha emisión: ${formData.issueDate}` : "",
        ]
          .filter(Boolean)
          .join(" · ");

        let syncAbono:
          | {
              type: "ABONO_50" | "COMPLETO";
              amount: number;
              paymentMethod: string;
              notes?: string;
            }
          | undefined;

        if (formData.paymentStatus === "paid") {
          const paidAmount =
            formData.depositAmount > 0 || formData.balanceAmount > 0
              ? formData.depositAmount + formData.balanceAmount
              : effectiveTotal;
          if (paidAmount > 0) {
            syncAbono = {
              type: "COMPLETO",
              amount: Math.min(paidAmount, effectiveTotal),
              paymentMethod: paymentMethodLabel(formData.depositPaymentMethod),
              notes: abonoNotes || undefined,
            };
          }
        } else if (formData.depositAmount > 0) {
          syncAbono = {
            type: "ABONO_50",
            amount: formData.depositAmount,
            paymentMethod: paymentMethodLabel(formData.depositPaymentMethod),
            notes: abonoNotes || undefined,
          };
        }

        try {
          await axios.post(`/api/bookings/${bookingId}/payments/sync`, {
            paymentStatus:
              formData.paymentStatus === "paid" ? "PAID" : "PARTIAL",
            abono: syncAbono,
            verifiedBy,
          });
        } catch (paymentError) {
          console.error("Error sincronizando abono:", paymentError);
          sileo.warning({
            title: "Reserva guardada",
            description:
              "Los datos se guardaron, pero no se pudo actualizar el abono.",
            fill: "#fffbeb",
          });
        }
      } else if (conversationId) {
        const res = await axios.post(
          `/api/inbox/${conversationId}/create-booking`,
          data,
        );
        savedBookingId = res.data?.bookingId;
      } else {
        const res = await axios.post("/api/bookings", data);
        savedBookingId = res.data?.bookingId;
      }

      if (savedBookingId && !isEditMode) {
        const paymentEntries: Array<{
          type: "ABONO_50" | "SALDO_50" | "COMPLETO";
          amount: number;
          paymentMethod: string;
          notes?: string;
        }> = [];

        const abonoNotes = [
          formData.depositDate ? `Fecha abono: ${formData.depositDate}` : "",
          formData.issueDate ? `Fecha emisión: ${formData.issueDate}` : "",
        ]
          .filter(Boolean)
          .join(" · ");

        if (formData.paymentStatus === "paid") {
          const paidAmount =
            formData.depositAmount > 0 || formData.balanceAmount > 0
              ? formData.depositAmount + formData.balanceAmount
              : effectiveTotal;
          if (paidAmount > 0) {
            paymentEntries.push({
              type: "COMPLETO",
              amount: Math.min(paidAmount, effectiveTotal),
              paymentMethod: paymentMethodLabel(formData.depositPaymentMethod),
              notes: abonoNotes || undefined,
            });
          }
        } else if (formData.depositAmount > 0) {
          paymentEntries.push({
            type: "ABONO_50",
            amount: formData.depositAmount,
            paymentMethod: paymentMethodLabel(formData.depositPaymentMethod),
            notes: abonoNotes || undefined,
          });
        }

        for (const payment of paymentEntries) {
          try {
            await axios.post(`/api/bookings/${savedBookingId}/payments`, {
              ...payment,
              verifiedBy,
            });
          } catch (paymentError) {
            console.error("Error registrando abono:", paymentError);
          }
        }
      }

      sileo.success({
        title: isEditMode ? "Reserva actualizada" : "Reserva creada",
        description: isEditMode
          ? "Los cambios se guardaron correctamente."
          : formData.depositAmount > 0
            ? "Reserva creada. Solo el abono quedó registrado como pagado."
            : "Se ha registrado en el sistema y en Google Calendar.",
        fill: "#f0fdf4",
      });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });

      if (isEditMode && savedBookingId && onSaved) {
        await onSaved(savedBookingId);
      }
      setMultimediaFiles([]);
      onClose();
    } catch (error) {
      const detail =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : null;
      console.error(
        isEditMode ? "Error updating booking:" : "Error creating booking:",
        detail ?? error,
      );
      sileo.error({
        title: "Error",
        description:
          (detail && detail.trim()) ||
          (isEditMode
            ? "No se pudo actualizar la reserva."
            : "No se pudo crear la reserva."),
        fill: "#fee2e2",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setMultimediaFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setMultimediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addEconomicAdjustment = () => {
    const amount = parseCOP(adjustmentDraft.amount);
    if (!adjustmentDraft.description.trim()) {
      sileo.error({
        title: "Descripción requerida",
        description: "Indica el motivo del ajuste económico.",
        fill: "#fee2e2",
      });
      return;
    }
    if (amount <= 0) {
      sileo.error({
        title: "Monto inválido",
        description: "El valor del ajuste debe ser mayor a cero.",
        fill: "#fee2e2",
      });
      return;
    }
    const item = createEconomicAdjustment({
      date: adjustmentDraft.date,
      description: adjustmentDraft.description,
      amount,
      type: adjustmentDraft.type,
      createdBy: operatorLabel || "Operador",
    });
    setFormData((prev) => ({
      ...prev,
      economicAdjustments: [...prev.economicAdjustments, item],
    }));
    setAdjustmentDraft({
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      amount: "",
      type: "INCREMENT",
    });
  };

  const removeEconomicAdjustment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      economicAdjustments: prev.economicAdjustments.filter((a) => a.id !== id),
    }));
  };

  const baseReservationTotal =
    formData.rentAmount + formData.cleaningFee + formData.refundableDeposit;
  const adjustmentsNet = sumEconomicAdjustments(formData.economicAdjustments);

  const depositBreakdown = useMemo(() => {
    const damageDeposit = Math.round(
      Number(
        priceData?.damageDeposit ??
          selectedProperty?.depositoDanosReembolsable ??
          0,
      ),
    );
    const apiPetRef =
      priceData?.pets?.count === formData.numeroMascotas
        ? Number(priceData.pets.refundable || 0)
        : undefined;
    return resolveDepositBreakdown({
      totalDeposit: formData.refundableDeposit,
      damageDeposit,
      petCount: formData.numeroMascotas,
      apiPetRefundable: apiPetRef,
      storedHouse: isEditMode
        ? parseNumericField(initialData?.depositoGarantia)
        : 0,
      storedPet: isEditMode
        ? parseNumericField(initialData?.depositoMascotas)
        : 0,
    });
  }, [
    formData.refundableDeposit,
    formData.numeroMascotas,
    priceData?.damageDeposit,
    priceData?.pets,
    selectedProperty?.depositoDanosReembolsable,
    isEditMode,
    initialData?.depositoGarantia,
    initialData?.depositoMascotas,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card p-0 text-card-foreground shadow-xl">
        <ScrollArea className="flex-1 overflow-y-auto">
          <div id="reservation-wizard-top" className="p-6 md:p-8 space-y-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl md:text-2xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-foreground ring-1 ring-border shrink-0">
                  <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                {isEditMode ? "Editar Reserva" : "Nueva Reserva Manual"}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base leading-relaxed opacity-80">
                {isEditMode
                  ? "Modifica los datos de la reserva. Los cambios se sincronizan con Google Calendar."
                  : `Registra una reserva en ${WIZARD_STEPS.length} pasos. El sistema buscará disponibilidad y se sincronizará automáticamente.`}
              </DialogDescription>
            </DialogHeader>

            {/* Indicador de pasos */}
            <div className="flex items-center gap-1.5">
              {WIZARD_STEPS.map((s, idx) => {
                const isCurrent = step === s.id;
                const isDone =
                  s.id < step && stepMissingFields[s.id].length === 0;
                const reachable = canGoToStep(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && setStep(s.id)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 group",
                      !reachable && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="w-full flex items-center gap-1.5">
                      {idx > 0 && (
                        <div
                          key={`line-before-${s.id}`}
                          className={cn(
                            "h-0.5 flex-1 rounded-full",
                            s.id <= step ? "bg-primary" : "bg-border",
                          )}
                        />
                      )}
                      <div
                        key={`step-circle-${s.id}`}
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-all",
                          isCurrent
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                            : isDone
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground ring-1 ring-border",
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          s.id
                        )}
                      </div>
                      {idx < WIZARD_STEPS.length - 1 && (
                        <div
                          key={`line-after-${s.id}`}
                          className={cn(
                            "h-0.5 flex-1 rounded-full",
                            s.id < step ? "bg-primary" : "bg-border",
                          )}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider",
                        isCurrent
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-3",
                  step !== 1 && "hidden",
                )}
              >
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  Propiedad / Finca
                </Label>

                <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between h-14 rounded-2xl border border-input bg-background hover:bg-muted/40 transition-all font-medium px-4",
                        !formData.propertyId && "text-muted-foreground",
                      )}
                    >
                      {selectedProperty ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground overflow-hidden shrink-0 ring-1 ring-border">
                            {selectedProperty.image ? (
                              <img
                                src={selectedProperty.image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex flex-col items-start leading-tight">
                            <span className="font-bold text-foreground">
                              {selectedProperty.title}
                            </span>
                            <span className="text-[10px] uppercase tracking-tighter opacity-70">
                              {selectedProperty.location}
                            </span>
                          </div>
                        </div>
                      ) : formData.propertyId ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Cargando finca...
                          </span>
                        </div>
                      ) : (
                        "Buscar por nombre o código..."
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 w-(--radix-popover-trigger-width) min-w-[320px] rounded-2xl overflow-hidden border border-border bg-popover shadow-xl"
                    align="start"
                  >
                    <div className="p-3 border-b border-border bg-muted/10">
                      <div className="relative group">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                        <Input
                          placeholder="Escribe el nombre o el código (ej: FIN-001)..."
                          className="pl-10 h-10 rounded-xl bg-background border border-input focus-visible:ring-1 focus-visible:ring-ring transition-all"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    <ScrollArea
                      className="h-72"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 space-y-1">
                        {isLoadingProps ? (
                          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm font-medium">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            Cargando fincas...
                          </div>
                        ) : filteredProperties?.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <p className="text-sm font-bold">
                              No se encontraron fincas
                            </p>
                            <p className="text-xs">
                              Prueba con otro término de búsqueda.
                            </p>
                          </div>
                        ) : (
                          filteredProperties?.map((p: any) => (
                            <button
                              key={p._id}
                              className={cn(
                                "w-full flex items-center gap-4 p-3 rounded-xl transition-all hover:bg-accent/80 text-left group",
                                formData.propertyId === p._id &&
                                  "bg-accent ring-1 ring-border",
                              )}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  propertyId: p._id,
                                  incluirServicio: p.serviceStaffMandatory
                                    ? true
                                    : formData.incluirServicio,
                                });
                                setIsPickerOpen(false);
                                setSearchTerm("");
                              }}
                            >
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border group-hover:border-foreground/15 transition-all",
                                  formData.propertyId === p._id &&
                                    "ring-1 ring-border shadow-sm",
                                )}
                              >
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Building2 className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="overflow-hidden">
                                  <p className="font-bold text-[13px] text-foreground truncate group-hover:text-foreground transition-colors">
                                    {p.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                  <span className="truncate opacity-80">
                                    {p.location}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                {/* </Popover> */}
              </div>

              {step === 4 && (
                <div className="col-span-1 md:col-span-2 rounded-2xl border border-border bg-muted/20 p-5 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Resumen de la reserva
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      ["Finca", selectedProperty?.title || "—"],
                      [
                        "Fechas",
                        formData.fechaEntrada && formData.fechaSalida
                          ? `${formatReservationDateLabel(formData.fechaEntrada)} → ${formatReservationDateLabel(formData.fechaSalida)} (${stayNights} noche${stayNights === 1 ? "" : "s"})`
                          : "—",
                      ],
                      [
                        "Huésped",
                        formData.nombreCompleto
                          ? `${formData.nombreCompleto}${formData.celular ? ` · ${formData.celular}` : ""}`
                          : "—",
                      ],
                      [
                        "Personas / Mascotas",
                        `${formData.numeroPersonas} persona${formData.numeroPersonas === 1 ? "" : "s"} · ${formData.numeroMascotas} mascota${formData.numeroMascotas === 1 ? "" : "s"}`,
                      ],
                      ["Nº contrato", formData.contractNumber || "—"],
                      [
                        "Total reserva",
                        `$${formatPriceInput(formData.totalAmount || formData.precioTotal)}`,
                      ],
                      [
                        "Abono",
                        formData.depositAmount > 0
                          ? `$${formatPriceInput(formData.depositAmount)} (${paymentMethodLabel(formData.depositPaymentMethod)})`
                          : "Sin abono registrado",
                      ],
                      [
                        "Saldo pendiente",
                        `$${formatPriceInput(formData.balanceAmount)}`,
                      ],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          {label}
                        </span>
                        <span className="text-[13px] font-semibold text-foreground">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {missingAll.length > 0 && (
                    <p className="text-[11px] font-semibold text-red-500">
                      Faltan campos obligatorios: {missingAll.join(", ")}.
                    </p>
                  )}
                </div>
              )}

              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-2",
                  step !== 4 && "hidden",
                )}
              >
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Código de reserva (check-in / calendario)
                </Label>
                <Input
                  value={formData.calendarLabel}
                  onChange={(e) => {
                    setCalendarLabelTouched(true);
                    setFormData({ ...formData, calendarLabel: e.target.value });
                  }}
                  placeholder='Ej: CR-1024 (link de check-in y Google Calendar)'
                  className="rounded-xl border border-input bg-background"
                />
                <p className="text-[10px] text-muted-foreground ml-1">
                  Se llena con el Nº de contrato si coincide; edítalo aquí si el
                  código de reserva es distinto (ej. CR-1024 vs contrato 1010).
                </p>
              </div>

              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-3",
                  step !== 2 && "hidden",
                )}
              >
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                  <User className="h-3.5 w-3.5" /> Buscar Huésped / Cliente
                  Existente
                </Label>
                <Popover
                  open={isClientPickerOpen}
                  onOpenChange={setIsClientPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between h-12 rounded-2xl border border-input bg-background hover:bg-muted/40 transition-all font-medium px-4",
                      )}
                    >
                      <div className="flex items-center gap-3 w-full overflow-hidden text-left">
                        <span className="text-muted-foreground/60 w-full truncate text-sm">
                          Escribe para buscar en la base de datos...
                        </span>
                      </div>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 w-(--radix-popover-trigger-width) min-w-[320px] rounded-2xl overflow-hidden border border-border bg-popover shadow-xl"
                    align="start"
                  >
                    <div className="p-3 border-b border-border bg-muted/10">
                      <div className="relative group">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                        <Input
                          placeholder="Escribe el nombre, correo o celular..."
                          className="pl-10 h-10 rounded-xl bg-background border border-input focus-visible:ring-1 focus-visible:ring-ring transition-all"
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <ScrollArea
                      className="h-[280px]"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 space-y-1">
                        {isLoadingContacts || isLoadingVerifiedGuests ? (
                          <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : clientSearchTerm.length < 2 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <p className="text-sm font-bold">
                              Escribe para buscar
                            </p>
                            <p className="text-xs mt-1 opacity-70">
                              Incluye clientes con abono aprobado en check-in
                            </p>
                          </div>
                        ) : (verifiedGuests?.length ?? 0) === 0 &&
                          crmContactsFiltered.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <p className="text-sm font-bold">
                              No hay coincidencias
                            </p>
                          </div>
                        ) : (
                          <>
                            {(verifiedGuests?.length ?? 0) > 0 && (
                              <div className="space-y-1 pb-2">
                                <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">
                                  Pagos verificados
                                </p>
                                {verifiedGuests?.map((guest) => (
                                  <button
                                    key={guest.id}
                                    type="button"
                                    className="w-full flex items-start gap-3 p-3 rounded-xl transition-all hover:bg-emerald-50/80 dark:hover:bg-emerald-950/20 text-left group border border-transparent hover:border-emerald-200/60"
                                    onClick={() => applyGuestFromPicker(guest)}
                                  >
                                    <div className="mt-0.5 shrink-0 rounded-full bg-emerald-100 p-1.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-sm text-foreground truncate">
                                          {guest.nombre}
                                        </p>
                                        <Badge
                                          variant="secondary"
                                          className="text-[9px] h-5 px-1.5 font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                        >
                                          {guest.sourceLabel}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-bold flex-wrap">
                                        {guest.celular && (
                                          <span className="truncate">
                                            {guest.celular}
                                          </span>
                                        )}
                                        {guest.cedula && (
                                          <span className="truncate opacity-70">
                                            ID: {guest.cedula}
                                          </span>
                                        )}
                                        {guest.reference && (
                                          <span className="truncate opacity-70">
                                            {guest.reference}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-emerald-700/90 mt-1 font-semibold">
                                        {guest.lastVerifiedAmount > 0
                                          ? `${formatCOP(guest.lastVerifiedAmount)} · `
                                          : ""}
                                        {guest.propertyTitle || "Reserva anterior"}
                                        {guest.lastVerifiedBy
                                          ? ` · por ${guest.lastVerifiedBy}`
                                          : ""}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            {crmContactsFiltered.length > 0 && (
                              <div className="space-y-1">
                                {(verifiedGuests?.length ?? 0) > 0 && (
                                  <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    Contactos CRM
                                  </p>
                                )}
                                {crmContactsFiltered.map((c: any, i: number) => (
                                  <button
                                    key={c.id ?? c._id ?? `crm-${c.phone ?? ""}-${c.cedula ?? ""}-${i}`}
                                    type="button"
                                    className="w-full flex items-center gap-4 p-3 rounded-xl transition-all hover:bg-accent/80 text-left group"
                                    onClick={() => applyGuestFromPicker(c)}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-sm text-foreground truncate group-hover:text-foreground transition-colors">
                                        {c.name}
                                      </p>
                                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-bold">
                                        {c.phone && (
                                          <span className="truncate">
                                            {c.phone}
                                          </span>
                                        )}
                                        {c.cedula && (
                                          <span className="truncate opacity-70">
                                            ID: {c.cedula}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              <div className={cn("space-y-2 mt-4", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Nombre Completo *
                </Label>
                <Input
                  value={formData.nombreCompleto}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombreCompleto: toClientFieldUpper(e.target.value),
                    })
                  }
                  placeholder="Nombre del cliente"
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div className={cn("space-y-2 mt-4", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Cédula / ID
                </Label>
                <Input
                  value={formData.cedula}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cedula: toClientFieldUpper(e.target.value),
                    })
                  }
                  placeholder="Documento de identidad"
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div className={cn("space-y-2", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Celular *
                </Label>
                <Input
                  value={formData.celular}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      celular: toClientFieldUpper(e.target.value),
                    })
                  }
                  placeholder="Ej: 3001234567"
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div className={cn("space-y-2", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Correo Electrónico
                </Label>
                <Input
                  value={formData.correo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      correo: toClientFieldUpper(e.target.value),
                    })
                  }
                  placeholder="email@ejemplo.com"
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div className={cn("space-y-2", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Ciudad de Origen
                </Label>
                <Input
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      city: toClientFieldUpper(e.target.value),
                    })
                  }
                  placeholder="Ej: Bogotá"
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div className={cn("space-y-2", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Dirección
                </Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: toClientFieldUpper(e.target.value),
                    })
                  }
                  placeholder="Ej: Calle 150 # 14-24, Bogotá"
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div
                className={cn("space-y-2 order-1", step !== 3 && "hidden")}
              >
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Nº Contrato
                </Label>
                <Input
                  value={formData.contractNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, contractNumber: e.target.value })
                  }
                  placeholder="Ej: 1010 (número interno del contrato)"
                  className="rounded-xl border border-input bg-background"
                />
                <p className="text-[10px] text-muted-foreground ml-1">
                  Número del contrato PDF. Si el código de reserva es otro (ej.
                  CR-1024), indícalo en el paso Confirmación.
                </p>
              </div>

              <div
                className={cn("space-y-2 order-2", step !== 3 && "hidden")}
              >
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Fecha emisión
                </Label>
                <Input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, issueDate: e.target.value })
                  }
                  className="rounded-xl border border-input bg-background h-10"
                />
              </div>

              <div className={cn("space-y-2", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Fecha de nacimiento
                </Label>
                <Input
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fechaNacimiento: e.target.value,
                    })
                  }
                  className="rounded-xl border border-input bg-background"
                />
              </div>

              <div className={cn("space-y-2", step !== 2 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Motivo del Viaje
                </Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                >
                  <option value="Descanso familiar">Descanso familiar</option>
                  <option value="Evento / Fiesta">Evento / Fiesta</option>
                  <option value="Trabajo / Corporativo">
                    Trabajo / Corporativo
                  </option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className={cn("space-y-2", step !== 1 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Fecha Entrada *
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-10 px-3 flex items-center justify-start text-left font-normal rounded-xl border border-input bg-background hover:bg-muted/50",
                        !formData.fechaEntrada && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <span className="text-sm">
                        {formatReservationDateLabel(formData.fechaEntrada) ??
                          "Seleccionar llegada..."}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-100" align="start">
                    <Calendar
                      mode="single"
                      selected={reservationDateAtNoon(formData.fechaEntrada)}
                      onSelect={(date) => {
                        if (date)
                          setFormData({
                            ...formData,
                            fechaEntrada: format(date, "yyyy-MM-dd"),
                          });
                      }}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className={cn("space-y-2", step !== 1 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Hora Entrada
                </Label>
                <Input
                  type="time"
                  className="rounded-xl border border-input bg-background h-10"
                  value={formData.horaEntrada}
                  onChange={(e) =>
                    setFormData({ ...formData, horaEntrada: e.target.value })
                  }
                />
              </div>

              <div className={cn("space-y-2", step !== 1 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Fecha Salida *
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-10 px-3 flex items-center justify-start text-left font-normal rounded-xl border border-input bg-background hover:bg-muted/50",
                        !formData.fechaSalida && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <span className="text-sm">
                        {formatReservationDateLabel(formData.fechaSalida) ??
                          "Seleccionar salida..."}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-100" align="start">
                    <Calendar
                      mode="single"
                      selected={reservationDateAtNoon(formData.fechaSalida)}
                      onSelect={(date) => {
                        if (date)
                          setFormData({
                            ...formData,
                            fechaSalida: format(date, "yyyy-MM-dd"),
                          });
                      }}
                      initialFocus
                      locale={es}
                      disabled={(date) => {
                        const entrada = reservationDateAtNoon(
                          formData.fechaEntrada,
                        );
                        if (!entrada) return false;
                        const dateEntrada = new Date(entrada);
                        dateEntrada.setHours(0, 0, 0, 0);
                        return date <= dateEntrada;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className={cn("space-y-2", step !== 1 && "hidden")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Hora Salida
                </Label>
                <Input
                  type="time"
                  className="rounded-xl border border-input bg-background h-10"
                  value={formData.horaSalida}
                  onChange={(e) =>
                    setFormData({ ...formData, horaSalida: e.target.value })
                  }
                />
              </div>

              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-4 pt-5 border-t border-border/50",
                  step !== 1 && "hidden",
                )}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                      Número de Personas
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.numeroPersonas}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numeroPersonas: parseInt(e.target.value) || 1,
                        })
                      }
                      className="rounded-xl border border-input bg-background"
                    />
                    {selectedProperty?.capacity != null &&
                      selectedProperty.capacity > 0 && (
                        <p className="ml-1 text-[11px] font-medium text-muted-foreground">
                          Capacidad declarada: {selectedProperty.capacity}{" "}
                          personas
                        </p>
                      )}
                    <GuestCapacityWarningAlert message={guestCapacityWarning} />
                  </div>

                  <div className="pt-6 border-t border-border/40 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        Servicios y Adicionales
                      </h3>
                    </div>

                    <div className="grid gap-3">
                      {/* CARD: MASCOTAS */}
                      {formData.propertyId && (
                        <div className="group relative overflow-hidden rounded-[24px] border border-border bg-muted/20 p-5 transition-all hover:bg-muted/30">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-muted text-foreground ring-1 ring-border">
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-foreground">
                                  Estancia de Mascotas
                                </h4>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight mt-0.5">
                                  Configuracion temporal activa
                                </p>
                              </div>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-muted border border-border">
                              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">
                                {formData.numeroMascotas > 0
                                  ? "CON MASCOTAS"
                                  : "OPCIONAL"}
                              </span>
                            </div>
                          </div>

                          <div className="bg-muted/30 rounded-2xl p-4 border border-border/20">
                            <PetStepper
                              value={formData.numeroMascotas}
                              onChange={(val) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  numeroMascotas: val,
                                }))
                              }
                              label="Cantidad de mascotas"
                              description="1-2: $100k (Depósito) | 3+: $30k (Tarifa extra)"
                            />
                          </div>
                        </div>
                      )}

                      {/* CARD: PERSONAL DE SERVICIO */}
                      {formData.propertyId &&
                        (Boolean(selectedProperty?.serviceStaffAvailable) ||
                          (selectedProperty?.serviceStaffPrice ?? 0) > 0) && (
                          <div
                            className={cn(
                              "group relative overflow-hidden rounded-[24px] border p-5 transition-all duration-300",
                              formData.incluirServicio
                                ? "bg-primary/5 border-primary/25 shadow-sm"
                                : "bg-muted/20 border-border hover:bg-muted/30",
                            )}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-2xl transition-colors",
                                    formData.incluirServicio
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  <User className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-foreground">
                                    Personal de Servicio
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[11px] font-bold text-foreground">
                                      {serviceStaffUnitPrice > 0
                                        ? `$${formatPriceInput(serviceStaffStayTotal)}`
                                        : "Sin tarifa configurada"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none font-medium">
                                      {serviceStaffUnitPrice > 0
                                        ? `• $${formatPriceInput(serviceStaffUnitPrice)} × ${stayNights} noche${stayNights === 1 ? "" : "s"}`
                                        : "• Configure el valor en la finca"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider transition-colors",
                                    formData.incluirServicio
                                      ? "text-foreground"
                                      : "text-muted-foreground/60",
                                  )}
                                >
                                  {formData.incluirServicio
                                    ? "Incluido"
                                    : "No Incluir"}
                                </span>
                                <Switch
                                  checked={formData.incluirServicio}
                                  disabled={
                                    selectedProperty?.serviceStaffMandatory
                                  }
                                  onCheckedChange={(val) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      incluirServicio: val,
                                    }))
                                  }
                                  className="data-[state=checked]:bg-primary"
                                />
                              </div>
                            </div>

                            {(formData.incluirServicio ||
                              selectedProperty?.serviceStaffMandatory) && (
                              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-3 h-3 text-muted-foreground" />
                                  <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                                    {selectedProperty?.serviceStaffMandatory
                                      ? "Este servicio es obligatorio para esta finca."
                                      : "Este servicio se añadirá al precio final del contrato generado."}
                                  </p>
                                </div>
                                {selectedProperty?.serviceStaffMandatory && (
                                  <Badge
                                    variant="outline"
                                    className="text-[8px] font-black uppercase text-foreground border-border bg-muted"
                                  >
                                    Requerido
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-border/50 order-5",
                  step !== 3 && "hidden",
                )}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    Pagos y confirmación
                  </h3>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium px-1 -mt-2">
                  Abono, saldo y montos como en el PDF de confirmación. Solo el
                  abono se registra como pagado; el saldo es lo que falta por
                  cobrar (no cuenta como abonado hasta que el cliente pague).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Valor alquiler
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatPriceInput(formData.rentAmount)}
                      onChange={(e) =>
                        setNumericPaymentField("rentAmount", e.target.value)
                      }
                      placeholder="5.400.000"
                      className="rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Limpieza general
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatPriceInput(formData.cleaningFee)}
                      onChange={(e) =>
                        setNumericPaymentField("cleaningFee", e.target.value)
                      }
                      placeholder="120.000"
                      className="rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Depósito incluido mascotas
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatPriceInput(formData.refundableDeposit)}
                      onChange={(e) =>
                        setNumericPaymentField(
                          "refundableDeposit",
                          e.target.value,
                        )
                      }
                      placeholder="600.000"
                      className="rounded-xl h-10"
                    />
                    {(depositBreakdown.house > 0 ||
                      depositBreakdown.pets > 0) && (
                      <p className="text-[10px] text-muted-foreground">
                        {depositBreakdown.pets > 0
                          ? `$${formatPriceInput(depositBreakdown.house)} depósito + $${formatPriceInput(depositBreakdown.pets)} mascotas`
                          : `$${formatPriceInput(depositBreakdown.house)} depósito de la finca`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Total reserva
                    </Label>
                    <Input
                      type="text"
                      value={formatPriceInput(formData.totalAmount)}
                      readOnly
                      className="rounded-xl h-10 bg-muted/40 font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Alquiler + limpieza + depósito + ajustes. Se calcula solo.
                    </p>
                    {formData.economicAdjustments.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Base: ${formatPriceInput(baseReservationTotal)}
                        {adjustmentsNet >= 0 ? " + " : " − "}
                        ${formatPriceInput(Math.abs(adjustmentsNet))} ajustes
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Estado de pago
                    </Label>
                    <Select
                      value={formData.paymentStatus}
                      onValueChange={(value: PaymentStatus) =>
                        setFormData((prev) => ({ ...prev, paymentStatus: value }))
                      }
                    >
                      <SelectTrigger className={PAYMENT_FIELD_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Abono parcial / pendiente</SelectItem>
                        <SelectItem value="paid">Pago completo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    Abono / anticipo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Valor abono
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatPriceInput(formData.depositAmount)}
                        onChange={(e) =>
                          setNumericPaymentField("depositAmount", e.target.value)
                        }
                        placeholder="2.700.000"
                        className="rounded-xl h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Fecha abono
                      </Label>
                      <Input
                        type="date"
                        value={formData.depositDate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            depositDate: e.target.value,
                          }))
                        }
                        className="rounded-xl h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Medio de pago abono
                      </Label>
                      <Select
                        value={formData.depositPaymentMethod}
                        onValueChange={(value: PaymentMethod) =>
                          setFormData((prev) => ({
                            ...prev,
                            depositPaymentMethod: value,
                          }))
                        }
                      >
                        <SelectTrigger className={PAYMENT_FIELD_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                      Novedades económicas / Ajustes adicionales
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Registra incrementos o descuentos sin modificar el valor
                      base de alquiler, limpieza y depósito.
                    </p>
                  </div>

                  {formData.economicAdjustments.length > 0 && (
                    <div className="space-y-2">
                      {formData.economicAdjustments.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/80 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-foreground truncate">
                              {item.type === "INCREMENT" ? "+" : "−"}$
                              {formatPriceInput(item.amount)} · {item.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.date}
                              {item.createdBy ? ` · ${item.createdBy}` : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600"
                            onClick={() => removeEconomicAdjustment(item.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Fecha novedad
                      </Label>
                      <Input
                        type="date"
                        value={adjustmentDraft.date}
                        onChange={(e) =>
                          setAdjustmentDraft((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                        className="rounded-xl h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Tipo de ajuste
                      </Label>
                      <Select
                        value={adjustmentDraft.type}
                        onValueChange={(value: "INCREMENT" | "DISCOUNT") =>
                          setAdjustmentDraft((prev) => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger className={PAYMENT_FIELD_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INCREMENT">
                            Incremento (+)
                          </SelectItem>
                          <SelectItem value="DISCOUNT">Descuento (−)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Descripción / observación
                      </Label>
                      <Input
                        value={adjustmentDraft.description}
                        onChange={(e) =>
                          setAdjustmentDraft((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Ej: Aumento por huéspedes adicionales"
                        className="rounded-xl h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Valor del ajuste
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={adjustmentDraft.amount}
                        onChange={(e) =>
                          setAdjustmentDraft((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        placeholder="810.000"
                        className="rounded-xl h-10"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl h-10 font-bold"
                        onClick={addEconomicAdjustment}
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Agregar ajuste
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Lo que falta por pagar
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Se calcula solo: total de la reserva menos el abono. No se
                      registra como pagado hasta que lo cobres.
                    </p>
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Valor pendiente
                    </Label>
                    <Input
                      type="text"
                      readOnly
                      value={formatPriceInput(formData.balanceAmount)}
                      placeholder="0"
                      className="rounded-xl h-10 bg-muted/40 font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "space-y-3 col-span-1 md:col-span-2 order-3",
                  step !== 3 && "hidden",
                  // Al editar, el valor ya fue cotizado y negociado por el
                  // vendedor: ocultamos el "precio sugerido" para no confundir.
                  // El total se gestiona en "Total reserva" de la sección Pagos.
                  isEditMode && "hidden",
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest">
                    Precio Total Sugerido
                  </Label>
                  {formData.incluirServicio && (
                    <Badge
                      variant="outline"
                      className="bg-muted text-foreground border-border text-[9px] font-black px-2 py-0.5 rounded-lg border"
                    >
                      + SERVICIO INCLUIDO
                    </Badge>
                  )}
                </div>

                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xl group-focus-within:text-foreground transition-colors">
                    $
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatPriceInput(formData.precioTotal)}
                    onChange={(e) => {
                      const value = parseCOP(e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        precioTotal: value,
                        totalAmount: value,
                      }));
                    }}
                    className={cn(
                      "h-20 w-full pl-12 text-3xl font-black rounded-[28px] border border-input bg-muted/30 transition-all text-foreground",
                      "focus-visible:ring-offset-4 focus-visible:ring-ring/30 focus-visible:border-ring shadow-sm",
                      loadingPrice && "animate-pulse opacity-70",
                    )}
                  />
                  {loadingPrice && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium px-2 italic">
                  * Este es el valor base calculado según las fechas y
                  adicionales seleccionados.
                </p>
              </div>

              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-border/50",
                  step !== 4 && "hidden",
                )}
              >
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 ml-1">
                    <Upload className="h-3 w-3" /> Contenido Multimedia
                    (Imágenes / PDF)
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                    onClick={() =>
                      document.getElementById("multimedia-upload")?.click()
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Añadir Archivos
                  </Button>
                  <input
                    id="multimedia-upload"
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {multimediaFiles.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {multimediaFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="group relative h-28 rounded-2xl bg-muted/20 border border-border hover:border-border transition-all overflow-hidden flex flex-col shadow-sm"
                      >
                        {/* Image Preview or Icon Container */}
                        <div className="relative flex-1 bg-muted/40 flex items-center justify-center overflow-hidden">
                          {file.type.startsWith("image/") && previews[idx] ? (
                            <img
                              src={previews[idx]}
                              alt={file.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              {file.type.includes("pdf") ? (
                                <FileText className="w-8 h-8 text-red-500/80" />
                              ) : (
                                <Upload className="w-8 h-8 text-muted-foreground/40" />
                              )}
                            </div>
                          )}

                          {/* Overlay on hover for PDF or filename */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-[10px] text-white font-bold px-2 text-center truncate w-full">
                              {file.name}
                            </p>
                          </div>
                        </div>

                        {/* File Info Bar */}
                        <div className="px-3 py-1.5 bg-background/80 backdrop-blur-sm border-t border-border/40 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold truncate text-foreground/70">
                              {file.type.includes("pdf")
                                ? "Documento PDF"
                                : "Imagen"}
                            </p>
                            <p className="text-[8px] text-muted-foreground font-medium">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-muted-foreground/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-muted/5 hover:bg-muted/10 transition-all cursor-pointer group"
                    onClick={() =>
                      document.getElementById("multimedia-upload")?.click()
                    }
                  >
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all ring-1 ring-border">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-foreground/60">
                        Haz clic para subir archivos
                      </p>
                      <p className="text-[10px] text-muted-foreground opacity-70">
                        Imágenes y documentos PDF soportados
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "col-span-1 md:col-span-2 space-y-2",
                  step !== 4 && "hidden",
                )}
              >
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Observaciones
                </Label>
                <Input
                  value={formData.observaciones}
                  onChange={(e) =>
                    setFormData({ ...formData, observaciones: e.target.value })
                  }
                  placeholder="Detalles adicionales como mascotas, transporte, etc."
                  className="rounded-xl border border-input bg-background"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2 px-6 py-4 md:px-8 md:py-6 bg-muted/30 border-t border-border">
          {missingForCurrentStep.length > 0 && (
            <p className="text-[11px] font-semibold text-muted-foreground sm:mr-auto">
              Falta: {missingForCurrentStep.join(", ")}.
            </p>
          )}
          <div className="flex items-center justify-end gap-2 sm:ml-auto">
            <Button
              key="cancel"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-bold"
            >
              Cancelar
            </Button>
            {step > 1 && (
              <Button
                key="back"
                variant="outline"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="rounded-xl font-bold"
              >
                Atrás
              </Button>
            )}
            {step < 4 ? (
              <Button
                key="next"
                onClick={goNext}
                disabled={missingForCurrentStep.length > 0}
                variant="primary"
                className="rounded-xl font-bold px-6 transition-all active:scale-[0.98]"
              >
                Siguiente
              </Button>
            ) : (
              <Button
                key="submit"
                onClick={handleSubmit}
                disabled={loading || missingAll.length > 0}
                variant="primary"
                className="rounded-xl font-bold px-6 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Guardando..." : "Creando..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isEditMode ? "Guardar cambios" : "Crear Reserva"}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
