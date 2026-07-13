"use client";

/**
 * Portal público del link de venta (/venta/[token]).
 *
 * El cliente abre el link que le comparte el asesor, revisa su reserva,
 * completa sus datos y sube el comprobante de pago. Cuando el asesor valida
 * el pago, aquí mismo descarga el contrato y puede devolverlo firmado.
 *
 * Toda la lógica vive en Convex (saleLinks.getPublicByToken / submitClientData
 * / submitSignedContract); esta página solo la consume.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Moon,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";
import { cn } from "@/lib/utils";

function money(v?: number | null) {
  if (!v || v <= 0) return "—";
  return `$${Math.round(v).toLocaleString("es-CO")}`;
}

function fdate(ms?: number | null) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseCop(s: string) {
  return Math.max(0, Math.floor(Number(String(s).replace(/[^\d]/g, "")) || 0));
}

function formatCopInput(s: string) {
  const n = parseCop(s);
  return n > 0 ? n.toLocaleString("es-CO") : "";
}

async function uploadDocument(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "documents");
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "No se pudo subir el archivo.");
  }
  return { url: data.url };
}

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
const labelClass =
  "mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground";

export function VentaPortal({ token }: { token: string }) {
  const link = useQuery(api.saleLinks.getPublicByToken, { token });
  const submitClientData = useMutation(api.saleLinks.submitClientData);
  const submitSignedContract = useMutation(api.saleLinks.submitSignedContract);

  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    email: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    fechaNacimiento: "",
    amount: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [cedulaFile, setCedulaFile] = useState<File | null>(null);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingSigned, setSendingSigned] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [genTried, setGenTried] = useState(false);

  // Cuando el pago está validado pero aún no hay contrato, dispara su
  // generación en el servidor (una sola vez). Al terminar, la query reactiva
  // de Convex actualiza contractUrl y aparece el botón de descarga.
  useEffect(() => {
    if (!link || genTried) return;
    if (!link.paymentValidated || link.contractUrl || !link.clientDataFilled) {
      return;
    }
    setGenTried(true);
    void fetch(`/api/sale-links/${token}/generate-contract`, {
      method: "POST",
    }).catch(() => {});
  }, [link, token, genTried]);

  // Precarga con datos ya enviados (reabre el link en otro momento/dispositivo).
  const clientData = link?.clientData;
  if (clientData && !prefilled) {
    setPrefilled(true);
    setForm((prev) => ({
      ...prev,
      nombre: clientData.nombre ?? "",
      cedula: clientData.cedula ?? "",
      email: clientData.email ?? "",
      telefono: clientData.telefono ?? "",
      direccion: clientData.direccion ?? "",
      ciudad: clientData.ciudad ?? "",
      fechaNacimiento: clientData.fechaNacimiento ?? "",
    }));
  }

  const breakdown = useMemo(() => {
    if (!link) return [] as { label: string; value: number }[];
    const rows: { label: string; value: number }[] = [];
    if (link.rentalValue) rows.push({ label: `Alquiler · ${link.nights} noche${link.nights === 1 ? "" : "s"}`, value: link.rentalValue });
    if (link.cleaningFee) rows.push({ label: "Aseo", value: link.cleaningFee });
    if (link.depositAmount) rows.push({ label: "Depósito de garantía", value: link.depositAmount });
    if (link.petDeposit) rows.push({ label: "Depósito mascotas", value: link.petDeposit });
    if (link.petSurcharge) rows.push({ label: "Cargo mascotas", value: link.petSurcharge });
    return rows;
  }, [link]);

  const handleSubmit = async () => {
    if (!link) return;
    const required: [string, string][] = [
      [form.nombre, "tu nombre completo"],
      [form.cedula, "tu cédula"],
      [form.email, "tu correo"],
      [form.telefono, "tu celular"],
      [form.direccion, "tu dirección"],
    ];
    for (const [value, label] of required) {
      if (!value.trim()) {
        toast.error(`Ingresa ${label}.`);
        return;
      }
    }
    if (!proofFile) {
      toast.error("Adjunta el comprobante de pago.");
      return;
    }

    setSending(true);
    try {
      const proof = await uploadDocument(proofFile);
      const cedulaPhoto = cedulaFile ? await uploadDocument(cedulaFile) : null;
      const result = await submitClientData({
        token,
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim() || undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        paymentProofUrl: proof.url,
        paymentProofFileName: proofFile.name,
        paymentProofMimeType: proofFile.type || undefined,
        paymentProofAmount: parseCop(form.amount) || undefined,
        paymentValidationKey: crypto.randomUUID(),
        ...(cedulaPhoto
          ? {
              cedulaPhotoUrl: cedulaPhoto.url,
              cedulaPhotoFileName: cedulaFile!.name,
              cedulaPhotoMimeType: cedulaFile!.type || undefined,
            }
          : {}),
      });
      if (!result.ok) {
        const reasons: Record<string, string> = {
          not_found: "El link ya no existe.",
          inactive: "Este link ya no está activo. Contacta a tu asesor.",
          already_validated: "El pago ya fue validado.",
          past_payment_step: "Esta etapa ya fue completada.",
        };
        toast.error(reasons[String(result.reason)] ?? "No se pudo enviar.");
        return;
      }
      setProofFile(null);
      toast.success(
        result.appended
          ? "Comprobante adicional enviado. Lo revisaremos en breve."
          : "¡Datos y comprobante enviados! Te confirmamos apenas validemos el pago.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmitSigned = async () => {
    if (!signedFile) {
      toast.error("Adjunta el contrato firmado.");
      return;
    }
    setSendingSigned(true);
    try {
      const uploaded = await uploadDocument(signedFile);
      const result = await submitSignedContract({
        token,
        signedContractUrl: uploaded.url,
        signedContractFileName: signedFile.name,
      });
      if (!result.ok) {
        toast.error("No se pudo enviar el contrato firmado.");
        return;
      }
      setSignedFile(null);
      toast.success("¡Contrato firmado recibido! Gracias.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setSendingSigned(false);
    }
  };

  // ── Estados de carga / no encontrado ────────────────────────────────
  if (link === undefined) {
    return (
      <div className="landing flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (link === null) {
    return (
      <div className="landing flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-bold">Link no encontrado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este link de reserva no existe o fue eliminado. Escríbele a tu
            asesor de FincasYa para recibir uno nuevo.
          </p>
        </div>
      </div>
    );
  }

  const inactive = link.status !== "active";
  const validated = Boolean(link.paymentValidated);
  const inReview = !validated && Boolean(link.paymentProofSubmitted);

  const steps = [
    { label: "Tus datos y pago", done: Boolean(link.paymentProofSubmitted) },
    { label: "Validación", done: validated },
    { label: "Contrato", done: Boolean(link.signedContractSubmitted) },
  ];

  return (
    <div className="landing min-h-dvh bg-gradient-to-b from-[#fff6f2] via-background to-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <img
            src="/dark-logo.svg"
            alt="FincasYa"
            className="h-8 w-auto object-contain sm:h-9"
          />
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            Reserva {link.contractCode || link.bookingReference || ""}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-5">
        {/* Progreso */}
        <div className="flex gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center",
                s.done ? "bg-primary/10" : "bg-transparent",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-bold",
                  s.done ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  s.done ? "text-primary" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Resumen de la reserva */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {link.property?.images?.[0] ? (
            <div className="relative h-44 w-full sm:h-52">
              <img
                src={link.property.images[0]}
                alt={link.property?.title ?? "Finca"}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-4">
                <div className="min-w-0">
                  <h1 className="truncate text-base font-bold text-white drop-shadow-sm">
                    {link.property?.title ?? "Tu finca"}
                  </h1>
                  {link.property?.location ? (
                    <p className="flex items-center gap-1 truncate text-xs font-medium text-white/85">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {link.property.location}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold">
                  {link.property?.title ?? "Tu finca"}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {link.property?.location ?? ""}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            {[
              { icon: CalendarDays, k: "Entrada", v: `${fdate(link.checkIn)}${link.checkInTime ? ` · ${link.checkInTime}` : ""}` },
              { icon: CalendarDays, k: "Salida", v: `${fdate(link.checkOut)}${link.checkOutTime ? ` · ${link.checkOutTime}` : ""}` },
              { icon: Moon, k: "Noches", v: String(link.nights ?? "—") },
              { icon: Users, k: "Personas", v: String(link.guests ?? "—") },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3" /> {k}
                </p>
                <p className="mt-0.5 text-xs font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-4 py-3">
            {breakdown.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between border-b border-dashed border-border py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold">{money(r.value)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-3 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Total reserva
              </span>
              <span className="text-lg font-bold">{money(link.totalValue)}</span>
            </div>
          </div>
        </section>

        {/* Estado: link inactivo */}
        {inactive && !validated ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Este link ya no está activo. Escríbele a tu asesor de FincasYa si
            necesitas retomar la reserva.
          </section>
        ) : null}

        {/* Estado: pago validado → contrato */}
        {validated ? (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              Pago validado — tu reserva está confirmada.
            </div>
            {link.contractUrl ? (
              <a
                href={link.contractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white"
              >
                <Download className="h-4 w-4" /> Descargar contrato
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <span>
                  Estamos generando tu contrato… aparecerá aquí en unos segundos.
                </span>
              </div>
            )}
            {link.crUrl ? (
              <a
                href={link.crUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold"
              >
                <FileText className="h-4 w-4" /> Confirmación de reserva (CR)
              </a>
            ) : null}
            {link.signedContractSubmitted ? (
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Recibimos tu contrato firmado. ¡Gracias!
              </div>
            ) : link.contractUrl ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Cuando lo firmes, súbelo aquí (PDF o foto):
                </p>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary"
                />
                <button
                  type="button"
                  onClick={() => void handleSubmitSigned()}
                  disabled={sendingSigned || !signedFile}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50"
                >
                  {sendingSigned ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Enviar contrato firmado
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Estado: comprobante en revisión */}
        {inReview ? (
          <section className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50 shadow-sm">
            <div className="flex flex-col items-center gap-3 px-4 py-7 text-center">
              <div className="relative grid h-14 w-14 place-items-center rounded-full bg-sky-100">
                <span className="absolute inset-0 animate-ping rounded-full bg-sky-300/40" />
                <Clock className="h-6 w-6 text-sky-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-sky-900">
                  ¡Recibimos tu pago! Estamos validándolo
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-sky-800/90">
                  Recibimos tu comprobante
                  {link.paymentProofAmount
                    ? ` por ${money(link.paymentProofAmount)}`
                    : ""}
                  . Tu asesor lo revisa y, apenas lo confirme, aquí mismo
                  aparecerá tu <b>contrato</b> para descargar. No cierres este
                  link — te avisamos por WhatsApp.
                </p>
              </div>
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Paso 2 de 3 · Validación
              </span>
            </div>
          </section>
        ) : null}

        {/* Formulario: datos + pago (mientras no esté validado y el link viva) */}
        {!validated && !inactive ? (
          <>
            {!inReview && (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold">1 · Tus datos</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Nombre completo *</label>
                  <input
                    className={inputClass}
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Como aparece en tu cédula"
                  />
                </div>
                <div>
                  <label className={labelClass}>Cédula *</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.cedula}
                    onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))}
                    placeholder="Ej: 1234567890"
                  />
                </div>
                <div>
                  <label className={labelClass}>Celular *</label>
                  <input
                    className={inputClass}
                    inputMode="tel"
                    value={form.telefono}
                    onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                    placeholder="Ej: 315 777 3937"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Correo *</label>
                  <input
                    className={inputClass}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="tucorreo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Dirección *</label>
                  <input
                    className={inputClass}
                    value={form.direccion}
                    onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
                    placeholder="Dirección de residencia"
                  />
                </div>
                <div>
                  <label className={labelClass}>Ciudad</label>
                  <input
                    className={inputClass}
                    value={form.ciudad}
                    onChange={(e) => setForm((p) => ({ ...p, ciudad: e.target.value }))}
                    placeholder="Ej: Bogotá"
                  />
                </div>
                <div>
                  <label className={labelClass}>Fecha de nacimiento</label>
                  <input
                    className={inputClass}
                    type="date"
                    value={form.fechaNacimiento}
                    onChange={(e) => setForm((p) => ({ ...p, fechaNacimiento: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Foto de tu cédula (opcional)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setCedulaFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary"
                  />
                </div>
              </div>
            </section>
            )}

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-bold">
                {inReview ? "¿Necesitas enviar otro comprobante?" : "2 · Realiza el pago"}
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Consigna o transfiere a una de estas cuentas y sube el
                comprobante.
              </p>
              <div className="space-y-2">
                {link.bankAccounts.length === 0 ? (
                  <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                    Tu asesor te compartirá los datos de pago por WhatsApp.
                  </p>
                ) : (
                  link.bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                    >
                      <BankLogoBadge
                        bankName={account.bankName ?? ""}
                        brebKey={Boolean(
                          (account as { brebKey?: boolean }).brebKey,
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {account.bankName}
                          {account.accountType ? ` · ${account.accountType}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {account.accountNumber}
                          {(account as { accountHolderName?: string }).accountHolderName
                            ? ` · ${(account as { accountHolderName?: string }).accountHolderName}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Valor consignado</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: formatCopInput(e.target.value) }))
                    }
                    placeholder={`Ej: ${Math.round((link.totalValue || 0) / 2).toLocaleString("es-CO")}`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Comprobante de pago *</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={sending}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                  </>
                ) : inReview ? (
                  "Enviar otro comprobante"
                ) : (
                  "Enviar datos y comprobante"
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Al enviar aceptas que FincasYa use estos datos para tu reserva y
                contrato.
              </p>
            </section>
          </>
        ) : null}

        {/* Confianza / cierre */}
        <footer className="flex flex-col items-center gap-2 pt-4 text-center">
          <img
            src="/dark-logo.svg"
            alt="FincasYa"
            className="h-7 w-auto opacity-70"
          />
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Tus datos están protegidos · Los expertos en alquiler
          </p>
        </footer>
      </main>
    </div>
  );
}
