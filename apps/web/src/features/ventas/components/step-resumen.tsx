"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, Moon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SaleLinkPublicData } from "./venta-page-content";
import {
  StepHeader,
  VentaCallout,
  VentaMetaRow,
  VentaPanel,
  VentaPanelTitle,
} from "./venta-ui";

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
  const depositHalf =
    data.advancePaymentAmount ?? Math.round(data.totalValue / 2);

  const breakdown = [
    { label: "Alquiler", amount: data.rentalValue },
    { label: "Limpieza / aseo", amount: data.cleaningFee },
    data.depositAmount > 0 && {
      label: "Depósito de garantía",
      amount: data.depositAmount,
      refundable: true,
    },
    data.petSurcharge &&
      data.petSurcharge > 0 && {
        label: `Recargo mascotas${data.petCount ? ` (${data.petCount})` : ""}`,
        amount: data.petSurcharge,
      },
    data.petDeposit &&
      data.petDeposit > 0 && {
        label: "Depósito mascotas",
        amount: data.petDeposit,
        refundable: true,
      },
  ].filter(Boolean) as {
    label: string;
    amount: number;
    refundable?: boolean;
  }[];

  return (
    <div className="space-y-6">
      <StepHeader
        step={1}
        title="Resumen de tu reserva"
        description="Revisa fechas y valores antes de continuar."
      />

      <VentaPanel>
        <VentaPanelTitle>Estadía</VentaPanelTitle>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Check-in</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight">
              {format(checkInDate, "d MMM yyyy", { locale: es })}
            </p>
            {data.checkInTime ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.checkInTime}
              </p>
            ) : null}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Check-out</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight">
              {format(checkOutDate, "d MMM yyyy", { locale: es })}
            </p>
            {data.checkOutTime ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.checkOutTime}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" />
            {data.nights} {data.nights === 1 ? "noche" : "noches"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {data.guests} {data.guests === 1 ? "persona" : "personas"}
          </span>
        </div>
      </VentaPanel>

      <VentaPanel className="space-y-3">
        <VentaPanelTitle>Desglose</VentaPanelTitle>
        <div className="space-y-2.5">
          {breakdown.map((row) => (
            <VentaMetaRow
              key={row.label}
              label={
                row.refundable ? (
                  <span>
                    {row.label}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      · reembolsable
                    </span>
                  </span>
                ) : (
                  row.label
                )
              }
              value={formatCOP(row.amount)}
            />
          ))}
        </div>
        <Separator className="my-1" />
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-semibold tracking-tight tabular-nums">
            {formatCOP(data.totalValue)}
          </span>
        </div>
        <VentaCallout className="mt-2">
          <p>
            <span className="font-medium">Anticipo ahora:</span>{" "}
            {formatCOP(depositHalf)}
            {data.advancePaymentAmount && data.totalValue > 0
              ? ` (${Math.round((depositHalf / data.totalValue) * 100)}% del total).`
              : " (sugerido)."}{" "}
            El saldo restante lo pagas al llegar.
          </p>
        </VentaCallout>
      </VentaPanel>

      {!readOnly ? (
        <Button onClick={onContinue} className="h-11 w-full" size="lg">
          Continuar con mis datos
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
