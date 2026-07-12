"use client";

import { Suspense } from "react";
import { SaleLinksManager } from "@/features/ventas/components/sale-links-manager";

export default function VentasPage() {
  return (
    <Suspense fallback={null}>
      <div className="p-6">
        <SaleLinksManager />
      </div>
    </Suspense>
  );
}
