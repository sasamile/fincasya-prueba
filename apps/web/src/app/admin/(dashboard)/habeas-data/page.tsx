"use client";

import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { ShieldCheck } from "lucide-react";
import { HabeasDataManager } from "@/features/admin/components/habeas-data/habeas-data-manager";

export default function HabeasDataPage() {
  const pendingCount = useConvexQuery(api.habeasData.countPending, {});

  return (
    <div className="relative min-h-[calc(100vh-4rem)] space-y-6 bg-transparent p-4 md:space-y-8 md:p-8 lg:p-12">
      {/* Encabezado */}
      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </span>
            Habeas Data
            {typeof pendingCount === "number" && pendingCount > 0 ? (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground opacity-80">
            Solicitudes de protección de datos personales (Ley 1581 de 2012)
          </p>
        </div>
      </div>

      <HabeasDataManager />
    </div>
  );
}
