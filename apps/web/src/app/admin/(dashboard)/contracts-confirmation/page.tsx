"use client";

import { Suspense } from "react";
import { ContractsReservationSection } from "@/features/admin/components/contracts/contracts-reservation-section";

export default function ContractsConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ContractsReservationSection />
    </Suspense>
  );
}
