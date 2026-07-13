"use client";

/**
 * Contenido de la sección "Abonos y pagos" del panel de reserva.
 * Sin tarjeta ni título propios: se renderiza dentro de un <DetailSection>
 * (acordeón) que aporta el encabezado. Paleta neutra y sobria — los estados
 * se comunican con texto, no con bloques de color.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useConvex, useMutation as useConvexMutation } from "convex/react";
import { api as convexApi } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CreditCard,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatOperatorLabel,
  getCurrentUser,
} from "@/features/auth/api/auth.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatPriceInput, parseCOP } from "@/lib/utils";

type PaymentType = "ABONO_50" | "SALDO_50" | "COMPLETO" | "REEMBOLSO";

type BookingPayment = {
  _id: string;
  type: PaymentType;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  status?: string;
  receiptUrl?: string;
  verifiedBy?: string;
  verifiedAt?: number;
  createdAt: number;
};

type PaymentsSummary = {
  precioTotal: number;
  paymentStatus?: string;
  netPaid: number;
  pending: number;
  payments: BookingPayment[];
};

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ABONO_50: "Abono / anticipo",
  SALDO_50: "Saldo",
  COMPLETO: "Pago completo",
  REEMBOLSO: "Reembolso",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Abonado parcial",
  PAID: "Pagado",
  REFUNDED: "Reembolsado",
};

const PAYMENT_FIELD_CLASS = "h-10 w-full rounded-xl";

function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

/** Responsable que registró o aprobó el abono (campo o notas históricas). */
function resolvePaymentResponsible(payment: BookingPayment): string | null {
  const direct = payment.verifiedBy?.trim();
  if (direct) return direct;
  const notes = payment.notes ?? "";
  const porMatch = notes.match(/\bpor\s+([^·.\n]+)/i);
  if (porMatch?.[1]?.trim()) return porMatch[1].trim();
  return null;
}

function formatOperationalNotes(notes?: string): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  if (/^Abono verificado y aprobado en Revisión de Pagos/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

type BookingPaymentsSectionProps = {
  bookingId: string;
  precioTotal?: number;
  onPaymentStatusChange?: (status: string) => void;
};

export function BookingPaymentsSection({
  bookingId,
  precioTotal,
  onPaymentStatusChange,
}: BookingPaymentsSectionProps) {
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "ABONO_50" as PaymentType,
    amount: "",
    paymentMethod: "Transferencia",
    reference: "",
    notes: "",
  });

  // "Validar pago": flujo simple (valor + soporte) para soportes que llegan
  // por correo/WhatsApp. Registra el abono y actualiza el estado.
  const [showValidate, setShowValidate] = useState(false);
  const [validating, setValidating] = useState(false);
  const [vForm, setVForm] = useState({
    amount: "",
    paymentMethod: "Transferencia",
  });
  const [vFile, setVFile] = useState<File | null>(null);
  const [actor, setActor] = useState("");
  const formAmountPrefilledRef = useRef(false);

  // Convex directo (reactivo). Los abonos se leen/crean/borran sin pasar por
  // rutas REST; el comprobante ("soporte") sube al bucket S3.
  const convex = useConvex();
  const createPaymentMut = useConvexMutation(convexApi.bookings.createPayment);
  const deletePaymentMut = useConvexMutation(convexApi.bookings.deletePayment);
  const bookingConvexId = bookingId as Id<"bookings">;

  const uploadSoporteToS3 = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "images");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const body = (await res.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null;
    if (!res.ok || !body?.url) {
      throw new Error(body?.error ?? "No se pudo subir el soporte");
    }
    return body.url;
  };

  useEffect(() => {
    getCurrentUser()
      .then((u) => setActor(formatOperatorLabel(u)))
      .catch(() => {});
  }, []);

  const handleValidate = async () => {
    const amount = parseCOP(vForm.amount);
    if (amount <= 0) {
      toast.error("Ingresa un valor válido.");
      return;
    }
    setValidating(true);
    try {
      const receiptUrl = vFile ? await uploadSoporteToS3(vFile) : undefined;
      await createPaymentMut({
        bookingId: bookingConvexId,
        type: "ABONO_50",
        amount,
        paymentMethod: vForm.paymentMethod,
        receiptUrl,
        verifiedBy: actor || undefined,
        verifiedAt: Date.now(),
        notes: "Pago validado con soporte",
      });
      await loadPayments();
      toast.success("Pago validado y abono registrado.");
      setShowValidate(false);
      setVForm({ amount: "", paymentMethod: "Transferencia" });
      setVFile(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo validar el pago.";
      toast.error(message);
    } finally {
      setValidating(false);
    }
  };

  // Eliminar un abono cargado por error (con confirmación inline).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (paymentId: string) => {
    setDeletingId(paymentId);
    try {
      await deletePaymentMut({ paymentId: paymentId as Id<"payments"> });
      await loadPayments();
      toast.success("Abono eliminado.");
      setConfirmDeleteId(null);
    } catch {
      toast.error("No se pudo eliminar el abono.");
    } finally {
      setDeletingId(null);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = (await convex.query(
        convexApi.bookings.getPaymentsByBooking,
        { bookingId: bookingConvexId },
      )) as PaymentsSummary | null;
      setSummary(data);
      if (data?.paymentStatus && onPaymentStatusChange) {
        onPaymentStatusChange(data.paymentStatus);
      }
    } catch {
      toast.error("No se pudieron cargar los abonos de esta reserva.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) return;
    void loadPayments();
  }, [bookingId]);

  const total = summary?.precioTotal ?? precioTotal ?? 0;
  const netPaid = summary?.netPaid ?? 0;
  const pending = summary?.pending ?? Math.max(0, total - netPaid);
  const progress = total > 0 ? Math.min(100, (netPaid / total) * 100) : 0;

  const statusLabel = useMemo(() => {
    const key = String(summary?.paymentStatus ?? "PENDING").toUpperCase();
    return PAYMENT_STATUS_LABELS[key] ?? key;
  }, [summary?.paymentStatus]);

  const handleSubmit = async () => {
    const amount = parseCOP(form.amount);
    if (amount <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }

    setSaving(true);
    try {
      await createPaymentMut({
        bookingId: bookingConvexId,
        type: form.type,
        amount,
        paymentMethod: form.paymentMethod,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        verifiedBy: actor || undefined,
      });
      await loadPayments();
      toast.success("Abono registrado correctamente.");
      setShowForm(false);
      setForm({
        type: "ABONO_50",
        amount: pending > 0 ? formatPriceInput(pending) : "",
        paymentMethod: "Transferencia",
        reference: "",
        notes: "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo registrar el abono.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!showForm) {
      formAmountPrefilledRef.current = false;
      return;
    }
    if (pending > 0 && !formAmountPrefilledRef.current) {
      setForm((prev) => ({
        ...prev,
        amount: formatPriceInput(pending),
      }));
      formAmountPrefilledRef.current = true;
    }
  }, [showForm, pending]);

  return (
    <div className="space-y-4">
      {/* Resumen: total / pagado / pendiente — neutro, sin bloques de color */}
      <div className="divide-x divide-border/60 grid grid-cols-3 rounded-xl border border-border/60">
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total
          </p>
          <p className="text-sm font-semibold text-foreground">
            {formatCop(total)}
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pagado
          </p>
          <p className="text-sm font-semibold text-foreground">
            {formatCop(netPaid)}
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pendiente
          </p>
          <p className="text-sm font-bold text-foreground">
            {formatCop(pending)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground/80 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] font-medium text-muted-foreground">
          {Math.round(progress)}% abonado · {statusLabel}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando abonos...
        </div>
      ) : summary && summary.payments.length > 0 ? (
        <div className="space-y-2">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Historial de abonos
          </p>
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {summary.payments.map((payment) => {
              const responsible = resolvePaymentResponsible(payment);
              const operationalNotes = formatOperationalNotes(payment.notes);
              const validatedAt = payment.verifiedAt ?? payment.createdAt;

              return (
                <div
                  key={payment._id}
                  className="flex items-start justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {PAYMENT_TYPE_LABELS[payment.type] ?? payment.type}
                      </span>
                      {payment.paymentMethod && (
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase text-muted-foreground"
                        >
                          {payment.paymentMethod}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {format(new Date(payment.createdAt), "dd MMM yyyy · HH:mm", {
                        locale: es,
                      })}
                      {payment.reference ? ` · Ref. ${payment.reference}` : ""}
                    </p>
                    {responsible ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Registrado por{" "}
                        <span className="font-semibold text-foreground">
                          {responsible}
                        </span>
                        {payment.verifiedAt &&
                        payment.verifiedAt !== payment.createdAt
                          ? ` · ${format(new Date(validatedAt), "dd MMM yyyy · HH:mm", { locale: es })}`
                          : ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] italic text-muted-foreground/80">
                        Sin responsable registrado
                      </p>
                    )}
                    {operationalNotes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {operationalNotes}
                      </p>
                    )}
                    {payment.receiptUrl && (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                      >
                        <FileText className="h-3 w-3" /> Ver soporte
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        payment.type === "REEMBOLSO"
                          ? "text-red-600"
                          : "text-foreground",
                      )}
                    >
                      {payment.type === "REEMBOLSO" ? "−" : "+"}
                      {formatCop(payment.amount)}
                    </span>
                    {confirmDeleteId === payment._id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleDelete(payment._id)}
                          disabled={deletingId === payment._id}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline disabled:opacity-60"
                        >
                          {deletingId === payment._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Sí, eliminar"
                          )}
                        </button>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === payment._id}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(payment._id)}
                        title="Eliminar abono"
                        className="text-muted-foreground/60 transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="py-2 text-xs text-muted-foreground">
          Aún no hay abonos registrados para esta reserva.
        </p>
      )}

      {/* Validar pago: flujo simple con soporte (correo/WhatsApp) */}
      {!showValidate ? (
        <Button
          type="button"
          className="h-11 w-full rounded-xl text-white text-sm font-semibold"
          onClick={() => {
            setShowValidate(true);
            setShowForm(false);
            setVForm((prev) => ({
              ...prev,
              amount: pending > 0 ? formatPriceInput(pending) : "",
            }));
          }}
        >
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          Validar pago
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Validar pago
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Valor (COP)
              </Label>
              <Input
                inputMode="numeric"
                value={vForm.amount}
                onChange={(e) =>
                  setVForm((prev) => ({
                    ...prev,
                    amount: formatPriceInput(e.target.value),
                  }))
                }
                className={PAYMENT_FIELD_CLASS}
                placeholder="Ej: 1.650.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Método
              </Label>
              <Select
                value={vForm.paymentMethod}
                onValueChange={(value) =>
                  setVForm((prev) => ({ ...prev, paymentMethod: value }))
                }
              >
                <SelectTrigger className={PAYMENT_FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Transferencia",
                    "Efectivo",
                    "Nequi",
                    "Bancolombia",
                    "Bold",
                    "Otro",
                  ].map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Soporte (imagen/PDF)
            </Label>
            <input
              type="file"
              id={`validate-file-${bookingId}`}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setVFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor={`validate-file-${bookingId}`}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted/30"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="truncate">
                {vFile ? vFile.name : "Cargar soporte"}
              </span>
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl text-xs font-semibold"
              onClick={() => void handleValidate()}
              disabled={validating}
            >
              {validating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Validar y registrar
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-xl text-xs"
              onClick={() => setShowValidate(false)}
              disabled={validating}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!showForm ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full rounded-xl text-xs font-semibold"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Registrar abono (sin soporte)
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Tipo
              </Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, type: value as PaymentType }))
                }
              >
                <SelectTrigger className={PAYMENT_FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Monto (COP)
              </Label>
              <Input
                inputMode="numeric"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    amount: formatPriceInput(e.target.value),
                  }))
                }
                className={PAYMENT_FIELD_CLASS}
                placeholder="Ej: 1.650.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Método
              </Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, paymentMethod: value }))
                }
              >
                <SelectTrigger className={PAYMENT_FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Transferencia",
                    "Efectivo",
                    "Nequi",
                    "Bancolombia",
                    "Bold",
                    "Otro",
                  ].map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Referencia (opcional)
              </Label>
              <Input
                value={form.reference}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reference: e.target.value }))
                }
                className={PAYMENT_FIELD_CLASS}
                placeholder="Nº comprobante"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Nota (opcional)
            </Label>
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              className={PAYMENT_FIELD_CLASS}
              placeholder="Ej. Abono del 50% por transferencia"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl text-xs font-semibold text-white"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                  Guardar abono
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-xl text-xs"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
