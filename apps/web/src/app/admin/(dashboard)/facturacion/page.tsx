"use client";

import { useMemo, useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
  useAction as useConvexAction,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  Receipt,
  Loader2,
  Plug,
  RefreshCw,
  Settings2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Home,
  X,
} from "lucide-react";
import { toast } from "sonner";

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

function monthBounds(ym: string): { monthStart: number; monthEnd: number } {
  const [y, m] = ym.split("-").map(Number);
  return {
    monthStart: new Date(y, m - 1, 1).getTime(),
    monthEnd: new Date(y, m, 1).getTime(),
  };
}

type InvoiceBadge = {
  status: string;
  siigoNumber: string | null;
  total: number;
  publicUrl?: string | null;
  errorMessage?: string | null;
} | null;

type MonthlyRow = {
  _id: string;
  reference: string | null;
  nombreCompleto: string;
  cedula: string;
  precioTotal: number;
  paymentStatus: string;
  status: string;
  fechaEntrada: number;
  fechaSalida: number;
  propertyTitle: string | null;
  hasOwnerPayout: boolean;
  saleInvoice: InvoiceBadge;
  purchaseInvoice: InvoiceBadge;
};

function StatusBadge({ invoice }: { invoice: InvoiceBadge }) {
  if (!invoice) {
    return (
      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Sin facturar
      </span>
    );
  }
  if (invoice.status === "error") {
    return (
      <span
        title={invoice.errorMessage ?? undefined}
        className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800"
      >
        <AlertTriangle className="h-3 w-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
      <CheckCircle2 className="h-3 w-3" />
      {invoice.status === "stamped" ? "Timbrada" : "Borrador"}
      {invoice.siigoNumber ? ` · ${invoice.siigoNumber}` : ""}
    </span>
  );
}

function SummaryCards({
  monthStart,
  monthEnd,
}: {
  monthStart: number;
  monthEnd: number;
}) {
  const summary = useConvexQuery(api.siigo.getMonthlySummary, {
    monthStart,
    monthEnd,
  });
  const cards = [
    { label: "Reservas del mes", value: summary?.reservasCount ?? 0 },
    { label: "Facturadas", value: summary?.facturadasCount ?? 0 },
    { label: "Sin facturar", value: summary?.pendientesCount ?? 0 },
    { label: "Total facturado", value: money(summary?.totalFacturado), isMoney: true },
    { label: "Total pendiente", value: money(summary?.totalPendiente), isMoney: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {c.label}
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function ConfirmInvoiceModal({
  row,
  invoiceModel,
  onClose,
  onConfirmed,
}: {
  row: MonthlyRow;
  invoiceModel: "total" | "comision";
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const createSale = useConvexAction(api.siigo.createSalesInvoiceForBooking);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await createSale({ bookingId: row._id as Id<"bookings"> });
      toast.success(
        `Factura borrador creada en Siigo por ${money(res.total)}${
          res.siigoNumber ? ` (${res.siigoNumber})` : ""
        }.`,
      );
      onConfirmed();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo facturar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">Crear factura de venta</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <p>
            <span className="text-muted-foreground">Reserva:</span>{" "}
            <span className="font-semibold">{row.reference ?? row._id}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Cliente:</span>{" "}
            {row.nombreCompleto} · CC {row.cedula}
          </p>
          <p>
            <span className="text-muted-foreground">Finca:</span>{" "}
            {row.propertyTitle ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Modelo:</span>{" "}
            <span className="font-semibold">
              {invoiceModel === "comision"
                ? "Solo comisión FincasYA"
                : "Valor total de la reserva"}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Total reserva:</span>{" "}
            {money(row.precioTotal)}
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          El depósito reembolsable <b>NO se factura</b> (no es un ingreso). Se
          crea como <b>borrador</b> en Siigo — no se envía a la DIAN.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-3 h-9 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => void run()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 h-9 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4" />
            )}
            Facturar
          </button>
        </div>
      </div>
    </div>
  );
}

function ReservationRow({
  row,
  invoiceModel,
  onFacturar,
}: {
  row: MonthlyRow;
  invoiceModel: "total" | "comision";
  onFacturar: (row: MonthlyRow) => void;
}) {
  const createPurchase = useConvexAction(
    api.siigo.createPurchaseInvoiceForOwnerPayout,
  );
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const alreadyInvoiced =
    row.saleInvoice != null && row.saleInvoice.status !== "error";
  const isPaid = row.paymentStatus === "PAID";

  const runPurchase = async () => {
    setLoadingPurchase(true);
    try {
      const res = await createPurchase({ bookingId: row._id as Id<"bookings"> });
      toast.success(`Factura de compra (borrador) creada por ${money(res.total)}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear la compra.",
      );
    } finally {
      setLoadingPurchase(false);
    }
  };

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-3 py-2.5">
        <p className="font-semibold text-sm">{row.reference ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{row.propertyTitle ?? "—"}</p>
      </td>
      <td className="px-3 py-2.5 text-sm">
        <p>{row.nombreCompleto}</p>
        <p className="text-xs text-muted-foreground">CC {row.cedula}</p>
      </td>
      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">
        {money(row.precioTotal)}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
            isPaid
              ? "bg-emerald-100 text-emerald-800"
              : "bg-orange-100 text-orange-800"
          }`}
        >
          {row.paymentStatus}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <StatusBadge invoice={row.saleInvoice} />
          {row.saleInvoice?.publicUrl ? (
            <a
              href={row.saleInvoice.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="Ver en Siigo"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onFacturar(row)}
            disabled={alreadyInvoiced || !isPaid}
            title={
              alreadyInvoiced
                ? "Ya facturada"
                : !isPaid
                  ? "La reserva no está pagada al 100%"
                  : "Crear factura de venta (borrador)"
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 h-8 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Receipt className="h-3.5 w-3.5" /> Facturar
          </button>
          {row.hasOwnerPayout ? (
            <button
              onClick={() => void runPurchase()}
              disabled={
                loadingPurchase ||
                (row.purchaseInvoice != null &&
                  row.purchaseInvoice.status !== "error")
              }
              title="Crear cuenta por pagar / compra al propietario (borrador)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 h-8 text-xs font-semibold hover:bg-muted disabled:opacity-40"
            >
              {loadingPurchase ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Home className="h-3.5 w-3.5" />
              )}
              Compra
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ConfigTab() {
  const settings = useConvexQuery(api.siigo.getSettings, {});
  const options = useConvexQuery(api.siigo.getConfigOptions, {}) as
    | {
        salesDocs?: { id: number; name?: string; code?: string }[];
        purchaseDocs?: { id: number; name?: string; code?: string }[];
        salesPayments?: { id: number; name?: string }[];
        purchasePayments?: { id: number; name?: string }[];
        users?: {
          id: number;
          username?: string;
          first_name?: string;
          last_name?: string;
        }[];
        taxes?: { id: number; name?: string; percentage?: number }[];
        products?: { code?: string; name?: string }[];
        syncedAt?: number;
      }
    | null
    | undefined;

  const testConnection = useConvexAction(api.siigo.testConnection);
  const syncConfig = useConvexAction(api.siigo.syncConfig);
  const setSettings = useConvexMutation(api.siigo.setSettings);

  const [busy, setBusy] = useState<"test" | "sync" | "save" | null>(null);

  // Estado del formulario (inicializado desde settings al primer render con datos).
  const [form, setForm] = useState<Record<string, string>>({});
  const [formReady, setFormReady] = useState(false);
  if (settings !== undefined && !formReady) {
    setForm({
      invoiceModel: settings?.invoiceModel ?? "total",
      comisionType: settings?.comisionType ?? "percent",
      comisionValue: settings?.comisionValue != null ? String(settings.comisionValue) : "",
      salesDocumentTypeId:
        settings?.salesDocumentTypeId != null ? String(settings.salesDocumentTypeId) : "",
      purchaseDocumentTypeId:
        settings?.purchaseDocumentTypeId != null
          ? String(settings.purchaseDocumentTypeId)
          : "",
      sellerUserId: settings?.sellerUserId != null ? String(settings.sellerUserId) : "",
      salesPaymentTypeId:
        settings?.salesPaymentTypeId != null ? String(settings.salesPaymentTypeId) : "",
      purchasePaymentTypeId:
        settings?.purchasePaymentTypeId != null
          ? String(settings.purchasePaymentTypeId)
          : "",
      taxId:
        settings?.taxIds && settings.taxIds.length ? String(settings.taxIds[0]) : "",
      defaultProductCode: settings?.defaultProductCode ?? "",
      comisionProductCode: settings?.comisionProductCode ?? "",
    });
    setFormReady(true);
  }

  const upd = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const doTest = async () => {
    setBusy("test");
    try {
      const res = await testConnection({});
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión.");
    } finally {
      setBusy(null);
    }
  };

  const doSync = async () => {
    setBusy("sync");
    try {
      await syncConfig({});
      toast.success("Configuración de Siigo sincronizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
    } finally {
      setBusy(null);
    }
  };

  const doSave = async () => {
    setBusy("save");
    try {
      await setSettings({
        invoiceModel: (form.invoiceModel as "total" | "comision") || "total",
        comisionType: (form.comisionType as "percent" | "fixed") || undefined,
        comisionValue: form.comisionValue ? Number(form.comisionValue) : undefined,
        salesDocumentTypeId: form.salesDocumentTypeId
          ? Number(form.salesDocumentTypeId)
          : undefined,
        purchaseDocumentTypeId: form.purchaseDocumentTypeId
          ? Number(form.purchaseDocumentTypeId)
          : undefined,
        sellerUserId: form.sellerUserId ? Number(form.sellerUserId) : undefined,
        salesPaymentTypeId: form.salesPaymentTypeId
          ? Number(form.salesPaymentTypeId)
          : undefined,
        purchasePaymentTypeId: form.purchasePaymentTypeId
          ? Number(form.purchasePaymentTypeId)
          : undefined,
        taxIds: form.taxId ? [Number(form.taxId)] : [],
        defaultProductCode: form.defaultProductCode || undefined,
        comisionProductCode: form.comisionProductCode || undefined,
      });
      toast.success("Configuración guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  };

  const hasOptions = !!options?.syncedAt;

  const Select = ({
    label,
    field,
    children,
  }: {
    label: string;
    field: string;
    children: React.ReactNode;
  }) => (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select
        value={form[field] ?? ""}
        onChange={(e) => upd(field, e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
      >
        <option value="">— Selecciona —</option>
        {children}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-bold">Conexión con Siigo</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Primero prueba la conexión (usa las credenciales configuradas en el
          entorno) y luego sincroniza la configuración de la cuenta.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void doTest()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {busy === "test" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            Probar conexión
          </button>
          <button
            onClick={() => void doSync()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {busy === "sync" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar configuración
          </button>
          {hasOptions ? (
            <span className="inline-flex items-center gap-1 self-center text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Configuración sincronizada
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <h3 className="font-bold">Modelo de facturación</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["total", "Valor total de la reserva"],
              ["comision", "Solo comisión FincasYA"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => upd("invoiceModel", value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                (form.invoiceModel ?? "total") === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {form.invoiceModel === "comision" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Tipo de comisión" field="comisionType">
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Valor fijo (COP)</option>
            </Select>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                {form.comisionType === "fixed" ? "Valor fijo (COP)" : "Porcentaje (%)"}
              </span>
              <input
                inputMode="numeric"
                value={form.comisionValue ?? ""}
                onChange={(e) => upd("comisionValue", e.target.value.replace(/[^\d.]/g, ""))}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                placeholder={form.comisionType === "fixed" ? "Ej: 150000" : "Ej: 10"}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-bold">Datos de la cuenta Siigo</h3>
        {!hasOptions ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Sincroniza la configuración para cargar las opciones (tipos de
            documento, vendedor, impuestos, productos).
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Select label="Tipo de documento — Venta (FV)" field="salesDocumentTypeId">
              {(options?.salesDocs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.code ?? d.id}
                </option>
              ))}
            </Select>
            <Select label="Vendedor" field="sellerUserId">
              {(options?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                    u.username ||
                    u.id}
                </option>
              ))}
            </Select>
            <Select label="Forma de pago — Venta" field="salesPaymentTypeId">
              {(options?.salesPayments ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id}
                </option>
              ))}
            </Select>
            <Select label="Impuesto (IVA / consumo)" field="taxId">
              {(options?.taxes ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name ?? t.id}
                  {t.percentage != null ? ` (${t.percentage}%)` : ""}
                </option>
              ))}
            </Select>
            <Select label="Producto/servicio — Arriendo" field="defaultProductCode">
              {(options?.products ?? [])
                .filter((p) => p.code)
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name ? `${p.name} (${p.code})` : p.code}
                  </option>
                ))}
            </Select>
            {form.invoiceModel === "comision" ? (
              <Select label="Producto/servicio — Comisión" field="comisionProductCode">
                {(options?.products ?? [])
                  .filter((p) => p.code)
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name ? `${p.name} (${p.code})` : p.code}
                    </option>
                  ))}
              </Select>
            ) : null}
            <Select
              label="Tipo de documento — Compra (FC)"
              field="purchaseDocumentTypeId"
            >
              {(options?.purchaseDocs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.code ?? d.id}
                </option>
              ))}
            </Select>
            <Select label="Forma de pago — Compra" field="purchasePaymentTypeId">
              {(options?.purchasePayments ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Timbrado DIAN deshabilitado
            (fase 1 — solo borradores)
          </span>
          <button
            onClick={() => void doSave()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 h-9 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            Guardar configuración
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FacturacionPage() {
  const [tab, setTab] = useState<"mes" | "config">("mes");
  const [month, setMonth] = useState(currentMonthValue());
  const { monthStart, monthEnd } = useMemo(() => monthBounds(month), [month]);

  const settings = useConvexQuery(api.siigo.getSettings, {});
  const invoiceModel = (settings?.invoiceModel ?? "total") as "total" | "comision";

  const rows = useConvexQuery(api.siigo.listMonthlyReservations, {
    monthStart,
    monthEnd,
  }) as MonthlyRow[] | undefined;

  const [confirmRow, setConfirmRow] = useState<MonthlyRow | null>(null);
  const isLoading = rows === undefined;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <Receipt className="w-5 h-5 text-primary" />
          </span>
          Facturación (Siigo)
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-11">
          Genera facturas de venta y compras en Siigo a partir de las reservas.
          En esta fase todo se crea como <b>borrador</b> (no se envía a la DIAN).
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["mes", "Reservas del mes"],
            ["config", "Configuración"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "config" ? (
              <Settings2 className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {label}
          </button>
        ))}
      </div>

      {tab === "config" ? (
        <ConfigTab />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-muted-foreground">
              Mes
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
            />
          </div>

          <SummaryCards monthStart={monthStart} monthEnd={monthEnd} />

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando reservas…
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                No hay reservas con llegada en este mes.
              </div>
            ) : (
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Reserva</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5">Total</th>
                    <th className="px-3 py-2.5">Pago</th>
                    <th className="px-3 py-2.5">Factura</th>
                    <th className="px-3 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ReservationRow
                      key={row._id}
                      row={row}
                      invoiceModel={invoiceModel}
                      onFacturar={setConfirmRow}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {confirmRow ? (
        <ConfirmInvoiceModal
          row={confirmRow}
          invoiceModel={invoiceModel}
          onClose={() => setConfirmRow(null)}
          onConfirmed={() => setConfirmRow(null)}
        />
      ) : null}
    </div>
  );
}
