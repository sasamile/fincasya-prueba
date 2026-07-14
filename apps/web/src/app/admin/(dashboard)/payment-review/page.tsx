"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
  useAction as useConvexAction,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  ShieldCheck,
  Loader2,
  ZoomIn,
  Minimize2,
  Check,
  X,
  RefreshCw,
  Wand2,
  Search,
  ShoppingBag,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { validateSaleLinkPaymentAdmin } from "@/features/ventas/api/sale-links.api";
import { saleLinkDocumentPreviewSrc } from "@/lib/sale-link-document-preview";

type ReceiptSource = "portal" | "sale-link";

type PendingReceipt = {
  source?: ReceiptSource;
  bookingId: string | null;
  saleLinkToken?: string;
  receiptId: string;
  reference: string;
  propertyTitle?: string;
  clienteNombre?: string;
  clienteCedula?: string;
  precioTotal?: number;
  pagado?: number;
  pendiente?: number;
  amount?: number;
  aiExtractedAmount?: number;
  aiExtractedBank?: string;
  aiExtractConfidence?: number;
  bankName?: string;
  receiptUrl: string;
  fileName?: string;
  submittedAt?: number;
};

type SourceFilter = "all" | "portal" | "sale-link";

function money(v?: number) {
  if (!v || v <= 0) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);
}

function parseCop(s: string) {
  return Math.max(0, Math.floor(Number(String(s).replace(/[^\d]/g, "")) || 0));
}

function receiptPreviewUrl(r: PendingReceipt) {
  if (r.source === "sale-link" && r.saleLinkToken) {
    return saleLinkDocumentPreviewSrc(r.saleLinkToken, "payment-proof");
  }
  return r.receiptUrl;
}

function ReceiptReviewCard({
  r,
  onDone,
}: {
  r: PendingReceipt;
  onDone: () => void;
}) {
  const setReceiptStatus = useConvexMutation(api.paymentReceipts.setReceiptStatus);
  const suggestAmount = useConvexAction(api.paymentReceipts.suggestReceiptAmount);
  const isSaleLink = r.source === "sale-link";
  const previewUrl = receiptPreviewUrl(r);
  const suggested =
    r.aiExtractedAmount || r.amount || r.pendiente || undefined;
  const [amount, setAmount] = useState<string>(
    suggested ? String(suggested) : "",
  );
  const [motivo, setMotivo] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState<"approve" | "reject" | "ai" | null>(
    null,
  );
  const [zoomed, setZoomed] = useState(false);

  // Cuando la IA termina en background, rellena el campo si aún no lo editaron.
  useEffect(() => {
    const next = r.aiExtractedAmount || r.amount;
    if (!next || next <= 0) return;
    setAmount((prev) => {
      const current = parseCop(prev);
      if (current > 0 && current !== next && !r.aiExtractedAmount) return prev;
      if (current === next) return prev;
      if (current > 0 && current !== (r.pendiente || 0)) return prev;
      return String(next);
    });
  }, [r.aiExtractedAmount, r.amount, r.pendiente]);

  const runAiSuggest = async () => {
    if (!r.bookingId || isSaleLink) return;
    setLoading("ai");
    try {
      const res = await suggestAmount({
        bookingId: r.bookingId as Id<"bookings">,
        receiptId: r.receiptId,
      });
      if (!res.ok) {
        const reasons: Record<string, string> = {
          pdf_not_supported: "Los PDF aún no se leen con IA (usa una foto).",
          no_amount: "No se pudo leer un monto claro en el comprobante.",
          not_found: "Soporte no encontrado.",
          not_pending: "Este soporte ya no está pendiente.",
        };
        toast.error(reasons[String(res.reason)] ?? "No se pudo analizar el soporte.");
        return;
      }
      if (res.amount) setAmount(String(res.amount));
      toast.success(
        `IA sugiere ${money(res.amount)}${res.bankName ? ` · ${res.bankName}` : ""}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al analizar con IA",
      );
    } finally {
      setLoading(null);
    }
  };

  const approve = async () => {
    if (isSaleLink) {
      if (!r.saleLinkToken) {
        toast.error("Falta el token del link de venta.");
        return;
      }
      setLoading("approve");
      try {
        const res = await validateSaleLinkPaymentAdmin(r.saleLinkToken);
        if (!res.ok) {
          toast.error(res.reason ?? "No se pudo validar el pago del link de venta.");
          return;
        }
        toast.success(
          res.alreadyValidated
            ? "El pago ya estaba validado."
            : "Pago del link de venta validado. Se generará contrato y CR.",
        );
        onDone();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : null;
        toast.error(message ?? "No se pudo validar el pago del link de venta.");
      } finally {
        setLoading(null);
      }
      return;
    }

    if (!r.bookingId) {
      toast.error("Reserva no encontrada para este soporte.");
      return;
    }
    const value = parseCop(amount);
    if (value <= 0) {
      toast.error("Ingresa el monto verificado.");
      return;
    }
    setLoading("approve");
    try {
      await setReceiptStatus({
        bookingId: r.bookingId as Id<"bookings">,
        receiptId: r.receiptId,
        status: "approved",
        reviewedAmount: value,
      });
      toast.success(`Abono de ${money(value)} aprobado y reflejado en la reserva.`);
      onDone();
    } catch {
      toast.error("No se pudo aprobar el soporte.");
    } finally {
      setLoading(null);
    }
  };

  const reject = async () => {
    if (isSaleLink) {
      toast.error(
        "Para links de venta usa Links de Venta → Reiniciar comprobante si necesitas rechazar.",
      );
      return;
    }
    if (!r.bookingId) {
      toast.error("Reserva no encontrada.");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Escribe el motivo del rechazo.");
      return;
    }
    setLoading("reject");
    try {
      await setReceiptStatus({
        bookingId: r.bookingId as Id<"bookings">,
        receiptId: r.receiptId,
        status: "rejected",
        rejectReason: motivo.trim(),
      });
      toast.success("Soporte rechazado.");
      onDone();
    } catch {
      toast.error("No se pudo rechazar el soporte.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          title={zoomed ? "Reducir comprobante" : "Ampliar comprobante"}
          className="group relative block shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={r.fileName || "Comprobante"}
            className="aspect-4/3 w-full object-contain bg-white"
          />
          <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
            <ZoomIn className="h-3 w-3" /> Ampliar
          </span>
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{r.reference}</span>
            <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
              Por revisar
            </span>
            {isSaleLink ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                <ShoppingBag className="h-3 w-3" />
                Link de venta
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                <CreditCard className="h-3 w-3" />
                Check-in / portal
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {[r.propertyTitle, r.clienteNombre].filter(Boolean).join(" · ")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Reportó</p>
              <p className="font-semibold">{money(r.amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Origen</p>
              <p className="font-semibold">{r.bankName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total reserva</p>
              <p className="font-semibold">{money(r.precioTotal)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Saldo pendiente</p>
              <p className="font-semibold text-orange-700">
                {money(r.pendiente)}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            {!isSaleLink ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  Monto verificado
                </label>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 2.000.000"
                  className="h-9 w-36 rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                {r.aiExtractedAmount ? (
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                    IA {money(r.aiExtractedAmount)}
                    {typeof r.aiExtractConfidence === "number"
                      ? ` · ${Math.round(r.aiExtractConfidence * 100)}%`
                      : ""}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void runAiSuggest()}
                  disabled={loading !== null}
                  title="Leer el monto del comprobante con IA"
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 h-9 text-[11px] font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                >
                  {loading === "ai" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Leer con IA
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Al aprobar se valida el pago del link de venta (contrato + CR).
              </p>
            )}
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                onClick={approve}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 h-9 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading === "approve" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {isSaleLink ? "Validar pago" : "Aprobar abono"}
              </button>
              {!isSaleLink ? (
                <button
                  onClick={() => setShowReject((s) => !s)}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 h-9 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" /> Rechazar
                </button>
              ) : null}
            </div>
          </div>

          {showReject && !isSaleLink ? (
            <div className="flex flex-col sm:flex-row items-stretch gap-2 rounded-xl border border-red-200 bg-red-50/50 p-2.5">
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo del rechazo (ej. no se ve el valor, no ingresó el pago)"
                className="h-9 flex-1 rounded-lg border border-red-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40"
              />
              <button
                onClick={reject}
                disabled={loading !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 h-9 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading === "reject" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Confirmar rechazo
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {zoomed ? (
        <div className="mt-4 rounded-xl border border-border bg-white p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">
              {r.fileName || "Comprobante de pago"}
            </span>
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Minimize2 className="h-3.5 w-3.5" /> Reducir
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={r.fileName || "Comprobante"}
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

export default function PaymentReviewPage() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  const rawPending = useConvexQuery(api.paymentReceipts.listPending, {
    source: "all",
  });
  const backfillPending = useConvexMutation(
    api.paymentReceipts.backfillPendingFlag,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const isLoading = rawPending === undefined;
  const allItems = (rawPending?.items ?? []) as PendingReceipt[];

  const items = useMemo(() => {
    let list = allItems;
    if (sourceFilter === "portal") {
      list = list.filter((i) => i.source !== "sale-link");
    } else if (sourceFilter === "sale-link") {
      list = list.filter((i) => i.source === "sale-link");
    }
    const q = searchDebounced.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) =>
      [i.reference, i.propertyTitle, i.clienteNombre, i.clienteCedula]
        .some((f) => String(f ?? "").toLowerCase().includes(q)),
    );
  }, [allItems, sourceFilter, searchDebounced]);

  const counts = useMemo(() => {
    const portal = allItems.filter((i) => i.source !== "sale-link").length;
    const saleLink = allItems.filter((i) => i.source === "sale-link").length;
    return { portal, saleLink, total: allItems.length };
  }, [allItems]);

  const refetch = () => {
    /* Convex es reactivo: no hace falta invalidar manualmente. */
  };

  const sync = async () => {
    setIsSyncing(true);
    try {
      await backfillPending({});
      toast.success("Soportes sincronizados.");
    } catch {
      toast.error("No se pudo sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-500/10">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
            </span>
            Revisión de pagos
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-11">
            Soportes del check-in y de los links de venta pendientes de validar.
            Las fotos se leen con IA al llegar para sugerir el monto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void sync()}
            disabled={isSyncing}
            title="Detecta soportes pendientes de reservas anteriores"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition disabled:opacity-60"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            Sincronizar
          </button>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearchDebounced(search);
            }}
            placeholder="Buscar por CR, cliente, finca…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button
          type="button"
          onClick={() => setSearchDebounced(search)}
          className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
        >
          Buscar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `Todos (${counts.total})`],
            ["portal", `Check-in / portal (${counts.portal})`],
            ["sale-link", `Links de venta (${counts.saleLink})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSourceFilter(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              sourceFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando soportes…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed border-border rounded-2xl space-y-2 px-4">
          <p>No hay soportes de pago por revisar. 🎉</p>
          {sourceFilter === "sale-link" ? (
            <p className="text-xs max-w-md mx-auto leading-relaxed">
              Los links de venta solo aparecen aquí mientras el pago NO está
              validado. Si ya lo aprobaste (correo «Revisar pago» o Links de
              venta), desaparece de esta lista y el cliente puede seguir con el
              contrato.
            </p>
          ) : (
            <p className="text-xs max-w-md mx-auto leading-relaxed">
              El botón del correo de links de venta abre una página pública de
              validación (sin login). Esta cola lista check-in/portal y links
              aún pendientes.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <ReceiptReviewCard
              key={`${r.source ?? "portal"}-${r.receiptId}`}
              r={r}
              onDone={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
