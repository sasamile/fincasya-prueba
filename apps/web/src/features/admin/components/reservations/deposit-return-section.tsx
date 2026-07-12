"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  Check,
  X,
  Upload,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/features/auth/api/auth.api";

type Cuenta = {
  titular?: string;
  tipo?: string;
  numero?: string;
  banco?: string;
  documento?: string;
  observaciones?: string;
};

export interface DepositReturnSectionProps {
  bookingId: string;
  depositoGarantia?: number;
  initialDepositReturn?: {
    estado?: string;
    cuenta?: Cuenta | null;
    retencion?: {
      motivo?: string;
      obsPropietario?: string;
      valorRetenido?: number;
      evidencias?: string[];
    } | null;
    devolucion?: {
      valor?: number | null;
      fecha?: string | null;
      medio?: string | null;
      numTransaccion?: string | null;
      observaciones?: string | null;
      comprobanteUrl?: string | null;
    } | null;
  } | null;
  /** Reenviar el enlace de check-out al cliente. */
  onResend?: () => void;
}

const MEDIOS = [
  "Transferencia bancaria",
  "Nequi",
  "Daviplata",
  "Bancolombia",
  "Llaves",
  "Efectivo",
  "Otro",
];

const ESTADO_PILL: Record<string, { label: string; cls: string }> = {
  pendiente_validacion: {
    label: "Pendiente de validación",
    cls: "bg-muted text-muted-foreground",
  },
  aprobado: { label: "Aprobado", cls: "bg-muted text-foreground" },
  rechazado: { label: "Con observaciones", cls: "bg-red-100 text-red-700" },
  en_revision: { label: "En revisión", cls: "bg-muted text-muted-foreground" },
  devuelto: { label: "Devuelto", cls: "bg-muted text-foreground" },
};

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const fmtCOP = (digits: string) =>
  digits ? Number(digits).toLocaleString("es-CO") : "";

export function DepositReturnSection({
  bookingId,
  depositoGarantia = 0,
  initialDepositReturn,
  onResend,
}: DepositReturnSectionProps) {
  const [actor, setActor] = useState("");
  useEffect(() => {
    getCurrentUser()
      .then((u) => setActor(u?.name || ""))
      .catch(() => {});
  }, []);

  const [liveDr, setLiveDr] = useState(initialDepositReturn ?? null);
  const dr = liveDr;
  const cuenta = dr?.cuenta ?? null;
  const [estado, setEstado] = useState(dr?.estado || "pendiente_validacion");
  const [approving, setApproving] = useState(false);

  // Retención
  const [motivo, setMotivo] = useState(dr?.retencion?.motivo ?? "");
  const [obsProp, setObsProp] = useState(dr?.retencion?.obsPropietario ?? "");
  const [valorRetenido, setValorRetenido] = useState(
    dr?.retencion?.valorRetenido != null
      ? String(dr.retencion.valorRetenido)
      : "",
  );
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [uploadingEv, setUploadingEv] = useState(false);
  const [evCount, setEvCount] = useState(dr?.retencion?.evidencias?.length ?? 0);

  // Devolución
  const [valor, setValor] = useState(
    dr?.devolucion?.valor != null ? String(dr.devolucion.valor) : "",
  );
  const [fecha, setFecha] = useState(dr?.devolucion?.fecha ?? "");
  const [medio, setMedio] = useState(dr?.devolucion?.medio ?? "");
  const [numTx, setNumTx] = useState(dr?.devolucion?.numTransaccion ?? "");
  const [obsDev, setObsDev] = useState(dr?.devolucion?.observaciones ?? "");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(
    dr?.devolucion?.comprobanteUrl ?? null,
  );
  const [savingRefund, setSavingRefund] = useState(false);

  // Trae el estado fresco del servidor: la cuenta del cliente puede haberse
  // registrado después de abrir el panel, así que no nos quedamos con datos viejos.
  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    axios
      .get(`/api/bookings/${bookingId}/deposit-return`)
      .then(({ data }) => {
        if (!active || !data) return;
        setLiveDr(data);
        if (data.estado) setEstado(data.estado);
        if (data.devolucion?.comprobanteUrl)
          setComprobanteUrl(data.devolucion.comprobanteUrl);
        if (Array.isArray(data.retencion?.evidencias))
          setEvCount(data.retencion.evidencias.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [bookingId]);

  const showRetencion = estado === "rechazado" || estado === "en_revision";
  const pill = ESTADO_PILL[estado] || ESTADO_PILL.pendiente_validacion;

  const approve = async (nuevoEstado: string) => {
    setApproving(true);
    try {
      await axios.post(`/api/bookings/${bookingId}/deposit-approval`, {
        estado: nuevoEstado,
        nombre: actor || undefined,
        motivo: nuevoEstado === "aprobado" ? undefined : motivo || undefined,
        obsPropietario:
          nuevoEstado === "aprobado" ? undefined : obsProp || undefined,
        valorRetenido:
          nuevoEstado === "aprobado" ? undefined : valorRetenido || undefined,
      });
      setEstado(nuevoEstado);
      toast.success(
        nuevoEstado === "aprobado"
          ? "Devolución aprobada"
          : "Novedad registrada (en revisión)",
      );
    } catch {
      toast.error("No se pudo actualizar la validación.");
    } finally {
      setApproving(false);
    }
  };

  const uploadEvidencias = async () => {
    if (evidencias.length === 0) return;
    setUploadingEv(true);
    try {
      const fd = new FormData();
      evidencias.forEach((f) => fd.append("evidencias", f));
      await axios.post(`/api/bookings/${bookingId}/deposit-evidencias`, fd);
      setEvCount((n) => n + evidencias.length);
      setEvidencias([]);
      toast.success("Evidencias subidas");
    } catch {
      toast.error("No se pudieron subir las evidencias.");
    } finally {
      setUploadingEv(false);
    }
  };

  const saveRefund = async () => {
    setSavingRefund(true);
    try {
      const fd = new FormData();
      if (valor) fd.append("valor", valor);
      if (fecha) fd.append("fecha", fecha);
      if (medio) fd.append("medio", medio);
      if (numTx) fd.append("numTransaccion", numTx);
      if (obsDev) fd.append("observaciones", obsDev);
      if (actor) fd.append("actor", actor);
      if (comprobante) fd.append("comprobante", comprobante);
      await axios.post(`/api/bookings/${bookingId}/deposit-refund`, fd);
      if (estado === "aprobado") setEstado("devuelto");
      if (comprobante) {
        setComprobanteUrl((u) => u ?? "pending");
        setComprobante(null);
      }
      toast.success("Devolución registrada");
    } catch {
      toast.error("No se pudo guardar la devolución.");
    } finally {
      setSavingRefund(false);
    }
  };

  const labelCls =
    "block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1";

  return (
    <div className="rounded-2xl border border-border bg-background p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
          Devolución del depósito
        </p>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5",
            pill.cls,
          )}
        >
          {pill.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Depósito de garantía</span>
        <span className="font-bold text-foreground">
          {new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
          }).format(depositoGarantia)}
        </span>
      </div>

      {/* Cuenta del cliente (read-only) */}
      {cuenta && (cuenta.numero || cuenta.titular) ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">Cuenta del cliente</p>
          <p>
            {cuenta.titular} · {cuenta.banco} {cuenta.tipo} {cuenta.numero}
          </p>
          {cuenta.documento ? <p>Doc: {cuenta.documento}</p> : null}
          {cuenta.observaciones ? <p>“{cuenta.observaciones}”</p> : null}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          El cliente aún no registró la cuenta para la devolución.
        </p>
      )}

      {/* 1 · Validación del propietario */}
      <div>
        <p className={labelCls}>1 · Validación del propietario</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void approve("aprobado")}
            disabled={approving}
            className={cn(
              "h-9 px-3 rounded-xl font-semibold text-xs",
              estado === "aprobado" || estado === "devuelto"
                ? "bg-foreground text-background"
                : "bg-foreground hover:bg-foreground/90 text-background",
            )}
          >
            <Check className="w-3.5 h-3.5 mr-1.5" /> Aprobar
          </Button>
          <Button
            onClick={() => void approve("rechazado")}
            disabled={approving}
            variant="outline"
            className="h-9 px-3 rounded-xl font-semibold text-xs text-red-600 border-red-200 hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5 mr-1.5" /> Rechazar / con observaciones
          </Button>
        </div>
      </div>

      {/* 2 · Retención (cuando hay novedad o devolución parcial) */}
      {showRetencion ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <p className={labelCls}>2 · Retención / novedad</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Valor retenido</label>
              <Input
                inputMode="numeric"
                value={fmtCOP(valorRetenido)}
                onChange={(e) => setValorRetenido(onlyDigits(e.target.value))}
                placeholder="0"
                className="h-9 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className={labelCls}>Motivo</label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: daño en…"
                className="h-9 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Observaciones del propietario</label>
            <textarea
              value={obsProp}
              onChange={(e) => setObsProp(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              id={`ev-${bookingId}`}
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) =>
                setEvidencias(Array.from(e.target.files ?? []))
              }
            />
            <label
              htmlFor={`ev-${bookingId}`}
              className="flex h-9 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted/40"
            >
              <Upload className="w-3.5 h-3.5" />
              {evidencias.length > 0
                ? `${evidencias.length} archivo(s) listos`
                : `Evidencias${evCount ? ` (${evCount} subidas)` : ""}`}
            </label>
            <Button
              onClick={() => void uploadEvidencias()}
              disabled={uploadingEv || evidencias.length === 0}
              variant="outline"
              className="h-9 px-3 rounded-xl text-xs font-semibold"
            >
              {uploadingEv ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Subir"
              )}
            </Button>
          </div>
          <Button
            onClick={() => void approve("rechazado")}
            disabled={approving}
            variant="outline"
            className="h-9 w-full rounded-xl text-xs font-semibold"
          >
            Guardar retención
          </Button>
        </div>
      ) : null}

      {/* 3 · Registro de la devolución */}
      <div className="space-y-2">
        <p className={labelCls}>3 · Registro de la devolución</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Valor devuelto</label>
            <Input
              inputMode="numeric"
              value={fmtCOP(valor)}
              onChange={(e) => setValor(onlyDigits(e.target.value))}
              placeholder="0"
              className="h-9 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className={labelCls}>Fecha</label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-9 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className={labelCls}>Medio de pago</label>
            <Select value={medio || undefined} onValueChange={setMedio}>
              <SelectTrigger className="h-9 w-full rounded-xl">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent position="popper" className="min-w-(--radix-select-trigger-width)">
                {MEDIOS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>N° de transacción</label>
            <Input
              value={numTx}
              onChange={(e) => setNumTx(e.target.value)}
              placeholder="Opcional"
              className="h-9 rounded-xl text-sm"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Observaciones</label>
          <textarea
            value={obsDev}
            onChange={(e) => setObsDev(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <input
          type="file"
          id={`refund-file-${bookingId}`}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor={`refund-file-${bookingId}`}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-3 text-xs text-muted-foreground hover:bg-muted/40"
        >
          <Upload className="w-3.5 h-3.5" />
          {comprobante
            ? comprobante.name
            : comprobanteUrl
              ? "Reemplazar comprobante"
              : "Subir comprobante (imagen/PDF)"}
        </label>
        {comprobanteUrl && comprobanteUrl !== "pending" ? (
          <a
            href={comprobanteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground hover:underline"
          >
            <FileText className="w-3.5 h-3.5" /> Ver comprobante guardado
          </a>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            onClick={() => void saveRefund()}
            disabled={savingRefund}
            variant="outline"
            className="h-9 px-4 rounded-xl font-semibold text-xs"
          >
            {savingRefund ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Guardar devolución
              </>
            )}
          </Button>
          {onResend ? (
            <Button
              onClick={onResend}
              className="h-9 px-4 rounded-xl font-semibold text-xs bg-foreground hover:bg-foreground/90 text-background"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" /> Reenviar al cliente
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
