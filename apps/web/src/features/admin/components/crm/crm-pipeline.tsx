"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  Loader2,
  Users,
  Calendar,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
  Building2,
  ChevronDown,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  listOpportunities,
  getOpportunityStats,
  updateOpportunityStage,
  markOpportunityLost,
  type Opportunity,
  type OpportunityStage,
} from "@/features/admin/api/opportunities.api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";

// ─── Configuración de stages ─────────────────────────────────────────────────

const STAGES: {
  key: OpportunityStage;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}[] = [
  {
    key: "nuevo",
    label: "Nuevo",
    emoji: "✨",
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-900/40",
    border: "border-slate-200 dark:border-slate-800",
    dot: "bg-slate-400",
  },
  {
    key: "calificado",
    label: "Calificado",
    emoji: "🎯",
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800",
    dot: "bg-sky-500",
  },
  {
    key: "propuesta",
    label: "Propuesta",
    emoji: "📋",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
  },
  {
    key: "negociacion",
    label: "Negociación",
    emoji: "🤝",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  {
    key: "ganada",
    label: "Ganada",
    emoji: "🏆",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  {
    key: "perdida",
    label: "Perdida",
    emoji: "❌",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
  },
];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s]));
const ACTIVE_STAGES: OpportunityStage[] = ["nuevo", "calificado", "propuesta", "negociacion"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCOP(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

function daysAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff}d`;
}

// ─── Tarjeta de oportunidad ──────────────────────────────────────────────────

function DealCard({
  deal,
  onMove,
  onLost,
}: {
  deal: Opportunity;
  onMove: (id: Id<"opportunities">, stage: OpportunityStage) => void;
  onLost: (id: Id<"opportunities">) => void;
}) {
  const stage = STAGE_MAP[deal.stage];
  const isTerminal = deal.stage === "ganada" || deal.stage === "perdida";

  const nextStages = STAGES.filter(
    (s) => s.key !== deal.stage && s.key !== "perdida" && s.key !== "nuevo"
  );

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white dark:bg-gray-900 shadow-sm",
        "hover:shadow-md transition-all duration-200 hover:-translate-y-0.5",
        "overflow-hidden",
        deal.stage === "ganada" && "border-emerald-200 dark:border-emerald-800",
        deal.stage === "perdida" && "border-rose-200/50 dark:border-rose-900/50 opacity-60",
      )}
    >
      {/* Barra de color arriba */}
      <div className={cn("h-1 w-full", stage.dot)} />

      <div className="p-3 space-y-2.5">
        {/* Header: nombre + menú */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foreground leading-tight truncate">
              {deal.contactName}
            </p>
            {deal.contactPhone && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {deal.contactPhone}
              </p>
            )}
          </div>

          {!isTerminal && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Mover a
                </div>
                {nextStages.map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    onClick={() => onMove(deal._id, s.key)}
                    className="gap-2 text-xs"
                  >
                    <span>{s.emoji}</span>
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onLost(deal._id)}
                  className="gap-2 text-xs text-rose-600 focus:text-rose-600"
                >
                  <XCircle className="h-3 w-3" />
                  Marcar perdida
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Finca / deal label */}
        {(deal.propertyName || deal.dealLabel) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{deal.propertyName ?? deal.dealLabel}</span>
          </div>
        )}

        {/* Fechas */}
        {deal.checkIn && deal.checkOut && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>
              {format(deal.checkIn, "dd MMM", { locale: es })} →{" "}
              {format(deal.checkOut, "dd MMM", { locale: es })}
              {deal.guests && ` · ${deal.guests}pax`}
            </span>
          </div>
        )}

        {/* Footer: valor + antigüedad + fuente */}
        <div className="flex items-center justify-between pt-0.5">
          <span
            className={cn(
              "text-[13px] font-black",
              deal.stage === "ganada"
                ? "text-emerald-600"
                : "text-foreground",
            )}
          >
            {deal.estimatedValue ? formatCOP(deal.estimatedValue) : "—"}
          </span>
          <div className="flex items-center gap-1.5">
            {deal.source === "bot" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 font-semibold">
                <Zap className="h-2.5 w-2.5" />
                Bot
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/60">
              {daysAgo(deal.createdAt)}
            </span>
          </div>
        </div>

        {/* Motivo de pérdida */}
        {deal.stage === "perdida" && deal.lostReason && (
          <p className="text-[10px] text-rose-500/80 italic truncate">
            {deal.lostReason}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Columna del kanban ──────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  deals,
  onMove,
  onLost,
  collapsed,
  onToggle,
}: {
  stage: (typeof STAGES)[number];
  deals: Opportunity[];
  onMove: (id: Id<"opportunities">, stage: OpportunityStage) => void;
  onLost: (id: Id<"opportunities">) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const totalValue = deals.reduce((s, d) => s + (d.estimatedValue ?? 0), 0);

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border transition-all duration-200",
        stage.bg,
        stage.border,
        collapsed ? "w-12" : "min-w-[240px] w-[240px]",
      )}
    >
      {/* Header de columna */}
      <div
        className={cn(
          "flex items-center gap-2 p-3 cursor-pointer select-none",
          collapsed && "flex-col gap-1",
        )}
        onClick={onToggle}
      >
        <span className={collapsed ? "text-base" : "text-sm"}>{stage.emoji}</span>
        {!collapsed && (
          <>
            <span className={cn("text-[12px] font-black flex-1", stage.color)}>
              {stage.label.toUpperCase()}
            </span>
            <span
              className={cn(
                "inline-flex items-center justify-center h-5 min-w-5 rounded-full text-[10px] font-black text-white",
                stage.dot,
              )}
            >
              {deals.length}
            </span>
          </>
        )}
        {collapsed && (
          <span
            className={cn(
              "inline-flex items-center justify-center h-5 min-w-5 rounded-full text-[10px] font-black text-white",
              stage.dot,
            )}
          >
            {deals.length}
          </span>
        )}
      </div>

      {/* Valor total de la columna */}
      {!collapsed && totalValue > 0 && (
        <div className={cn("px-3 pb-2 text-[11px] font-bold", stage.color)}>
          {formatCOP(totalValue)}
        </div>
      )}

      {/* Cards */}
      {!collapsed && (
        <div className="flex flex-col gap-2 p-3 pt-0 flex-1 overflow-y-auto max-h-[calc(100vh-320px)]">
          {deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
              <div className="text-2xl mb-1">{stage.emoji}</div>
              <p className="text-[10px] font-semibold text-muted-foreground">
                Sin deals
              </p>
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard
                key={deal._id}
                deal={deal}
                onMove={onMove}
                onLost={onLost}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline principal ──────────────────────────────────────────────────────

export function CrmPipeline() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    ganada: true,
    perdida: true,
  });
  const [lostDialog, setLostDialog] = useState<{
    id: Id<"opportunities"> | null;
    reason: string;
  }>({ id: null, reason: "" });

  // ─── Data ────────────────────────────────────────────────────────────────

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["crm-opportunities", statusFilter],
    queryFn: () => listOpportunities(statusFilter === "all" ? undefined : statusFilter),
    staleTime: 15_000,
  });

  const { data: oppStats } = useQuery({
    queryKey: ["crm-opp-stats"],
    queryFn: () => getOpportunityStats(),
    staleTime: 30_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const moveMutation = useMutation({
    mutationFn: ({
      id,
      stage,
      reason,
    }: {
      id: Id<"opportunities">;
      stage: OpportunityStage;
      reason?: string;
    }) => updateOpportunityStage(id, stage, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
      void qc.invalidateQueries({ queryKey: ["crm-opp-stats"] });
      toast.success("Deal actualizado");
    },
    onError: () => toast.error("Error al mover el deal"),
  });

  const lostMutation = useMutation({
    mutationFn: ({
      id,
      reason,
    }: {
      id: Id<"opportunities">;
      reason: string;
    }) => markOpportunityLost(id, reason || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
      void qc.invalidateQueries({ queryKey: ["crm-opp-stats"] });
      toast.success("Deal marcado como perdido");
      setLostDialog({ id: null, reason: "" });
    },
    onError: () => toast.error("Error al marcar como perdido"),
  });

  // ─── Filtrado por etapa ──────────────────────────────────────────────────

  const visibleStages = useMemo(() => {
    if (statusFilter === "active") return STAGES.filter((s) => (ACTIVE_STAGES as string[]).includes(s.key));
    if (statusFilter === "ganada") return STAGES.filter((s) => s.key === "ganada");
    if (statusFilter === "perdida") return STAGES.filter((s) => s.key === "perdida");
    return STAGES;
  }, [statusFilter]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const d of deals) {
      if (!map[d.stage]) map[d.stage] = [];
      map[d.stage].push(d);
    }
    // Ordenar por valor estimado desc dentro de cada columna
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0));
    }
    return map;
  }, [deals]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleMove = (id: Id<"opportunities">, stage: OpportunityStage) => {
    moveMutation.mutate({ id, stage });
  };

  const handleLostClick = (id: Id<"opportunities">) => {
    setLostDialog({ id, reason: "" });
  };

  const handleLostConfirm = () => {
    if (!lostDialog.id) return;
    lostMutation.mutate({ id: lostDialog.id, reason: lostDialog.reason });
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            Cargando pipeline...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats top */}
      {oppStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill
            icon={Users}
            label="Total deals"
            value={String(oppStats.total)}
          />
          <StatPill
            icon={DollarSign}
            label="Valor total"
            value={formatCOP(oppStats.totalValue)}
          />
          <StatPill
            icon={Trophy}
            label="Valor ganado"
            value={formatCOP(oppStats.wonValue)}
            accent="text-emerald-600"
          />
          <StatPill
            icon={TrendingUp}
            label="Conversión"
            value={`${oppStats.conversionRate}%`}
            accent={
              oppStats.conversionRate >= 50
                ? "text-emerald-600"
                : "text-amber-600"
            }
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "active", label: "Activos" },
          { key: "all", label: "Todos" },
          { key: "ganada", label: "Ganados" },
          { key: "perdida", label: "Perdidos" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-bold border transition-all",
              statusFilter === f.key
                ? "bg-primary text-white border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground self-center">
          {deals.length} deal{deals.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {visibleStages.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            deals={dealsByStage[stage.key] ?? []}
            onMove={handleMove}
            onLost={handleLostClick}
            collapsed={!!collapsed[stage.key] && statusFilter !== stage.key}
            onToggle={() =>
              setCollapsed((prev) => ({
                ...prev,
                [stage.key]: !prev[stage.key],
              }))
            }
          />
        ))}

        {deals.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-semibold">Sin oportunidades</p>
            <p className="text-xs mt-1 max-w-xs opacity-70">
              Se crearán automáticamente cuando el bot detecte una reserva o cuando crees un link de venta.
            </p>
          </div>
        )}
      </div>

      {/* Dialog: marcar perdida */}
      <Dialog
        open={!!lostDialog.id}
        onOpenChange={(open) => {
          if (!open) setLostDialog({ id: null, reason: "" });
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              ¿Por qué se perdió?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Opcional — ayuda a mejorar el proceso comercial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap gap-2">
              {["Precio", "Fechas no disponibles", "Eligió otra finca", "No respondió", "Presupuesto"].map((r) => (
                <button
                  key={r}
                  onClick={() => setLostDialog((d) => ({ ...d, reason: r }))}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                    lostDialog.reason === r
                      ? "bg-rose-600 text-white border-rose-600"
                      : "border-border hover:border-rose-300",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input
              placeholder="Otro motivo..."
              value={lostDialog.reason}
              onChange={(e) =>
                setLostDialog((d) => ({ ...d, reason: e.target.value }))
              }
              className="rounded-xl text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => setLostDialog({ id: null, reason: "" })}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl font-bold"
                onClick={handleLostConfirm}
                disabled={lostMutation.isPending}
              >
                {lostMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3 shadow-sm flex items-center gap-3">
      <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Icon className={cn("h-4 w-4 text-muted-foreground", accent)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
          {label}
        </p>
        <p className={cn("text-base font-black leading-tight", accent)}>{value}</p>
      </div>
    </div>
  );
}
