"use client";

import { Suspense } from "react";
import { ContractsReservationSection } from "@/features/admin/components/contracts/contracts-reservation-section";

export default function ContractLinkPage() {
  return (
    <Suspense fallback={null}>
      <ContractsReservationSection variant="link" />
    </Suspense>
  );
}
