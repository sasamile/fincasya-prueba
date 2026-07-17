"use client";

import { useState } from "react";
import { useConvex } from "convex/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatSellerContractCode,
  useContractSettingsStore,
} from "@/features/admin/store/contract-settings.store";

type Props = {
  /** Rellena el campo de código (editable después). */
  onAssign: (code: string) => void;
  className?: string;
  /** Compacto para inbox / modales estrechos. */
  compact?: boolean;
};

/**
 * Botones por vendedor (CR, CRA…).
 * El clic SOLO sugiere el siguiente número libre (no consume el contador).
 * El contador sube cuando el contrato/link se guarda de verdad.
 */
export function ContractCodeSellerButtons({
  onAssign,
  className,
  compact,
}: Props) {
  const sellers = useContractSettingsStore((s) => s.contractSellers);
  const convex = useConvex();
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = sellers.filter((s) => s.activo !== false);
  if (active.length === 0) return null;

  const handleClick = async (sellerId: string) => {
    setBusyId(sellerId);
    try {
      const result = await convex.query(
        api.adminContractSettings.peekNextContractCode,
        { sellerId },
      );
      if (!result?.code) {
        toast.error("No se encontró un número libre para ese prefijo.");
        return;
      }
      onAssign(result.code);
      toast.success(
        `Sugerido ${result.code} (se confirma al generar/guardar el contrato)`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo sugerir el siguiente código",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {!compact ? (
        <p className="text-[11px] text-muted-foreground">
          Clic = rellena el siguiente libre. El contador solo avanza al
          generar/guardar el contrato.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {active.map((s) => {
          const next = s.lastNumber + 1;
          const preview = formatSellerContractCode(s.iniciales, next);
          const busy = busyId === s.id;
          return (
            <Button
              key={s.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={busyId !== null}
              title={`${s.nombre}: sugerir ${preview} (sin consumir hasta guardar)`}
              onClick={() => void handleClick(s.id)}
              className={cn(
                "h-8 gap-1.5 rounded-lg px-2.5 font-semibold tabular-nums",
                compact && "h-7 text-xs",
              )}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              <span>{s.iniciales.trim().toUpperCase()}</span>
              <span className="font-normal text-muted-foreground">
                →{next}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
