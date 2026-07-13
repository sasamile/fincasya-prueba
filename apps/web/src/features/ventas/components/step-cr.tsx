"use client";

/**
 * Paso 5 — Confirmación de reserva (CR). PLACEHOLDER (Etapa 1).
 * Aún no genera el CR; solo muestra el enlace si el asesor ya lo adjuntó,
 * o un estado amable de "en preparación". La generación real llega en Etapa 2.
 */
import { FileCheck, Clock } from "lucide-react";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
}

export function StepCr({ data }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
          Paso 5
        </p>
        <h1 className="text-2xl font-bold">Confirmación de reserva</h1>
      </div>

      {data.crUrl ? (
        <a
          href={data.crUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-white p-6 shadow-sm transition hover:border-primary hover:shadow-md"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <FileCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Descargar confirmación de reserva
            </p>
            <p className="text-sm text-muted-foreground">
              Tu comprobante oficial (CR) está listo.
            </p>
          </div>
        </a>
      ) : (
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Confirmación de reserva en preparación
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tu pago quedó confirmado. Estamos preparando tu confirmación de
            reserva (CR); tu asesor de FincasYa te la enviará muy pronto.
          </p>
        </div>
      )}
    </div>
  );
}
