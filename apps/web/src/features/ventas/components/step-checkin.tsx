"use client";

/**
 * Paso 6 — Check-in en línea. PLACEHOLDER (Etapa 1).
 * El registro de huéspedes/placas real llega en Etapa 2. Por ahora muestra un
 * estado amable de "en preparación", o de éxito si ya se completó.
 */
import { CheckCircle2, DoorOpen } from "lucide-react";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
}

export function StepCheckin({ data }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
          Paso 6
        </p>
        <h1 className="text-2xl font-bold">Check-in</h1>
      </div>

      {data.checkinCompleted ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-emerald-900">
            Check-in completado — ¡nos vemos en la finca!
          </h2>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <DoorOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Check-in en preparación
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            ¡Ya casi! El check-in en línea (registro de huéspedes, placas, etc.)
            estará disponible aquí muy pronto. Tu asesor te guiará.
          </p>
        </div>
      )}
    </div>
  );
}
