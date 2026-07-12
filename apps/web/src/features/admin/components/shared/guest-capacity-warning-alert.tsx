"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type GuestCapacityWarningAlertProps = {
  message: string | null;
  className?: string;
};

export function GuestCapacityWarningAlert({
  message,
  className,
}: GuestCapacityWarningAlertProps) {
  if (!message) return null;

  return (
    <Alert
      variant="default"
      className={
        className ??
        "rounded-xl border-amber-200 bg-amber-50 py-3 dark:border-amber-900/30 dark:bg-amber-950/20"
      }
    >
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <div className="flex flex-col gap-1">
        <AlertTitle className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
          Cupo excedido
        </AlertTitle>
        <AlertDescription className="text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-300">
          {message}
        </AlertDescription>
      </div>
    </Alert>
  );
}
