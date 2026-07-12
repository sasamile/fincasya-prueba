"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const copDigitsOnly = (value?: string) => (value || "").replace(/\D/g, "");

export const formatCopInputDisplay = (value?: string) => {
  const raw = copDigitsOnly(value);
  if (!raw) return "";
  return Number(raw).toLocaleString("es-CO");
};

/** Guarda etiqueta COP para cláusulas del contrato ($100.000). */
export const toStoredCopLabel = (digits: string) => {
  if (!digits) return "";
  return `$${Number(digits).toLocaleString("es-CO")}`;
};

type CopMoneyInputProps = {
  value: string;
  onChange?: (digits: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function CopMoneyInput({
  value,
  onChange,
  readOnly,
  disabled,
  className,
  placeholder,
}: CopMoneyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
        $
      </span>
      <Input
        type="text"
        inputMode="numeric"
        readOnly={readOnly}
        disabled={disabled}
        value={formatCopInputDisplay(value)}
        placeholder={placeholder}
        onChange={(event) => onChange?.(copDigitsOnly(event.target.value))}
        className={cn(
          "pl-9 font-semibold tabular-nums tracking-tight",
          className,
        )}
      />
    </div>
  );
}
