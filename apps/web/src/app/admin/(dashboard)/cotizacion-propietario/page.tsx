"use client";

import { Mail } from "lucide-react";
import { OwnerQuotePage } from "@/features/admin/components/owner-quote/owner-quote-page";

export default function CotizacionPropietarioPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-orange-600">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Cotización al propietario
          </h1>
          <p className="text-sm text-muted-foreground">
            Elige una reserva, define el valor negociado y envíasela al dueño
            por correo.
          </p>
        </div>
      </div>

      <OwnerQuotePage />
    </div>
  );
}
