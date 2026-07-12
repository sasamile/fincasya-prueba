"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Loader2,
  TrendingUp,
  Users,
  XCircle,
  CheckCircle,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listSaleLinks } from "@/features/ventas/api/sale-links.api";
import {
  computePipelineStats,
  mapSaleLinkToPipelineDeal,
} from "@/features/admin/lib/crm-pipeline-data";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CrmReports() {
  const { data, isLoading } = useQuery({
    queryKey: ["crm-pipeline-sale-links"],
    queryFn: () => listSaleLinks(),
    staleTime: 30_000,
  });

  const links = data?.rows ?? [];
  const stats = useMemo(() => computePipelineStats(links), [links]);
  const deals = useMemo(
    () => links.map(mapSaleLinkToPipelineDeal),
    [links],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const funnelStages = [
    { key: "nuevo", label: "Nuevo" },
    { key: "datos", label: "Datos completados" },
    { key: "pago_enviado", label: "Pago enviado" },
    { key: "pago_validado", label: "Pago validado" },
    { key: "contrato", label: "Contrato" },
    { key: "completado", label: "Completado" },
  ];

  const stageOrder = funnelStages.map((s) => s.key);
  const cumulativeCounts = funnelStages.map((stage) => {
    const idx = stageOrder.indexOf(stage.key);
    return deals.filter((d) => {
      const dealIdx = stageOrder.indexOf(d.stage);
      return dealIdx >= idx || (d.stage === "perdido" && false);
    }).length;
  });

  const stageCounts = funnelStages.map((stage) =>
    deals.filter((d) => d.stage === stage.key).length,
  );

  const lostDeals = deals.filter((d) => d.stage === "perdido");
  const wonDeals = deals.filter(
    (d) => d.stage === "completado" || d.status === "completed",
  );

  const sellerStats = Object.entries(stats?.bySeller ?? {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxFunnel = Math.max(...cumulativeCounts, 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReportCard
          label="Total deals"
          value={String(stats?.totalDeals ?? 0)}
          icon={<Users className="h-4 w-4 text-sky-600" />}
        />
        <ReportCard
          label="Ganados"
          value={String(wonDeals.length)}
          icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
        />
        <ReportCard
          label="Perdidos"
          value={String(lostDeals.length)}
          icon={<XCircle className="h-4 w-4 text-red-500" />}
        />
        <ReportCard
          label="Tasa de conversión"
          value={`${((stats?.conversionRate ?? 0) * 100).toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4 text-violet-600" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-white p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-800">
            Embudo de ventas
          </h3>
          <div className="space-y-1">
            {funnelStages.map((stage, i) => {
              const count = cumulativeCounts[i];
              const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0;
              const stageCount = stageCounts[i];
              return (
                <div key={stage.key} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-gray-700">
                      {stage.label}
                    </span>
                    <span className="text-gray-500">
                      {count} ({stageCount} en etapa)
                    </span>
                  </div>
                  <div className="h-6 w-full bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-md transition-all",
                        i <= 1
                          ? "bg-sky-400"
                          : i <= 3
                            ? "bg-amber-400"
                            : "bg-emerald-500",
                      )}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  {i < funnelStages.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowDown className="h-3 w-3 text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">
              Valor por estado
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Valor total pipeline</span>
                <span className="font-bold">
                  {formatCurrency(stats?.totalValue ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">Valor ganado</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(stats?.wonValue ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-500">Valor perdido</span>
                <span className="font-bold text-red-500">
                  {formatCurrency(
                    lostDeals.reduce((s, d) => s + d.totalValue, 0),
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">
              Deals por vendedor
            </h3>
            {sellerStats.length > 0 ? (
              <div className="space-y-1.5">
                {sellerStats.slice(0, 10).map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-700 truncate max-w-[180px]">
                      {s.name}
                    </span>
                    <span className="font-bold text-gray-800">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCard({
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
