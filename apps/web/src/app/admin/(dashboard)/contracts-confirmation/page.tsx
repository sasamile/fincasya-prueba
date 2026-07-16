"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ContractsReservationSection } from "@/features/admin/components/contracts/contracts-reservation-section";

function ContractsConfirmationFallback() {
  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 items-center justify-center rounded-2xl border border-border bg-card">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-xs font-medium">Cargando generador de contratos…</p>
      </div>
    </div>
  );
}

export default function ContractsConfirmationPage() {
  return (
    <Suspense fallback={<ContractsConfirmationFallback />}>
      <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col">
        <ContractsReservationSection />
      </div>
    </Suspense>
  );
}
