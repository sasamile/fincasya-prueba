"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Baby,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { downloadCheckinGuestsPdf } from "@/features/admin/utils/download-checkin-guests-pdf";
import { CHECKIN_EXPIRED_REDIRECT_URL } from "@/features/checkin/api/checkin-portal.api";
import { CheckinPaymentSection } from "@/features/checkin/components/checkin-payment-section";
import { isReservationEndedForCheckin } from "@/features/checkin/utils/checkin-portal-access";
import { SupportFab } from "@/features/shared/components/support-fab";
import { GuestDocumentFields } from "@/features/checkin/components/guest-document-fields";
import {
  DEFAULT_GUEST_DOCUMENT_TYPE,
  formatGuestDocument,
  normalizeGuestDocumentType,
  parseGuestFromObservacionesText,
  validateGuestDocument,
} from "@/features/checkin/utils/guest-document";
import type { CheckinBankAccount } from "@/features/checkin/utils/payment-holders";
import type { PaymentBreakdownLine } from "@/features/admin/utils/payment-whatsapp-message";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "https://modest-husky-871.convex.site";

type Reservation = {
  reference: string;
  nombreTitular: string;
  propertyTitle: string;
  propertyLocation: string | null;
  fechaEntrada: number;
  fechaSalida: number;
  horaEntrada?: string | null;
  horaSalida?: string | null;
  numeroPersonas: number;
  status: string;
  checkinCompleted: boolean;
  checkinUpdatedAt: number | null;
  guests: GuestRow[];
  menoresDe2?: number;
  placas?: string;
  allowsPets?: boolean;
  requiresGuestList?: boolean;
  mascotas?: number;
  observaciones?: string;
  aceptaTratamientoDatos?: boolean;
  needsEmpleada: boolean;
  needsTeam: boolean;
  serviciosNota: string;
  precioTotal?: number;
  pagoTotal?: number;
  pagoPendiente?: number;
  pagoCompleto?: boolean;
  checkinUbicacionUrl?: string | null;
  checkinWazeUrl?: string | null;
  checkinIndicacionesLlegada?: string | null;
  checkinRecomendaciones?: string | null;
  checkinUbicacionImageUrl?: string | null;
  checkinUbicacionImageUrls?: string[] | null;
  guestListLocked?: boolean;
  guestListLockHours?: number;
  guestListLockAt?: number | null;
};

type PaymentPortalSnapshot = {
  precioTotal?: number;
  pagoTotal?: number;
  pagoPendiente?: number;
  pagoCompleto?: boolean;
  breakdown?: PaymentBreakdownLine[];
  bankAccounts?: CheckinBankAccount[];
  boldLink?: string | null;
  boldSurcharge?: number | null;
};

type GuestRow = {
  nombreCompleto: string;
  cedula?: string;
  /** Tipo de documento: CC, TI, CE, PA (pasaporte), RC (registro civil). */
  tipoDocumento?: string;
  /** @deprecated los menores de 2 años ahora van en un contador aparte. */
  esMenor?: boolean;
  email?: string;
  fechaNacimiento?: string;
  telefono?: string;
};

type PageState =
  | "loading"
  | "form"
  | "not_found"
  | "error"
  | "success"
  | "expired";

function redirectToWebsiteAfterReservationEnded(embedded: boolean) {
  if (embedded) return;
  window.location.replace(CHECKIN_EXPIRED_REDIRECT_URL);
}

type CheckinPageContentProps = {
  /** Referencia de reserva (CR). Si no se pasa, se toma de la URL /checkin/[reference]. */
  reference?: string;
  /** Modo embebido dentro del stepper de venta (sin pantalla completa). */
  embedded?: boolean;
  /** Callback al completar el check-in (p. ej. refrescar el portal de venta). */
  onCheckinComplete?: () => void;
};

function emptyGuest(): GuestRow {
  return {
    nombreCompleto: "",
    cedula: "",
    tipoDocumento: DEFAULT_GUEST_DOCUMENT_TYPE,
    email: "",
    fechaNacimiento: "",
    telefono: "",
  };
}

function mapGuestRow(g: Partial<GuestRow>): GuestRow {
  return {
    nombreCompleto: g.nombreCompleto ?? "",
    cedula: g.cedula ?? "",
    tipoDocumento: normalizeGuestDocumentType(g.tipoDocumento),
    email: g.email ?? "",
    fechaNacimiento: g.fechaNacimiento ?? "",
    telefono: g.telefono ?? "",
  };
}

function formatDate(ms: number) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(ms));
}

function formatTime(ms: number) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  })
    .format(new Date(ms))
    .replace(/ /g, " ");
}

/**
 * Hora para mostrar: prioriza la hora configurada en la reserva (texto tipo
 * "15:00" o "03:00 PM") y cae al timestamp si no existe.
 */
function displayTime(hora: string | null | undefined, ms: number) {
  const s = (hora ?? "").trim();
  if (!s) return formatTime(ms);
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m24[2]} ${ap}`;
  }
  return s.toLowerCase();
}

/** Noches calendario en hora de Colombia (UTC-5), ignorando las horas. */
function calendarNights(entradaMs: number, salidaMs: number) {
  const DAY = 86400000;
  const off = 5 * 3600000;
  const dayIndex = (ms: number) => Math.floor((ms - off) / DAY);
  return Math.max(1, dayIndex(salidaMs) - dayIndex(entradaMs));
}

export function CheckinPageContent({
  reference: referenceProp,
  embedded = false,
  onCheckinComplete,
}: CheckinPageContentProps = {}) {
  const params = useParams<{ reference?: string }>();
  const reference = referenceProp ?? params.reference;
  const [pageState, setPageState] = useState<PageState>("loading");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([emptyGuest()]);
  const [guestListOpen, setGuestListOpen] = useState(false);
  const [menoresCount, setMenoresCount] = useState(0);
  const [placas, setPlacas] = useState("");
  const [pendingReceipts, setPendingReceipts] = useState(0);
  const [mascotas, setMascotas] = useState(0);
  const [adicionales, setAdicionales] = useState<GuestRow[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [needsEmpleada, setNeedsEmpleada] = useState(false);
  const [needsTeam, setNeedsTeam] = useState(false);
  const [serviciosNota, setServiciosNota] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [paymentPortal, setPaymentPortal] = useState<PaymentPortalSnapshot | null>(
    null,
  );

  useEffect(() => {
    if (!reference) return;
    fetch(`/api/payment/${encodeURIComponent(reference)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as PaymentPortalSnapshot;
        setPaymentPortal(data);
      })
      .catch(() => {
        /* opcional: medios de pago no bloquean el check-in */
      });
  }, [reference]);

  useEffect(() => {
    if (!reference) return;
    fetch(`${CONVEX_SITE_URL}/api/checkin/${encodeURIComponent(reference)}`)
      .then(async (res) => {
        if (res.status === 410) {
          if (embedded) {
            setPageState("expired");
          } else {
            redirectToWebsiteAfterReservationEnded(embedded);
          }
          return;
        }
        if (res.status === 404) {
          setPageState("not_found");
          return;
        }
        if (!res.ok) {
          setPageState("error");
          return;
        }
        const data = (await res.json()) as Reservation & { ok: boolean };
        if (
          isReservationEndedForCheckin(data.fechaSalida, data.horaSalida ?? null)
        ) {
          if (embedded) {
            setPageState("expired");
          } else {
            redirectToWebsiteAfterReservationEnded(embedded);
          }
          return;
        }
        setReservation(data);
        setNeedsEmpleada(data.needsEmpleada);
        setNeedsTeam(data.needsTeam);
        setServiciosNota(data.serviciosNota ?? "");
        setPlacas(data.placas ?? "");
        setMascotas(Math.max(0, Math.floor(Number(data.mascotas) || 0)));
        setAceptaDatos(data.aceptaTratamientoDatos === true);

        // Observaciones: separar la línea de invitados adicionales (que el
        // formulario anexa al guardar) y reconstruir las tarjetas.
        const obsLineas = (data.observaciones ?? "").split("\n");
        const lineaAdicionales = obsLineas.find((l) =>
          l.startsWith("Invitados adicionales"),
        );
        setObservaciones(
          obsLineas
            .filter((l) => !l.startsWith("Invitados adicionales"))
            .join("\n")
            .trim(),
        );
        if (lineaAdicionales) {
          const cuerpo = lineaAdicionales
            .replace(/^Invitados adicionales[^:]*:\s*/, "")
            .replace(/^\d+\s*—\s*/, "");
          const filas = cuerpo
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => parseGuestFromObservacionesText(s));
          if (filas.length > 0) setAdicionales(filas);
        }

        // Reanudable: precarga lo ya guardado; si no hay nada, abre tantas
        // filas como personas tenga la reserva (mínimo una).
        const expected = Math.max(data.numeroPersonas || 0, 1);
        if (data.guests && data.guests.length > 0) {
          // Compat: si vienen invitados marcados como menores (esquema viejo),
          // los movemos al contador y NO los listamos.
          const mayores = data.guests.filter((g) => !g.esMenor);
          const menores = data.guests.filter((g) => g.esMenor).length;
          setMenoresCount(data.menoresDe2 || menores);
          setGuests(
            (mayores.length > 0 ? mayores : [emptyGuest()]).map((g) =>
              mapGuestRow(g),
            ),
          );
        } else {
          setGuests(Array.from({ length: expected }, emptyGuest));
          setMenoresCount(data.menoresDe2 ?? 0);
        }
        setPageState("form");
      })
      .catch(() => setPageState("error"));
  }, [reference, embedded]);

  useEffect(() => {
    if (pageState === "success") {
      onCheckinComplete?.();
    }
  }, [pageState, onCheckinComplete]);

  const updateGuest = useCallback(
    (index: number, patch: Partial<GuestRow>) => {
      setGuests((prev) =>
        prev.map((g, i) => (i === index ? { ...g, ...patch } : g)),
      );
      setFormError(null);
      setSavedNote(null);
    },
    [],
  );

  const addGuest = () => {
    if (reservation?.guestListLocked) return;
    const cap = reservation?.numeroPersonas ?? 0;
    setGuests((prev) => {
      if (cap > 0 && prev.length >= cap) return prev;
      return [...prev, emptyGuest()];
    });
    setSavedNote(null);
  };

  const removeGuest = (index: number) => {
    if (reservation?.guestListLocked) return;
    setGuests((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
    setSavedNote(null);
  };

  const buildPayload = (action: "save" | "submit") => ({
    action,
    guests: guests
      .map((g) => ({
        nombreCompleto: g.nombreCompleto.trim(),
        cedula: (g.cedula ?? "").trim(),
        tipoDocumento: normalizeGuestDocumentType(g.tipoDocumento),
        email: (g.email ?? "").trim() || undefined,
        fechaNacimiento: (g.fechaNacimiento ?? "").trim() || undefined,
        telefono: (g.telefono ?? "").trim() || undefined,
      }))
      .filter((g) => g.nombreCompleto || g.cedula),
    menoresDe2: menoresCount,
    placas: placas.trim(),
    ...(reservation?.allowsPets
      ? { mascotas: Math.max(0, Math.floor(Number(mascotas) || 0)) }
      : {}),
    invitadosAdicionales: adicionales
      .map((g) => ({
        nombreCompleto: g.nombreCompleto.trim(),
        cedula: (g.cedula ?? "").trim(),
        tipoDocumento: normalizeGuestDocumentType(g.tipoDocumento),
        email: (g.email ?? "").trim() || undefined,
        fechaNacimiento: (g.fechaNacimiento ?? "").trim() || undefined,
        telefono: (g.telefono ?? "").trim() || undefined,
      }))
      .filter((g) => g.nombreCompleto || g.cedula),
    // Los invitados adicionales también se anexan a observaciones para que
    // queden visibles en el panel admin aunque el backend aún no persista
    // el campo dedicado.
    observaciones: (() => {
      const extras = adicionales
        .map((g) => ({
          nombre: g.nombreCompleto.trim(),
          cedula: (g.cedula ?? "").trim(),
          tipoDocumento: normalizeGuestDocumentType(g.tipoDocumento),
        }))
        .filter((g) => g.nombre || g.cedula);
      const extrasTexto =
        extras.length > 0
          ? `Invitados adicionales (sujeto a aprobación): ${extras.length} — ${extras
              .map((g) =>
                [
                  g.nombre,
                  g.cedula
                    ? formatGuestDocument(g.tipoDocumento, g.cedula)
                    : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              )
              .join(", ")}`
          : "";
      return [observaciones.trim(), extrasTexto].filter(Boolean).join("\n");
    })(),
    aceptaTratamientoDatos: aceptaDatos,
    needsEmpleada,
    needsTeam,
    serviciosNota: serviciosNota.trim(),
  });

  const handleSaveDraft = async () => {
    if (!reference) return;
    setIsSaving(true);
    setFormError(null);
    setSavedNote(null);
    try {
      const res = await fetch(
        `${CONVEX_SITE_URL}/api/checkin/${encodeURIComponent(reference)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("save")),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 410 && data?.error === "reservation_ended") {
        if (embedded) {
          setPageState("expired");
        } else {
          redirectToWebsiteAfterReservationEnded(embedded);
        }
        return;
      }
      if (res.status === 423 && data?.error === "guest_list_locked") {
        const lockHours =
          reservation?.guestListLockHours ??
          (reservation &&
          calendarNights(
            reservation.fechaEntrada,
            reservation.fechaSalida,
          ) === 1
            ? 12
            : 24);
        setFormError(
          `La lista de invitados ya no puede modificarse (bloqueada ${lockHours} horas antes de tu llegada). Si necesitas un cambio urgente, contáctanos por Soporte.`,
        );
        return;
      }
      if (!res.ok) {
        setFormError("No se pudo guardar tu avance. Intenta de nuevo.");
        return;
      }
      setSavedNote(
        "Avance guardado. Puedes cerrar y volver a este mismo link cuando quieras para completar el resto. 👌",
      );
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const validateForSubmit = (): string | null => {
    const guestListRequired = reservation?.requiresGuestList !== false;
    const expected = reservation?.numeroPersonas ?? 0;
    const filled = guests.filter(
      (g) => g.nombreCompleto.trim() || (g.cedula ?? "").trim(),
    );
    if (guestListRequired) {
      if (filled.length < 1) {
        return "Registra al menos al titular de la reserva con nombre y documento.";
      }
      if (expected > 0 && filled.length > expected) {
        return `Tu reserva está contratada para ${expected} personas y registraste ${filled.length}. Las personas extra van en "Invitados adicionales" (sujetas a aprobación y valor adicional).`;
      }
      for (let i = 0; i < filled.length; i++) {
        const g = filled[i];
        if (!g.nombreCompleto.trim()) {
          return `Falta el nombre completo del invitado #${i + 1}.`;
        }
        const docError = validateGuestDocument(g.tipoDocumento, g.cedula);
        if (docError) {
          return `Invitado #${i + 1}: ${docError}`;
        }
      }
    }
    if (!placas.trim()) {
      return 'Ingresa las placas de los vehículos (obligatorio). Si no llegas en carro, escribe "No aplica".';
    }
    if (pendingReceipts > 0) {
      return 'Tienes un comprobante de pago cargado pero SIN enviar. Dale "Enviar comprobante" primero, o quítalo si no lo vas a enviar.';
    }
    if (!aceptaDatos) {
      return "Debes aceptar el tratamiento de datos personales para enviar el check-in.";
    }
    return null;
  };

  const handleDownloadPdf = async () => {
    if (!reservation) return;
    setIsDownloading(true);
    setPdfError(null);
    try {
      const titulares = guests
        .map((g) => ({
          nombreCompleto: g.nombreCompleto.trim(),
          cedula: (g.cedula ?? "").trim(),
          tipoDocumento: normalizeGuestDocumentType(g.tipoDocumento),
        }))
        .filter((g) => g.nombreCompleto || g.cedula);
      const extras = adicionales
        .map((g) => ({
          nombreCompleto: g.nombreCompleto.trim()
            ? `${g.nombreCompleto.trim()} (ADICIONAL — sujeto a aprobación)`
            : "",
          cedula: (g.cedula ?? "").trim(),
          tipoDocumento: normalizeGuestDocumentType(g.tipoDocumento),
        }))
        .filter((g) => g.nombreCompleto || g.cedula);
      const result = await downloadCheckinGuestsPdf({
        propertyTitle: reservation.propertyTitle,
        propertyLocation: reservation.propertyLocation ?? undefined,
        guestName: reservation.nombreTitular,
        contractNumber: reservation.reference,
        checkInDate: formatDate(reservation.fechaEntrada),
        checkOutDate: formatDate(reservation.fechaSalida),
        guests: [...titulares, ...extras],
        minorsUnder2: menoresCount,
        vehiclePlates: placas.trim() || undefined,
        petsAllowed: reservation.allowsPets,
        petCount: mascotas,
        needsEmpleada,
        needsTeam,
        servicesNote: serviciosNota.trim() || undefined,
        checkinCompleted: true,
      });
      if (!result.ok) {
        setPdfError("No se pudo generar el PDF. Intenta de nuevo.");
        return;
      }
    } catch {
      setPdfError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference) return;
    const validationError = validateForSubmit();
    if (validationError) {
      setBlockMessage(validationError);
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    setSavedNote(null);
    try {
      const res = await fetch(
        `${CONVEX_SITE_URL}/api/checkin/${encodeURIComponent(reference)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("submit")),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        expected?: number;
        got?: number;
      };
      if (res.status === 410 && data?.error === "reservation_ended") {
        if (embedded) {
          setPageState("expired");
        } else {
          redirectToWebsiteAfterReservationEnded(embedded);
        }
        return;
      }
      if (res.status === 422 && data?.error === "count_mismatch") {
        setFormError(
          `Registraste ${data.got} personas y tu reserva es para ${data.expected}. Quita invitados de la lista principal o muévelos a "Invitados adicionales".`,
        );
        return;
      }
      if (res.status === 422 && data?.error === "missing_guests") {
        setFormError(
          "Registra al menos al titular de la reserva con nombre y cédula.",
        );
        return;
      }
      if (res.status === 423 && data?.error === "guest_list_locked") {
        const lockHours =
          reservation?.guestListLockHours ??
          (reservation &&
          calendarNights(
            reservation.fechaEntrada,
            reservation.fechaSalida,
          ) === 1
            ? 12
            : 24);
        setFormError(
          `La lista de invitados ya no puede modificarse (bloqueada ${lockHours} horas antes de tu llegada). Si necesitas un cambio urgente, contáctanos por Soporte.`,
        );
        return;
      }
      if (!res.ok) {
        setFormError("No se pudo enviar tu check-in. Intenta de nuevo.");
        return;
      }
      setPageState("success");
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div
        className={
          embedded
            ? "flex items-center justify-center py-16"
            : "flex min-h-screen items-center justify-center bg-gray-50"
        }
      >
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <StatusCard
        icon={<AlertCircle className="h-12 w-12 text-amber-500" />}
        title="Reserva finalizada"
        message="Tu estadía ya terminó y este enlace de check-in ya no está disponible."
        action={
          <Button asChild className="rounded-full">
            <a href={CHECKIN_EXPIRED_REDIRECT_URL}>Ir a FincasYa</a>
          </Button>
        }
      />
    );
  }

  if (pageState === "not_found") {
    return (
      <StatusCard
        icon={<AlertCircle className="h-12 w-12 text-red-500" />}
        title="Reserva no encontrada"
        message="No encontramos esta reserva. Verifica que el link sea el correcto o escríbele a tu asesor por WhatsApp."
      />
    );
  }

  if (pageState === "error") {
    return (
      <StatusCard
        icon={<AlertCircle className="h-12 w-12 text-red-500" />}
        title="Algo salió mal"
        message="Hubo un error al cargar tu check-in. Recarga la página o contacta a tu asesor."
      />
    );
  }

  if (pageState === "success") {
    if (embedded) {
      return (
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="mb-2 text-xl font-black text-gray-900">
            ¡Check-in completado! 🎉
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Recibimos tu lista de invitados
            {reservation?.reference ? ` (CR ${reservation.reference})` : ""}.
            Ya estás listo para ingresar a la finca en la fecha de tu reserva.
            ¡Buen viaje!
          </p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-8 text-center shadow-md">
          <div className="mb-4 flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="mb-2 text-xl font-black text-gray-900">
            ¡Check-in completado! 🎉
          </h2>
          <p className="text-sm leading-relaxed text-gray-500">
            Recibimos tu lista de invitados
            {reservation?.reference ? ` (CR ${reservation.reference})` : ""}.
            Ya puedes ingresar a la finca en la fecha de tu reserva. ¡Buen
            viaje!
          </p>
          <Button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="mt-6 h-12 w-full rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando
                PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Descargar mi PDF
              </>
            )}
          </Button>
          {pdfError && (
            <p className="mt-2 text-[11px] font-medium text-red-500">
              {pdfError}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
            Guárdalo y compártelo por WhatsApp con Fincas Ya para agilizar tu
            ingreso.
          </p>
        </div>
      </div>
    );
  }

  const expected = reservation?.numeroPersonas ?? 0;
  const filledGuestCount = guests.filter(
    (g) => g.nombreCompleto.trim() || (g.cedula ?? "").trim(),
  ).length;
  const precioTotal =
    paymentPortal?.precioTotal ?? reservation?.precioTotal ?? 0;
  const pagoTotal = paymentPortal?.pagoTotal ?? reservation?.pagoTotal ?? 0;
  const pagoPendiente =
    paymentPortal?.pagoPendiente ?? reservation?.pagoPendiente ?? 0;
  const pagoCompleto =
    paymentPortal?.pagoCompleto === true ||
    reservation?.pagoCompleto === true ||
    (precioTotal > 0 && pagoPendiente <= 0 && pagoTotal >= precioTotal);
  const paymentAccounts = paymentPortal?.bankAccounts ?? [];
  const paymentBreakdown = paymentPortal?.breakdown ?? [];
  const guestListRequired = reservation?.requiresGuestList !== false;
  const stayNights = reservation
    ? calendarNights(reservation.fechaEntrada, reservation.fechaSalida)
    : 1;
  const guestListLockHours =
    reservation?.guestListLockHours ?? (stayNights === 1 ? 12 : 24);
  const guestListLocked = reservation?.guestListLocked === true;

  return (
    <div
      className={
        embedded
          ? "bg-linear-to-b from-emerald-50 to-white px-0 py-2"
          : "min-h-screen bg-linear-to-b from-emerald-50 to-white px-4 py-10"
      }
    >
      <div className={embedded ? "mx-auto w-full max-w-lg" : "mx-auto max-w-lg"}>
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white shadow-lg">
            F
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-700">
            Check-in · Fincas Ya
          </p>
          {reservation?.reference ? (
            <>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900">
                CR {reservation.reference}
              </h1>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                Número de identificación de tu reserva
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              Registra tu lista de invitados para tu ingreso
            </p>
          )}
        </div>

        {reservation && (
          <div className="mb-6 overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 to-emerald-500 p-5 text-center shadow-lg">
            {reservation.nombreTitular ? (
              <p className="text-2xl font-black tracking-tight text-white">
                ¡Hola,{" "}
                {reservation.nombreTitular.trim().split(/\s+/)[0]}! 👋
              </p>
            ) : (
              <p className="text-2xl font-black text-white">¡Bienvenido! 👋</p>
            )}
            <p className="mt-1.5 text-sm font-semibold text-emerald-100">
              Ya casi es tu momento de descansar 🌅
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-emerald-50/90">
              {guestListRequired
                ? "Solo falta un último paso. Registra a quienes te acompañan y prepárate para disfrutar en "
                : "Confirma los datos de tu llegada y prepárate para disfrutar en "}
              {reservation.propertyLocation ?? "tu finca"}. En FincasYa
              cuidamos cada detalle para que tú solo crees recuerdos. 💚
            </p>
          </div>
        )}

        {reservation && !reservation.checkinCompleted && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5">
            <Save className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-[13px] font-bold text-blue-900">
                No tienes que hacerlo de una sola vez
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-blue-800">
                Puedes guardar tu avance en cualquier momento y volver a este
                mismo link para continuar cuando quieras.
              </p>
            </div>
          </div>
        )}

        {reservation && (
          <div className="mb-6 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="text-center">
              <p className="text-base font-bold text-gray-800">
                {reservation.propertyTitle}
              </p>
              {reservation.propertyLocation && (
                <p className="mt-0.5 flex items-center justify-center gap-1 text-xs font-medium text-gray-500">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  {reservation.propertyLocation}
                </p>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Llegada
                </p>
                <p className="mt-1 text-sm font-bold leading-snug text-gray-800">
                  {formatDate(reservation.fechaEntrada)}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {displayTime(reservation.horaEntrada, reservation.fechaEntrada)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Salida
                </p>
                <p className="mt-1 text-sm font-bold leading-snug text-gray-800">
                  {formatDate(reservation.fechaSalida)}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {displayTime(reservation.horaSalida, reservation.fechaSalida)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-600">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                {expected} persona{expected === 1 ? "" : "s"} ·{" "}
                {calendarNights(
                  reservation.fechaEntrada,
                  reservation.fechaSalida,
                )}{" "}
                noche
                {calendarNights(
                  reservation.fechaEntrada,
                  reservation.fechaSalida,
                ) === 1
                  ? ""
                  : "s"}
              </span>
            </div>
            {reservation.checkinCompleted && (
              <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {guestListLocked
                    ? "Check-in completado. La lista de invitados ya está cerrada para tu llegada."
                    : "Ya completaste tu check-in. Puedes editar la lista si lo necesitas."}
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800 disabled:opacity-60"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" /> Descargar el PDF de
                      mi check-in
                    </>
                  )}
                </button>
                {pdfError && (
                  <p className="mt-1 text-[11px] font-medium text-red-500">
                    {pdfError}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-amber-900">
                    Muy importante para tu ingreso
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    <strong>Diligencia el Check-in</strong> y envía esta
                    información mínimo{" "}
                    <strong>36 horas antes de tu llegada</strong>. Es muy
                    importante que hagas este proceso completo para poder dar
                    gestión de tu ingreso a la propiedad.
                  </p>
                </div>
              </div>
            </div>

            {!pagoCompleto && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black uppercase text-red-900">
                      Pago obligatorio al 100%
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-red-800">
                      El saldo pendiente podrá ser cancelado antes de tu llegada
                      o al momento de llegar a la propiedad. Sin embargo, para
                      iniciar la entrega formal y disfrutar de las instalaciones,
                      la reserva deberá estar pagada al{" "}
                      <strong>100%</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <CheckinPaymentSection
              precioTotal={precioTotal}
              pagoTotal={pagoTotal}
              pagoPendiente={pagoPendiente}
              pagoCompleto={pagoCompleto}
              breakdown={paymentBreakdown}
              bankAccounts={paymentAccounts}
              reference={reference}
              boldLink={paymentPortal?.boldLink}
              boldSurcharge={paymentPortal?.boldSurcharge}
              onPendingReceiptsChange={setPendingReceipts}
            />

            {pagoCompleto && precioTotal > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Tu reserva está al día en pagos. ¡Nos vemos pronto!
                </div>
              )}

            {(reservation.checkinUbicacionUrl?.trim() ||
              reservation.checkinWazeUrl?.trim() ||
              reservation.checkinIndicacionesLlegada?.trim() ||
              reservation.checkinUbicacionImageUrl?.trim() ||
              (reservation.checkinUbicacionImageUrls?.length ?? 0) > 0) ? (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-black text-blue-950">
                        Cómo llegar a la finca
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-blue-800/80">
                        Información exclusiva para tu ingreso. Revísala antes de
                        salir en camino.
                      </p>
                    </div>

                    {reservation.checkinIndicacionesLlegada?.trim() ? (
                      <div className="rounded-xl border border-blue-100 bg-white/70 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
                          Indicaciones
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-blue-950">
                          {reservation.checkinIndicacionesLlegada.trim()}
                        </p>
                      </div>
                    ) : null}

                    {(() => {
                      const imgs = (
                        reservation.checkinUbicacionImageUrls?.length
                          ? reservation.checkinUbicacionImageUrls
                          : reservation.checkinUbicacionImageUrl
                            ? [reservation.checkinUbicacionImageUrl]
                            : []
                      )
                        .map((u) => u?.trim())
                        .filter((u): u is string => !!u);
                      if (!imgs.length) return null;
                      return (
                        <div className="space-y-2">
                          {imgs.map((src, i) => (
                            <div
                              key={i}
                              className="overflow-hidden rounded-xl border border-blue-100 bg-white/70 p-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt={`Referencia visual de llegada ${i + 1}`}
                                className="mx-auto max-h-64 w-full rounded-lg object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {(reservation.checkinUbicacionUrl?.trim() ||
                      reservation.checkinWazeUrl?.trim()) ? (
                      <div className="flex flex-wrap gap-2">
                        {reservation.checkinUbicacionUrl?.trim() ? (
                          <a
                            href={reservation.checkinUbicacionUrl.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir en Google Maps
                          </a>
                        ) : null}
                        {reservation.checkinWazeUrl?.trim() ? (
                          <a
                            href={reservation.checkinWazeUrl.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir en Waze
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {reservation.checkinRecomendaciones?.trim() ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-black text-emerald-950">
                        Recomendaciones de la finca
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80">
                        Ten en cuenta estas indicaciones para disfrutar tu
                        estadía y cuidar la propiedad.
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-white/70 px-3 py-3">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-emerald-950">
                        {reservation.checkinRecomendaciones.trim()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          {guestListRequired ? (
            <Collapsible open={guestListOpen} onOpenChange={setGuestListOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="mb-4 flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-black text-gray-900">
                      Lista de invitados
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {guestListOpen
                        ? "Toca para ocultar el listado"
                        : "Toca aquí para inscribir a tus invitados"}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">
                      {filledGuestCount}
                      {expected > 0 ? ` de ${expected}` : ""}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        guestListOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
          {guestListLocked ? (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Lista de invitados bloqueada
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  Por seguridad del ingreso, la lista ya no puede editarse (
                  {guestListLockHours} horas antes de tu llegada). Solo quienes
                  aparecen aquí podrán ingresar. Si necesitas un cambio urgente,
                  escríbenos por Soporte.
                </p>
              </div>
            </div>
          ) : null}
          <p className="mb-5 text-xs text-gray-500">
            Incluye a cada persona mayor de 2 años que sí va a ingresar, con
            nombre completo y documento de identidad. Para menores usa tarjeta de
            identidad o registro civil. Si alguien del grupo ya no asiste, usa
            &ldquo;Quitar&rdquo; en su tarjeta. Los menores de 2 años se indican
            aparte (no van en la lista).
          </p>

          <div className="space-y-4">
            {guests.map((guest, index) => {
              return (
                <div
                  key={index}
                  className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      {index === 0
                        ? "Invitado #1 · Titular de la reserva"
                        : `Invitado #${index + 1}`}
                    </span>
                    {guests.length > 1 && !guestListLocked && (
                      <button
                        type="button"
                        onClick={() => removeGuest(index)}
                        aria-label={`Quitar invitado #${index + 1}`}
                        className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Quitar
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                        Nombre completo
                      </label>
                      <Input
                        placeholder="Nombre completo"
                        value={guest.nombreCompleto}
                        disabled={guestListLocked}
                        onChange={(e) =>
                          updateGuest(index, { nombreCompleto: e.target.value })
                        }
                        className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                      />
                    </div>
                    <GuestDocumentFields
                      tipoDocumento={guest.tipoDocumento}
                      numeroDocumento={guest.cedula}
                      disabled={guestListLocked}
                      onTipoChange={(tipoDocumento) =>
                        updateGuest(index, { tipoDocumento })
                      }
                      onNumeroChange={(cedula) => updateGuest(index, { cedula })}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                          Correo electrónico{" "}
                          <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <Input
                          type="email"
                          placeholder="correo@ejemplo.com"
                          value={guest.email ?? ""}
                          disabled={guestListLocked}
                          onChange={(e) =>
                            updateGuest(index, { email: e.target.value })
                          }
                          className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                          Fecha de nacimiento{" "}
                          <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <Input
                          type="date"
                          value={guest.fechaNacimiento ?? ""}
                          disabled={guestListLocked}
                          onChange={(e) =>
                            updateGuest(index, {
                              fechaNacimiento: e.target.value,
                            })
                          }
                          className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                        Teléfono{" "}
                        <span className="text-gray-400 font-normal">(opcional)</span>
                      </label>
                      <Input
                        type="tel"
                        placeholder="3001234567"
                        value={guest.telefono ?? ""}
                        disabled={guestListLocked}
                        onChange={(e) =>
                          updateGuest(index, { telefono: e.target.value })
                        }
                        className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {expected > 0 &&
          filledGuestCount > 0 &&
          filledGuestCount < expected ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
              <p className="text-xs font-bold text-blue-900">
                Registraste {filledGuestCount} de {expected} personas contratadas
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800">
                Si alguien ya no viaja, puedes enviar el check-in solo con quienes
                sí ingresarán.
              </p>
            </div>
          ) : null}

          {expected > 0 && guests.length >= expected ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-xs font-bold text-amber-900">
                Llegaste al cupo contratado ({expected} persona
                {expected === 1 ? "" : "s"}).
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                ¿Vienen más personas? Regístralas abajo en{" "}
                <strong>&ldquo;Invitados adicionales&rdquo;</strong> — sujetas a
                aprobación y valor adicional.
              </p>
            </div>
          ) : (
            !guestListLocked && (
            <button
              type="button"
              onClick={addGuest}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50"
            >
              <Plus className="h-4 w-4" /> Agregar invitado
            </button>
            )
          )}

          {/* Menores de 2 años: contador aparte, NO van en el listado. */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                ¿Cuántos menores de 2 años?
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Restar menor"
                onClick={() => setMenoresCount((n) => Math.max(0, n - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-bold text-gray-800">
                {menoresCount}
              </span>
              <button
                type="button"
                aria-label="Sumar menor"
                onClick={() => setMenoresCount((n) => n + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs leading-relaxed text-emerald-900">
              Esta finca <strong>no requiere listado de invitados</strong>.
              Completa placas, mascotas y el resto de datos para finalizar tu
              check-in.
            </div>
          )}

          {/* Placas de vehículos */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <h2 className="text-base font-black text-gray-900">
              Placas de vehículos{" "}
              <span className="text-xs font-semibold text-red-500">
                (Obligatorio)
              </span>
            </h2>
            <p className="mt-1 mb-3 text-xs text-gray-500">
              Si llegas en carro, sepáralas por comas. Si no llegas en carro,
              escribe &ldquo;No aplica&rdquo;.
            </p>
            <Input
              placeholder="Ej: ABC123, XYZ789"
              value={placas}
              onChange={(e) => setPlacas(e.target.value)}
              className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20"
            />
          </div>

          {reservation?.allowsPets && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <h3 className="text-sm font-black text-gray-900">
                🐾 ¿Llevas mascotas?
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Si confirmaste mascotas en tu reserva final, por favor indícalas.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Restar mascota"
                  onClick={() => setMascotas((n) => Math.max(0, n - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="min-w-8 text-center text-lg font-bold text-gray-900">
                  {mascotas}
                </span>
                <button
                  type="button"
                  aria-label="Sumar mascota"
                  onClick={() => setMascotas((n) => n + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  +
                </button>
                <span className="text-xs text-gray-500">
                  {mascotas === 0
                    ? "No van mascotas"
                    : `${mascotas} mascota${mascotas === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className="mt-3 rounded-xl bg-emerald-100/70 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-900">
                <p className="font-bold">🐾 Condiciones para mascotas</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    Depósito reembolsable de <strong>$100.000</strong> por cada
                    mascota.
                  </li>
                  <li>
                    Desde la <strong>3.ª mascota</strong>: <strong>$30.000</strong>{" "}
                    de ingreso por cada una.
                  </li>
                  <li>
                    Con <strong>3 o más mascotas</strong>: aseo único de{" "}
                    <strong>$70.000</strong>.
                  </li>
                  <li>
                    No piscina · no muebles/camas · evita orina y pelaje en
                    interiores.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {guestListRequired ? (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-base font-black text-gray-900">
                ¿Tendrás invitados adicionales a lo contratado?
              </h2>
              {adicionales.length > 0 && (
                <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  {adicionales.length} adicional
                  {adicionales.length === 1 ? "" : "es"}
                </span>
              )}
            </div>
            <p className="mb-3 text-xs leading-relaxed text-gray-500">
              Regístralos con nombre y documento para validar si es posible el
              ingreso.{" "}
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                Sujeto a aprobación y valor adicional
              </span>
            </p>

            <div className="space-y-4">
              {adicionales.map((guest, index) => {
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-amber-100 bg-amber-50/40 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800">
                        Adicional #{index + 1} · Sujeto a aprobación
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAdicionales((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                        aria-label={`Quitar adicional #${index + 1}`}
                        className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Quitar
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                          Nombre completo
                        </label>
                        <Input
                          placeholder="Nombre completo"
                          value={guest.nombreCompleto}
                          onChange={(e) =>
                            setAdicionales((prev) =>
                              prev.map((g, i) =>
                                i === index
                                  ? { ...g, nombreCompleto: e.target.value }
                                  : g,
                              ),
                            )
                          }
                          className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20"
                        />
                      </div>
                      <GuestDocumentFields
                        tipoDocumento={guest.tipoDocumento}
                        numeroDocumento={guest.cedula}
                        onTipoChange={(tipoDocumento) =>
                          setAdicionales((prev) =>
                            prev.map((g, i) =>
                              i === index ? { ...g, tipoDocumento } : g,
                            ),
                          )
                        }
                        onNumeroChange={(cedula) =>
                          setAdicionales((prev) =>
                            prev.map((g, i) =>
                              i === index ? { ...g, cedula } : g,
                            ),
                          )
                        }
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                            Correo electrónico{" "}
                            <span className="text-gray-400 font-normal">(opcional)</span>
                          </label>
                          <Input
                            type="email"
                            placeholder="correo@ejemplo.com"
                            value={guest.email ?? ""}
                            onChange={(e) =>
                              setAdicionales((prev) =>
                                prev.map((g, i) =>
                                  i === index ? { ...g, email: e.target.value } : g,
                                ),
                              )
                            }
                            className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                            Fecha de nacimiento{" "}
                            <span className="text-gray-400 font-normal">(opcional)</span>
                          </label>
                          <Input
                            type="date"
                            value={guest.fechaNacimiento ?? ""}
                            onChange={(e) =>
                              setAdicionales((prev) =>
                                prev.map((g, i) =>
                                  i === index
                                    ? { ...g, fechaNacimiento: e.target.value }
                                    : g,
                                ),
                              )
                            }
                            className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                          Teléfono{" "}
                          <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <Input
                          type="tel"
                          placeholder="3001234567"
                          value={guest.telefono ?? ""}
                          onChange={(e) =>
                            setAdicionales((prev) =>
                              prev.map((g, i) =>
                                i === index ? { ...g, telefono: e.target.value } : g,
                              ),
                            )
                          }
                          className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setAdicionales((prev) => [...prev, emptyGuest()])}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 py-3 text-sm font-bold text-amber-700 hover:bg-amber-50"
            >
              <Plus className="h-4 w-4" /> Agregar invitado adicional
            </button>
          </div>
          ) : null}

          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="mb-1 text-base font-black text-gray-900">
              ¿Necesitas empleada de servicio?
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">
              Confírmala mínimo <strong>3 días antes</strong> de tu llegada. No
              aplica para las casas que cuentan con personal de servicio
              obligatorio o incluido.
            </p>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700">
                <Checkbox
                  checked={needsEmpleada}
                  onCheckedChange={(c) => setNeedsEmpleada(c === true)}
                />
                Necesito empleada de servicio
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700">
                <Checkbox
                  checked={needsTeam}
                  onCheckedChange={(c) => setNeedsTeam(c === true)}
                />
                Necesito más de 2 personas de servicio
              </label>
              {(needsEmpleada || needsTeam) && (
                <>
                  <Input
                    placeholder="Detalle: cuántas personas, qué días, horario…"
                    value={serviciosNota}
                    onChange={(e) => setServiciosNota(e.target.value)}
                    className="h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20"
                  />
                  <p className="text-[11px] font-medium text-amber-600">
                    Estos servicios pueden tener un costo adicional. Tu asesor te
                    confirmará el valor y se reflejará en tu saldo.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Observaciones / solicitudes especiales */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="mb-1 text-base font-black text-gray-900">
              ¿Tienes alguna solicitud o novedad?
            </h2>
            <p className="mb-3 text-xs text-gray-500">
              Cuéntanos cualquier detalle o cambio (opcional). Si el grupo cambió
              o ya no serán todos, escríbelo aquí.
            </p>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Ej: ya no seremos todos, seremos 6; llegamos de noche; necesitamos cuna…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          {/* Consentimiento tratamiento de datos (Ley 1581 / habeas data) */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-gray-600">
              <Checkbox
                checked={aceptaDatos}
                onCheckedChange={(c) => setAceptaDatos(c === true)}
                className="mt-0.5"
              />
              <span>
                Autorizo a FincasYa el tratamiento de los datos personales aquí
                registrados (incluidas las cédulas) con la finalidad exclusiva de
                gestionar el ingreso a la finca, conforme a la Ley 1581 de 2012
                de protección de datos personales.
              </span>
            </label>
          </div>

          {formError && (
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          {savedNote && (
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {savedNote}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Button
              type="submit"
              disabled={isSubmitting || isSaving}
              className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                </>
              ) : (
                "Finalizar y enviar check-in ✅"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting}
              className="h-12 w-full rounded-xl border-emerald-200 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Guardar avance y continuar
                  después
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Ten en cuenta
            </p>
            <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-gray-400">
              <li>
                El no envío oportuno de esta información puede retrasar tu
                ingreso a la propiedad.
              </li>
              <li>
                Puedes registrar menos personas que las contratadas si alguien ya
                no asiste; solo quienes estén en la lista podrán ingresar.
              </li>
              <li>
                Puedes guardar tu avance y volver a este mismo link cuando
                quieras; tu lista se puede modificar hasta{" "}
                {guestListLockHours} horas antes de tu llegada, sin superar el
                cupo contratado.
              </li>
              <li>
                Tus datos están protegidos; los solicitamos por exigencia de las
                autoridades de turismo para el control de invitados.
              </li>
            </ul>
          </div>

          {/* ── Mensaje de cierre ─────────────────────────────── */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-red-200 bg-red-50">
            <div className="flex items-start gap-3 px-5 py-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-red-900">
                  Antes de cerrar, recuerda:
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-red-800">
                  Para poder ingresar a la finca debes haber realizado el{" "}
                  <strong className="font-bold">
                    pago del 100% de la reserva
                  </strong>{" "}
                  y contar con la{" "}
                  <strong className="font-bold">
                    validación correspondiente
                  </strong>{" "}
                  por parte de la administración.
                </p>
              </div>
            </div>
            <div className="border-t border-red-100 px-5 py-3">
              <button
                type="button"
                onClick={() =>
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }
                className="text-xs font-bold text-red-700 underline underline-offset-2 hover:text-red-900"
              >
                ↑ Revisar mi información desde el inicio
              </button>
            </div>
          </div>
        </form>
      </div>

      {blockMessage && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setBlockMessage(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900">
                Antes de finalizar
              </h3>
              <p className="text-sm leading-relaxed text-gray-600">
                {blockMessage}
              </p>
              <button
                type="button"
                onClick={() => setBlockMessage(null)}
                className="mt-2 h-12 w-full rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700"
              >
                Entendido, lo corrijo
              </button>
            </div>
          </div>
        </div>
      )}

      {!embedded ? <SupportFab context="check-in" /> : null}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-8 text-center shadow-md">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h2 className="mb-2 text-xl font-black text-gray-900">{title}</h2>
        <p className="text-sm leading-relaxed text-gray-500">{message}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
