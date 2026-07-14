"use client";

import { useMemo, useState } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  BarChart3,
  Loader2,
  Download,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportMovimientosXlsx,
  exportTercerosSiigoXlsx,
  type MovimientoRow,
  type TerceroRow,
} from "@/lib/xlsx-export";

function money(v?: number | null) {
  if (!v || v <= 0) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(ym: string): { start: number; end: number } {
  const [y, m] = ym.split("-").map(Number);
  return {
    start: new Date(y, m - 1, 1).getTime(),
    end: new Date(y, m, 1).getTime(),
  };
}

type MovimientosResult = {
  rows: MovimientoRow[];
  totals: { totalIngresos: number; totalEgresos: number; neto: number };
};

export default function ReportesPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const { start, end } = useMemo(() => monthBounds(month), [month]);

  const movimientos = useConvexQuery(api.reportes.getMovimientos, {
    start,
    end,
  }) as MovimientosResult | undefined;
  const terceros = useConvexQuery(api.reportes.getTercerosConReserva, {}) as
    | TerceroRow[]
    | undefined;

  const isLoading = movimientos === undefined;
  const rows = movimientos?.rows ?? [];
  const totals = movimientos?.totals ?? {
    totalIngresos: 0,
    totalEgresos: 0,
    neto: 0,
  };

  const downloadMovimientos = () => {
    if (rows.length === 0) {
      toast.error("No hay movimientos en este mes para exportar.");
      return;
    }
    exportMovimientosXlsx(rows, `movimientos-${month}.xlsx`);
    toast.success("Excel de movimientos descargado.");
  };

  const downloadTerceros = () => {
    if (!terceros || terceros.length === 0) {
      toast.error("No hay clientes con reserva para exportar.");
      return;
    }
    exportTercerosSiigoXlsx(terceros, `terceros-siigo-${month}.xlsx`);
    toast.success(`Excel de terceros descargado (${terceros.length} clientes).`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </span>
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-11">
          Descarga en Excel el libro de movimientos (ingresos/egresos) y los
          clientes para importar a Siigo o cualquier software contable.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-muted-foreground">Mes</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
        />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" /> Ingresos
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">
            {money(totals.totalIngresos)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5 text-red-600" /> Egresos
          </p>
          <p className="mt-1 text-xl font-bold text-red-700 tabular-nums">
            {money(totals.totalEgresos)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Neto
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {money(totals.neto)}
          </p>
        </div>
      </div>

      {/* Movimientos */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <h2 className="font-bold">Movimientos del mes</h2>
          <button
            onClick={downloadMovimientos}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 h-9 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Descargar Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando movimientos…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No hay movimientos registrados en este mes.
            </div>
          ) : (
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Fecha</th>
                  <th className="px-3 py-2.5">Finca</th>
                  <th className="px-3 py-2.5">Operación</th>
                  <th className="px-3 py-2.5">Entidad</th>
                  <th className="px-3 py-2.5 text-right">Ingreso</th>
                  <th className="px-3 py-2.5 text-right">Egreso</th>
                  <th className="px-3 py-2.5">Nombre</th>
                  <th className="px-3 py-2.5">Cédula</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{r.fecha}</td>
                    <td className="px-3 py-2">{r.finca}</td>
                    <td className="px-3 py-2">{r.operacion}</td>
                    <td className="px-3 py-2">{r.entidad || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {r.ingreso ? money(r.ingreso) : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      {r.egreso ? money(r.egreso) : ""}
                    </td>
                    <td className="px-3 py-2">{r.nombre}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.cedula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Terceros */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </span>
            <div>
              <h2 className="font-bold">Terceros / Clientes</h2>
              <p className="text-xs text-muted-foreground">
                {terceros === undefined
                  ? "Cargando…"
                  : `${terceros.length} clientes con reserva (únicos por cédula), listos para importar a Siigo.`}
              </p>
            </div>
          </div>
          <button
            onClick={downloadTerceros}
            disabled={terceros === undefined}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Descargar Excel (terceros)
          </button>
        </div>
      </div>
    </div>
  );
}
