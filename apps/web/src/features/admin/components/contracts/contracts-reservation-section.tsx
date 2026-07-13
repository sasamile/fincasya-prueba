"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Home,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  User,
  ChevronUp,
  FileCheck,
  Link2,
  Copy,
  MessageCircle,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FormSection } from "../shared/form-section";
import {
  useCalculateStayPrice,
  useProperties,
  useProperty,
  usePropertyOwnerInfo,
  usePropietarios,
} from "@/features/fincas/queries/fincas.queries";
import {
  getContractSettingsSnapshot,
  useContractSettingsStore,
} from "@/features/admin/store/contract-settings.store";
import {
  buildContractHTML,
  formatFincaFeatures,
  type FincaData,
} from "@/features/admin/utils/contract-utils";
import {
  buildReservationPreviewFincaData,
} from "@/features/admin/utils/contract-preview-helpers";
import { ContractGlobalSetupSections } from "@/features/admin/components/contracts/contract-global-setup-sections";
import { ContractCodeHistoryModal } from "@/features/admin/components/contracts/contract-code-history-modal";
import {
  generateContractDocxAction,
  generateContractPdfAction,
} from "@/features/admin/actions/contract-actions";
import { inboxService } from "@/features/inbox/api/inbox.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatPriceInput, parseCOP } from "@/lib/utils";
import { normalizeContractLookupQuery } from "@/lib/normalize-contract-lookup";
import { toClientFieldUpper } from "@/lib/client-field-normalize";
import { getGuestCapacityWarning } from "@/features/admin/utils/guest-capacity-warning";
import { GuestCapacityWarningAlert } from "@/features/admin/components/shared/guest-capacity-warning-alert";
import { propertyMatchesSearchQuery } from "@/lib/property/property-search";
import {
  CopMoneyInput,
  copDigitsOnly as digits,
} from "@/features/admin/components/contracts/cop-money-input";

interface FieldErrors {
  [key: string]: string;
}
type PricingRuleLike = { activa?: boolean; nombre?: string };
type StayPriceLike = {
  appliedRule?: string;
  subtotal?: number;
  nightsCount?: number;
  pets?: {
    refundable?: number;
    serviceFee?: number;
    cleaningFee?: number;
  };
};
type BookingConflict = { cedula?: string; celular?: string };
type PropertyLike = {
  id: string;
  title: string;
  code?: string;
  location?: string;
  images?: string[];
  priceBase?: number | null;
  contractTemplateUrl?: string;
  pricing?: PricingRuleLike[];
  allowsPets?: boolean;
  serviceStaffAvailable?: boolean;
  serviceStaffMandatory?: boolean;
  serviceStaffPrice?: number;
  capacity?: number;
  eventCapacity?: number;
  features?: unknown[];
  depositoDanosReembolsable?: number;
  depositoAseo?: number;
  manillaCondominio?: number;
  propietarioNombre?: string;
  propietarioCedula?: string;
  ownerName?: string;
  nombrePropietario?: string;
};

type FormState = {
  propertyId: string;
  contractNumber: string;
  contractTotalInput: string;
  nightlyPrice: string;
  clientName: string;
  clientId: string;
  clientEmail: string;
  clientPhone: string;
  clientCity: string;
  clientAddress: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  guests: string;
  temporada: string;
  groupType: string;
  petCount: string;
  petDeposit: string;
  petSurcharge: string;
  serviceStaffIncluded: boolean;
  serviceStaffFee: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  idNumber: string;
  cleaningFee: string;
  refundableDeposit: string;
  manillaCondominio: string;
  otherCharges: string;
  isEvento: boolean;
  extraSound: string;
  liveMusic: string;
  dj: string;
  decoration: string;
  additionalGuests: string;
};

const INITIAL: FormState = {
  propertyId: "",
  contractNumber: "",
  contractTotalInput: "",
  nightlyPrice: "",
  clientName: "",
  clientId: "",
  clientEmail: "",
  clientPhone: "",
  clientCity: "",
  clientAddress: "",
  checkInDate: "",
  checkOutDate: "",
  checkInTime: "10:00 AM",
  checkOutTime: "04:00 PM",
  guests: "1",
  temporada: "ESTANDAR",
  groupType: "FAMILIAR",
  petCount: "0",
  petDeposit: "0",
  petSurcharge: "0",
  serviceStaffIncluded: false,
  serviceStaffFee: "0",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  idNumber: "",
  cleaningFee: "100000",
  refundableDeposit: "0",
  manillaCondominio: "0",
  otherCharges: "0",
  isEvento: false,
  extraSound: "NO",
  liveMusic: "NO",
  dj: "NO",
  decoration: "NO",
  additionalGuests: "NO",
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const mins = index * 30;
  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const hour = h24 % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${period}`;
});

const normSeason = (value?: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const money = (value: number) =>
  `$${Math.round(value || 0).toLocaleString("es-CO")}`;

/** Borrador interno: mismos datos que luego crearán la reserva al confirmar pago. */
function buildContractSnapshotPayload(input: {
  form: FormState;
  inMs: number;
  outMs: number;
  nights: number;
  contractTotal: number;
  staySubtotal: number;
  serviceStaffTotal: number;
  petSurchargeTotal: number;
  petDepositTotal: number;
  generatedContractNumber: string;
  contractUrlResult: string;
}): Record<string, unknown> {
  const f = input.form;
  const multimedia =
    input.contractUrlResult.trim().length > 0
      ? [
          {
            url: input.contractUrlResult,
            name: `Contrato_${input.generatedContractNumber}.pdf`,
            type: "application/pdf",
          },
        ]
      : [];
  const payload: Record<string, unknown> = {
    nombreCompleto: f.clientName,
    cedula: f.clientId,
    celular: f.clientPhone,
    correo: f.clientEmail,
    fechaEntrada: input.inMs,
    fechaSalida: input.outMs,
    numeroPersonas: f.guests || "1",
    precioTotal: String(input.contractTotal),
    subtotal: String(input.staySubtotal + input.serviceStaffTotal),
    depositoAseo: f.cleaningFee || "0",
    depositoGarantia: f.refundableDeposit || "0",
    numeroNoches: String(input.nights),
    temporada: f.temporada || "ESTANDAR",
    horaEntrada: f.checkInTime,
    horaSalida: f.checkOutTime,
    city: f.clientCity,
    address: f.clientAddress,
    numeroMascotas: f.petCount || "0",
    costoMascotas: String(input.petSurchargeTotal),
    depositoMascotas: String(input.petDepositTotal),
    costoPersonalServicio: String(input.serviceStaffTotal),
    tieneMascotas: String(Number(f.petCount || 0) > 0),
    isEvento: String(f.isEvento),
    isDirect: "true",
    observaciones: `Contrato: ${input.generatedContractNumber}`,
    reference: input.generatedContractNumber,
    multimediaLinks: multimedia,
  };
  if (f.isEvento) {
    payload.detallesEvento = {
      extraSound: f.extraSound,
      liveMusic: f.liveMusic,
      dj: f.dj,
      decoration: f.decoration,
      additionalGuests: f.additionalGuests,
    };
  }
  return payload;
}

/** Texto para UI (evita "1 noches"). */
const nochesResumenEs = (n: number) =>
  n === 1 ? "1 noche" : `${n} noches`;

/** Número de contrato para API: nunca vacío (el backend también rellena si falta). */
function ensureApiContractNumber(
  draft: FormState,
  props: PropertyLike[],
): string {
  const t = draft.contractNumber.trim();
  if (t) return t;
  const p = props.find((x) => x.id === draft.propertyId);
  const codePart = (p?.code || "FN")
    .replace(/[^\w-]+/g, "")
    .slice(0, 16)
    .replace(/^$/, "FN");
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const r = Math.floor(Math.random() * 90000 + 10000);
  return `DIR-${codePart}-${stamp}-${r}`;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const maybeMessage = (
      error.response?.data as { message?: string | string[] } | undefined
    )?.message;
    if (Array.isArray(maybeMessage)) {
      return maybeMessage.join(" ");
    }
    return maybeMessage || error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
};

const getBlobErrorMessage = async (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const parsed = JSON.parse(text) as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(parsed.message)) return parsed.message.join(" ");
      if (parsed.message) return String(parsed.message);
      if (parsed.error) return String(parsed.error);
    } catch {
      return error.message || fallback;
    }
  }
  return getErrorMessage(error, fallback);
};

async function sleepMs(ms: number) {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Comprueba que el blob sea un PDF o Word descargable (evita JSON de error). */
async function assertPdfBlob(blob: Blob | undefined | null, label: string) {
  if (!blob || blob.size < 8) {
    const hint =
      blob && blob.size > 0 ? (await blob.text()).slice(0, 400) : "(vacío)";
    throw new Error(
      `La ${label} no llegó como archivo (${blob?.size ?? 0} bytes). ${hint}`,
    );
  }
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const sig = String.fromCharCode(...head);
  const isPdf = sig.startsWith("%PDF");
  const isDocx = sig.startsWith("PK");
  if (!isPdf && !isDocx) {
    const body = (await blob.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `La ${label} no es un PDF/Word válido (¿error del servidor?). ${body || sig}`,
    );
  }
}

const filenameFromHeader = (cd?: string) => {
  if (!cd) return "";
  const match =
    cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^"]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

type ContractsReservationSectionProps = {
  /** full = contrato completo; link = generar link para que el cliente llene sus datos. */
  variant?: "full" | "link";
};

export function ContractsReservationSection({
  variant = "full",
}: ContractsReservationSectionProps) {
  const isLinkMode = variant === "link";
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL);
  const formTopRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [seasonManual, setSeasonManual] = useState(false);
  const [contractTotalManual, setContractTotalManual] = useState(false);
  const [contractUrl, setContractUrl] = useState("");
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const [confirmationFilename, setConfirmationFilename] = useState("");

  // --- "Confirmar pago" panel ---
  const [confModalOpen, setConfModalOpen] = useState(false);
  const [confSearchNumber, setConfSearchNumber] = useState("");
  const [confSearchLoading, setConfSearchLoading] = useState(false);
  const [confFoundBooking, setConfFoundBooking] = useState<Record<string, any> | null>(null);
  const [confForm, setConfForm] = useState({
    depositAmount: "",
    depositDate: "",
    balanceAmount: "",
    balanceDate: "",
    paymentMethod: "bancolombia",
    paymentStatus: "PARTIAL",
  });
  const [loadingConfirmation, setLoadingConfirmation] = useState(false);
  const [contractSnapshotSaved, setContractSnapshotSaved] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [contractArtifactKind, setContractArtifactKind] = useState<
    "pdf" | "docx" | null
  >(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [loadingGenerateLink, setLoadingGenerateLink] = useState(false);
  const [codeHistoryOpen, setCodeHistoryOpen] = useState(false);
  const contractBlobUrlRef = useRef<string | null>(null);

  const { data: propertiesData, isLoading } = useProperties({
    all: true,
    limit: 1000,
  });
  const properties = useMemo<PropertyLike[]>(
    () =>
      (propertiesData?.properties ?? []).filter(
        (p) =>
          p.code !== "FINCA-PRUEBA" &&
          !p.title.toLowerCase().includes("finca prueba"),
      ),
    [propertiesData?.properties],
  );
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.propertyId),
    [properties, form.propertyId],
  );
  const { data: propertyDetail } = useProperty(form.propertyId);
  const previewProperty = useMemo(
    () =>
      propertyDetail
        ? {
            ...selectedProperty,
            ...propertyDetail,
            features:
              propertyDetail.features?.length
                ? propertyDetail.features
                : selectedProperty?.features,
          }
        : selectedProperty,
    [propertyDetail, selectedProperty],
  );

  const guestCapacityWarning = useMemo(
    () =>
      getGuestCapacityWarning(Number(form.guests || 0), selectedProperty, {
        isEvent: form.isEvento,
      }),
    [form.guests, form.isEvento, selectedProperty],
  );

  const { data: ownerInfo } = usePropertyOwnerInfo(form.propertyId);
  const { data: propietarios } = usePropietarios();
  const {
    adminSettings,
    bankAccounts,
    contractBankAccountIds,
    clauses,
    firmantes,
    propertyContractOwnerOverrides,
    setPropertyContractOwnerOverride,
    setContractBankAccountIds,
  } = useContractSettingsStore();

  // Firmante de Fincas Ya elegido para este contrato (default = el marcado por defecto).
  const [selectedFirmanteId, setSelectedFirmanteId] = useState<string>("");
  // Paso actual del asistente (stepper) de generación de contrato.
  const [step, setStep] = useState(0);
  const CONTRACT_STEPS = [
    "Finca",
    "Propietario",
    "Estadía",
    "Cargos",
    "Cliente",
    "Revisar",
  ];
  const selectedFirmante = useMemo(
    () =>
      firmantes.find((f) => f.id === selectedFirmanteId) ??
      firmantes.find((f) => f.esDefault) ??
      firmantes[0] ??
      null,
    [firmantes, selectedFirmanteId],
  );

  const bankIdsForContract = useMemo(
    () => contractBankAccountIds.filter((id) => bankAccounts.some((a) => a.id === id)),
    [contractBankAccountIds, bankAccounts],
  );

  // Edición desde el Gestor de Contratos: ?contract=NUMERO precarga el formulario
  // con los datos del contrato para revisarlo y volver a generarlo.
  const searchParams = useSearchParams();
  const prefilledRef = useRef(false);
  useEffect(() => {
    const contractNumber = searchParams?.get("contract");
    if (!contractNumber || prefilledRef.current) return;
    prefilledRef.current = true;
    void (async () => {
      try {
        const { data: rec } = await axios.get(
          `/api/bookings/contracts/${encodeURIComponent(contractNumber)}`,
        );
        if (!rec) {
          toast.error(`No se encontró el contrato ${contractNumber}.`);
          return;
        }
        const toDateInput = (val: unknown): string => {
          const s = String(val ?? "").trim();
          if (!s) return "";
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
          if (/^\d{10,}$/.test(s)) {
            const d = new Date(Number(s));
            return Number.isFinite(d.getTime())
              ? d.toISOString().slice(0, 10)
              : "";
          }
          return "";
        };
        let draft: Record<string, any> = {};
        if (rec.draftJson) {
          try {
            draft = JSON.parse(rec.draftJson);
          } catch {
            draft = {};
          }
        }
        setForm((prev) => ({
          ...prev,
          propertyId: rec.propertyId || draft.propertyId || prev.propertyId,
          contractNumber: rec.contractNumber || prev.contractNumber,
          contractTotalInput: rec.valorTotal
            ? String(rec.valorTotal)
            : draft.contractTotal
              ? String(draft.contractTotal)
              : prev.contractTotalInput,
          clientName: toClientFieldUpper(
            rec.clienteNombre || draft.nombreCompleto || prev.clientName,
          ),
          clientId: toClientFieldUpper(
            rec.clienteCedula || draft.cedula || prev.clientId,
          ),
          clientEmail: toClientFieldUpper(
            rec.clienteEmail || draft.correo || prev.clientEmail,
          ),
          clientPhone: toClientFieldUpper(
            rec.clienteTelefono || draft.celular || prev.clientPhone,
          ),
          clientCity: toClientFieldUpper(rec.clienteCiudad || prev.clientCity),
          clientAddress: toClientFieldUpper(
            rec.clienteDireccion || prev.clientAddress,
          ),
          checkInDate:
            toDateInput(rec.fechaEntrada ?? draft.checkInDate) ||
            prev.checkInDate,
          checkOutDate:
            toDateInput(rec.fechaSalida ?? draft.checkOutDate) ||
            prev.checkOutDate,
          nightlyPrice: draft.nightlyPrice
            ? String(draft.nightlyPrice)
            : prev.nightlyPrice,
          guests: draft.guests ? String(draft.guests) : prev.guests,
          cleaningFee:
            draft.cleaningFee != null
              ? String(draft.cleaningFee)
              : prev.cleaningFee,
          refundableDeposit:
            draft.refundableDeposit != null
              ? String(draft.refundableDeposit)
              : prev.refundableDeposit,
        }));
        const fNom = String(rec.firmanteNombre ?? draft.adminName ?? "")
          .trim()
          .toLowerCase();
        const fCed = String(rec.firmanteCedula ?? draft.adminCedula ?? "").trim();
        if (fNom || fCed) {
          const match = firmantes.find(
            (f) =>
              (fCed && f.cedula === fCed) ||
              (fNom && f.nombre.trim().toLowerCase() === fNom),
          );
          if (match) setSelectedFirmanteId(match.id);
        }
        toast.success(`Contrato ${rec.contractNumber} cargado para editar.`);
      } catch {
        toast.error("No se pudo cargar el contrato para editar.");
      }
    })();
  }, [searchParams, firmantes, setForm]);

  /** Si no hay ninguna marcada, preselecciona la primera cuenta disponible. */
  useEffect(() => {
    if (bankAccounts.length === 0) return;
    const selectedValid = contractBankAccountIds.filter((id) =>
      bankAccounts.some((a) => a.id === id),
    );
    if (selectedValid.length > 0) return;
    setContractBankAccountIds([bankAccounts[0].id]);
  }, [bankAccounts, contractBankAccountIds, setContractBankAccountIds]);

  useEffect(() => {
    const firstId = bankIdsForContract[0];
    if (!firstId) {
      setForm((prev) => ({
        ...prev,
        bankName: "",
        accountNumber: "",
        accountHolder: "",
        idNumber: "",
      }));
      return;
    }
    const acc = bankAccounts.find((a) => a.id === firstId);
    if (!acc) return;
    setForm((prev) => ({
      ...prev,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      accountHolder: acc.ownerName,
      idNumber: acc.ownerCedula,
    }));
  }, [bankIdsForContract, bankAccounts]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return properties;
    return properties.filter((property) =>
      propertyMatchesSearchQuery(
        { title: property.title, code: property.code },
        searchTerm,
        ["title", "code"],
      ),
    );
  }, [properties, searchTerm]);

  const seasonOptions = useMemo(() => {
    const map = new Map<string, string>([["ESTANDAR", "ESTANDAR"]]);
    (selectedProperty?.pricing || []).forEach((rule) => {
      if (rule?.activa === false) return;
      const name = String(rule?.nombre || "").trim();
      if (!name) return;
      const key = normSeason(name);
      if (!map.has(key)) map.set(key, name.toUpperCase());
    });
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [selectedProperty]);

  const propertyAllowsPets = selectedProperty
    ? selectedProperty.allowsPets !== false
    : true;
  const petsChargesTemporarilyEnabled = true;
  const canConfigurePetCharges =
    petsChargesTemporarilyEnabled || propertyAllowsPets;
  const propertyServiceMandatory = Boolean(
    selectedProperty?.serviceStaffMandatory,
  );
  const propertyServiceFee = Number(selectedProperty?.serviceStaffPrice || 0);
  const propertyServiceAvailable = Boolean(
    selectedProperty?.serviceStaffAvailable ||
    propertyServiceMandatory ||
    propertyServiceFee > 0,
  );

  const { data: stayPriceData } = useCalculateStayPrice(
    form.propertyId,
    form.checkInDate,
    form.checkOutDate,
    undefined,
    Number(form.petCount || 0),
  );

  const nights = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) return 0;
    const start = new Date(`${form.checkInDate}T12:00:00`);
    const end = new Date(`${form.checkOutDate}T12:00:00`);
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  }, [form.checkInDate, form.checkOutDate]);

  const petDepositTotal = useMemo(() => {
    const apiValue = Number(
      (stayPriceData as StayPriceLike | undefined)?.pets?.refundable || 0,
    );
    if (apiValue > 0) return apiValue;
    return Math.min(Number(form.petCount || 0), 2) * 100000;
  }, [form.petCount, stayPriceData]);

  const petSurchargeTotal = useMemo(() => {
    const apiValue = Number(
      (stayPriceData as StayPriceLike | undefined)?.pets?.serviceFee || 0,
    );
    if (apiValue > 0) return apiValue;
    return Math.max(0, Number(form.petCount || 0) - 2) * 30000;
  }, [form.petCount, stayPriceData]);

  const petCleaningTotal = useMemo(() => {
    const apiValue = Number(
      (stayPriceData as StayPriceLike | undefined)?.pets?.cleaningFee || 0,
    );
    if (apiValue > 0) return apiValue;
    return Number(form.petCount || 0) >= 3 ? 70000 : 0;
  }, [form.petCount, stayPriceData]);

  const serviceStaffTotal = useMemo(() => {
    if (!form.serviceStaffIncluded) return 0;
    return Number(form.serviceStaffFee || 0) * Math.max(1, nights);
  }, [form.serviceStaffFee, form.serviceStaffIncluded, nights]);

  const petDepositForCalc = useMemo(() => {
    const manual = Number(form.petDeposit || 0);
    if (manual > 0) return manual;
    return petDepositTotal;
  }, [form.petDeposit, petDepositTotal]);

  const nonAccommodationCharges = useMemo(
    () => ({
      cleaningFee: Number(form.cleaningFee || 0),
      refundableDeposit: Number(form.refundableDeposit || 0),
      petDeposit: petDepositForCalc,
      manillaCondominio: Number(form.manillaCondominio || 0),
      otherCharges: Number(form.otherCharges || 0),
    }),
    [
      form.cleaningFee,
      form.refundableDeposit,
      form.manillaCondominio,
      form.otherCharges,
      petDepositForCalc,
    ],
  );

  const suggestedContractTotal = useMemo(() => {
    const stayFromNightly = Number(form.nightlyPrice || 0) * nights;
    const apiSubtotal = Number(
      (stayPriceData as StayPriceLike | undefined)?.subtotal || 0,
    );
    const stay = stayFromNightly > 0 ? stayFromNightly : apiSubtotal;
    return (
      stay +
      petDepositTotal +
      petSurchargeTotal +
      petCleaningTotal +
      serviceStaffTotal +
      nonAccommodationCharges.cleaningFee +
      nonAccommodationCharges.refundableDeposit +
      nonAccommodationCharges.manillaCondominio +
      nonAccommodationCharges.otherCharges
    );
  }, [
    form.nightlyPrice,
    nights,
    nonAccommodationCharges.cleaningFee,
    nonAccommodationCharges.manillaCondominio,
    nonAccommodationCharges.otherCharges,
    nonAccommodationCharges.refundableDeposit,
    petCleaningTotal,
    petDepositTotal,
    petSurchargeTotal,
    serviceStaffTotal,
    stayPriceData,
  ]);

  /** Total del contrato: autocalculado o el valor que edites manualmente. */
  const contractTotal = useMemo(
    () => Number(form.contractTotalInput || 0),
    [form.contractTotalInput],
  );

  const staySubtotal = useMemo(() => {
    const fromNightly = Number(form.nightlyPrice || 0) * nights;
    if (fromNightly > 0) return fromNightly;
    return Number(
      (stayPriceData as StayPriceLike | undefined)?.subtotal || 0,
    );
  }, [stayPriceData, form.nightlyPrice, nights]);

  useEffect(() => {
    if (contractTotalManual) return;
    const next = String(Math.round(suggestedContractTotal));
    setForm((prev) =>
      prev.contractTotalInput === next
        ? prev
        : { ...prev, contractTotalInput: next },
    );
  }, [suggestedContractTotal, contractTotalManual]);

  useEffect(() => {
    const apiData = stayPriceData as StayPriceLike | undefined;
    if (!apiData?.pets) return;
    const nextPetDeposit = String(apiData.pets?.refundable || 0);
    const nextPetSurcharge = String(apiData.pets?.serviceFee || 0);
    setForm((prev) => {
      if (
        prev.petDeposit === nextPetDeposit &&
        prev.petSurcharge === nextPetSurcharge
      ) {
        return prev;
      }
      return {
        ...prev,
        petDeposit: nextPetDeposit,
        petSurcharge: nextPetSurcharge,
      };
    });
  }, [stayPriceData]);


  const ownerResolved = useMemo(() => {
    const contractOwnerRow = form.propertyId
      ? propertyContractOwnerOverrides[form.propertyId]
      : undefined;
    const manualName = contractOwnerRow?.nombreCompleto?.trim();
    let name =
      manualName ||
      ownerInfo?.propietarioNombre?.trim() ||
      selectedProperty?.propietarioNombre?.trim() ||
      selectedProperty?.ownerName?.trim() ||
      selectedProperty?.nombrePropietario?.trim() ||
      "";
    if (!manualName && ownerInfo?.ownerUserId && propietarios) {
      const owner = propietarios.find(
        (p) =>
          p.id === ownerInfo.ownerUserId ||
          (p as { _id?: string })._id === ownerInfo.ownerUserId,
      );
      if (owner?.name) name = owner.name;
    }
    return {
      name,
      cedula:
        contractOwnerRow?.cedula?.trim() ||
        ownerInfo?.propietarioCedula?.trim() ||
        selectedProperty?.propietarioCedula?.trim() ||
        "",
      ciudadCedula: contractOwnerRow?.ciudadCedula?.trim() || "",
    };
  }, [
    form.propertyId,
    ownerInfo,
    propietarios,
    propertyContractOwnerOverrides,
    selectedProperty,
  ]);

  const reservationFincaPreviewData = useMemo(() => {
    const contractOwnerRow = form.propertyId
      ? propertyContractOwnerOverrides[form.propertyId]
      : undefined;

    let fincaData: Partial<FincaData> = buildReservationPreviewFincaData(
      previewProperty,
      ownerResolved.name,
      {
        contractNumber: form.contractNumber,
        clientName: form.clientName,
        clientId: form.clientId,
        clientEmail: form.clientEmail,
        clientPhone: form.clientPhone,
        clientCity: form.clientCity,
        clientAddress: form.clientAddress,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
      },
      nights,
      contractTotal,
      money,
      formatFincaFeatures,
      contractOwnerRow,
    );

    const firstContractAccount =
      bankIdsForContract[0] &&
      bankAccounts.find((a) => a.id === bankIdsForContract[0]);
    if (firstContractAccount) {
      fincaData = {
        ...fincaData,
        cuentaNumero: firstContractAccount.accountNumber,
        bancoNombre:
          [firstContractAccount.accountType, firstContractAccount.bankName]
            .filter(Boolean)
            .join(" ") || firstContractAccount.bankName,
        titularNombre: firstContractAccount.ownerName,
        titularCedula: firstContractAccount.ownerCedula,
      };
    }

    return fincaData;
  }, [
    previewProperty,
    ownerResolved.name,
    form.propertyId,
    form.contractNumber,
    form.clientName,
    form.clientId,
    form.clientEmail,
    form.clientPhone,
    form.clientCity,
    form.clientAddress,
    form.checkInDate,
    form.checkOutDate,
    form.checkInTime,
    form.checkOutTime,
    nights,
    contractTotal,
    propertyContractOwnerOverrides,
    bankIdsForContract,
    bankAccounts,
  ]);

  const contractPreviewHtml = useMemo(
    () =>
      buildContractHTML(
        adminSettings,
        bankAccounts,
        bankIdsForContract,
        clauses,
        reservationFincaPreviewData,
        {
          chargeLabels: {
            precioAseoFinal:
              Number(form.cleaningFee || 0) > 0
                ? money(Number(form.cleaningFee || 0))
                : undefined,
            depositoGarantia:
              Number(form.refundableDeposit || 0) > 0
                ? money(Number(form.refundableDeposit || 0))
                : undefined,
            precioPorMasota:
              petDepositForCalc > 0
                ? money(petDepositForCalc)
                : undefined,
          },
          manillaCondominioCop: Number(form.manillaCondominio || 0),
          otherChargesCop: Number(form.otherCharges || 0),
          formatCop: money,
          firmante: selectedFirmante
            ? {
                nombre: selectedFirmante.nombre,
                cedula: selectedFirmante.cedula,
                ciudad: selectedFirmante.ciudad,
                firmaUrl: selectedFirmante.firmaUrl,
              }
            : undefined,
        },
      ),
    [
      adminSettings,
      bankAccounts,
      bankIdsForContract,
      clauses,
      reservationFincaPreviewData,
      form.cleaningFee,
      form.refundableDeposit,
      form.manillaCondominio,
      form.otherCharges,
      petDepositForCalc,
      selectedFirmante,
    ],
  );

  /** Todas las fincas usan la plantilla Word maestra (QUINTA OLAYA) en el API. */
  const hasPropertyPdfTemplate = true;

  const clearError = (field: keyof FormState) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const setField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const setClientField = <K extends keyof Pick<
    FormState,
    | "clientName"
    | "clientId"
    | "clientEmail"
    | "clientPhone"
    | "clientCity"
    | "clientAddress"
  >>(
    field: K,
    value: FormState[K],
  ) => {
    setField(field, toClientFieldUpper(String(value)) as FormState[K]);
  };

  const handleNightlyPriceChange = (next: string) => {
    setField("nightlyPrice", next);
  };

  const handleContractTotalChange = (next: string) => {
    setContractTotalManual(true);
    setField("contractTotalInput", next);
  };

  const applySuggestedContractTotal = () => {
    setContractTotalManual(false);
    setField(
      "contractTotalInput",
      String(Math.round(suggestedContractTotal)),
    );
  };

  useEffect(() => {
    if (!form.propertyId || !ownerInfo) return;
    const row = propertyContractOwnerOverrides[form.propertyId];
    const patch: Record<string, string> = {};
    if (!row?.nombreCompleto?.trim() && ownerInfo.propietarioNombre?.trim()) {
      patch.nombreCompleto = ownerInfo.propietarioNombre.trim();
    }
    if (!row?.cedula?.trim() && ownerInfo.propietarioCedula?.trim()) {
      patch.cedula = ownerInfo.propietarioCedula.trim();
    }
    if (Object.keys(patch).length > 0) {
      setPropertyContractOwnerOverride(form.propertyId, patch);
    }
  }, [
    form.propertyId,
    ownerInfo,
    propertyContractOwnerOverrides,
    setPropertyContractOwnerOverride,
  ]);

  useEffect(() => {
    if (!selectedProperty) return;
    setForm((prev) => {
      const nextIncluded = propertyServiceMandatory
        ? true
        : prev.serviceStaffIncluded;
      const nextFee =
        propertyServiceFee > 0
          ? String(propertyServiceFee)
          : prev.serviceStaffFee;
      if (
        prev.serviceStaffIncluded === nextIncluded &&
        prev.serviceStaffFee === nextFee
      )
        return prev;
      return {
        ...prev,
        serviceStaffIncluded: nextIncluded,
        serviceStaffFee: nextFee,
      };
    });
  }, [propertyServiceFee, propertyServiceMandatory, selectedProperty]);

  const autoApplied = normSeason(
    (stayPriceData as StayPriceLike | undefined)?.appliedRule,
  );
  useEffect(() => {
    if (!autoApplied || seasonManual || form.temporada === autoApplied) return;
    if (!seasonOptions.some((option) => option.value === autoApplied)) return;
    setForm((prev) => ({ ...prev, temporada: autoApplied }));
  }, [autoApplied, seasonManual, form.temporada, seasonOptions]);

  const validateContractForm = (draft: FormState) => {
    const nextErrors: FieldErrors = {};
    if (!draft.propertyId) nextErrors.propertyId = "Selecciona una finca.";
    if (!draft.contractTotalInput || Number(draft.contractTotalInput) <= 0)
      nextErrors.contractTotalInput =
        "Ingresa el valor total del contrato.";
    if (!draft.nightlyPrice || Number(draft.nightlyPrice) <= 0)
      nextErrors.nightlyPrice =
        "Ingresa el valor por noche o revisa total, fechas y cargos.";
    if (nights <= 0)
      nextErrors.checkOutDate =
        "La fecha de salida debe ser mayor a la de entrada.";
    if (!ownerResolved.name)
      nextErrors.propertyOwnerName =
        "El nombre del propietario es obligatorio en el contrato.";
    if (bankIdsForContract.length < 1)
      nextErrors.bankAccounts =
        "Selecciona al menos 1 cuenta bancaria en Ajustes globales del contrato.";
    if (!isLinkMode) {
      if (!draft.clientName.trim())
        nextErrors.clientName = "El nombre del arrendatario es obligatorio.";
    }
    if (!draft.checkInDate)
      nextErrors.checkInDate = "La fecha de entrada es obligatoria.";
    if (!draft.checkOutDate)
      nextErrors.checkOutDate = "La fecha de salida es obligatoria.";
    if (!draft.checkInTime.trim())
      nextErrors.checkInTime = "La hora de entrada es obligatoria.";
    if (!draft.checkOutTime.trim())
      nextErrors.checkOutTime = "La hora de salida es obligatoria.";
    if (!draft.guests.trim() || Number(draft.guests) <= 0)
      nextErrors.guests = "Ingresa el numero de huespedes.";
    if (!draft.temporada.trim())
      nextErrors.temporada = "Selecciona la temporada.";
    if (!draft.bankName.trim())
      nextErrors.bankName =
        "Elige la cuenta del contrato en Ajustes globales (cuentas bancarias) o agrega una cuenta.";
    if (!draft.accountNumber.trim())
      nextErrors.accountNumber =
        "Elige la cuenta principal en Ajustes globales del contrato (cuentas bancarias) o agrega una cuenta.";
    if (!draft.accountHolder.trim())
      nextErrors.accountHolder =
        "Elige la cuenta principal en Ajustes globales del contrato (cuentas bancarias) o agrega una cuenta.";
    if (!draft.idNumber.trim())
      nextErrors.idNumber =
        "Elige la cuenta principal en Ajustes globales del contrato (cuentas bancarias) o agrega una cuenta.";
    if (Number(draft.petCount || 0) < 0)
      nextErrors.petCount = "El numero de mascotas no puede ser negativo.";
    if (draft.serviceStaffIncluded && Number(draft.serviceStaffFee || 0) <= 0) {
      nextErrors.serviceStaffFee = "Ingresa el valor del servicio.";
    }
    return nextErrors;
  };

  const showFormValidationErrors = (nextErrors: FieldErrors) => {
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) return false;
    toast.error(Object.values(nextErrors).join(" · "), { duration: 14_000 });
    requestAnimationFrame(() => {
      document
        .querySelector(".border-red-500")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return true;
  };

  const buildContractPayload = (
    draft: FormState,
    generatedContractNumber: string,
  ) => ({
    propertyId: draft.propertyId,
    contractNumber: generatedContractNumber,
    nightlyPrice: String(draft.nightlyPrice),
    totalPrice: String(contractTotal),
    conversationId: "direct-reservation",
    clientName: draft.clientName,
    clientId: draft.clientId,
    clientEmail: draft.clientEmail,
    clientPhone: draft.clientPhone,
    clientCity: draft.clientCity,
    clientAddress: draft.clientAddress,
    checkInDate: draft.checkInDate,
    checkOutDate: draft.checkOutDate,
    checkInTime: draft.checkInTime,
    checkOutTime: draft.checkOutTime,
    guests: Number(draft.guests || 1),
    petCount: Number(draft.petCount || 0),
    petDeposit: Number(draft.petDeposit || petDepositTotal || 0),
    petSurcharge: Number(draft.petSurcharge || petSurchargeTotal || 0),
    serviceStaffFee: draft.serviceStaffIncluded
      ? Number(draft.serviceStaffFee || 0)
      : 0,
    bankName: draft.bankName,
    accountNumber: draft.accountNumber,
    accountHolder: draft.accountHolder,
    idNumber: draft.idNumber,
    bankAccountIds: bankIdsForContract,
    cleaningFee: Number(draft.cleaningFee || 0),
    refundableDeposit: Number(draft.refundableDeposit || 0),
    manillaCondominio: Number(draft.manillaCondominio || 0),
    otherCharges: Number(draft.otherCharges || 0),
    cleaningFeeLabel:
      Number(draft.cleaningFee || 0) > 0
        ? money(Number(draft.cleaningFee || 0))
        : adminSettings.cleaningFee,
    securityDepositLabel:
      Number(draft.refundableDeposit || 0) > 0
        ? money(Number(draft.refundableDeposit || 0))
        : adminSettings.securityDeposit,
    extraPersonFeeLabel: adminSettings.extraPersonFee,
    petDepositLabel:
      petDepositForCalc > 0
        ? money(petDepositForCalc)
        : adminSettings.petDeposit,
    propertyOwnerName: ownerResolved.name,
    propertyOwnerCedula: ownerResolved.cedula,
    propertyOwnerCity: ownerResolved.ciudadCedula,
    // Firmante de Fincas Ya elegido para este contrato (override del global).
    ...(selectedFirmante
      ? {
          adminName: selectedFirmante.nombre,
          adminCedula: selectedFirmante.cedula,
          adminCity: selectedFirmante.ciudad,
          ...(selectedFirmante.firmaUrl
            ? { firmaArrendadorUrl: selectedFirmante.firmaUrl }
            : {}),
        }
        : {}),
  });

  const download = (blob: Blob, filename: string) => {
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error(`Archivo vacío o inválido: ${filename}`);
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revocar en el siguiente tick: si se revoca al instante, algunos navegadores cancelan la descarga.
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  const generatedContractFilename = useMemo(() => {
    const num = form.contractNumber.trim();
    const base = num ? `Contrato_${num}` : "Contrato_generado";
    const ext = contractArtifactKind === "docx" ? "docx" : "pdf";
    return `${base}.${ext}`;
  }, [form.contractNumber, contractArtifactKind]);

  const downloadGeneratedContract = async () => {
    if (!contractUrl) return;
    if (contractUrl.startsWith("blob:")) {
      try {
        const response = await fetch(contractUrl);
        const blob = await response.blob();
        download(blob, generatedContractFilename);
      } catch {
        window.open(contractUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    try {
      const response = await axios.get(contractUrl, { responseType: "blob" });
      download(response.data, generatedContractFilename);
    } catch {
      window.open(contractUrl, "_blank", "noopener,noreferrer");
    }
  };

  const downloadGeneratedConfirmation = async () => {
    if (!confirmationUrl || !confirmationFilename) return;
    if (confirmationUrl.startsWith("blob:")) {
      try {
        const response = await fetch(confirmationUrl);
        const blob = await response.blob();
        download(blob, confirmationFilename);
      } catch {
        window.open(confirmationUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    const link = document.createElement("a");
    link.href = confirmationUrl;
    link.download = confirmationFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const searchContractBooking = async () => {
    const raw = confSearchNumber.trim();
    if (!raw) return;
    const queryCode = normalizeContractLookupQuery(raw);
    if (!queryCode) {
      toast.error("Escribe un número de contrato o pega la línea del PDF.");
      return;
    }
    setConfSearchLoading(true);
    setConfFoundBooking(null);
    try {
      const res = await axios.get(
        `/api/bookings/by-contract?contractNumber=${encodeURIComponent(queryCode)}`,
        { withCredentials: true },
      );
      if (res.data?.error) {
        const extra =
          typeof res.data?.message === "string" ? ` ${res.data.message}` : "";
        toast.error(`${String(res.data.error)}${extra}`.trim());
        return;
      }
      if (res.data && res.data._id) {
        setConfFoundBooking(res.data);
        const total = res.data.precioTotal ?? 0;
        const half = Math.round(total * 0.5);
        setConfForm((prev) => ({
          ...prev,
          depositAmount:
            prev.depositAmount || formatPriceInput(half),
          balanceAmount:
            prev.balanceAmount ||
            formatPriceInput(Math.max(total - half, 0)),
          depositDate: prev.depositDate || new Date().toISOString().split("T")[0],
          balanceDate:
            prev.balanceDate ||
            (res.data.fechaEntrada
              ? new Date(res.data.fechaEntrada).toISOString().split("T")[0]
              : ""),
        }));
        toast.success(`Datos cargados: ${res.data.nombreCompleto ?? ""}`);
      } else {
        const hint =
          queryCode !== raw
            ? ` (buscamos el código «${queryCode}» a partir de lo que escribiste)`
            : "";
        toast.error(`No encontramos borrador ni reserva con ese número.${hint}`, {
          duration: 9000,
          description:
            "El código debe ser el del contrato que acabas de generar (se guarda como borrador hasta confirmar pago). Si es una reserva antigua creada antes de este cambio, sigue apareciendo aquí igual.",
        });
      }
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        toast.error(
          "No tienes permiso para esta búsqueda. Debes iniciar sesión como administrador, asistente o vendedor.",
          { duration: 8000 },
        );
        return;
      }
      const d = axios.isAxiosError(e) ? e.response?.data : undefined;
      const msg =
        d &&
        typeof d === "object" &&
        d !== null &&
        ("message" in d || "error" in d)
          ? [String((d as { message?: string }).message || ""), String((d as { error?: string }).error || "")]
              .filter(Boolean)
              .join(" — ")
          : "";
      toast.error(
        msg || (e instanceof Error ? e.message : "Error al buscar la reserva."),
        { duration: 12_000 },
      );
    } finally {
      setConfSearchLoading(false);
    }
  };

  const generateConfirmationPdf = async () => {
    if (!confFoundBooking) return;
    setLoadingConfirmation(true);
    const loadingId = toast.loading("Generando confirmación PDF…");
    try {
      const b = confFoundBooking;
      const property = properties.find((p) => p.id === b.propertyId);
      const petCount = Number(b.numeroMascotas ?? 0) || 0;
      const depositoMascotas = Number(b.depositoMascotas ?? 0) || 0;
      const petCleaningFee = petCount >= 3 ? 70_000 : 0;
      const cleaningFee = 100_000 + petCleaningFee;
      let damageDeposit =
        Number(b.depositoGarantia ?? 0) || 0;
      if (!damageDeposit && property?.depositoDanosReembolsable) {
        damageDeposit = Number(property.depositoDanosReembolsable);
      }
      const precioTotal = Number(b.precioTotal) || 0;
      const subtotal = Number(b.subtotal ?? 0) || 0;
      const costoMascotas = Number(b.costoMascotas ?? 0) || 0;
      let petRefundable = depositoMascotas;
      if (!petRefundable && petCount > 0) {
        petRefundable = Math.min(petCount, 2) * 100_000;
      }
      const refundableDeposit = damageDeposit + petRefundable;
      const payload = {
        propertyId: b.propertyId,
        precioTotal,
        subtotal: subtotal > 0 ? subtotal : undefined,
        costoMascotas: costoMascotas > 0 ? costoMascotas : undefined,
        contractNumber:
          normalizeContractLookupQuery(confSearchNumber.trim()) ||
          (b.reference ?? b.observaciones ?? "")
            .replace(/^contrato\s*:\s*/i, "")
            .trim(),
        clientName: b.nombreCompleto ?? "",
        clientId: b.cedula ?? "",
        clientEmail: b.correo ?? "",
        clientPhone: b.celular ?? "",
        clientAddress: b.address ?? b.city ?? "",
        propertyName: b.propertyTitle ?? "",
        propertyLocation: b.propertyLocation ?? "",
        checkInDate: b.fechaEntrada
          ? new Date(b.fechaEntrada).toISOString().split("T")[0]
          : "",
        checkOutDate: b.fechaSalida
          ? new Date(b.fechaSalida).toISOString().split("T")[0]
          : "",
        checkInTime: b.horaEntrada ?? "10:00",
        checkOutTime: b.horaSalida ?? "16:00",
        guests: b.numeroPersonas ?? 1,
        nights: b.numeroNoches ?? 1,
        cleaningFee,
        damageDeposit,
        depositoMascotas: petRefundable,
        petCount,
        petCleaningFee,
        refundableDeposit,
        depositAmount: parseCOP(confForm.depositAmount),
        depositDate: confForm.depositDate || new Date().toISOString().split("T")[0],
        balanceAmount: parseCOP(confForm.balanceAmount),
        balanceDate: confForm.balanceDate || "",
        paymentMethod: confForm.paymentMethod,
        paymentStatus:
          confForm.paymentStatus === "PAID" ? "paid" : "pending",
        persistConfirmation: true,
      };

      const confResult = await inboxService.generateReservationConfirmationPreview(
        "direct-reservation",
        payload,
      );
      await assertPdfBlob(confResult.blob, "confirmación de reserva");

      const blobUrl = URL.createObjectURL(confResult.blob);
      setConfirmationUrl(blobUrl);
      setConfirmationFilename(confResult.filename);
      download(confResult.blob, confResult.filename);
      toast.success("Confirmación PDF generada y descargada.", { duration: 6000 });

      if (b.isContractSnapshot) {
        try {
          const fin = await axios.post(
            "/api/bookings/finalize-contract-snapshot",
            {
              snapshotId: b._id,
              paymentStatus: confForm.paymentStatus,
            },
            { withCredentials: true },
          );
          const code =
            normalizeContractLookupQuery(confSearchNumber.trim()) ||
            String(b.reference ?? "").trim();
          if (code) {
            const refetch = await axios.get(
              `/api/bookings/by-contract?contractNumber=${encodeURIComponent(code)}`,
              { withCredentials: true },
            );
            if (refetch.data?._id && !refetch.data?.isContractSnapshot) {
              setConfFoundBooking(refetch.data);
            }
          }
          if (fin.data?.bookingId) {
            toast.success("Reserva registrada en el calendario con el pago indicado.", {
              duration: 8000,
            });
          }
        } catch (finErr) {
          console.error(finErr);
          const d = axios.isAxiosError(finErr) ? finErr.response?.data : undefined;
          const msg =
            d && typeof d === "object" && d !== null && "error" in d
              ? String((d as { error?: string }).error || "")
              : finErr instanceof Error
                ? finErr.message
                : "";
          toast.error(
            msg ||
              "La confirmación PDF se descargó, pero no se pudo registrar la reserva. Revisa disponibilidad o inténtalo de nuevo.",
            { duration: 14_000 },
          );
        }
      }
    } catch (error: unknown) {
      const msg = await getBlobErrorMessage(error, "No se pudo generar la confirmación PDF.");
      toast.error(msg, { duration: 12_000 });
    } finally {
      toast.dismiss(loadingId);
      setLoadingConfirmation(false);
    }
  };

  const onSelectProperty = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    const aseo =
      property?.depositoAseo != null && property.depositoAseo > 0
        ? String(property.depositoAseo)
        : INITIAL.cleaningFee;
    const deposito =
      property?.depositoDanosReembolsable != null &&
      property.depositoDanosReembolsable > 0
        ? String(property.depositoDanosReembolsable)
        : INITIAL.refundableDeposit;
    const manilla =
      property?.manillaCondominio != null && property.manillaCondominio > 0
        ? String(property.manillaCondominio)
        : INITIAL.manillaCondominio;
    setForm((prev) => ({
      ...prev,
      propertyId,
      contractTotalInput: prev.propertyId === propertyId ? prev.contractTotalInput : "",
      nightlyPrice:
        property?.priceBase !== undefined && property?.priceBase !== null
          ? String(property.priceBase)
          : prev.nightlyPrice,
      cleaningFee: aseo,
      refundableDeposit: deposito,
      manillaCondominio: manilla,
      temporada: "ESTANDAR",
      petCount: prev.petCount,
      serviceStaffIncluded: property?.serviceStaffMandatory
        ? true
        : prev.serviceStaffIncluded,
      serviceStaffFee:
        property?.serviceStaffPrice !== undefined &&
        property?.serviceStaffPrice !== null
          ? String(property.serviceStaffPrice)
          : prev.serviceStaffFee,
    }));

    const ownerName =
      property?.propietarioNombre?.trim() ||
      property?.ownerName?.trim() ||
      property?.nombrePropietario?.trim() ||
      "";
    const ownerCedula = property?.propietarioCedula?.trim() || "";
    if (ownerName || ownerCedula) {
      setPropertyContractOwnerOverride(propertyId, {
        ...(ownerName ? { nombreCompleto: ownerName } : {}),
        ...(ownerCedula ? { cedula: ownerCedula } : {}),
      });
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.propertyId;
      return next;
    });
    setSeasonManual(false);
    setContractTotalManual(false);
    setContractSnapshotSaved(false);
    setContractUrl("");
    setContractArtifactKind(null);
    if (contractBlobUrlRef.current) {
      URL.revokeObjectURL(contractBlobUrlRef.current);
      contractBlobUrlRef.current = null;
    }
    setConfirmationUrl("");
    setConfirmationFilename("");
    setSearchTerm("");
    setIsSearchFocused(false);
  };

  const warnIfGuestsExceedCapacity = (
    guestCount: number,
    isEvent?: boolean,
  ) => {
    const warning = getGuestCapacityWarning(
      guestCount,
      selectedProperty,
      { isEvent },
    );
    if (!warning) return;
    toast.warning(`⚠️ Cupo excedido. ${warning}`, {
      duration: 14_000,
      id: "contracts-capacity-exceed",
    });
  };

  const samePersonConflict = (conflict: BookingConflict) => {
    const myId = digits(form.clientId);
    const myPhone = digits(form.clientPhone);
    const conflictId = digits(conflict?.cedula);
    const conflictPhone = digits(conflict?.celular);
    const matchesId = Boolean(myId && conflictId && myId === conflictId);
    const matchesPhone = Boolean(
      myPhone &&
      conflictPhone &&
      myPhone.slice(-10) === conflictPhone.slice(-10),
    );
    return matchesId || matchesPhone;
  };

  const generateContractAndReserve = async () => {
    const generatedContractNumber = ensureApiContractNumber(form, properties);
    const nextFormState = {
      ...form,
      contractNumber: generatedContractNumber,
    };

    const effectiveForm = {
      ...nextFormState,
      petDeposit: String(petDepositTotal),
      petSurcharge: String(petSurchargeTotal),
      serviceStaffFee: form.serviceStaffIncluded
        ? String(serviceStaffTotal)
        : "0",
    };
    const nextErrors = validateContractForm(nextFormState);
    if (showFormValidationErrors(nextErrors)) return;

    const inMs = new Date(`${effectiveForm.checkInDate}T10:00:00`).getTime();
    const outMs = new Date(`${effectiveForm.checkOutDate}T10:00:00`).getTime();
    let loadingToastId: string | number | undefined;
    setLoadingGenerate(true);
    let contractDocxDownloadedEarly = false;
    try {
      loadingToastId = toast.loading(
        "Generando contrato…",
      );

      const availability = await axios.post(
        "/api/bookings/check-availability",
        {
          propertyId: effectiveForm.propertyId,
          fechaEntrada: inMs,
          fechaSalida: outMs,
        },
        { withCredentials: true },
      );

      const available = availability.data?.available !== false;
      const conflicts = availability.data?.conflictingBookings || [];

      if (!available) {
        const otherConflict = (conflicts as BookingConflict[]).some(
          (conflict) => !samePersonConflict(conflict),
        );
        if (otherConflict || conflicts.length === 0) {
          toast.warning(
            "⚠️ La finca tiene otra reserva en esas fechas. Puedes generar el contrato, pero al confirmar el pago el sistema no podrá registrar la reserva en el calendario hasta que haya disponibilidad.",
            { duration: 14_000, id: "contracts-availability-block" },
          );
        }
      }

      warnIfGuestsExceedCapacity(
        Number(effectiveForm.guests || 0),
        effectiveForm.isEvento,
      );

      let contractUrlResult = "";
      let contractDownloadFilename = "";
      let contractLocalBlob: Blob | null = null;
      setContractArtifactKind(null);

      if (hasPropertyPdfTemplate) {
        const contractResponse = await axios.post(
          `/api/fincas/${effectiveForm.propertyId}/direct-booking-contract`,
          {
            ...buildContractPayload(effectiveForm, generatedContractNumber),
            // El servidor genera el PDF desde este HTML ya renderizado (WYSIWYG
            // con la vista previa) vía Puppeteer.
            customHtml: contractPreviewHtml,
          },
          { withCredentials: true },
        );
        contractUrlResult = contractResponse.data?.url || "";
        contractDownloadFilename = String(
          contractResponse.data?.filename || "",
        ).trim();
        const returnedMime = String(
          contractResponse.data?.mimeType || "",
        ).toLowerCase();
        const isDocxArtifact =
          contractDownloadFilename.toLowerCase().endsWith(".docx") ||
          returnedMime.includes("wordprocessingml");
        const fileBase64 = String(
          contractResponse.data?.fileBase64 || "",
        ).trim();
        if (fileBase64) {
          const mime =
            returnedMime ||
            (isDocxArtifact
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/pdf");
          contractLocalBlob = base64ToBlob(fileBase64, mime);
          if (contractBlobUrlRef.current) {
            URL.revokeObjectURL(contractBlobUrlRef.current);
            contractBlobUrlRef.current = null;
          }
          const blobUrl = URL.createObjectURL(contractLocalBlob);
          contractBlobUrlRef.current = blobUrl;
          setContractUrl(blobUrl);
          setContractArtifactKind(isDocxArtifact ? "docx" : "pdf");
          const downloadName =
            contractDownloadFilename ||
            `Contrato_${generatedContractNumber}.${isDocxArtifact ? "docx" : "pdf"}`;
          download(contractLocalBlob, downloadName);
          contractDocxDownloadedEarly = true;
        } else {
          setContractUrl(contractUrlResult);
          setContractArtifactKind(
            contractUrlResult.trim() ? (isDocxArtifact ? "docx" : "pdf") : null,
          );
        }
      } else {
        const htmlSource = contractPreviewHtml.trim();

        // 1. Intentar PDF vía backend (puppeteer)
        const pdfRes = await generateContractPdfAction(
          htmlSource,
          `Contrato_${generatedContractNumber}`,
        );

        if (pdfRes.success && pdfRes.base64) {
          contractLocalBlob = base64ToBlob(pdfRes.base64, "application/pdf");
          if (contractBlobUrlRef.current) {
            URL.revokeObjectURL(contractBlobUrlRef.current);
            contractBlobUrlRef.current = null;
          }
          const blobUrl = URL.createObjectURL(contractLocalBlob);
          contractBlobUrlRef.current = blobUrl;
          setContractUrl(blobUrl);
          setContractArtifactKind("pdf");
          download(
            contractLocalBlob,
            `Contrato_${generatedContractNumber}.pdf`,
          );
          contractDocxDownloadedEarly = true;
          toast.success("Contrato PDF descargado.", {
            duration: 4000,
          });
        } else {
          // 2. Fallback: .docx si puppeteer no está disponible
          const pdfErr = !pdfRes.success ? pdfRes.error : "";
          console.warn("[contratos] PDF fallido, generando .docx:", pdfErr);
          const docxRes = await generateContractDocxAction(htmlSource, "", "");
          if (docxRes.success && docxRes.base64) {
            contractLocalBlob = base64ToBlob(
              docxRes.base64,
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            );
            if (contractBlobUrlRef.current) {
              URL.revokeObjectURL(contractBlobUrlRef.current);
              contractBlobUrlRef.current = null;
            }
            const blobUrl = URL.createObjectURL(contractLocalBlob);
            contractBlobUrlRef.current = blobUrl;
            setContractUrl(blobUrl);
            setContractArtifactKind("docx");
            download(
              contractLocalBlob,
              `Contrato_${generatedContractNumber}.docx`,
            );
            contractDocxDownloadedEarly = true;
            toast.success("Contrato Word descargado.", { duration: 4000 });
          } else {
            setContractUrl("");
            const errMsg =
              !docxRes.success && typeof docxRes.error === "string"
                ? docxRes.error
                : null;
            toast.warning(
              errMsg
                ? `No se pudo generar el contrato: ${errMsg}`
                : "No se pudo generar el contrato. Revisa la consola o intenta de nuevo.",
            );
          }
        }
      }

      setForm(nextFormState);

      let snapshotOk = false;
      try {
        await axios.post(
          "/api/bookings/contract-snapshot",
          {
            contractNumber: generatedContractNumber,
            propertyId: effectiveForm.propertyId,
            payload: buildContractSnapshotPayload({
              form: effectiveForm,
              inMs,
              outMs,
              nights,
              contractTotal,
              staySubtotal,
              serviceStaffTotal,
              petSurchargeTotal,
              petDepositTotal,
              generatedContractNumber,
              contractUrlResult,
            }),
          },
          { withCredentials: true },
        );
        snapshotOk = true;
        setContractSnapshotSaved(true);
      } catch (snapErr) {
        console.error(snapErr);
        setContractSnapshotSaved(false);
        toast.error(
          "El contrato se generó pero no se guardó el borrador para «Confirmar pago». Reintenta o vuelve a generar.",
          { duration: 14_000, id: "contracts-snapshot-error" },
        );
      }

      // --- AUTOMATIC DOWNLOAD (fallback si no vino fileBase64 en la respuesta) ---
      if (contractUrlResult && !contractDocxDownloadedEarly) {
        try {
          const resp = await axios.get(contractUrlResult, { responseType: "blob" });
          const downloadName =
            contractDownloadFilename ||
            `Contrato_${generatedContractNumber}.${
              contractDownloadFilename.toLowerCase().endsWith(".docx")
                ? "docx"
                : "pdf"
            }`;
          download(resp.data, downloadName);
        } catch {
          window.open(contractUrlResult, "_blank", "noopener,noreferrer");
        }
      } else if (contractLocalBlob && !contractDocxDownloadedEarly) {
        const ext = contractArtifactKind === "pdf" ? "pdf" : "docx";
        download(contractLocalBlob, `Contrato_${generatedContractNumber}.${ext}`);
      }

      setForm((prev) => ({ ...prev, contractNumber: generatedContractNumber }));
      const hasContractFile =
        Boolean(contractUrlResult.trim()) || Boolean(contractLocalBlob);
      if (snapshotOk) {
        toast.success(
          hasContractFile
            ? "Contrato generado y borrador guardado. Cuando el cliente pague, usa «Confirmar pago» para registrar la reserva en el calendario y descargar la confirmación."
            : "Borrador guardado con el código del contrato. Cuando haya pago, usa «Confirmar pago» para registrar la reserva y la confirmación PDF.",
          {
            duration: 10_000,
            description:
              "Hasta ese paso no se crea reserva ni bloqueo en el calendario.",
          },
        );
      } else if (hasContractFile) {
        toast.warning(
          "Contrato listo para descargar, pero el borrador no quedó guardado en el sistema.",
          { duration: 10_000 },
        );
      }
    } catch (error: unknown) {
      const msg = await getBlobErrorMessage(
        error,
        "No se pudo generar el contrato.",
      );
      toast.error(msg, { duration: 14_000, id: "contracts-generate-error" });
    } finally {
      if (loadingToastId != null) toast.dismiss(loadingToastId);
      setLoadingGenerate(false);
    }
  };

  const generateContractLink = async () => {
    const generatedContractNumber = ensureApiContractNumber(form, properties);
    const nextFormState = {
      ...form,
      contractNumber: generatedContractNumber,
      petDeposit: String(petDepositTotal),
      petSurcharge: String(petSurchargeTotal),
      serviceStaffFee: form.serviceStaffIncluded
        ? String(serviceStaffTotal)
        : "0",
    };

    const nextErrors = validateContractForm(nextFormState);
    if (showFormValidationErrors(nextErrors)) return;

    if (!selectedProperty) {
      toast.error("Selecciona una finca.");
      return;
    }

    let ownerDisplayName =
      (
        selectedProperty as
          | { ownerName?: string; nombrePropietario?: string }
          | undefined
      )?.ownerName ||
      (
        selectedProperty as { nombrePropietario?: string } | undefined
      )?.nombrePropietario ||
      "";
    if (ownerInfo?.ownerUserId && propietarios) {
      const owner = propietarios.find(
        (p) =>
          p.id === ownerInfo.ownerUserId ||
          (p as { _id?: string })._id === ownerInfo.ownerUserId,
      );
      if (owner?.name) ownerDisplayName = owner.name;
    }

    const contractOwnerRow = form.propertyId
      ? propertyContractOwnerOverrides[form.propertyId]
      : undefined;

    warnIfGuestsExceedCapacity(
      Number(nextFormState.guests || 0),
      nextFormState.isEvento,
    );

    setLoadingGenerateLink(true);
    try {
      const contractDraft = {
        propertyId: nextFormState.propertyId,
        contractNumber: generatedContractNumber,
        // Vista previa del contrato (cláusulas + firmante + firma). Se guarda con
        // los placeholders del cliente sin rellenar; al completar el link, el
        // backend los rellena y genera el MISMO contrato que en "Confirmación".
        previewHtml: contractPreviewHtml,
        // Firmante elegido para este contrato (se usa al generar el PDF al completar el link).
        ...(selectedFirmante
          ? {
              adminName: selectedFirmante.nombre,
              adminCedula: selectedFirmante.cedula,
              adminCity: selectedFirmante.ciudad,
              ...(selectedFirmante.firmaUrl
                ? { firmaArrendadorUrl: selectedFirmante.firmaUrl }
                : {}),
            }
          : {}),
        nightlyPrice: nextFormState.nightlyPrice,
        checkInDate: nextFormState.checkInDate,
        checkOutDate: nextFormState.checkOutDate,
        checkInTime: nextFormState.checkInTime,
        checkOutTime: nextFormState.checkOutTime,
        guests: nextFormState.guests,
        temporada: nextFormState.temporada,
        groupType: nextFormState.groupType,
        petCount: nextFormState.petCount,
        petDeposit: nextFormState.petDeposit,
        petSurcharge: nextFormState.petSurcharge,
        serviceStaffIncluded: nextFormState.serviceStaffIncluded,
        serviceStaffFee: nextFormState.serviceStaffFee,
        bankName: nextFormState.bankName,
        accountNumber: nextFormState.accountNumber,
        accountHolder: nextFormState.accountHolder,
        idNumber: nextFormState.idNumber,
        cleaningFee: nextFormState.cleaningFee,
        refundableDeposit: nextFormState.refundableDeposit,
        manillaCondominio: nextFormState.manillaCondominio,
        otherCharges: nextFormState.otherCharges,
        isEvento: nextFormState.isEvento,
        extraSound: nextFormState.extraSound,
        liveMusic: nextFormState.liveMusic,
        dj: nextFormState.dj,
        decoration: nextFormState.decoration,
        additionalGuests: nextFormState.additionalGuests,
        contractTotal,
        nights,
        staySubtotal,
        serviceStaffTotal,
        petSurchargeTotal,
        petDepositTotal,
        petCleaningTotal,
      };

      const res = await axios.post(
        "/api/admin/contract-link",
        {
          contractDraftJson: JSON.stringify(contractDraft),
          contractSettingsJson: JSON.stringify(
            getContractSettingsSnapshot(useContractSettingsStore.getState()),
          ),
          propertyMetaJson: JSON.stringify({
            title: selectedProperty.title,
            location: selectedProperty.location,
            code: selectedProperty.code,
            capacity: selectedProperty.capacity,
            features: selectedProperty.features,
            ownerDisplayName,
            contractOwnerOverride: contractOwnerRow,
          }),
          propertyTitle: selectedProperty.title,
          propertyLocation: selectedProperty.location,
          fechaEntrada: nextFormState.checkInDate,
          fechaSalida: nextFormState.checkOutDate,
          cupo: Number(nextFormState.guests || 1),
          precioTotal: contractTotal,
        },
        { withCredentials: true },
      );

      const link = String(res.data?.link ?? "").trim();
      if (!link) {
        throw new Error("El servidor no devolvió el link.");
      }

      setForm(nextFormState);
      setGeneratedLink(link);

      try {
        const inMs = new Date(`${nextFormState.checkInDate}T10:00:00`).getTime();
        const outMs = new Date(`${nextFormState.checkOutDate}T10:00:00`).getTime();
        await axios.post(
          "/api/bookings/contract-snapshot",
          {
            contractNumber: generatedContractNumber,
            propertyId: nextFormState.propertyId,
            payload: buildContractSnapshotPayload({
              form: {
                ...nextFormState,
                clientName: "(Link pendiente)",
                clientId: "-",
                clientEmail: "-",
                clientPhone: "-",
                clientCity: "-",
                clientAddress: "-",
              },
              inMs,
              outMs,
              nights,
              contractTotal,
              staySubtotal,
              serviceStaffTotal,
              petSurchargeTotal,
              petDepositTotal,
              generatedContractNumber,
              contractUrlResult: "",
            }),
          },
          { withCredentials: true },
        );
      } catch {
        /* El link ya se creó; el historial puede depender del token en Convex. */
      }

      toast.success("Link generado. Compártelo con tu cliente.");
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, "No se pudo generar el link de contrato."),
      );
    } finally {
      setLoadingGenerateLink(false);
    }
  };

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Link copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  };

  const shareGeneratedLinkWhatsApp = () => {
    if (!generatedLink || !selectedProperty) return;
    const text = encodeURIComponent(
      `Hola! Te comparto el link para completar tus datos y descargar el contrato de *${selectedProperty.title}*:\n\n${generatedLink}\n\nAl terminar podrás descargar el PDF para firmarlo y devolverlo.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const fieldLabelClass = (field: keyof FormState) =>
    cn(
      "ml-1 text-[11px] font-black uppercase tracking-[0.18em]",
      errors[field] ? "text-red-500" : "text-zinc-400",
    );

  const fieldClass = (field: keyof FormState) =>
    cn(
      "h-14 rounded-2xl border bg-zinc-50/80 shadow-sm transition-all",
      errors[field]
        ? "border-red-500 focus-visible:ring-2 focus-visible:ring-red-200"
        : "border-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-900/10",
    );

  const sectionTitleClass = "text-lg font-bold tracking-tight text-zinc-950";

  return (
    <div className="space-y-4 p-4 md:p-6 lg:flex lg:h-[calc(100dvh-3.75rem)] lg:flex-col lg:gap-0 lg:overflow-hidden lg:p-3">

      {/* ── CONFIRMAR PAGO (modal) ─────────────────────────────────────── */}
      {!isLinkMode && (
      <>
      <Dialog open={confModalOpen} onOpenChange={setConfModalOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90vh,760px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-emerald-100 bg-white p-0 sm:max-w-xl"
        >
          <DialogHeader className="shrink-0 border-b border-emerald-100 bg-emerald-50/90 px-5 py-4 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <DialogTitle className="text-lg font-bold text-emerald-950 dark:text-zinc-50">
              Confirmar pago
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                  Número de contrato
                </Label>
                <Input
                  placeholder="Ej: FY-2005 o DIR-FINCA-…"
                  value={confSearchNumber}
                  onChange={(e) => setConfSearchNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchContractBooking();
                  }}
                  className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={() => void searchContractBooking()}
                  disabled={confSearchLoading || !confSearchNumber.trim()}
                  className="h-12 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  {confSearchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2">Buscar</span>
                </Button>
              </div>
            </div>

            {confFoundBooking && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {confFoundBooking.isContractSnapshot ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                    Borrador del contrato (aún no hay reserva en el calendario). Al generar la confirmación PDF se creará la reserva con el pago indicado.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                  {[
                    { label: "Cliente", value: confFoundBooking.nombreCompleto },
                    { label: "Finca", value: confFoundBooking.propertyTitle },
                    {
                      label: "Entrada",
                      value: confFoundBooking.fechaEntrada
                        ? new Date(confFoundBooking.fechaEntrada).toLocaleDateString("es-CO")
                        : "-",
                    },
                    {
                      label: "Salida",
                      value: confFoundBooking.fechaSalida
                        ? new Date(confFoundBooking.fechaSalida).toLocaleDateString("es-CO")
                        : "-",
                    },
                    {
                      label: "Total",
                      value: confFoundBooking.precioTotal
                        ? `$${Number(confFoundBooking.precioTotal).toLocaleString("es-CO")}`
                        : "-",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-emerald-50 px-3 py-1.5 dark:bg-emerald-950/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {label}:{" "}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Abono / Anticipo
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={confForm.depositAmount}
                      onChange={(e) =>
                        setConfForm((p) => ({
                          ...p,
                          depositAmount: formatPriceInput(e.target.value),
                        }))
                      }
                      className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Fecha abono
                    </Label>
                    <Input
                      type="date"
                      value={confForm.depositDate}
                      onChange={(e) =>
                        setConfForm((p) => ({ ...p, depositDate: e.target.value }))
                      }
                      className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Saldo restante
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={confForm.balanceAmount}
                      onChange={(e) =>
                        setConfForm((p) => ({
                          ...p,
                          balanceAmount: formatPriceInput(e.target.value),
                        }))
                      }
                      className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Fecha saldo
                    </Label>
                    <Input
                      type="date"
                      value={confForm.balanceDate}
                      onChange={(e) =>
                        setConfForm((p) => ({ ...p, balanceDate: e.target.value }))
                      }
                      className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Método de pago
                    </Label>
                    <Select
                      value={confForm.paymentMethod}
                      onValueChange={(v) => setConfForm((p) => ({ ...p, paymentMethod: v }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bancolombia">Bancolombia</SelectItem>
                        <SelectItem value="bbva">BBVA</SelectItem>
                        <SelectItem value="davivienda">Davivienda</SelectItem>
                        <SelectItem value="nequi">Nequi</SelectItem>
                        <SelectItem value="pse">PSE</SelectItem>
                        <SelectItem value="tarjeta_credito">Tarjeta Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Estado pago
                    </Label>
                    <Select
                      value={confForm.paymentStatus}
                      onValueChange={(v) => setConfForm((p) => ({ ...p, paymentStatus: v }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PARTIAL">Abono parcial</SelectItem>
                        <SelectItem value="PAID">Pago completo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => void generateConfirmationPdf()}
                  disabled={loadingConfirmation}
                  className="h-14 w-full rounded-2xl bg-emerald-600 text-base font-bold text-white shadow hover:bg-emerald-700"
                >
                  {loadingConfirmation ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generando PDF…
                    </>
                  ) : (
                    <>
                      <FileCheck className="mr-2 h-5 w-5" /> Generar confirmación PDF
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </>
      )}

      {/* ── CONTRATOS ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
          <div
            className="border-r border-zinc-100 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden"
            ref={formTopRef}
          >
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 md:px-5">
              <div className="rounded-xl bg-zinc-900 p-2 text-white shadow-md">
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold tracking-tight text-zinc-950">
                {isLinkMode ? "Link de Contrato" : "Generar Contrato"}
              </h2>
              <span className="hidden text-xs text-zinc-400 lg:inline">
                · Completa los pasos y genera el PDF
              </span>
              {!isLinkMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-9 rounded-xl border-emerald-200 bg-emerald-50/90 font-bold text-emerald-900 shadow-sm hover:bg-emerald-100"
                  onClick={() => setConfModalOpen(true)}
                >
                  <FileCheck className="mr-1.5 h-4 w-4" />
                  Confirmar pago
                </Button>
              )}
            </div>

            {/* ── Stepper (fijo arriba, fuera del scroll) ───────────────── */}
            <div className="shrink-0 px-3 pt-3 md:px-4 md:pt-4">
            <div className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
              {CONTRACT_STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(i)}
                  title={label}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors",
                    i === step ? "bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-bold",
                      i <= step
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[11px] font-semibold",
                      i === step ? "text-primary" : "text-muted-foreground",
                      // En pantallas angostas solo se lee el paso activo.
                      i === step ? "inline" : "hidden sm:inline",
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
            </div>

            {/* ── Contenido del paso (única zona con scroll) ────────────── */}
            <div className="space-y-4 p-3 md:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto scrollbar-hide">
            {step === 0 && (
            <>
            <FormSection
              title="Finca"
              description="Selecciona la finca. Un PDF en Propiedades es opcional si quieres descargar el mismo texto en plantilla."
              icon={Home}
              gradientFrom="from-blue-500/10"
              iconBg="bg-blue-100 text-blue-600"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              compact
              defaultOpen={true}
              className="bg-zinc-50/50"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className={fieldLabelClass("propertyId")}>
                    Buscar finca
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      placeholder="Escribe nombre o codigo"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() =>
                        setTimeout(() => setIsSearchFocused(false), 200)
                      }
                      className={cn(fieldClass("propertyId"), "pl-10")}
                    />
                  </div>
                  {errors.propertyId && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.propertyId}
                    </p>
                  )}
                </div>

                <AnimatePresence>
                  {isSearchFocused && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <ScrollArea className="h-[200px] rounded-xl border border-zinc-100 bg-white p-2">
                        <div className="space-y-2">
                          {isLoading ? (
                            <div className="p-4 text-sm text-zinc-500">
                              Cargando inventario de fincas...
                            </div>
                          ) : filtered.length === 0 ? (
                            <div className="p-4 text-sm text-zinc-500">
                              No se encontraron fincas.
                            </div>
                          ) : (
                            filtered.map((property) => {
                              const active = form.propertyId === property.id;
                              return (
                                <button
                                  key={property.id}
                                  type="button"
                                  onClick={() => {
                                    onSelectProperty(property.id);
                                    setIsSearchFocused(false);
                                  }}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all",
                                    active
                                      ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                                      : "border-zinc-100 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                                  )}
                                >
                                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-zinc-100">
                                    {property.images?.[0] ? (
                                      <img
                                        src={property.images[0]}
                                        alt={property.title}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center">
                                        <Home
                                          className={cn(
                                            "h-5 w-5",
                                            active
                                              ? "text-white/80"
                                              : "text-zinc-400",
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold">
                                      {property.title}
                                    </p>
                                    <p
                                      className={cn(
                                        "truncate text-[10px] font-semibold uppercase tracking-wider",
                                        active
                                          ? "text-white/70"
                                          : "text-zinc-400",
                                      )}
                                    >
                                      {property.code || "SIN CODIGO"}{" "}
                                      {property.location
                                        ? `• ${property.location}`
                                        : ""}
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>

                {selectedProperty && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 rounded-2xl bg-white p-3 border border-zinc-100 shadow-sm">
                      {selectedProperty.images?.[0] ? (
                        <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-zinc-100 shrink-0">
                          <img
                            src={selectedProperty.images[0]}
                            alt={selectedProperty.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 shrink-0">
                          <Home className="h-7 w-7 text-zinc-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="secondary"
                            className="h-5 px-2 text-[9px] font-black tracking-widest uppercase bg-zinc-100 text-zinc-600 border-0"
                          >
                            {selectedProperty.code || "SELECCIONADA"}
                          </Badge>
                          <span className="text-[11px] font-bold text-zinc-400 truncate">
                            {selectedProperty.location ||
                              "Ubicacion no definida"}
                          </span>
                        </div>
                        <h4 className="truncate text-base font-bold text-zinc-950 leading-tight">
                          {selectedProperty.title}
                        </h4>
                      </div>
                    </div>

                    {selectedProperty.contractTemplateUrl?.trim() ? (
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 p-3">
                        <a
                          href={selectedProperty.contractTemplateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Abrir plantilla del contrato (PDF/Word) de esta finca
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </FormSection>
            </>
            )}

            {step === 1 && (
            <>
            {selectedProperty && form.propertyId ? (
              <FormSection
                title="Propietario de la finca (contrato)"
                description="Datos legales del propietario en el contrato. Al seleccionar la finca se precargan si están registrados; solo el nombre es obligatorio."
                icon={User}
                gradientFrom="from-violet-500/10"
                iconBg="bg-violet-100 text-violet-700"
                iconShadow="shadow-violet-500/20"
                textColor="text-violet-600"
                compact
              defaultOpen={true}
                className="bg-zinc-50/50"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Nombre completo del propietario *
                    </Label>
                    <Input
                      value={
                        propertyContractOwnerOverrides[form.propertyId]
                          ?.nombreCompleto ?? ""
                      }
                      onChange={(event) =>
                        setPropertyContractOwnerOverride(form.propertyId, {
                          nombreCompleto: event.target.value,
                        })
                      }
                      placeholder={
                        ownerResolved.name
                          ? ownerResolved.name
                          : "Ej. María Pérez"
                      }
                      className={cn(
                        "h-14 rounded-2xl border bg-zinc-50/80 shadow-sm",
                        errors.propertyOwnerName
                          ? "border-red-500"
                          : "border-zinc-100",
                      )}
                    />
                    {errors.propertyOwnerName && (
                      <p className="ml-1 text-xs font-semibold text-red-500">
                        {errors.propertyOwnerName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Cédula
                    </Label>
                    <Input
                      value={
                        propertyContractOwnerOverrides[form.propertyId]
                          ?.cedula ?? ""
                      }
                      onChange={(event) =>
                        setPropertyContractOwnerOverride(form.propertyId, {
                          cedula: event.target.value,
                        })
                      }
                      placeholder="Número de documento"
                      className="h-14 rounded-2xl border border-zinc-100 bg-zinc-50/80 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Ciudad de expedición
                    </Label>
                    <Input
                      value={
                        propertyContractOwnerOverrides[form.propertyId]
                          ?.ciudadCedula ?? ""
                      }
                      onChange={(event) =>
                        setPropertyContractOwnerOverride(form.propertyId, {
                          ciudadCedula: event.target.value,
                        })
                      }
                      placeholder="Ej. Bogotá D.C."
                      className="h-14 rounded-2xl border border-zinc-100 bg-zinc-50/80 shadow-sm"
                    />
                  </div>
                </div>
              </FormSection>
            ) : null}
            </>
            )}

            {step === 2 && (
            <>
            <FormSection
              title="Estadia y Logistica"
              description="Fechas, horas y valores del contrato"
              icon={Clock3}
              gradientFrom="from-amber-500/10"
              iconBg="bg-amber-100 text-amber-600"
              iconShadow="shadow-amber-500/20"
              textColor="text-amber-500"
              compact
              defaultOpen={true}
              className="bg-zinc-50/50"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label className={fieldLabelClass("contractNumber")}>
                    Codigo contrato
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={form.contractNumber}
                      onChange={(event) =>
                        setField("contractNumber", event.target.value)
                      }
                      placeholder="Ej: CFINCA-01 o DIR-FINCA-…"
                      className={cn(fieldClass("contractNumber"), "sm:flex-1")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 shrink-0 rounded-2xl border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                      onClick={() => setCodeHistoryOpen(true)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      Ver historial
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("nightlyPrice")}>
                    Valor por noche
                  </Label>
                  <CopMoneyInput
                    value={form.nightlyPrice}
                    onChange={handleNightlyPriceChange}
                    className={fieldClass("nightlyPrice")}
                    placeholder="0"
                  />
                  <p className="ml-1 text-[11px] font-medium text-zinc-400">
                    Según tarifa y noches (o precio automático de la finca). Al
                    cambiarlo, el total se recalcula abajo salvo que lo hayas
                    editado manualmente.
                  </p>
                  {errors.nightlyPrice && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.nightlyPrice}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("checkInDate")}>
                    Fecha entrada
                  </Label>
                  <Input
                    type="date"
                    value={form.checkInDate}
                    onChange={(event) => {
                      setField("checkInDate", event.target.value);
                      setSeasonManual(false);
                    }}
                    className={fieldClass("checkInDate")}
                  />
                  {errors.checkInDate && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.checkInDate}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("checkOutDate")}>
                    Fecha salida
                  </Label>
                  <Input
                    type="date"
                    min={form.checkInDate || undefined}
                    value={form.checkOutDate}
                    onChange={(event) => {
                      setField("checkOutDate", event.target.value);
                      setSeasonManual(false);
                    }}
                    className={fieldClass("checkOutDate")}
                  />
                  {errors.checkOutDate && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.checkOutDate}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("checkInTime")}>
                    Hora check-in
                  </Label>
                  <Input
                    list="contracts-time-options"
                    value={form.checkInTime}
                    onChange={(event) =>
                      setField("checkInTime", event.target.value.toUpperCase())
                    }
                    placeholder="10:00 AM"
                    className={fieldClass("checkInTime")}
                  />
                  <p className="ml-1 text-[11px] font-medium text-zinc-400">
                    Puedes escribir la hora o elegir una sugerencia.
                  </p>
                  {errors.checkInTime && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.checkInTime}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("checkOutTime")}>
                    Hora check-out
                  </Label>
                  <Input
                    list="contracts-time-options"
                    value={form.checkOutTime}
                    onChange={(event) =>
                      setField("checkOutTime", event.target.value.toUpperCase())
                    }
                    placeholder="04:00 PM"
                    className={fieldClass("checkOutTime")}
                  />
                  <p className="ml-1 text-[11px] font-medium text-zinc-400">
                    Puedes escribir la hora o elegir una sugerencia.
                  </p>
                  {errors.checkOutTime && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.checkOutTime}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("guests")}>
                    Numero de huespedes
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.guests}
                    onChange={(event) => setField("guests", event.target.value)}
                    className={fieldClass("guests")}
                  />
                  {errors.guests && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.guests}
                    </p>
                  )}
                  {selectedProperty?.capacity != null &&
                    selectedProperty.capacity > 0 && (
                      <p className="ml-1 text-[11px] font-medium text-zinc-400">
                        Capacidad declarada: {selectedProperty.capacity}{" "}
                        personas
                        {form.isEvento &&
                        selectedProperty.eventCapacity != null &&
                        selectedProperty.eventCapacity > 0
                          ? ` · evento: ${selectedProperty.eventCapacity}`
                          : ""}
                      </p>
                    )}
                  <GuestCapacityWarningAlert message={guestCapacityWarning} />
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("temporada")}>
                    Temporada
                  </Label>
                  <Select
                    value={form.temporada}
                    onValueChange={(value) => {
                      setField("temporada", value);
                      setSeasonManual(true);
                    }}
                  >
                    <SelectTrigger className={fieldClass("temporada")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {seasonOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.temporada && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.temporada}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={fieldLabelClass("groupType")}>
                    Tipo de Grupo
                  </Label>
                  <Select
                    value={form.groupType}
                    onValueChange={(value) => setField("groupType", value)}
                  >
                    <SelectTrigger className={fieldClass("groupType")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FAMILIAR">Familiar</SelectItem>
                      <SelectItem value="AMIGOS">Amigos</SelectItem>
                      <SelectItem value="EMPRESA">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.groupType && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.groupType}
                    </p>
                  )}
                </div>
              </div>
            </FormSection>
            </>
            )}

            {step === 3 && (
            <>
            <FormSection
              title="Adicionales y Cargos"
              description="Mascotas, servicio y extras del contrato"
              icon={Sparkles}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-100 text-emerald-600"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
              compact
              defaultOpen={true}
              className="bg-zinc-50/50"
            >
              <div className="grid gap-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-zinc-950">
                        Cargos por Mascotas
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Primeras 2: deposito de $100k | 3ra en adelante: tarifa
                        $30k
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    >
                      {canConfigurePetCharges
                        ? propertyAllowsPets
                          ? "Configurables"
                          : "Temporalmente habilitadas"
                        : "No permitidas"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-100 bg-white p-4">
                    <div>
                      <Label className={fieldLabelClass("petCount")}>
                        Numero de mascotas
                      </Label>
                      <p className="mt-1 text-sm text-zinc-500">
                        {canConfigurePetCharges
                          ? propertyAllowsPets
                            ? "Define aqui el cargo que debe entrar al contrato antes de generar el PDF."
                            : "Temporal: esta finca marcaba no permitidas, pero aqui puedes configurarlas manualmente."
                          : "Esta finca no permite mascotas. Los cargos de mascotas se mantienen en 0."}
                      </p>
                      {errors.petCount && (
                        <p className="mt-1 text-xs font-semibold text-red-500">
                          {errors.petCount}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        disabled={
                          !canConfigurePetCharges ||
                          Number(form.petCount || 0) <= 0
                        }
                        onClick={() =>
                          setField(
                            "petCount",
                            String(Math.max(0, Number(form.petCount || 0) - 1)),
                          )
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="min-w-10 text-center text-lg font-bold">
                        {form.petCount || "0"}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        disabled={!canConfigurePetCharges}
                        onClick={() =>
                          setField(
                            "petCount",
                            String(Number(form.petCount || 0) + 1),
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {propertyServiceAvailable && (
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-zinc-950">
                          Personal de aseo / cocina
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          Se incluye en el resumen si la finca lo requiere
                        </p>
                      </div>
                      {propertyServiceMandatory && (
                        <Badge className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                          Obligatorio
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                      <Button
                        type="button"
                        variant={
                          form.serviceStaffIncluded ? "default" : "outline"
                        }
                        className="h-12 rounded-xl"
                        disabled={propertyServiceMandatory}
                        onClick={() =>
                          setField(
                            "serviceStaffIncluded",
                            !form.serviceStaffIncluded,
                          )
                        }
                      >
                        {form.serviceStaffIncluded
                          ? "No incluir servicio"
                          : "Incluir servicio"}
                      </Button>

                      <div className="space-y-2">
                        <Label className={fieldLabelClass("serviceStaffFee")}>
                          Valor servicio
                        </Label>
                        <p className="ml-1 text-xs font-semibold text-zinc-500">
                          Estado:{" "}
                          {propertyServiceMandatory
                            ? "Incluido obligatorio"
                            : form.serviceStaffIncluded
                              ? "Incluido"
                              : "No incluido"}
                        </p>
                        <CopMoneyInput
                          value={form.serviceStaffFee}
                          onChange={(next) => setField("serviceStaffFee", next)}
                          disabled={
                            !form.serviceStaffIncluded &&
                            !propertyServiceMandatory
                          }
                          className={fieldClass("serviceStaffFee")}
                        />
                        {errors.serviceStaffFee && (
                          <p className="ml-1 text-xs font-semibold text-red-500">
                            {errors.serviceStaffFee}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-zinc-950">
                      Cargos adicionales al total del contrato
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      Manilla y otros cobros se suman al resumen de cobro y aparecen en el contrato antes de las firmas. El aseo se edita abajo en «Configuración del contrato».
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className={fieldLabelClass("manillaCondominio")}>
                        Manilla condominio
                      </Label>
                      <CopMoneyInput
                        value={form.manillaCondominio}
                        onChange={(next) => setField("manillaCondominio", next)}
                        className={fieldClass("manillaCondominio")}
                      />
                      <p className="ml-1 text-[11px] text-zinc-500">
                        En el contrato: bloque «Cargos adicionales acordados».
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className={fieldLabelClass("otherCharges")}>
                        Otros cobros (no alojamiento)
                      </Label>
                      <CopMoneyInput
                        value={form.otherCharges}
                        onChange={(next) => setField("otherCharges", next)}
                        className={fieldClass("otherCharges")}
                        placeholder="0"
                      />
                      <p className="ml-1 text-[11px] text-zinc-500">
                        En el contrato: mismo bloque, línea «Otros cobros acordados».
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-orange-400/40 bg-orange-500 p-4 text-white">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        ¿Es un Evento?
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                        Define si el alquiler es para un evento
                      </p>
                    </div>
                    <div
                      className="flex shrink-0 rounded-xl bg-black/25 p-1"
                      role="group"
                      aria-label="Tipo de alquiler"
                    >
                      {(
                        [
                          { value: true, label: "SÍ, ES EVENTO" },
                          { value: false, label: "NETAMENTE FAMILIAR" },
                        ] as const
                      ).map((option) => {
                        const selected = form.isEvento === option.value;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            aria-pressed={selected}
                            className={cn(
                              "rounded-lg px-3 py-2 text-[10px] font-bold transition-all sm:text-xs",
                              selected
                                ? "bg-white text-orange-700 shadow-md"
                                : "text-white/55 hover:text-white",
                            )}
                            onClick={() =>
                              setField("isEvento", option.value)
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {form.isEvento && (
                    <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-white/25 bg-orange-600/40 p-4 md:grid-cols-2">
                      {[
                        { id: "extraSound", label: "¿Sonido adicional?" },
                        { id: "liveMusic", label: "¿Música en vivo?" },
                        { id: "dj", label: "¿DJ?" },
                        { id: "decoration", label: "¿Decoración?" },
                        { id: "additionalGuests", label: "¿Invitados extra?" },
                      ].map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <Label className="text-xs font-bold text-white">
                            {item.label}
                          </Label>
                          <div
                            className="flex shrink-0 rounded-lg bg-black/25 p-0.5"
                            role="group"
                            aria-label={item.label}
                          >
                            {["SI", "NO"].map((opt) => {
                              const selected =
                                form[item.id as keyof FormState] === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  aria-pressed={selected}
                                  className={cn(
                                    "min-w-[40px] rounded-md px-3 py-1.5 text-[10px] font-bold transition-all",
                                    selected
                                      ? "bg-white text-orange-700 shadow-md"
                                      : "text-white/55 hover:text-white",
                                  )}
                                  onClick={() =>
                                    setField(item.id as any, opt)
                                  }
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </FormSection>
            </>
            )}

            {step === 4 && (
            <>
            {!isLinkMode && (
            <FormSection
              title="Informacion del Cliente"
              description="Todos estos datos son obligatorios para diligenciar el contrato"
              icon={User}
              gradientFrom="from-zinc-500/10"
              iconBg="bg-zinc-100 text-zinc-700"
              iconShadow="shadow-zinc-500/20"
              textColor="text-zinc-500"
              compact
              defaultOpen={true}
              className="bg-zinc-50/50"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className={fieldLabelClass("clientName")}>
                    Nombre completo
                  </Label>
                  <Input
                    value={form.clientName}
                    onChange={(event) =>
                      setClientField("clientName", event.target.value)
                    }
                    className={fieldClass("clientName")}
                  />
                  {errors.clientName && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.clientName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabelClass("clientId")}>
                    Identificacion
                  </Label>
                  <Input
                    value={form.clientId}
                    onChange={(event) =>
                      setClientField("clientId", event.target.value)
                    }
                    className={fieldClass("clientId")}
                  />
                  {errors.clientId && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.clientId}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabelClass("clientPhone")}>
                    Celular / WhatsApp
                  </Label>
                  <Input
                    value={form.clientPhone}
                    onChange={(event) =>
                      setClientField("clientPhone", event.target.value)
                    }
                    className={fieldClass("clientPhone")}
                  />
                  {errors.clientPhone && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.clientPhone}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabelClass("clientEmail")}>
                    Correo electronico
                  </Label>
                  <Input
                    value={form.clientEmail}
                    onChange={(event) =>
                      setClientField("clientEmail", event.target.value)
                    }
                    className={fieldClass("clientEmail")}
                  />
                  {errors.clientEmail && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.clientEmail}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabelClass("clientCity")}>
                    Ciudad de expedición de cédula
                  </Label>
                  <Input
                    value={form.clientCity}
                    onChange={(event) =>
                      setClientField("clientCity", event.target.value)
                    }
                    placeholder="Ej. Bogotá D.C."
                    className={fieldClass("clientCity")}
                  />
                  <p className="ml-1 text-[11px] font-medium text-zinc-400">
                    Aparece en el contrato después del número de cédula (DE …).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabelClass("clientAddress")}>
                    Direccion
                  </Label>
                  <Input
                    value={form.clientAddress}
                    onChange={(event) =>
                      setClientField("clientAddress", event.target.value)
                    }
                    className={fieldClass("clientAddress")}
                  />
                  {errors.clientAddress && (
                    <p className="ml-1 text-xs font-semibold text-red-500">
                      {errors.clientAddress}
                    </p>
                  )}
                </div>
              </div>
            </FormSection>
            )}

            <ContractGlobalSetupSections
              clausePreviewFincaData={reservationFincaPreviewData}
              reservationCleaningFee={form.cleaningFee}
              onReservationCleaningFeeChange={(digits) =>
                setField("cleaningFee", digits)
              }
              reservationSecurityDeposit={form.refundableDeposit}
              onReservationSecurityDepositChange={(digits) =>
                setField("refundableDeposit", digits)
              }
              reservationPetDepositCop={petDepositForCalc}
              reservationContractTotal={form.contractTotalInput}
              onReservationContractTotalChange={handleContractTotalChange}
              reservationSuggestedContractTotalCop={suggestedContractTotal}
              onReservationContractTotalUseSuggested={applySuggestedContractTotal}
              reservationContractTotalError={errors.contractTotalInput}
            />
            {errors.bankAccounts && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {errors.bankAccounts}
              </p>
            )}
            </>
            )}

            {step === 5 && (
            <>
            <FormSection
              title="Vista previa del contrato"
              description="Vista del documento tal como se generará en PDF (texto justificado y logo). Los datos salen del formulario y de las cláusulas."
              icon={Eye}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-100 text-indigo-700"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-600"
              compact
              defaultOpen={true}
              className="bg-zinc-50/50"
            >
              {!form.propertyId ? (
                <p className="text-sm text-zinc-500">
                  Selecciona una finca para armar la vista previa.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-bold"
                      onClick={() =>
                        formTopRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                      }
                    >
                      <ChevronUp className="mr-1.5 h-4 w-4" />
                      Volver al inicio del formulario
                    </Button>
                  </div>
                  <ScrollArea className="h-[min(70vh,720px)] rounded-2xl border border-zinc-200 bg-white">
                    <div
                      className="prose prose-sm max-w-none p-6 text-zinc-900 leading-relaxed [&_p]:my-2 [&_p[align=center]]:text-center! [&_p[style*='text-align:center']]:text-center! [&_p]:text-justify! [&_.contract-amenities]:text-left! [&_.contract-amenities_*]:text-left!"
                      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                      dangerouslySetInnerHTML={{
                        __html: contractPreviewHtml,
                      }}
                    />
                  </ScrollArea>
                </div>
              )}
            </FormSection>
            </>
            )}

            </div>

            {/* ── Navegación (footer fijo al fondo de la columna) ───────── */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-3 py-3 md:px-4">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-xl"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Atrás
              </Button>
              <span className="text-xs font-semibold text-muted-foreground">
                Paso {step + 1} de {CONTRACT_STEPS.length}
              </span>
              {step < CONTRACT_STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setStep((s) => Math.min(CONTRACT_STEPS.length - 1, s + 1))
                  }
                  className="rounded-xl"
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <span className="text-xs font-semibold text-primary">
                  Último paso · genera abajo
                </span>
              )}
            </div>
          </div>

          <div className="bg-zinc-50/50 lg:border-l lg:border-zinc-100 lg:overflow-y-auto scrollbar-hide">
            <div className="p-3 md:p-4">
              <div className="rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-zinc-950">
                    Resumen de Cobro
                  </h3>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    {selectedProperty
                      ? selectedProperty.title
                      : "SELECCIONA UNA FINCA"}
                  </p>
                </div>

                <div className="space-y-6 pt-6 mt-4 border-t border-zinc-100/60 pb-1">
                  <p className="text-[11px] font-medium text-zinc-400">
                    El total se calcula automáticamente según las partidas.
                  </p>
                  <div className="space-y-0 text-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                          <span className="font-medium text-zinc-500">
                            Finca ({nochesResumenEs(nights)})
                          </span>
                          <span className="font-bold text-zinc-950">
                            {money(staySubtotal)}
                          </span>
                        </div>

                        {petDepositTotal > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-bold text-emerald-600">
                              Deposito mascotas
                            </span>
                            <span className="font-bold text-emerald-600">
                              + {money(petDepositTotal)}
                            </span>
                          </div>
                        )}

                        {petSurchargeTotal > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium italic text-zinc-500">
                              Tarifa ingreso mascotas (3ª+)
                            </span>
                            <span className="font-bold text-zinc-950">
                              + {money(petSurchargeTotal)}
                            </span>
                          </div>
                        )}

                        {petCleaningTotal > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium text-zinc-500">
                              Aseo por mascotas (3+)
                            </span>
                            <span className="font-bold text-zinc-950">
                              + {money(petCleaningTotal)}
                            </span>
                          </div>
                        )}

                        {serviceStaffTotal > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium text-indigo-600">
                              Personal de servicio (sujeto a disponibilidad)
                            </span>
                            <span className="font-bold text-indigo-600">
                              + {money(serviceStaffTotal)}
                            </span>
                          </div>
                        )}

                        {Number(form.cleaningFee || 0) > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium text-zinc-500">
                              Aseo final (propiedad)
                            </span>
                            <span className="font-bold text-zinc-950">
                              + {money(Number(form.cleaningFee || 0))}
                            </span>
                          </div>
                        )}

                        {Number(form.refundableDeposit || 0) > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium text-zinc-500">
                              Depósito por daños
                            </span>
                            <span className="font-bold text-zinc-950">
                              + {money(Number(form.refundableDeposit || 0))}
                            </span>
                          </div>
                        )}

                        {Number(form.manillaCondominio || 0) > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium text-zinc-500">
                              Manilla condominio
                            </span>
                            <span className="font-bold text-zinc-950">
                              + {money(Number(form.manillaCondominio || 0))}
                            </span>
                          </div>
                        )}

                        {Number(form.otherCharges || 0) > 0 && (
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-100 pb-4">
                            <span className="font-medium text-zinc-500">
                              Otros cobros
                            </span>
                            <span className="font-bold text-zinc-950">
                              + {money(Number(form.otherCharges || 0))}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl bg-zinc-950 p-5 text-white shadow-xl">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                              Total contrato
                            </p>
                            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                              {contractTotal > 0
                                ? money(contractTotal)
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm">
                            <CreditCard className="h-6 w-6" />
                          </div>
                        </div>
                      </div>
                </div>

                <div
                  className="space-y-3 border-t border-zinc-100/60 mt-4 pt-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold text-zinc-600"
                    >
                      {nochesResumenEs(nights)}
                    </Badge>
                    {!isLinkMode && contractSnapshotSaved && (
                      <Badge className="rounded-full border-0 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Borrador guardado (confirmar pago)
                      </Badge>
                    )}
                    {isLinkMode && generatedLink && (
                      <Badge className="rounded-full border-0 bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-700">
                        <Link2 className="mr-1 h-3 w-3" /> Link activo (48 h)
                      </Badge>
                    )}
                  </div>

                  {firmantes.length > 0 ? (
                    <div className="mb-2">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Firma del contrato
                      </label>
                      <select
                        value={selectedFirmante?.id ?? ""}
                        onChange={(e) => setSelectedFirmanteId(e.target.value)}
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {firmantes.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nombre}
                            {f.cedula ? ` · C.C. ${f.cedula}` : ""}
                            {f.esDefault ? " (por defecto)" : ""}
                          </option>
                        ))}
                      </select>
                      {selectedFirmante && !selectedFirmante.firmaUrl ? (
                        <p className="mt-1 text-[10px] text-amber-600">
                          Este firmante no tiene imagen de firma cargada.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                      No hay firmantes configurados. Agrégalos en Ajustes del
                      contrato → Firmantes.
                    </p>
                  )}

                  {isLinkMode ? (
                    <>
                      <Button
                        type="button"
                        className="h-12 w-full rounded-xl bg-orange-500 font-bold text-white shadow-md hover:bg-orange-600"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void generateContractLink();
                        }}
                        disabled={loadingGenerateLink}
                      >
                        {loadingGenerateLink ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generando link...
                          </>
                        ) : (
                          <>
                            <Link2 className="mr-2 h-4 w-4" />
                            Generar link de contrato
                          </>
                        )}
                      </Button>
                      <p className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        El cliente completará sus datos y descargará el PDF para firmarlo
                      </p>
                    </>
                  ) : (
                    <>
                  <Button
                    type="button"
                    className="h-12 w-full rounded-xl bg-blue-600 font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void generateContractAndReserve();
                    }}
                    disabled={loadingGenerate}
                  >
                    {loadingGenerate ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                        Generando...
                      </>
                    ) : (
                      "Generar contrato"
                    )}
                  </Button>

                  <p className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Revisa la vista previa del contrato abajo antes de generar.
                    Usa «Confirmar pago» cuando el cliente haya abonado.
                  </p>
                    </>
                  )}
                </div>
              </div>

              {contractUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mt-4"
                >
                  <div className="rounded-[20px] border border-blue-200/60 bg-blue-50 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-100 p-2.5 text-blue-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-blue-950">
                          {contractArtifactKind === "docx"
                            ? "Contrato Word generado"
                            : "Contrato generado exitosamente"}
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-500/80">
                          {generatedContractFilename}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        type="button"
                        className="h-12 w-full rounded-xl border-blue-200 font-bold text-white bg-blue-700 shadow-sm hover:bg-blue-600 transition-all"
                        onClick={downloadGeneratedContract}
                      >
                        <Download className="mr-2 h-4 w-4" /> Descargar archivo
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {isLinkMode && generatedLink && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mt-4"
                >
                  <div className="rounded-[20px] border border-orange-200/60 bg-orange-50 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-orange-100 p-2.5 text-orange-600">
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-orange-950">
                          Link listo para compartir
                        </p>
                        <p className="mt-1 truncate text-[11px] font-medium text-orange-700/80">
                          {generatedLink}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full rounded-xl border-orange-200 bg-white font-bold text-orange-900 hover:bg-orange-100"
                        onClick={() => void copyGeneratedLink()}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copiar link
                      </Button>
                      <Button
                        type="button"
                        className="h-11 w-full rounded-xl bg-[#25D366] font-bold text-white hover:bg-[#1ebe57]"
                        onClick={shareGeneratedLinkWhatsApp}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" /> Compartir por WhatsApp
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {confirmationUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mt-3"
                >
                  <div className="rounded-[20px] border border-emerald-200/60 bg-emerald-50 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-emerald-100 p-2.5 text-emerald-600">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-950">
                          Confirmacion generada exitosamente
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">
                          {confirmationFilename}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        type="button"
                        className="h-12 w-full rounded-xl border-emerald-200 font-bold text-white bg-emerald-700 shadow-sm hover:bg-emerald-600 transition-all"
                        onClick={downloadGeneratedConfirmation}
                      >
                        <Download className="mr-2 h-4 w-4" /> Descargar archivo
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      <datalist id="contracts-time-options">
        {TIME_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <ContractCodeHistoryModal
        open={codeHistoryOpen}
        onOpenChange={setCodeHistoryOpen}
        propertyId={form.propertyId || undefined}
        propertyCode={selectedProperty?.code}
        propertyTitle={selectedProperty?.title}
        currentCode={form.contractNumber}
        onSelectCode={(code) => setField("contractNumber", code)}
      />
    </div>
  );
}
