"use client";

import { Suspense } from "react";
import { ContractsReservationSection } from "@/features/admin/components/contracts/contracts-reservation-section";

export default function ContractsConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col">
        <ContractsReservationSection />
      </div>
    </Suspense>
  );
}
