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
  Building2,
  Check,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Upload,
  Eye,
  Wallet,
} from "lucide-react";
import { cn, formatPriceInput, parseCOP } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/features/auth/api/auth.api";

type PayoutLog = { accion: string; actor: string; ts: number };
type ObsLog = { valor: string; actor: string; ts: number };

export type OwnerPayoutAbono = {
  id: string;
  amount: number;
  fecha?: string | null;
  medio?: string | null;
  comprobanteUrl?: string | null;
  createdAt: number;
  actor?: string | null;
};

export type OwnerPayoutState = {
  valorAcordado?: number | null;
  abono?: number | null;
  valor?: number | null;
  fecha?: string | null;
  medio?: string | null;
  comprobanteUrl?: string | null;
  updatedAt?: number | null;
  abonos?: OwnerPayoutAbono[];
  log?: PayoutLog[];
};

export interface OwnerPayoutSectionProps {
  bookingId: string;
  initialClientObservaciones?: string;
  initialClientObservacionesUpdatedAt?: number;
  initialClientObservacionesLog?: ObsLog[];
  initialOwnerPayout?: OwnerPayoutState | null;
  initialOwnerPortalShare?: {
    showGuestList?: boolean;
    showPlates?: boolean;
    showEmpleada?: boolean;
    showInternalNotes?: boolean;
  } | null;
  /** Reenviar el enlace al propietario (usa el handler del modal). */
  onResend?: () => void;
  /** Se llama tras guardar para refrescar la reserva en el modal/lista. */
  onSaved?: (payout: OwnerPayoutState) => void;
  onShareSaved?: (share: {
    showGuestList: boolean;
    showPlates: boolean;
    showEmpleada: boolean;
    showInternalNotes: boolean;
  }) => void;
  /** Solo muestra el formulario de pago al propietario (sin observaciones ni visibilidad). */
  mode?: "full" | "payout-only";
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

const fmtDateTime = (ms?: number | null) =>
  ms
    ? new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Bogota",
      }).format(new Date(ms))
    : "";

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const fmtCOP = (digits: string) =>
  digits ? Number(digits).toLocaleString("es-CO") : "";

function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

function normalizeAbonos(
  payout: OwnerPayoutState | null | undefined,
  bookingId: string,
): OwnerPayoutAbono[] {
  if (!payout) return [];
  if (Array.isArray(payout.abonos) && payout.abonos.length > 0) {
    return payout.abonos;
  }
  const legacy =
    (payout.abono != null && payout.abono > 0 ? payout.abono : null) ??
    (payout.valor != null && payout.valor > 0 ? payout.valor : null);
  if (legacy == null || legacy <= 0) return [];
  return [
    {
      id: `legacy-${bookingId}`,
      amount: legacy,
      fecha: payout.fecha,
      medio: payout.medio,
      comprobanteUrl: payout.comprobanteUrl,
      createdAt: payout.updatedAt ?? Date.now(),
      actor: "Migrado",
    },
  ];
}

function mapPayoutResponse(raw: Record<string, unknown> | null | undefined): OwnerPayoutState {
  if (!raw) return {};
  const abonos = Array.isArray(raw.abonos)
    ? (raw.abonos as OwnerPayoutAbono[])
    : undefined;
  return {
    valorAcordado: (raw.valorAcordado as number | null | undefined) ?? null,
    abono: (raw.abono as number | null | undefined) ?? null,
    valor: (raw.valor as number | null | undefined) ?? null,
    fecha: (raw.fecha as string | null | undefined) ?? null,
    medio: (raw.medio as string | null | undefined) ?? null,
    comprobanteUrl: (raw.comprobanteUrl as string | null | undefined) ?? null,
    updatedAt: (raw.updatedAt as number | null | undefined) ?? null,
    abonos,
    log: Array.isArray(raw.log) ? (raw.log as PayoutLog[]) : [],
  };
}

export function OwnerPayoutSection({
  bookingId,
  initialClientObservaciones,
  initialClientObservacionesUpdatedAt,
  initialClientObservacionesLog,
  initialOwnerPayout,
  initialOwnerPortalShare,
  onResend,
  onSaved,
  onShareSaved,
  mode = "full",
}: OwnerPayoutSectionProps) {
  const [actor, setActor] = useState<string>("");
  useEffect(() => {
    getCurrentUser()
      .then((u) => setActor(u?.name || ""))
      .catch(() => {});
  }, []);

  // Observaciones del cliente
  const [obs, setObs] = useState(initialClientObservaciones ?? "");
  const [obsUpdatedAt, setObsUpdatedAt] = useState<number | undefined>(
    initialClientObservacionesUpdatedAt ?? undefined,
  );
  const [obsLog, setObsLog] = useState<ObsLog[]>(
    initialClientObservacionesLog ?? [],
  );
  const [showObsLog, setShowObsLog] = useState(false);
  const [savingObs, setSavingObs] = useState(false);

  const [shareGuestList, setShareGuestList] = useState(
    initialOwnerPortalShare?.showGuestList !== false,
  );
  const [sharePlates, setSharePlates] = useState(
    initialOwnerPortalShare?.showPlates !== false,
  );
  const [shareEmpleada, setShareEmpleada] = useState(
    initialOwnerPortalShare?.showEmpleada !== false,
  );
  const [shareInternalNotes, setShareInternalNotes] = useState(
    initialOwnerPortalShare?.showInternalNotes === true,
  );
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    setShareGuestList(initialOwnerPortalShare?.showGuestList !== false);
    setSharePlates(initialOwnerPortalShare?.showPlates !== false);
    setShareEmpleada(initialOwnerPortalShare?.showEmpleada !== false);
    setShareInternalNotes(initialOwnerPortalShare?.showInternalNotes === true);
  }, [bookingId, initialOwnerPortalShare]);

  const handleSaveShare = async () => {
    setSavingShare(true);
    try {
      await axios.post(`/api/bookings/${bookingId}/owner-portal-share`, {
        showGuestList: shareGuestList,
        showPlates: sharePlates,
        showEmpleada: shareEmpleada,
        showInternalNotes: shareInternalNotes,
      });
      onShareSaved?.({
        showGuestList: shareGuestList,
        showPlates: sharePlates,
        showEmpleada: shareEmpleada,
        showInternalNotes: shareInternalNotes,
      });
      toast.success("Visibilidad del portal del propietario guardada");
    } catch {
      toast.error("No se pudo guardar la visibilidad.");
    } finally {
      setSavingShare(false);
    }
  };

  const handleSaveObs = async () => {
    setSavingObs(true);
    try {
      await axios.post(`/api/bookings/${bookingId}/client-observaciones`, {
        valor: obs,
        actor: actor || undefined,
      });
      const now = Date.now();
      setObsUpdatedAt(now);
      setObsLog((prev) => [
        ...prev,
        { valor: obs.trim(), actor: actor || "Equipo", ts: now },
      ]);
      toast.success("Observaciones guardadas");
    } catch {
      toast.error("No se pudieron guardar las observaciones.");
    } finally {
      setSavingObs(false);
    }
  };

  // Pago al propietario
  const [valorAcordadoDigits, setValorAcordadoDigits] = useState(
    initialOwnerPayout?.valorAcordado != null
      ? String(initialOwnerPayout.valorAcordado)
      : "",
  );
  const [abonos, setAbonos] = useState<OwnerPayoutAbono[]>(() =>
    normalizeAbonos(initialOwnerPayout, bookingId),
  );
  const [payoutUpdatedAt, setPayoutUpdatedAt] = useState<number | undefined>(
    initialOwnerPayout?.updatedAt ?? undefined,
  );
  const [payoutLog, setPayoutLog] = useState<PayoutLog[]>(
    initialOwnerPayout?.log ?? [],
  );
  const [showPayoutLog, setShowPayoutLog] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [savingAbono, setSavingAbono] = useState(false);
  const [showAbonoForm, setShowAbonoForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [abonoForm, setAbonoForm] = useState({
    amount: "",
    fecha: "",
    medio: MEDIOS[0],
  });
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  useEffect(() => {
    setValorAcordadoDigits(
      initialOwnerPayout?.valorAcordado != null
        ? String(initialOwnerPayout.valorAcordado)
        : "",
    );
    setAbonos(normalizeAbonos(initialOwnerPayout, bookingId));
    setPayoutUpdatedAt(initialOwnerPayout?.updatedAt ?? undefined);
    setPayoutLog(initialOwnerPayout?.log ?? []);
    setShowAbonoForm(false);
    setConfirmDeleteId(null);
    setComprobanteFile(null);
  }, [bookingId, initialOwnerPayout]);

  const valorAcordado = Number(valorAcordadoDigits || 0);
  const totalPagado = useMemo(
    () => abonos.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [abonos],
  );
  const saldoPropietario = Math.max(0, valorAcordado - totalPagado);
  const progress =
    valorAcordado > 0
      ? Math.min(100, (totalPagado / valorAcordado) * 100)
      : 0;

  const isPaid = totalPagado > 0 || !!payoutUpdatedAt;

  const applyPayoutResponse = (raw: { ownerPayout?: Record<string, unknown> }) => {
    const payout = mapPayoutResponse(raw.ownerPayout);
    const nextAbonos = normalizeAbonos(payout, bookingId);
    setAbonos(nextAbonos);
    if (payout.valorAcordado != null) {
      setValorAcordadoDigits(String(payout.valorAcordado));
    }
    if (payout.updatedAt) setPayoutUpdatedAt(payout.updatedAt);
    if (payout.log) setPayoutLog(payout.log);
    onSaved?.({ ...payout, abonos: nextAbonos });
    return payout;
  };

  const handleSaveTerms = async () => {
    setSavingTerms(true);
    try {
      const fd = new FormData();
      if (valorAcordadoDigits) fd.append("valorAcordado", valorAcordadoDigits);
      if (actor) fd.append("actor", actor);
      const { data } = await axios.post<{ ownerPayout?: Record<string, unknown> }>(
        `/api/bookings/${bookingId}/owner-payout`,
        fd,
      );
      applyPayoutResponse(data);
      toast.success("Valor acordado guardado");
    } catch {
      toast.error("No se pudo guardar el valor acordado.");
    } finally {
      setSavingTerms(false);
    }
  };

  const handleAddAbono = async () => {
    const amount = parseCOP(abonoForm.amount);
    if (amount <= 0) {
      toast.error("Ingresa un valor válido para el abono.");
      return;
    }
    setSavingAbono(true);
    try {
      const fd = new FormData();
      fd.append("amount", String(amount));
      if (abonoForm.fecha) fd.append("fecha", abonoForm.fecha);
      if (abonoForm.medio) fd.append("medio", abonoForm.medio);
      if (actor) fd.append("actor", actor);
      if (comprobanteFile) fd.append("comprobante", comprobanteFile);
      const { data } = await axios.post<{ ownerPayout?: Record<string, unknown> }>(
        `/api/bookings/${bookingId}/owner-payout/abono`,
        fd,
      );
      applyPayoutResponse(data);
      setAbonoForm({ amount: "", fecha: "", medio: MEDIOS[0] });
      setComprobanteFile(null);
      setShowAbonoForm(false);
      toast.success("Abono al propietario registrado");
    } catch {
      toast.error("No se pudo registrar el abono.");
    } finally {
      setSavingAbono(false);
    }
  };

  const handleDeleteAbono = async (abonoId: string) => {
    setDeletingId(abonoId);
    try {
      const { data } = await axios.delete<{ ownerPayout?: Record<string, unknown> }>(
        `/api/bookings/${bookingId}/owner-payout/abono/${encodeURIComponent(abonoId)}`,
        { data: actor ? { actor } : undefined },
      );
      applyPayoutResponse(data);
      setConfirmDeleteId(null);
      toast.success("Abono eliminado");
    } catch {
      toast.error("No se pudo eliminar el abono.");
    } finally {
      setDeletingId(null);
    }
  };

  const labelCls =
    "block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1";

  return (
    <div className="space-y-4">
      {mode === "full" ? (
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <Building2 className="w-4 h-4 text-primary/70" />
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            Check-out del propietario
          </h3>
        </div>
      ) : null}

      {mode === "full" ? (
      <>
      {/* Observaciones del cliente */}
      <div className="rounded-2xl border border-border bg-background p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-primary/60" />
            Novedad del cliente
          </p>
          {obsUpdatedAt ? (
            <span className="text-[10px] text-muted-foreground">
              última edición: {obsLog[obsLog.length - 1]?.actor || "Equipo"} ·{" "}
              {fmtDateTime(obsUpdatedAt)}
            </span>
          ) : null}
        </div>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={3}
          placeholder="Peticiones o requerimientos adicionales del cliente…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
        />
        <div className="flex items-center justify-between">
          {obsLog.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowObsLog((v) => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <History className="w-3 h-3" />
              {showObsLog ? "Ocultar historial" : `Ver historial (${obsLog.length})`}
            </button>
          ) : (
            <span />
          )}
          <Button
            onClick={handleSaveObs}
            disabled={savingObs}
            className="h-9 px-4 rounded-xl font-semibold text-xs bg-foreground hover:bg-foreground/90 text-background"
          >
            {savingObs ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Guardar
              </>
            )}
          </Button>
        </div>
        {showObsLog && obsLog.length > 0 ? (
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-2.5">
            {[...obsLog].reverse().map((l, i) => (
              <div key={i} className="text-[11px]">
                <span className="font-semibold text-foreground">{l.actor}</span>{" "}
                <span className="text-muted-foreground">· {fmtDateTime(l.ts)}</span>
                <p className="text-muted-foreground whitespace-pre-line">
                  “{l.valor || "(vacío)"}”
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Información que verá el propietario en /anfitrion */}
      <div className="rounded-2xl border border-border bg-background p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-primary/60" />
          Información que verá el propietario
        </p>
        <div className="space-y-2">
          {(
            [
              {
                id: "guests",
                label: "Mostrar lista de invitados (mismo control que en Check-in del turista)",
                checked: shareGuestList,
                onChange: setShareGuestList,
              },
              {
                id: "plates",
                label: "Mostrar placas de vehículos",
                checked: sharePlates,
                onChange: setSharePlates,
              },
              {
                id: "empleada",
                label: "Mostrar empleada de servicio",
                checked: shareEmpleada,
                onChange: setShareEmpleada,
              },
              {
                id: "internal",
                label: "Mostrar observaciones internas",
                checked: shareInternalNotes,
                onChange: setShareInternalNotes,
              },
            ] as const
          ).map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-border text-foreground focus:ring-ring/30"
              />
              <span className="text-foreground">{item.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => void handleSaveShare()}
            disabled={savingShare}
            variant="outline"
            className="h-9 px-4 rounded-xl font-semibold text-xs"
          >
            {savingShare ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Guardar visibilidad
              </>
            )}
          </Button>
        </div>
      </div>

      </>
      ) : null}

      {/* Pago al propietario */}
      <div className="rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            Pago al propietario
          </p>
          {mode === "payout-only" ? (
            <p className="text-[10px] text-muted-foreground leading-snug max-w-[220px] text-right">
              Cada abono queda en fila aparte en Reportes
            </p>
          ) : null}
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5",
              isPaid
                ? saldoPropietario <= 0 && valorAcordado > 0
                  ? "bg-muted text-foreground"
                  : "bg-sky-100 text-sky-700"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isPaid
              ? saldoPropietario <= 0 && valorAcordado > 0
                ? "Pagado"
                : "Abonado parcial"
              : "Pendiente"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Valor acordado al propietario</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                inputMode="numeric"
                value={fmtCOP(valorAcordadoDigits)}
                onChange={(e) =>
                  setValorAcordadoDigits(onlyDigits(e.target.value))
                }
                placeholder="0"
                className="h-10 rounded-xl pl-7 text-sm"
              />
            </div>
          </div>
          <Button
            onClick={() => void handleSaveTerms()}
            disabled={savingTerms}
            variant="outline"
            className="h-10 px-4 rounded-xl font-semibold text-xs shrink-0"
          >
            {savingTerms ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Guardar acordado
              </>
            )}
          </Button>
        </div>

        {valorAcordado > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Acordado
                </p>
                <p className="text-sm font-bold text-foreground">
                  {formatCop(valorAcordado)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/20 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pagado
                </p>
                <p className="text-sm font-bold text-foreground">
                  {formatCop(totalPagado)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/20 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Saldo
                </p>
                <p className="text-sm font-bold text-muted-foreground">
                  {formatCop(saldoPropietario)}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground/80 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">
                {Math.round(progress)}% del valor acordado pagado al propietario
              </p>
            </div>
          </>
        ) : null}

        {abonos.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
            {abonos.map((abono, index) => (
              <div
                key={abono.id}
                className="flex items-start justify-between gap-3 px-3 py-3 bg-muted/10"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      Abono #{index + 1}
                    </span>
                    {abono.medio ? (
                      <Badge variant="secondary" className="text-[9px] uppercase">
                        {abono.medio}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtDateTime(abono.createdAt)}
                    {abono.fecha ? ` · Pago ${abono.fecha}` : ""}
                    {abono.actor ? ` · ${abono.actor}` : ""}
                  </p>
                  {abono.comprobanteUrl ? (
                    <a
                      href={abono.comprobanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline"
                    >
                      <FileText className="w-3 h-3" /> Ver comprobante
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-bold text-foreground">
                    +{formatCop(abono.amount)}
                  </span>
                  {confirmDeleteId === abono.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleDeleteAbono(abono.id)}
                        disabled={deletingId === abono.id}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline disabled:opacity-60"
                      >
                        {deletingId === abono.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Sí, eliminar"
                        )}
                      </button>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === abono.id}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(abono.id)}
                      title="Eliminar abono"
                      className="text-muted-foreground/60 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1">
            Aún no hay abonos registrados al propietario.
          </p>
        )}

        {!showAbonoForm ? (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl h-10 text-xs font-bold"
            onClick={() => {
              setShowAbonoForm(true);
              setAbonoForm((prev) => ({
                ...prev,
                amount:
                  saldoPropietario > 0
                    ? formatPriceInput(String(saldoPropietario))
                    : "",
              }));
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Registrar abono al propietario
          </Button>
        ) : (
          <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Nuevo abono
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Valor (COP)
                </Label>
                <Input
                  inputMode="numeric"
                  value={abonoForm.amount}
                  onChange={(e) =>
                    setAbonoForm((prev) => ({
                      ...prev,
                      amount: formatPriceInput(e.target.value),
                    }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="Ej: 800.000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Fecha de pago
                </Label>
                <Input
                  type="date"
                  value={abonoForm.fecha}
                  onChange={(e) =>
                    setAbonoForm((prev) => ({ ...prev, fecha: e.target.value }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Medio de pago
                </Label>
                <Select
                  value={abonoForm.medio}
                  onValueChange={(value) =>
                    setAbonoForm((prev) => ({ ...prev, medio: value }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIOS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                Comprobante (opcional)
              </Label>
              <input
                type="file"
                id={`owner-abono-file-${bookingId}`}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
              />
              <label
                htmlFor={`owner-abono-file-${bookingId}`}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted/30"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="truncate">
                  {comprobanteFile ? comprobanteFile.name : "Subir comprobante"}
                </span>
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                className="flex-1 rounded-xl h-10 text-xs font-bold bg-foreground hover:bg-foreground/90 text-background"
                onClick={() => void handleAddAbono()}
                disabled={savingAbono}
              >
                {savingAbono ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Guardar abono
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl h-10 text-xs"
                onClick={() => {
                  setShowAbonoForm(false);
                  setComprobanteFile(null);
                }}
                disabled={savingAbono}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {payoutLog.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowPayoutLog((v) => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <History className="w-3 h-3" />
              {payoutUpdatedAt
                ? `Actualizado ${fmtDateTime(payoutUpdatedAt)}`
                : "Historial"}
            </button>
          ) : (
            <span />
          )}
          {onResend ? (
            <Button
              onClick={onResend}
              className="h-9 px-4 rounded-xl font-semibold text-xs bg-foreground hover:bg-foreground/90 text-background"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" /> Reenviar al propietario
            </Button>
          ) : null}
        </div>

        {showPayoutLog && payoutLog.length > 0 ? (
          <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-2.5">
            {[...payoutLog].reverse().map((l, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{l.accion}</span>{" "}
                · {l.actor} · {fmtDateTime(l.ts)}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
