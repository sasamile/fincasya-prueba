"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  QrCode,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";
import type { PaymentBreakdownLine } from "@/features/admin/utils/payment-whatsapp-message";
import {
  type CheckinBankAccount,
  formatAccountNumber,
  formatCop,
  groupAccountsByHolder,
} from "@/features/checkin/utils/payment-holders";

// WhatsApp de asesores (mismo número del Soporte 24/7) cuando la subida
// en el portal está deshabilitada (default / toggle en admin).
const SOPORTE_WHATSAPP_E164 = "573157773937";

// ---------------------------------------------------------------------------
// QR Modal
// ---------------------------------------------------------------------------
function QRModal({
  images,
  bankName,
  onClose,
}: {
  images: string[];
  bankName: string;
  onClose: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-xl"
        >
          <X className="h-4 w-4 text-gray-700" />
        </button>
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="border-b border-gray-100 px-4 py-3 text-center">
            <p className="text-sm font-black text-gray-900">{bankName}</p>
            <p className="text-[11px] text-gray-400">QR de pago</p>
          </div>
          <div className="p-4">
            <img
              src={images[activeIdx]}
              alt={`QR ${bankName} ${activeIdx + 1}`}
              className="w-full rounded-2xl border border-gray-100 object-contain"
            />
          </div>
          {images.length > 1 ? (
            <div className="flex justify-center gap-1.5 pb-4">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === activeIdx
                      ? "w-6 bg-emerald-600"
                      : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account card
// ---------------------------------------------------------------------------
function AccountCard({ account }: { account: CheckinBankAccount }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const displayNumber = formatAccountNumber(account.accountNumber);
  const copyValue = account.accountNumber.replace(/\s+/g, "");

  const qrImages = account.imageUrls?.length
    ? account.imageUrls
    : account.imageUrl
      ? [account.imageUrl]
      : [];

  // "Solo QR": por flag explícito o inferido (sin número pero con imagen de QR).
  const isQrOnly =
    account.qrOnly === true ||
    (!account.accountNumber?.trim() && qrImages.length > 0);

  // Llave Bre-B: por flag explícito o por nombre de banco "Bre-B".
  const isBreb =
    account.brebKey === true || /bre-?b/i.test(account.bankName || "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {qrOpen && qrImages.length > 0 ? (
        <QRModal
          images={qrImages}
          bankName={account.bankName || "QR de pago"}
          onClose={() => setQrOpen(false)}
        />
      ) : null}

      {isBreb ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
            <BankLogoBadge bankName={account.bankName || "Bre-B"} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Paga con Bre-B
              </p>
              <p className="text-[11px] text-gray-500">
                Desde la app de cualquier banco, con esta llave
              </p>
              <p className="mt-0.5 break-all font-mono text-lg font-bold tracking-wide text-gray-900">
                {account.accountNumber}
              </p>
            </div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors sm:flex-none ${
                  copied
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-gray-200 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : isQrOnly ? (
        <button
          type="button"
          onClick={() => qrImages.length > 0 && setQrOpen(true)}
          className="flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50/60"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-700">
            <QrCode className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900">Paga con QR</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">
              Puedes pagar desde cualquier entidad bancaria escaneando.
            </p>
          </div>
          <QrCode className="h-5 w-5 shrink-0 text-emerald-600" />
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
            <BankLogoBadge bankName={account.bankName} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                {account.bankName}
              </p>
              {account.accountType ? (
                <p className="text-[11px] text-gray-500">
                  {account.accountType}
                </p>
              ) : null}
              <p className="mt-0.5 break-all font-mono text-lg font-bold tracking-wide text-gray-900">
                {displayNumber}
              </p>
            </div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              {qrImages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 sm:flex-none"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Ver QR
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors sm:flex-none ${
                  copied
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-gray-200 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Receipt upload
// ---------------------------------------------------------------------------
const RECEIPT_FILE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "pdf",
]);

function isAllowedReceiptFile(file: File) {
  const mime = file.type || "";
  if (mime.startsWith("image/") || mime === "application/pdf") return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return RECEIPT_FILE_EXTENSIONS.has(ext);
}

function isReceiptPdf(file: { type?: string; name?: string }) {
  const mime = file.type || "";
  if (mime === "application/pdf") return true;
  return (file.name || "").toLowerCase().endsWith(".pdf");
}

function isStoredReceiptPdf(receipt: {
  receiptUrl: string;
  fileName?: string;
}) {
  if ((receipt.fileName || "").toLowerCase().endsWith(".pdf")) return true;
  return receipt.receiptUrl.toLowerCase().includes("application/pdf");
}

type SubmittedReceipt = {
  id: string;
  bankName?: string;
  amount?: number;
  receiptUrl: string;
  fileName?: string;
  status: string;
};

function PendingReceiptPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isPdf = isReceiptPdf(file);
  const previewUrl = useMemo(
    () => (isPdf ? null : URL.createObjectURL(file)),
    [file, isPdf],
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      {isPdf ? (
        <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 bg-gray-50 px-3">
          <FileText className="h-10 w-10 text-emerald-600" />
          <span className="text-center text-[10px] font-semibold text-gray-600">
            PDF
          </span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl!}
          alt={file.name}
          className="aspect-4/3 w-full bg-gray-100 object-contain"
        />
      )}
      <div className="flex items-center gap-2 border-t border-gray-100 px-2 py-2">
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-gray-600">
          {file.name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
          aria-label={`Quitar ${file.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ReceiptUpload({
  reference,
  bankAccounts,
  allowUpload,
  onPendingChange,
}: {
  reference: string;
  bankAccounts: CheckinBankAccount[];
  /** Si false, el cliente envía el soporte por WhatsApp (default). */
  allowUpload: boolean;
  /** Reporta cuántos comprobantes hay cargados pero SIN enviar. */
  onPendingChange?: (count: number) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [submittedReceipts, setSubmittedReceipts] = useState<SubmittedReceipt[]>(
    [],
  );
  const [selectedAccountId, setSelectedAccountId] = useState(
    bankAccounts.length === 1 ? bankAccounts[0].id : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const receiptHolders = useMemo(
    () => groupAccountsByHolder(bankAccounts),
    [bankAccounts],
  );

  const loadSubmittedReceipts = useCallback(async () => {
    try {
      const res = await fetch(`/api/payment/${encodeURIComponent(reference)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { receipts?: SubmittedReceipt[] };
      if (Array.isArray(data.receipts)) {
        setSubmittedReceipts(data.receipts);
      }
    } catch {
      /* opcional */
    }
  }, [reference]);

  useEffect(() => {
    void loadSubmittedReceipts();
  }, [loadSubmittedReceipts]);

  // Avisar al padre cuántos comprobantes hay cargados sin enviar, para que el
  // check-in pueda alertar antes de finalizar.
  useEffect(() => {
    onPendingChange?.(files.length);
  }, [files.length, onPendingChange]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(incoming)) {
      if (!isAllowedReceiptFile(file)) {
        rejected.push(`${file.name}: solo imagen o PDF`);
        continue;
      }
      if (file.size > 900_000) {
        rejected.push(`${file.name}: muy grande (máx. ~900 KB)`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
      setError(null);
    }
    if (rejected.length > 0) setError(rejected.join(" · "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Adjunta al menos un comprobante.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      for (const file of files) {
        const account = bankAccounts.find((a) => a.id === selectedAccountId);
        const fd = new FormData();
        fd.append("file", file);
        if (selectedAccountId) fd.append("bankAccountId", selectedAccountId);
        if (account?.bankName) fd.append("bankName", account.bankName);
        const res = await fetch(`/api/payment/${encodeURIComponent(reference)}`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `No se pudo enviar ${file.name}`);
        }
      }
      setSuccess(true);
      setFiles([]);
      await loadSubmittedReceipts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al enviar comprobante.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Interruptor: en vez de subir el soporte, el cliente lo comparte por WhatsApp.
  if (!allowUpload) {
    const waText = encodeURIComponent(
      `Hola, quiero enviar el soporte de pago de mi reserva ${reference}.`,
    );
    const waHref = `https://wa.me/${SOPORTE_WHATSAPP_E164}?text=${waText}`;
    return (
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          </span>
          <p className="text-sm font-black text-gray-900">
            Comparte tu soporte de pago
          </p>
        </div>

        <p className="text-[13px] leading-relaxed text-gray-600">
          Por favor envía el soporte de tu pago por WhatsApp a nuestros asesores.
          Comparte únicamente el comprobante del{" "}
          <strong className="font-bold text-gray-800">saldo pendiente</strong> —
          no el de la reserva ni soportes de pagos ya validados.
        </p>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#1EA952] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#179348]"
        >
          <MessageCircle className="h-5 w-5" />
          Enviar soporte por WhatsApp
        </a>

        {submittedReceipts.length > 0 ? (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Ya cargados
            </p>
            <ul className="space-y-1.5">
              {submittedReceipts.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    {r.fileName || r.bankName || "Comprobante"}
                    {r.status === "pending" ? " · en revisión" : ""}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12px] leading-relaxed text-amber-800">
            Tu pago queda{" "}
            <strong className="font-bold">
              sujeto a validación por parte de la administración
            </strong>
            . Una vez validado, se actualizará el estado de tu reserva.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-black text-gray-900">
          Subir comprobante de pago
        </p>
      </div>

      {/* Aviso destacado: solo el saldo pendiente */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-[13px] font-black uppercase tracking-wide text-red-700">
            Importante: solo el saldo pendiente
          </p>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-red-900">
          En este paso únicamente debes adjuntar el soporte del pago del{" "}
          <strong className="font-bold">saldo pendiente</strong>.{" "}
          <strong className="font-bold">
            No subas el comprobante de la reserva ni soportes de pagos ya
            validados
          </strong>
          , ya que esto puede generar retrasos en tu ingreso a la propiedad.
        </p>
      </div>

      {/* Validation notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] leading-relaxed text-amber-800">
          El comprobante cargado está{" "}
          <strong className="font-bold">
            sujeto a validación por parte de la administración
          </strong>
          . Una vez validado, se actualizará el estado de tu reserva.
        </p>
      </div>

      {/* Account selector — desplegable agrupado por titular, con número/QR
          para distinguir cuentas del mismo banco. */}
      {bankAccounts.length > 1 ? (
        <div className="space-y-1.5">
          <label
            htmlFor="receipt-account"
            className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500"
          >
            ¿A qué cuenta pagaste?
          </label>
          <select
            id="receipt-account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-medium text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Selecciona la cuenta…</option>
            {receiptHolders.map((holder) => (
              <optgroup key={holder.id} label={holder.name}>
                {holder.accounts.map((a) => {
                  const isQr =
                    a.qrOnly === true ||
                    (!a.accountNumber?.trim() &&
                      Boolean(a.imageUrls?.length || a.imageUrl));
                  const digits = a.accountNumber?.replace(/\D/g, "") ?? "";
                  const last4 = digits.slice(-4);
                  const detail = isQr
                    ? "Pago por QR"
                    : last4
                      ? `···· ${last4}`
                      : a.accountType || "";
                  return (
                    <option key={a.id} value={a.id}>
                      {[a.bankName || "Cuenta", detail]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}

      {submittedReceipts.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            Tus comprobantes enviados
          </p>
          <div className="grid grid-cols-2 gap-3">
            {submittedReceipts.map((r) => (
              <a
                key={r.id}
                href={r.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-xl border border-white bg-white shadow-sm"
              >
                {isStoredReceiptPdf(r) ? (
                  <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 bg-gray-50 px-3">
                    <FileText className="h-10 w-10 text-emerald-600" />
                    <span className="text-center text-[10px] font-semibold text-gray-600">
                      Ver PDF
                    </span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.receiptUrl}
                    alt={r.fileName || "Comprobante enviado"}
                    className="aspect-4/3 w-full bg-gray-100 object-contain"
                  />
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-[10px] font-bold text-gray-800">
                    {r.bankName || "Pago"}
                    {r.amount ? ` · ${formatCop(r.amount)}` : ""}
                  </p>
                  <p className="text-[9px] capitalize text-gray-400">
                    {r.status === "pending" ? "En revisión" : r.status}
                  </p>
                </div>
              </a>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-emerald-800/80">
            Toca un comprobante para verlo en tamaño completo.
          </p>
        </div>
      ) : null}

      {/* Vista previa antes de enviar */}
      {files.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Vista previa
          </p>
          <div className="grid grid-cols-2 gap-3">
            {files.map((f, i) => (
              <PendingReceiptPreview
                key={`${f.name}-${i}-${f.size}`}
                file={f}
                onRemove={() =>
                  setFiles((prev) => prev.filter((_, j) => j !== i))
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Drop zone */}
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/30 px-4 py-6 hover:bg-emerald-50/60">
        <Upload className="mb-1.5 h-6 w-6 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-700">
          {files.length > 0
            ? "Agregar más comprobantes"
            : "Seleccionar comprobante"}
        </span>
        <span className="mt-0.5 text-[11px] text-gray-400">
          JPG, PNG o PDF · máx. ~900 KB c/u
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
          <Check className="h-4 w-4 shrink-0" />
          Comprobante enviado. Lo ves arriba en &ldquo;Tus comprobantes
          enviados&rdquo; mientras el equipo lo revisa.
        </div>
      ) : null}

      {files.length > 0 && !isSubmitting ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] font-bold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          {files.length > 1
            ? "Aún no has enviado estos comprobantes."
            : "Aún no has enviado este comprobante."}{" "}
          Dale el botón verde de abajo 👇
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || files.length === 0}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-white disabled:opacity-60 ${
          files.length > 0
            ? "bg-emerald-600 ring-4 ring-emerald-300/50 hover:bg-emerald-700"
            : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
          </>
        ) : files.length > 1 ? (
          `Enviar ${files.length} comprobantes`
        ) : (
          "Enviar comprobante"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------
type CheckinPaymentSectionProps = {
  precioTotal: number;
  pagoTotal: number;
  pagoPendiente: number;
  pagoCompleto: boolean;
  breakdown: PaymentBreakdownLine[];
  bankAccounts: CheckinBankAccount[];
  reference?: string;
  boldLink?: string | null;
  boldSurcharge?: number | null;
  /** Admin habilita subida de comprobantes en esta reserva. */
  allowPaymentProofUpload?: boolean;
  /** Reporta comprobantes cargados sin enviar (para alertar al finalizar). */
  onPendingReceiptsChange?: (count: number) => void;
};

export function CheckinPaymentSection({
  precioTotal,
  pagoTotal,
  pagoPendiente,
  pagoCompleto,
  breakdown,
  bankAccounts,
  reference,
  boldLink,
  boldSurcharge,
  allowPaymentProofUpload = false,
  onPendingReceiptsChange,
}: CheckinPaymentSectionProps) {
  const holders = useMemo(
    () => groupAccountsByHolder(bankAccounts),
    [bankAccounts],
  );
  const [selectedHolderId, setSelectedHolderId] = useState("");

  useEffect(() => {
    if (holders.length === 0) {
      setSelectedHolderId("");
      return;
    }
    setSelectedHolderId((current) =>
      holders.some((holder) => holder.id === current)
        ? current
        : holders[0].id,
    );
  }, [holders]);

  const selectedHolder = holders.find((holder) => holder.id === selectedHolderId);
  const saldoPendiente =
    pagoPendiente > 0
      ? pagoPendiente
      : Math.max(0, precioTotal - pagoTotal);
  const visibleBreakdown = breakdown.filter((row) => row.amount !== 0);
  const showPaymentSummary =
    precioTotal > 0 ||
    pagoTotal > 0 ||
    saldoPendiente > 0 ||
    visibleBreakdown.length > 0;
  const showPaymentMethods = holders.length > 0;
  const boldHref = boldLink?.trim() || "";
  const showBold = boldHref.length > 0;
  const surchargePct =
    boldSurcharge != null && Number.isFinite(boldSurcharge)
      ? boldSurcharge
      : null;
  const paymentBadge =
    pagoTotal > 0 && saldoPendiente > 0
      ? "Abono parcial"
      : saldoPendiente > 0
        ? "Pendiente de pago"
        : null;

  if (pagoCompleto) return null;
  if (!showPaymentSummary && !showPaymentMethods && !showBold) return null;

  return (
    <div className="mt-3 space-y-3">
      {/* ── Detalle del valor ──────────────────────────────────── */}
      {showPaymentSummary ? (
        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-500" />
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                Detalle del valor de tu reserva
              </p>
            </div>
            {paymentBadge ? (
              <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold text-orange-800">
                {paymentBadge}
              </span>
            ) : null}
          </div>

          {visibleBreakdown.length > 0 ? (
            <div className="space-y-2.5">
              {visibleBreakdown.map((row) => {
                const isDeposit = row.label
                  .toLowerCase()
                  .includes("depósito reembolsable");
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{row.label}</span>
                      <span
                        className={
                          row.highlight
                            ? "font-semibold text-emerald-600"
                            : "font-medium text-gray-900"
                        }
                      >
                        {formatCop(row.amount)}
                      </span>
                    </div>
                    {isDeposit ? (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-gray-400">
                        Se devuelve al entregar la propiedad a satisfacción.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="space-y-2 border-t border-gray-100 pt-3">
            {precioTotal > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-gray-800">
                  Total de tu reserva
                </span>
                <span className="font-black text-gray-900">
                  {formatCop(precioTotal)}
                </span>
              </div>
            ) : null}
            {pagoTotal > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Ya abonaste
                </span>
                <span className="font-semibold text-emerald-700">
                  − {formatCop(pagoTotal)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Saldo pendiente */}
          <div className="rounded-xl bg-orange-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wider text-orange-900">
                Saldo pendiente
              </p>
              <p className="text-xl font-black text-orange-950">
                {formatCop(saldoPendiente)}
              </p>
            </div>
          </div>

        </div>
      ) : null}

      {/* ── Cuentas de pago ────────────────────────────────────── */}
      {showPaymentMethods ? (
        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-black text-gray-900">
              Cuenta para enviar tu pago
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
              Realiza la transferencia o consignación a la cuenta indicada.
              Copia el número o escanea el QR.
            </p>
          </div>

          {holders.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {holders.map((holder) => {
                const active = holder.id === selectedHolderId;
                return (
                  <button
                    key={holder.id}
                    type="button"
                    onClick={() => setSelectedHolderId(holder.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-left transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300"
                    }`}
                  >
                    <span className="block text-[11px] font-bold">
                      {holder.name}
                    </span>
                    {holder.cedula ? (
                      <span
                        className={`block text-[10px] ${
                          active ? "text-emerald-50" : "text-gray-500"
                        }`}
                      >
                        C.C. {holder.cedula}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedHolder ? (
            <>
              <div className="rounded-2xl border-l-4 border-amber-400 bg-white px-4 py-3.5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Titular de las cuentas
                </p>
                <p className="mt-1 text-base font-bold text-gray-900">
                  {selectedHolder.name}
                </p>
                {selectedHolder.cedula ? (
                  <p className="mt-0.5 text-xs text-gray-500">
                    C.C. {selectedHolder.cedula}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                {selectedHolder.accounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── Tarjeta de crédito (Bold) ──────────────────────────── */}
      {showBold ? (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-black text-gray-900">
              Tarjeta de crédito
              {surchargePct != null ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  +{surchargePct}% recargo
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">
              Link de pago Bold (Visa · Mastercard · PSE).
              {surchargePct != null
                ? " El recargo se suma automáticamente."
                : ""}
            </p>
          </div>
          <a
            href={boldHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
          >
            Pagar
          </a>
        </div>
      ) : null}

      {/* ── Subir comprobante ──────────────────────────────────── */}
      {reference && bankAccounts.length > 0 ? (
        <ReceiptUpload
          reference={reference}
          bankAccounts={bankAccounts}
          allowUpload={allowPaymentProofUpload}
          onPendingChange={onPendingReceiptsChange}
        />
      ) : null}
    </div>
  );
}
