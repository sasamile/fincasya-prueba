"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  Loader2,
  Users,
  Calendar,
  Phone,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { listSaleLinks } from "@/features/ventas/api/sale-links.api";
import {
  PIPELINE_STAGES,
  computePipelineStats,
  filterSaleLinksByStatus,
  mapSaleLinkToPipelineDeal,
  type PipelineDeal,
} from "@/features/admin/lib/crm-pipeline-data";

const STAGE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  nuevo: { bg: "bg-sky-50", border: "border-sky-200", badge: "bg-sky-100 text-sky-700" },
  datos: { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-100 text-violet-700" },
  pago_enviado: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  pago_validado: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  contrato: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  completado: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  perdido: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CrmPipeline() {
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["crm-pipeline-sale-links"],
    queryFn: () => listSaleLinks(),
    staleTime: 30_000,
  });

  const allLinks = data?.rows ?? [];

  const stats = useMemo(
    () => computePipelineStats(allLinks),
    [allLinks],
  );

  const deals = useMemo(() => {
    const filtered = filterSaleLinksByStatus(allLinks, statusFilter);
    return filtered.map(mapSaleLinkToPipelineDeal);
  }, [allLinks, statusFilter]);

  const allStages = [...PIPELINE_STAGES, { key: "perdido", label: "Perdido", step: 0 }];

  const dealsByStage = useMemo(() => {
    const map: Record<string, PipelineDeal[]> = {};
    for (const s of allStages) map[s.key] = [];
    for (const deal of deals) {
      if (!map[deal.stage]) map[deal.stage] = [];
      map[deal.stage].push(deal);
    }
    return map;
  }, [deals, allStages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
        <p className="text-sm font-semibold text-foreground">
          No se pudo cargar el pipeline
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total deals"
          value={String(stats.totalDeals)}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Valor total"
          value={formatCurrency(stats.totalValue)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Valor ganado"
          value={formatCurrency(stats.wonValue)}
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          label="Conversión"
          value={`${(stats.conversionRate * 100).toFixed(1)}%`}
          icon={<ChevronRight className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "active", label: "Activos" },
          { key: "all", label: "Todos" },
          { key: "completed", label: "Completados" },
          { key: "cancelled", label: "Cancelados" },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setStatusFilter(opt.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              statusFilter === opt.key
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {opt.label}
          </button>
        ))}
        {isFetching ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
        ) : null}
        {stats.totalDeals === 0 ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="ml-auto rounded-xl text-xs"
          >
            <Link href="/admin/ventas">
              Crear link de venta
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        ) : null}
      </div>

      {stats.totalDeals === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            No hay links de venta todavía
          </p>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
            El pipeline muestra los deals creados desde Links de Venta. Crea uno
            en Ventas para verlo aquí por etapa (nuevo → datos → pago → contrato).
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {allStages.map((stage) => {
            const stageDeals = dealsByStage[stage.key] ?? [];
            const colors = STAGE_COLORS[stage.key] ?? STAGE_COLORS.nuevo;
            const stageTotal = stageDeals.reduce((sum, d) => sum + d.totalValue, 0);

            return (
              <div
                key={stage.key}
                className={cn(
                  "flex-shrink-0 w-[280px] rounded-xl border p-3 space-y-2",
                  colors.bg,
                  colors.border,
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">
                    {stage.label}
                  </h3>
                  <Badge variant="secondary" className={cn("text-[10px]", colors.badge)}>
                    {stageDeals.length}
                  </Badge>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">
                  {formatCurrency(stageTotal)}
                </p>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {stageDeals.map((deal) => (
                    <DealCard key={deal._id} deal={deal} />
                  ))}
                  {stageDeals.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">
                      Sin deals
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealCard({ deal }: { deal: PipelineDeal }) {
  return (
    <Link
      href="/admin/ventas"
      className="block rounded-lg border border-white/60 bg-white p-2.5 shadow-sm space-y-1.5 hover:border-emerald-200 transition-colors"
    >
      <p className="text-xs font-bold text-gray-800 truncate">
        {deal.clientName ?? deal.contractCode ?? deal.token.slice(0, 8)}
      </p>
      <p className="text-[10px] text-gray-500 truncate">{deal.propertyTitle}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-emerald-700">
          {formatCurrency(deal.totalValue)}
        </span>
        <span className="text-[10px] text-gray-400">
          <Users className="h-3 w-3 inline mr-0.5" />
          {deal.guests}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <Calendar className="h-3 w-3" />
        {format(deal.checkIn, "dd MMM", { locale: es })} →{" "}
        {format(deal.checkOut, "dd MMM", { locale: es })}
      </div>
      {deal.clientPhone && (
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Phone className="h-3 w-3" />
          {deal.clientPhone}
        </div>
      )}
      {deal.createdByName && (
        <p className="text-[9px] text-gray-400">
          Vendedor: {deal.createdByName}
        </p>
      )}
    </Link>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-gray-400">{icon}</div>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
    </div>
  );
}
