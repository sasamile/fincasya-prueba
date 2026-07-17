"use client";

/**
 * Portal público del link de venta (/venta/[token]) — wizard de 6 pasos.
 * Réplica del portal de producción (FincasYaWeb) adaptada a prueba: los datos
 * llegan por `useQuery(getPublicByToken)` (reactivo, sin polling).
 *
 * Pasos: Resumen · Mis datos · En revisión · Contrato · Confirmación · Check-in.
 */
import { useState, useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Home,
  Lock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StepResumen } from "./step-resumen";
import { StepDatosContrato } from "./step-datos-contrato";
import { StepEnRevision } from "./step-en-revision";
import { StepContrato } from "./step-contrato";
import { StepCr } from "./step-cr";
import { StepCheckin } from "./step-checkin";
import { VentaPropertyBanner } from "./venta-property-banner";
import {
  clearVentaDraftAll,
  loadVentaDraft,
  saveVentaDraft,
} from "../utils/venta-draft-storage";
import { syncVentaDraftToServer } from "../utils/venta-server-draft";

export type SaleLinkPublicData = {
  token: string;
  contractCode?: string;
  status: "active" | "completed" | "cancelled";
  clientStep: number;
  property: {
    id: string;
    title: string;
    location: string;
    code?: string;
    images: string[];
    maxGuests: number;
  } | null;
  checkIn: number;
  checkOut: number;
  nights: number;
  guests: number;
  checkInTime?: string;
  checkOutTime?: string;
  totalValue: number;
  rentalValue: number;
  depositAmount: number;
  cleaningFee: number;
  petDeposit?: number;
  petSurcharge?: number;
  petCount?: number;
  /** Abono configurado por el asesor (fallback: 50% del total). */
  advancePaymentAmount?: number;
  boldPaymentUrl?: string;
  boldPaymentAmount?: number;
  boldSurchargePercent?: number;
  boldPaymentStatus?: string;
  bankAccounts: Array<{
    id: string;
    bankName: string;
    accountType: string;
    accountNumber: string;
    ownerName: string;
    imageUrls?: string[];
    qrOnly?: boolean;
    brebKey?: boolean;
  }>;
  selectedBankAccountIds?: string[];
  clientDataFilled: boolean;
  clientName?: string;
  clientData?: {
    nombre: string;
    cedula: string;
    email: string;
    telefono: string;
    telefonoRespaldo?: string;
    direccion: string;
    ciudad?: string;
    fechaNacimiento?: string;
    cedulaPhotoUrl?: string;
    cedulaPhotoFileName?: string;
    cedulaPhotoMimeType?: string;
  };
  clientPortalUiStep?: number;
  clientDraftPhase?: "datos" | "preview" | "pago";
  clientDraftPaymentAmount?: number;
  /** Veredicto de IA ya guardado en el link (evita revalidar en cada refresh). */
  cedulaCheck?: {
    allow: boolean;
    photoUrl: string;
    number?: string;
    reason?: string;
  };
  paymentProofSubmitted: boolean;
  paymentProofFileName?: string;
  paymentProofSubmittedAt?: number;
  paymentProofAmount?: number;
  paymentProofs?: Array<{
    fileName?: string;
    mimeType?: string;
    amount?: number;
    submittedAt: number;
  }>;
  paymentValidated: boolean;
  contractUrl?: string;
  signedContractSubmitted: boolean;
  crUrl?: string;
  bookingReference?: string;
  checkinCompleted?: boolean;
  checkinGuests?: Array<{
    nombreCompleto: string;
    cedula?: string;
    tipoDocumento?: string;
    esMenor?: boolean;
  }>;
  checkinClientPaymentProofUploadEnabled?: boolean;
  checkinGuestListUnlocked?: boolean;
  checkinOwnerShareGuestList?: boolean;
};

const STEPS = [
  { id: 1, label: "Resumen", icon: Home },
  { id: 2, label: "Mis datos", icon: Users },
  { id: 3, label: "En revisión", icon: Lock },
  { id: 4, label: "Contrato", icon: FileText },
  { id: 5, label: "Confirmación", icon: CheckCircle2 },
  { id: 6, label: "Check-in", icon: Users },
];

interface Props {
  token: string;
  validatedParam?: string;
  boldReturnParam?: string;
}

export function VentaPageContent({
  token,
  validatedParam,
  boldReturnParam,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const raw = useQuery(api.saleLinks.getPublicByToken, { token });
  const syncBold = useAction(api.saleLinks.syncBoldPaymentStatus);
  const data = (raw ?? null) as SaleLinkPublicData | null;
  const loading = raw === undefined;

  /** Paso 2 (mis datos) es solo UI hasta enviar el comprobante; el servidor sigue en 1. */
  const [uiStep, setUiStep] = useState<number | null>(null);
  /** Permite ver pasos anteriores completados sin cambiar el avance real. */
  const [viewStep, setViewStep] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Con `useQuery` los datos son reactivos; refrescar es un no-op.
  const refresh = () => {};

  // Restaura el paso de UI a partir del borrador + estado del servidor.
  useEffect(() => {
    if (!data) return;
    if (data.paymentValidated || data.clientStep >= 4) {
      void clearVentaDraftAll(token);
      return;
    }
    const draft = loadVentaDraft(token);
    const serverUiStep =
      data.clientPortalUiStep ??
      (data.clientDataFilled && data.clientStep < 3 ? 2 : data.clientStep);
    const bestUiStep = Math.max(
      data.clientStep,
      serverUiStep,
      draft?.uiStep ?? 1,
    );
    if (bestUiStep > data.clientStep) {
      setUiStep((prev) => Math.max(prev ?? 1, bestUiStep));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data?.clientStep, data?.clientPortalUiStep, data?.paymentValidated]);

  useEffect(() => {
    if (!data) return;
    const capped = Math.min(uiStep ?? data.clientStep, 6);
    if (viewStep !== null && viewStep > capped) {
      setViewStep(null);
    }
  }, [data, uiStep, viewStep]);

  // Cuando el servidor avanza (p. ej. tras validar pago), seguir su paso.
  useEffect(() => {
    if (!data) return;
    const portalStep = Math.min(data.clientStep, 6);
    if (data.paymentValidated || data.clientStep >= 4) {
      setUiStep(portalStep);
      setViewStep(null);
      void clearVentaDraftAll(token);
      return;
    }
    if (data.clientStep >= 3 || data.paymentProofSubmitted) {
      setUiStep((prev) => Math.max(prev ?? 1, portalStep));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.clientStep, data?.paymentProofSubmitted, data?.paymentValidated, token]);

  useEffect(() => {
    if (validatedParam === "1" && data?.paymentValidated) {
      toast.success("¡Pago validado! Ya puedes continuar.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedParam, data?.paymentValidated]);

  // Al volver de Bold (?bold=return), consultamos el estado del link por API.
  const boldSyncTried = useRef(false);
  useEffect(() => {
    if (boldSyncTried.current) return;
    if (!data?.boldPaymentUrl || data.paymentValidated) return;
    if (boldReturnParam !== "return" && boldReturnParam !== "1") return;
    boldSyncTried.current = true;
    void (async () => {
      try {
        const res = await syncBold({ token, checkedBy: "cliente-retorno" });
        if (res.paid) {
          if (res.awaitingClientData) {
            toast.success(
              "Pago Bold confirmado. Completa tus datos en el portal para continuar.",
            );
          } else {
            toast.success("¡Pago Bold confirmado!");
          }
        } else if (res.ok) {
          toast.message(
            `Bold aún no confirma el pago (estado: ${res.status ?? "pendiente"}). Si ya pagaste, espera un momento y pulsa “Ya pagué”.`,
          );
        } else {
          toast.error(res.error ?? "No se pudo consultar Bold");
        }
      } catch {
        toast.error("No se pudo verificar el pago Bold");
      }
    })();
  }, [
    boldReturnParam,
    data?.boldPaymentUrl,
    data?.paymentValidated,
    syncBold,
    token,
  ]);

  if (!mounted || loading) {
    return (
      <div className="landing min-h-dvh bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
            <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          <div className="aspect-video animate-pulse rounded-2xl bg-muted sm:max-h-52" />
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="landing flex min-h-dvh flex-col bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dark-logo.svg" alt="FincasYa" className="h-8 w-auto" />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-muted">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Link no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Este enlace no existe o fue eliminado. Escríbele a tu asesor de
            FincasYa.
          </p>
        </main>
      </div>
    );
  }

  const serverStep = uiStep ?? data.clientStep;
  /** Pasos 7–8 son solo admin; el cliente ve el check-in (6) como final. */
  const maxStep = Math.min(serverStep, 6);
  const activeStep = Math.min(viewStep ?? maxStep, 6);
  const isReviewingPastStep = viewStep !== null && viewStep < maxStep;

  return (
    <div className="landing min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dark-logo.svg" alt="FincasYa" className="h-8 w-auto" />
        </div>
      </header>

      <main
        className={`mx-auto px-4 py-8 ${activeStep === 6 ? "max-w-lg" : "max-w-2xl"}`}
      >
        {data.property ? (
          <div className="mb-8">
            <VentaPropertyBanner property={data.property} />
          </div>
        ) : null}

        <div className="mb-8">
          <VentaStepper
            steps={STEPS}
            maxStep={maxStep}
            activeStep={activeStep}
            onStepClick={(stepId) => {
              if (stepId <= maxStep) setViewStep(stepId);
            }}
          />
        </div>

        {isReviewingPastStep ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Viendo un paso anterior (solo lectura).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewStep(null)}
            >
              Volver al actual
            </Button>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeStep === 1 && (
              <StepResumen
                data={data}
                readOnly={maxStep > 1}
                onContinue={() => {
                  const draft = loadVentaDraft(token);
                  const phase = draft?.phase ?? data.clientDraftPhase ?? "datos";
                  saveVentaDraft(token, {
                    nombre: draft?.nombre ?? data.clientData?.nombre ?? "",
                    cedula: draft?.cedula ?? data.clientData?.cedula ?? "",
                    email: draft?.email ?? data.clientData?.email ?? "",
                    telefono: draft?.telefono ?? data.clientData?.telefono ?? "",
                    telefonoRespaldo:
                      draft?.telefonoRespaldo ??
                      data.clientData?.telefonoRespaldo ??
                      "",
                    direccion:
                      draft?.direccion ?? data.clientData?.direccion ?? "",
                    ciudad: draft?.ciudad ?? data.clientData?.ciudad ?? "",
                    fechaNacimiento:
                      draft?.fechaNacimiento ??
                      data.clientData?.fechaNacimiento ??
                      "",
                    paymentAmount:
                      draft?.paymentAmount ??
                      data.clientDraftPaymentAmount ??
                      data.advancePaymentAmount ??
                      Math.round(data.totalValue / 2),
                    phase,
                    uiStep: 2,
                  });
                  void syncVentaDraftToServer(token, {
                    clientPortalUiStep: 2,
                    clientDraftPhase: phase,
                    nombre: draft?.nombre ?? data.clientData?.nombre,
                    cedula: draft?.cedula ?? data.clientData?.cedula,
                    email: draft?.email ?? data.clientData?.email,
                    telefono: draft?.telefono ?? data.clientData?.telefono,
                    telefonoRespaldo:
                      draft?.telefonoRespaldo ??
                      data.clientData?.telefonoRespaldo,
                    direccion: draft?.direccion ?? data.clientData?.direccion,
                    ciudad: draft?.ciudad ?? data.clientData?.ciudad,
                    fechaNacimiento:
                      draft?.fechaNacimiento ?? data.clientData?.fechaNacimiento,
                    paymentAmount:
                      draft?.paymentAmount ??
                      data.clientDraftPaymentAmount ??
                      data.advancePaymentAmount ??
                      Math.round(data.totalValue / 2),
                  });
                  setUiStep(2);
                  setViewStep(null);
                }}
              />
            )}
            {activeStep === 2 && (
              <StepDatosContrato
                data={data}
                readOnly={data.paymentValidated || data.clientStep >= 4}
                onSubmitted={() => {
                  setUiStep(3);
                  setViewStep(null);
                  refresh();
                }}
                onAmended={refresh}
              />
            )}
            {activeStep === 3 && (
              <StepEnRevision
                data={data}
                onPolled={refresh}
                onViewStep={(stepId) => setViewStep(stepId)}
              />
            )}
            {activeStep === 4 && <StepContrato data={data} onSubmitted={refresh} />}
            {activeStep === 5 && <StepCr data={data} onSubmitted={refresh} />}
            {activeStep === 6 && (
              <StepCheckin data={data} onSubmitted={refresh} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper UI
// ---------------------------------------------------------------------------

interface StepperStep {
  id: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function VentaStepper({
  steps,
  maxStep,
  activeStep,
  onStepClick,
}: {
  steps: StepperStep[];
  maxStep: number;
  activeStep: number;
  onStepClick: (stepId: number) => void;
}) {
  return (
    <nav aria-label="Progreso de la reserva" className="w-full">
      <ol className="flex items-center gap-1 sm:gap-1.5">
        {steps.map((step, index) => {
          const isDone = maxStep > step.id;
          const isActive = activeStep === step.id;
          const isReachable = step.id <= maxStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => isReachable && onStepClick(step.id)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.label}${isDone ? ", completado" : isActive ? ", actual" : ""}`}
                className={`flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "bg-muted/50 text-muted-foreground"
                } ${isReachable ? "cursor-pointer" : "cursor-default opacity-60"}`}
              >
                <span className="sm:hidden">{step.id}</span>
                <span className="hidden truncate px-1 sm:inline">{step.label}</span>
              </button>
              {!isLast ? (
                <div
                  className={`h-px w-2 shrink-0 sm:w-3 ${
                    maxStep > step.id ? "bg-foreground/25" : "bg-border"
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 text-center text-xs text-muted-foreground sm:hidden">
        {steps.find((s) => s.id === activeStep)?.label}
      </p>
    </nav>
  );
}
