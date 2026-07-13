"use client";

/**
 * Portal público del link de venta (/venta/[token]) — wizard de 6 pasos.
 * Réplica del portal de producción (FincasYaWeb) adaptada a prueba: los datos
 * llegan por `useQuery(getPublicByToken)` (reactivo, sin polling).
 *
 * Pasos: Resumen · Mis datos · En revisión · Contrato · Confirmación · Check-in.
 */
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Home,
  Loader2,
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
    direccion: string;
    ciudad?: string;
    fechaNacimiento?: string;
    cedulaPhotoUrl?: string;
    cedulaPhotoFileName?: string;
    cedulaPhotoMimeType?: string;
  };
  clientPortalUiStep?: number;
  clientDraftPhase?: "datos" | "pago";
  clientDraftPaymentAmount?: number;
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
}

export function VentaPageContent({ token, validatedParam }: Props) {
  const [mounted, setMounted] = useState(false);
  const raw = useQuery(api.saleLinks.getPublicByToken, { token });
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

  if (!mounted || loading) {
    return (
      <div className="landing min-h-dvh flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            Cargando tu reserva...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="landing min-h-dvh flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Link no disponible</h1>
          <p className="text-muted-foreground">
            Este link no existe o fue eliminado. Escríbele a tu asesor de FincasYa.
          </p>
        </div>
      </div>
    );
  }

  const serverStep = uiStep ?? data.clientStep;
  /** Pasos 7–8 son solo admin; el cliente ve el check-in (6) como final. */
  const maxStep = Math.min(serverStep, 6);
  const activeStep = Math.min(viewStep ?? maxStep, 6);
  const isReviewingPastStep = viewStep !== null && viewStep < maxStep;

  return (
    <div className="landing min-h-dvh bg-gradient-to-b from-[#fff6f2] via-white to-zinc-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-border/70">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/dark-logo.svg" alt="FincasYa" className="h-7 w-auto" />
        </div>
      </header>

      <main
        className={`mx-auto px-4 py-6 ${activeStep === 6 ? "max-w-lg" : "max-w-2xl"}`}
      >
        {data.property ? (
          <div className="mb-6">
            <VentaPropertyBanner property={data.property} />
          </div>
        ) : null}

        {/* Stepper */}
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
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex flex-wrap items-center justify-between gap-2">
            <span>Estás viendo un paso anterior (solo lectura).</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewStep(null)}
            >
              Volver al paso actual
            </Button>
          </div>
        ) : null}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
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
                    direccion: draft?.direccion ?? data.clientData?.direccion,
                    ciudad: draft?.ciudad ?? data.clientData?.ciudad,
                    fechaNacimiento:
                      draft?.fechaNacimiento ?? data.clientData?.fechaNacimiento,
                    paymentAmount:
                      draft?.paymentAmount ??
                      data.clientDraftPaymentAmount ??
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
    <div className="w-full overflow-x-auto pb-1">
      <div className="relative flex items-start justify-between min-w-[340px]">
        {/* progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-zinc-100" />
        <motion.div
          className="absolute top-4 left-0 h-0.5 bg-primary origin-left"
          initial={false}
          animate={{
            width: `${((maxStep - 1) / (steps.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />

        {steps.map((step) => {
          const isDone = maxStep > step.id;
          const isActive = activeStep === step.id;
          const isLocked = maxStep < step.id;
          const isClickable = step.id <= maxStep;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(step.id)}
              className={`relative flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 p-0 ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
              style={{ minWidth: 48 }}
            >
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors
                  ${
                    isDone
                      ? isActive
                        ? "border-primary bg-primary text-white ring-2 ring-primary/30"
                        : "border-primary bg-primary text-white hover:bg-primary/90"
                      : isActive
                        ? "border-primary bg-white text-primary"
                        : "border-zinc-200 bg-white text-zinc-400"
                  }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isLocked ? (
                  <Lock className="w-3 h-3" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </motion.div>

              <span
                className={`text-[10px] font-semibold text-center leading-tight transition-colors ${
                  isActive
                    ? "text-primary"
                    : isDone
                      ? "text-zinc-500"
                      : "text-zinc-300"
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
