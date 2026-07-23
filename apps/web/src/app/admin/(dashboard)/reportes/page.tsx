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
  exportDesgloseReservasXlsx,
  exportMovimientosXlsx,
  exportTercerosSiigoXlsx,
  type DesgloseReservaRow,
  type MovimientoRow,
  type TerceroRow,
} from "@/lib/xlsx-export";
import { ReportesGastosCaja } from "@/features/admin/components/reportes/reportes-gastos-caja";

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
  // Desglose por reserva: quién es el cliente, quién el propietario y cómo
  // se repartió la plata (Adriana, 22-jul).
  const desglose = useConvexQuery(api.reportes.getDesglosePorReserva, {
    start,
    end,
  }) as
    | { rows: DesgloseReservaRow[]; totals: Record<string, number> | null }
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

  const downloadDesglose = () => {
    const filas = desglose?.rows ?? [];
    if (filas.length === 0) {
      toast.error("No hay reservas en este mes para exportar.");
      return;
    }
    exportDesgloseReservasXlsx(filas, `desglose-reservas-${month}.xlsx`);
    toast.success("Excel de desglose descargado.");
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
          Descarga en Excel el libro de movimientos (ingresos/egresos), registra
          gastos y maneja la caja menor para importar a Siigo o cualquier
          software contable.
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

      <ReportesGastosCaja start={start} end={end} />

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
            <table className="w-full min-w-205 text-left text-sm">
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

      {/* Desglose por reserva — el resumen de negocio para la contadora */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap p-4">
          <div>
            <h2 className="font-bold">Desglose por reserva</h2>
            <p className="text-xs text-muted-foreground">
              Cliente, propietario y reparto de la plata: cobrado, pagado al
              dueño, devuelto y lo que quedó para FincasYa.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadDesglose}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            <Download className="h-4 w-4" /> Descargar Excel (desglose)
          </button>
        </div>
        {desglose === undefined ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Cargando…</p>
        ) : (desglose.rows ?? []).length === 0 ? (
          <p className="px-4 pb-6 text-center text-sm text-muted-foreground">
            No hay reservas con entrada en este mes.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Reserva</th>
                  <th className="px-3 py-2 text-left">Finca</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Propietario</th>
                  <th className="px-3 py-2 text-right">Cobrado</th>
                  <th className="px-3 py-2 text-right">Pagado dueño</th>
                  <th className="px-3 py-2 text-right">Devolución</th>
                  <th className="px-3 py-2 text-right">Ganancia FincasYa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {desglose.rows.map((r) => (
                  <tr key={r.reserva || `${r.finca}-${r.fechaEntrada}`}>
                    <td className="px-3 py-2 font-semibold">
                      {r.reserva || "—"}
                    </td>
                    <td className="px-3 py-2">{r.finca || "—"}</td>
                    <td className="px-3 py-2">{r.cliente || "—"}</td>
                    <td className="px-3 py-2">{r.propietario || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(r.cobradoCliente)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(r.pagadoPropietario)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(r.devolucionDeposito)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-bold ${
                        r.gananciaFincasya >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {money(r.gananciaFincasya)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {desglose.totals ? (
                <tfoot className="bg-muted/40 font-bold">
                  <tr>
                    <td className="px-3 py-2" colSpan={4}>
                      TOTALES ({desglose.totals.reservas} reservas)
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(desglose.totals.cobradoCliente)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(desglose.totals.pagadoPropietario)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(desglose.totals.devolucionDeposito)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {money(desglose.totals.gananciaFincasya)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
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
