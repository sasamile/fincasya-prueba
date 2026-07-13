"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronRight,
  Moon,
  Users,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  data: SaleLinkPublicData;
  onContinue: () => void;
  readOnly?: boolean;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

export function StepResumen({ data, onContinue, readOnly }: Props) {
  const checkInDate = new Date(data.checkIn);
  const checkOutDate = new Date(data.checkOut);

  const breakdown = [
    { label: "Alquiler", amount: data.rentalValue },
    { label: "Limpieza / aseo", amount: data.cleaningFee },
    data.depositAmount > 0 && {
      label: "Depósito de garantía (reembolsable)",
      amount: data.depositAmount,
      highlight: true,
    },
    data.petSurcharge && data.petSurcharge > 0 && {
      label: `Recargo mascotas (${data.petCount ?? ""})`,
      amount: data.petSurcharge,
    },
    data.petDeposit && data.petDeposit > 0 && {
      label: "Depósito mascotas (reembolsable)",
      amount: data.petDeposit,
      highlight: true,
    },
  ].filter(Boolean) as { label: string; amount: number; highlight?: boolean }[];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
          Paso 1
        </p>
        <h1 className="text-2xl font-bold">Resumen de tu reserva</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revisa los detalles antes de continuar
        </p>
      </div>

      {/* Fechas */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="w-4 h-4 text-primary" />
          Fechas de la estadía
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground">Check-in</p>
            <p className="font-bold">
              {format(checkInDate, "d MMM", { locale: es })}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(checkInDate, "yyyy")}
            </p>
            {data.checkInTime && (
              <p className="text-xs font-medium text-primary mt-0.5">
                {data.checkInTime}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground">Check-out</p>
            <p className="font-bold">
              {format(checkOutDate, "d MMM", { locale: es })}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(checkOutDate, "yyyy")}
            </p>
            {data.checkOutTime && (
              <p className="text-xs font-medium text-primary mt-0.5">
                {data.checkOutTime}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Moon className="w-3.5 h-3.5" /> {data.nights} noches
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {data.guests} personas
          </span>
        </div>
      </div>

      {/* Desglose de valores */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="w-4 h-4 text-primary" />
          Desglose del valor
        </div>
        <div className="space-y-2">
          {breakdown.map((row, i) => (
            <div
              key={i}
              className={`flex items-center justify-between text-sm ${
                row.highlight ? "font-medium" : ""
              }`}
            >
              <span
                className={
                  row.highlight ? "text-amber-700" : "text-muted-foreground"
                }
              >
                {row.label}
                {row.highlight && (
                  <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1 rounded">
                    Reembolsable
                  </span>
                )}
              </span>
              <span className={row.highlight ? "text-amber-700" : ""}>
                {formatCOP(row.amount)}
              </span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex items-center justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-primary text-lg">{formatCOP(data.totalValue)}</span>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
          <strong>¿Cuánto pago ahora?</strong> — Para confirmar tu reserva debes
          enviar el <strong>50% ({formatCOP(data.totalValue / 2)})</strong> como
          anticipo. El saldo restante lo pagas al llegar.
        </div>
      </div>

      {/* CTA */}
      {!readOnly ? (
        <Button
          onClick={onContinue}
          className="w-full bg-orange-500 text-white hover:bg-orange-600"
          size="lg"
        >
          Continuar con mis datos
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      ) : null}
    </div>
  );
}
