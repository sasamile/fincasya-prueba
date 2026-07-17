"use client";

/**
 * Paso 6 — Check-in. Misma UI/funciones que /checkin/[reference]
 * (CheckinPageContent embebido). Si aún no hay reserva, se provisiona.
 */
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { CheckinPageContent } from "@/features/checkin/components/checkin-page-content";
import type { SaleLinkPublicData } from "./venta-page-content";
import { StepHeader, VentaPanel } from "./venta-ui";

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
}

export function StepCheckin({ data, onSubmitted }: Props) {
  const ensureBooking = useMutation(api.saleLinks.ensureBookingForCheckin);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    if (data.bookingReference || data.checkinCompleted) return;
    if (!data.paymentValidated && data.clientStep < 6) return;
    let cancelled = false;
    setProvisioning(true);
    setProvisionError(null);
    void ensureBooking({ token: data.token })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setProvisionError(
            res.reason === "unavailable"
              ? "Esas fechas ya no están disponibles. Contacta a FincasYa."
              : res.reason === "no_client"
                ? "Faltan tus datos de contrato para el check-in."
                : "No se pudo preparar el check-in. Intenta de nuevo.",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProvisionError("No se pudo preparar el check-in. Intenta de nuevo.");
        }
      })
      .finally(() => {
        if (!cancelled) setProvisioning(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    data.bookingReference,
    data.checkinCompleted,
    data.paymentValidated,
    data.clientStep,
    data.token,
    ensureBooking,
  ]);

  if (data.checkinCompleted && !data.bookingReference) {
    return (
      <div className="space-y-5">
        <StepHeader
          step={6}
          title="Check-in"
          description="Tu check-in ya quedó registrado."
        />
        <VentaPanel>
          <p className="text-sm text-muted-foreground">
            Gracias. El equipo de FincasYa ya tiene tu lista de ingreso.
          </p>
        </VentaPanel>
      </div>
    );
  }

  if (data.bookingReference) {
    return (
      <CheckinPageContent
        reference={data.bookingReference}
        embedded
        onCheckinComplete={onSubmitted}
      />
    );
  }

  return (
    <div className="space-y-5">
      <StepHeader
        step={6}
        title="Check-in"
        description={
          data.property?.maxGuests
            ? `Registra a las personas que ingresan a la finca. Capacidad: ${data.property.maxGuests}.`
            : "Registra a las personas que ingresan a la finca."
        }
      />
      <VentaPanel className="flex flex-col items-center justify-center gap-3 py-10">
        {provisionError ? (
          <p className="text-center text-sm text-destructive">{provisionError}</p>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {provisioning
                ? "Preparando tu check-in…"
                : "Cargando check-in…"}
            </p>
          </>
        )}
      </VentaPanel>
    </div>
  );
}
