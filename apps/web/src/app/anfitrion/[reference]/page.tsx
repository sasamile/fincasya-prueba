"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  CircleCheck,
  Clock,
  FileText,
  Info,
  Loader2,
  UserCheck,
} from "lucide-react";
import { SupportFab } from "@/features/shared/components/support-fab";
import { propietarioTratoLabel } from "@/lib/owner-salutation";
import { toast } from "sonner";

type OwnerView = {
  reference: string;
  propertyTitle: string;
  propertyLocation: string | null;
  ownerName: string | null;
  ownerTratamiento: string | null;
  fechaEntrada: number;
  fechaSalida: number;
  horaEntrada: string | null;
  numeroPersonas: number | null;
  empleada: "no" | "una" | "varias";
  placas: string | null;
  allowsPets: boolean;
  requiresGuestList?: boolean;
  mascotas: number;
  checkinCompleted: boolean;
  guestCount: number;
  guests: Array<{ nombre: string; cedula: string; tipoDocumento?: string }>;
  invitadosPdfUrl: string | null;
  checkinObservaciones: string | null;
  serviciosNota: string | null;
  clientObservaciones: string | null;
  ownerPortalShare: {
    showGuestList: boolean;
    showPlates: boolean;
    showEmpleada: boolean;
    showInternalNotes: boolean;
  };
  ownerOfferPending?: boolean;
  ownerOfferAccepted?: boolean;
  ownerOfferRejected?: boolean;
  ownerOfferRejectedReason?: string | null;
  ownerReceiver: {
    nombre: string | null;
    contacto: string | null;
  } | null;
  ownerPayout: {
    valorAcordado: number | null;
    abono: number | null;
    saldo: number | null;
    valor: number | null;
    fecha: string | null;
    medio: string | null;
    comprobanteUrl: string | null;
  } | null;
  depositoGarantia: number;
  depositReturn: {
    estado: string;
    devuelto: number | null;
  } | null;
};

const TZ = "America/Bogota";

// La devolución del depósito es del check-out: solo se muestra desde el día de
// salida en adelante, no en el aviso de llegada del propietario.
function esDiaDeSalidaOposterior(fechaSalida: number): boolean {
  const ymd = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  return ymd(Date.now()) >= ymd(fechaSalida);
}

function fmtFecha(ms: number): string {
  const s = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(ms));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtHora(hora: string | null, ms: number): string {
  const s = String(hora ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    let h = parseInt(m[1], 10);
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m[2]} ${ap}`;
  }
  if (s) return s;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(new Date(ms));
}

function nights(a: number, b: number): number {
  return Math.max(1, Math.round((b - a) / 86400000));
}

const EMPLEADA_LABEL: Record<OwnerView["empleada"], string> = {
  no: "No requiere",
  una: "Sí, 1 empleada",
  varias: "Sí, varias empleadas",
};

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);

function OwnerCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-900">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function OwnerPayoutBreakdown({
  payout,
}: {
  payout: NonNullable<OwnerView["ownerPayout"]>;
}) {
  return (
    <div className="space-y-0">
      {payout.valorAcordado ? (
        <div className="flex items-center justify-between border-b border-gray-100 py-1.5 text-sm">
          <span className="text-gray-500">Valor acordado</span>
          <span className="font-semibold text-gray-900">
            {fmtCOP(payout.valorAcordado)}
          </span>
        </div>
      ) : null}
      {(payout.abono ?? 0) > 0 ? (
        <div className="flex items-center justify-between border-b border-gray-100 py-1.5 text-sm">
          <span className="text-gray-500">Abono pagado</span>
          <span className="font-semibold text-gray-900">
            {fmtCOP(payout.abono!)}
          </span>
        </div>
      ) : null}
      {payout.saldo != null && payout.valorAcordado ? (
        <div className="my-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-semibold text-emerald-800">Saldo pendiente</span>
          <span className="font-bold text-emerald-800">{fmtCOP(payout.saldo)}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function OwnerReservationPage() {
  const params = useParams();
  const reference = decodeURIComponent(String(params?.reference ?? ""));
  const [data, setData] = useState<OwnerView | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [depositEstado, setDepositEstado] = useState<string>("");
  const [depositSaving, setDepositSaving] = useState(false);
  const [receiverNombre, setReceiverNombre] = useState("");
  const [receiverContacto, setReceiverContacto] = useState("");
  const [receiverSaving, setReceiverSaving] = useState(false);
  const [receiverSaved, setReceiverSaved] = useState(false);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [offerAcceptedLocal, setOfferAcceptedLocal] = useState(false);
  const [rejectingOffer, setRejectingOffer] = useState(false);
  const [offerRejectedLocal, setOfferRejectedLocal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [offerComment, setOfferComment] = useState("");
  const [commentingOffer, setCommentingOffer] = useState(false);

  useEffect(() => {
    if (!reference) return;
    let active = true;

    const loadOwnerView = () =>
      fetch(`/api/bookings/owner/${encodeURIComponent(reference)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((json) => {
          if (!active) return;
          const view = json as OwnerView;
          setData(view);
          setDepositEstado(view.depositReturn?.estado || "pendiente_validacion");
          setReceiverNombre(view.ownerReceiver?.nombre || "");
          setReceiverContacto(view.ownerReceiver?.contacto || "");
          setStatus("ok");
        })
        .catch(() => {
          if (active) setStatus((s) => (s === "loading" ? "error" : s));
        });

    void loadOwnerView();
    const interval = window.setInterval(() => {
      void loadOwnerView();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [reference]);

  const submitDepositApproval = async (estado: string) => {
    setDepositSaving(true);
    try {
      const res = await fetch(
        `/api/bookings/owner/${encodeURIComponent(reference)}/deposit-approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado }),
        },
      );
      if (res.ok) setDepositEstado(estado);
    } catch {
      /* noop */
    } finally {
      setDepositSaving(false);
    }
  };

  const submitAcceptOffer = async () => {
    setAcceptingOffer(true);
    try {
      const res = await fetch(
        `/api/bookings/owner/${encodeURIComponent(reference)}/accept-offer`,
        { method: "POST" },
      );
      if (res.ok) {
        setOfferAcceptedLocal(true);
        toast.success("Reserva confirmada. Ya puedes ver el check-in.");
        await reloadOwnerView();
      } else {
        toast.error("No se pudo confirmar la reserva. Intenta de nuevo.");
      }
    } catch {
      toast.error("Error de conexión al confirmar.");
    } finally {
      setAcceptingOffer(false);
    }
  };

  const reloadOwnerView = async () => {
    const r = await fetch(
      `/api/bookings/owner/${encodeURIComponent(reference)}`,
      { cache: "no-store" },
    );
    if (r.ok) {
      const view = (await r.json()) as OwnerView;
      setData(view);
    }
  };

  const submitRejectOffer = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Indica el motivo del rechazo.");
      return;
    }
    setRejectingOffer(true);
    try {
      const res = await fetch(
        `/api/bookings/owner/${encodeURIComponent(reference)}/reject-offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (res.ok) {
        setOfferRejectedLocal(true);
        toast.success("Rechazo registrado. El equipo de FincasYa te contactará.");
        await reloadOwnerView();
      } else {
        toast.error("No se pudo registrar el rechazo.");
      }
    } catch {
      toast.error("Error de conexión al rechazar.");
    } finally {
      setRejectingOffer(false);
    }
  };

  const submitOfferComment = async () => {
    const comment = offerComment.trim();
    if (!comment) {
      toast.error("Escribe una observación.");
      return;
    }
    setCommentingOffer(true);
    try {
      const res = await fetch(
        `/api/bookings/owner/${encodeURIComponent(reference)}/owner-offer-comment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        },
      );
      if (res.ok) {
        setOfferComment("");
        toast.success("Observación enviada al equipo.");
        await reloadOwnerView();
      } else {
        toast.error("No se pudo enviar la observación.");
      }
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setCommentingOffer(false);
    }
  };

  const submitReceiver = async () => {
    if (!receiverNombre.trim() && !receiverContacto.trim()) return;
    setReceiverSaving(true);
    setReceiverSaved(false);
    try {
      const res = await fetch(
        `/api/bookings/owner/${encodeURIComponent(reference)}/receiver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: receiverNombre.trim(),
            contacto: receiverContacto.trim(),
          }),
        },
      );
      if (res.ok) {
        setReceiverSaved(true);
        setTimeout(() => setReceiverSaved(false), 3000);
      }
    } catch {
      /* noop */
    } finally {
      setReceiverSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-emerald-50/40">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-emerald-50/40 px-4 text-center">
        <p className="text-sm text-gray-500">
          No encontramos esta reserva. Verifica el enlace.
        </p>
      </div>
    );
  }

  const ownerOfferPending =
    data.ownerOfferPending === true &&
    !offerAcceptedLocal &&
    !offerRejectedLocal &&
    !data.ownerOfferAccepted &&
    !data.ownerOfferRejected;
  const ownerOfferRejected =
    data.ownerOfferRejected === true || offerRejectedLocal;
  const showOwnerCheckin =
    !ownerOfferPending && !ownerOfferRejected;
  const checkinDone = data.checkinCompleted || data.guestCount > 0;
  const guestListRequired = data.requiresGuestList !== false;
  const horaConfirmada = Boolean(String(data.horaEntrada ?? "").trim());
  const share = data.ownerPortalShare ?? {
    showGuestList: true,
    showPlates: true,
    showEmpleada: true,
    showInternalNotes: false,
  };
  const pdfHref =
    share.showGuestList &&
    guestListRequired &&
    (data.invitadosPdfUrl ||
      (data.guestCount > 0
        ? `/api/bookings/owner/${encodeURIComponent(data.reference)}/guests-pdf`
        : null));

  const novedadParts = [
    data.clientObservaciones?.trim(),
    share.showInternalNotes ? data.checkinObservaciones?.trim() : null,
  ].filter(Boolean) as string[];
  const novedadText = novedadParts.join("\n\n") || null;
  const hasPayout =
    data.ownerPayout &&
    (data.ownerPayout.valorAcordado ||
      data.ownerPayout.abono ||
      data.ownerPayout.valor ||
      data.ownerPayout.fecha ||
      data.ownerPayout.comprobanteUrl);

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-50 to-white px-4 py-10 pb-28">
      <div className="mx-auto max-w-md space-y-3">
        <div className="mb-2 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-black text-white shadow-lg">
            F
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            Propietario · Fincas Ya
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
            Confirmación de reserva
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">{data.propertyTitle}</p>
          {data.ownerName ? (
            <p className="mt-1 text-xs text-gray-400">
              Hola, {propietarioTratoLabel(data.ownerTratamiento)}{" "}
              {data.ownerName}
            </p>
          ) : null}
        </div>

        {ownerOfferRejected ? (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 shadow-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-700">
              Reserva no confirmada
            </p>
            <h2 className="mt-2 text-xl font-black text-gray-900">
              Rechazaste esta reserva
            </h2>
            {data.ownerOfferRejectedReason ? (
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-semibold">Motivo:</span>{" "}
                {data.ownerOfferRejectedReason}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-gray-600">
              El equipo de FincasYa fue notificado y se pondrá en contacto contigo.
            </p>
          </div>
        ) : null}

        {ownerOfferPending ? (
          <div className="rounded-2xl border-2 border-emerald-300 bg-white p-5 shadow-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
              Confirmación de reserva
            </p>
            <h2 className="mt-2 text-xl font-black text-gray-900">
              Revisa y confirma el pago
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              FincasYa te confirma el arriendo de{" "}
              <span className="font-semibold text-gray-800">
                {data.propertyTitle}
              </span>
              . El cliente ya realizó su abono; al confirmar verás el listado de
              invitados, placas y toda la información del check-in.
            </p>
            {data.ownerPayout?.valorAcordado ? (
              <div className="my-4 rounded-xl border border-emerald-100 bg-white px-4 py-3">
                <OwnerPayoutBreakdown payout={data.ownerPayout} />
              </div>
            ) : null}
            <button
              type="button"
              disabled={acceptingOffer}
              onClick={() => void submitAcceptOffer()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {acceptingOffer ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CircleCheck className="h-4 w-4" />
                  Confirmar reserva
                </>
              )}
            </button>

            <div className="mt-5 space-y-3 border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                ¿Tienes dudas o no puedes confirmar?
              </p>
              <textarea
                value={offerComment}
                onChange={(e) => setOfferComment(e.target.value)}
                rows={2}
                placeholder="Escribe una observación para el equipo (sin rechazar)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400"
              />
              <button
                type="button"
                disabled={commentingOffer}
                onClick={() => void submitOfferComment()}
                className="w-full rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
              >
                {commentingOffer ? "Enviando…" : "Enviar observación"}
              </button>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                placeholder="Motivo del rechazo (obligatorio)"
                className="w-full rounded-xl border border-red-100 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400"
              />
              <button
                type="button"
                disabled={rejectingOffer}
                onClick={() => void submitRejectOffer()}
                className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
              >
                {rejectingOffer ? "Registrando…" : "No puedo confirmar esta reserva"}
              </button>
            </div>
          </div>
        ) : null}

        {/* 1 · Información de la reserva */}
        <OwnerCard
          title="Información de la reserva"
          icon={<Info className="h-[18px] w-[18px] text-emerald-600" />}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Entrada
              </p>
              <p className="mt-1 text-sm font-bold text-gray-800">
                {fmtFecha(data.fechaEntrada)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Salida
              </p>
              <p className="mt-1 text-sm font-bold text-gray-800">
                {fmtFecha(data.fechaSalida)}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {nights(data.fechaEntrada, data.fechaSalida)} noche
                {nights(data.fechaEntrada, data.fechaSalida) === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Personas
              </p>
              <p className="mt-1 text-sm font-bold text-gray-800">
                {data.numeroPersonas ?? "—"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Hora de llegada
              </p>
              {horaConfirmada ? (
                <p className="mt-1 text-sm font-bold text-gray-800">
                  {fmtHora(data.horaEntrada, data.fechaEntrada)}
                  <span className="text-amber-600">*</span>
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-600">
                  Los turistas aún están validando la hora de llegada. Se estima
                  una llegada muy temprano en la mañana.
                </p>
              )}
            </div>
          </div>
          {horaConfirmada ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[11px] leading-relaxed text-amber-800">
                <span className="text-amber-600">*</span>Sin embargo, te
                iremos validando los tiempos de llegada a medida que los
                turistas los actualizan.
              </p>
            </div>
          ) : null}
        </OwnerCard>

        {/* 2 · Pago al propietario */}
        {!showOwnerCheckin && hasPayout ? (
          <OwnerCard
            title="Pago al propietario"
            icon={<CircleCheck className="h-[18px] w-[18px] text-emerald-600" />}
          >
            <OwnerPayoutBreakdown payout={data.ownerPayout!} />
            {data.ownerPayout!.valor ? (
              <div className="flex items-center justify-between border-b border-gray-100 py-1.5 text-sm">
                <span className="text-gray-500">Último pago</span>
                <span className="font-bold text-gray-900">
                  {fmtCOP(data.ownerPayout!.valor!)}
                </span>
              </div>
            ) : null}
            {data.ownerPayout!.fecha ? (
              <div className="flex items-center justify-between border-b border-gray-100 py-1.5 text-sm">
                <span className="text-gray-500">Fecha</span>
                <span className="text-gray-800">{data.ownerPayout!.fecha}</span>
              </div>
            ) : null}
            {data.ownerPayout!.medio ? (
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-500">Medio</span>
                <span className="text-gray-800">{data.ownerPayout!.medio}</span>
              </div>
            ) : null}
            {data.ownerPayout!.comprobanteUrl ? (
              <a
                href={data.ownerPayout!.comprobanteUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <FileText className="h-4 w-4" /> Ver comprobante de pago
              </a>
            ) : null}
          </OwnerCard>
        ) : null}

        {/* 3 · Novedad del cliente */}
        {showOwnerCheckin ? (
        <OwnerCard
          title="Novedad del cliente"
          icon={<Info className="h-[18px] w-[18px] text-amber-600" />}
        >
          {novedadText ? (
            <p className="text-xs leading-relaxed whitespace-pre-line text-gray-700">
              {novedadText}
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              Sin novedades registradas por el momento.
            </p>
          )}
        </OwnerCard>
        ) : null}

        {/* 4 · Estado del check-in */}
        {showOwnerCheckin ? (
        <OwnerCard
          title="Estado del check-in"
          icon={<CircleCheck className="h-[18px] w-[18px] text-emerald-600" />}
        >
          {share.showEmpleada ? (
            <div className="flex items-start gap-2.5 py-1.5">
              <CircleCheck
                className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${
                  data.empleada === "no" ? "text-gray-300" : "text-emerald-600"
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Empleada de servicio
                </p>
                <p className="text-xs text-gray-500">
                  {EMPLEADA_LABEL[data.empleada]}
                </p>
                {data.serviciosNota ? (
                  <p className="mt-1 text-xs italic text-gray-600">
                    “{data.serviciosNota}”
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {share.showGuestList && guestListRequired ? (
            <div
              className={`flex items-start gap-2.5 py-1.5 ${
                share.showEmpleada ? "border-t border-gray-50" : ""
              }`}
            >
              {checkinDone ? (
                <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600" />
              ) : (
                <Clock className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Listado de invitados
                </p>
                <p className="text-xs text-gray-500">
                  {checkinDone
                    ? `Diligenciado · ${data.guestCount} ${
                        data.guestCount === 1 ? "persona" : "personas"
                      }`
                    : "Aún pendiente · lo recibirás máximo 24 h antes de la llegada."}
                </p>
                {checkinDone && data.guests.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {data.guests.map((g, i) => {
                      const tipo = (g.tipoDocumento || "CC").toUpperCase();
                      const esMenorEdad = tipo === "TI" || tipo === "RC";
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 text-gray-700">
                            <span className="shrink-0 text-gray-400">
                              {i + 1}.
                            </span>
                            <span className="truncate">{g.nombre}</span>
                            {esMenorEdad ? (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                Menor de edad
                              </span>
                            ) : null}
                          </span>
                          {g.cedula ? (
                            <span className="shrink-0 font-mono text-gray-400">
                              {tipo} {g.cedula}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {share.showPlates && data.placas ? (
            <div className="flex items-start gap-2.5 border-t border-gray-50 py-1.5">
              <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Placas de vehículos
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {data.placas
                    .split(/[,\n]+/)
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .map((p, i) => (
                      <span
                        key={i}
                        className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700"
                      >
                        {p.toUpperCase()}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          ) : share.showPlates ? (
            <div className="flex items-start gap-2.5 border-t border-gray-50 py-1.5">
              <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gray-300" />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Placas de vehículos
                </p>
                <p className="text-xs text-gray-500">Aún sin registrar</p>
              </div>
            </div>
          ) : null}

          {data.allowsPets ? (
            <div className="flex items-start gap-2.5 border-t border-gray-50 py-1.5">
              <span
                className={`mt-0.5 text-[18px] leading-none ${
                  data.mascotas > 0 ? "" : "opacity-40"
                }`}
                aria-hidden
              >
                🐾
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">Mascotas</p>
                <p className="text-xs text-gray-500">
                  {data.mascotas > 0
                    ? `Sí, van ${data.mascotas} mascota${
                        data.mascotas === 1 ? "" : "s"
                      }`
                    : "No van mascotas"}
                </p>
              </div>
            </div>
          ) : null}
        </OwnerCard>
        ) : null}

        {/* 6 · ¿Quién recibe a los turistas? */}
        {showOwnerCheckin ? (
        <OwnerCard
          title="¿Quién recibe a los turistas?"
          icon={<UserCheck className="h-[18px] w-[18px] text-emerald-600" />}
        >
          <p className="mb-3 text-xs text-gray-500">
            Indícanos quién los recibirá el día de la llegada.
          </p>
          <input
            type="text"
            value={receiverNombre}
            onChange={(e) => setReceiverNombre(e.target.value)}
            placeholder="Nombre"
            className="mb-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-400"
          />
          <input
            type="text"
            inputMode="tel"
            value={receiverContacto}
            onChange={(e) => setReceiverContacto(e.target.value)}
            placeholder="Celular"
            className="mb-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-400"
          />
          <button
            type="button"
            disabled={
              receiverSaving ||
              (!receiverNombre.trim() && !receiverContacto.trim())
            }
            onClick={() => void submitReceiver()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {receiverSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : receiverSaved ? (
              <>
                <CircleCheck className="h-4 w-4" /> Guardado
              </>
            ) : (
              "Guardar contacto"
            )}
          </button>
        </OwnerCard>
        ) : null}

        {/* 7 · Descargar PDF */}
        {showOwnerCheckin && guestListRequired && share.showGuestList ? (
          pdfHref ? (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3.5 text-sm font-bold text-emerald-700 shadow-sm hover:border-emerald-400 hover:bg-emerald-50"
            >
              <FileText className="h-5 w-5" />
              Descargar PDF de invitados
            </a>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3.5 text-center">
              <FileText className="mx-auto h-5 w-5 text-gray-300" />
              <p className="mt-1 text-sm font-semibold text-gray-400">
                PDF de invitados
              </p>
              <p className="text-[11px] text-gray-400">
                Disponible cuando el turista complete el listado
              </p>
            </div>
          )
        ) : null}

        {showOwnerCheckin &&
        data.depositoGarantia > 0 &&
        esDiaDeSalidaOposterior(data.fechaSalida) ? (
          <OwnerCard
            title="Devolución del depósito"
            icon={<Info className="h-[18px] w-[18px] text-emerald-600" />}
          >
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">Depósito de garantía</span>
              <span className="font-bold text-gray-900">
                {fmtCOP(data.depositoGarantia)}
              </span>
            </div>
            {depositEstado === "aprobado" ? (
              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                ✅ Aprobaste la devolución del depósito. El equipo procederá con
                la transferencia al cliente.
              </p>
            ) : depositEstado === "rechazado" ||
              depositEstado === "en_revision" ? (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                ⚠️ Reportaste una novedad. El equipo revisará el caso antes de
                cualquier devolución.
              </p>
            ) : depositEstado === "devuelto" ? (
              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                ✅ Devolución completada.
              </p>
            ) : (
              <>
                <p className="mt-1 mb-2 text-[11px] leading-relaxed text-gray-500">
                  ¿Apruebas la devolución del depósito tras revisar el estado del
                  inmueble?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={depositSaving}
                    onClick={() => void submitDepositApproval("aprobado")}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={depositSaving}
                    onClick={() => void submitDepositApproval("rechazado")}
                    className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Reportar novedad
                  </button>
                </div>
              </>
            )}
          </OwnerCard>
        ) : null}

        {/* 8 · Mensaje informativo */}
        {showOwnerCheckin ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              Esta página se actualiza automáticamente. Cuando el turista termine
              el check-in, aquí aparecerá la lista definitiva de invitados y
              podrás descargar el PDF actualizado.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-[11px] leading-relaxed text-emerald-800">
              Acepta el valor ofrecido para habilitar el check-in, la lista de
              invitados y el resto de la información de la reserva.
            </p>
          </div>
        )}

        {/* 9 · Soporte 24x7 (botón inline; también flotante abajo) */}
        <a
          href={`https://wa.me/573157773937?text=${encodeURIComponent("Hola, necesito soporte (propietario). 🙏")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#20bd5a]"
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-white" />
          Soporte 24x7
        </a>
      </div>
      <SupportFab context="propietario" />
    </div>
  );
}
