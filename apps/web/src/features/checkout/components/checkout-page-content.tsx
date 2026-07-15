"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  ShieldCheck,
  Landmark,
  Send,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { SupportFab } from "@/features/shared/components/support-fab";
import {
  checkoutEndpoint,
  type CheckoutData,
} from "@/features/checkout/api/checkout-portal.api";

const TZ = "America/Bogota";

const BANCOS = [
  "Bancolombia",
  "Davivienda",
  "BBVA",
  "Banco de Bogotá",
  "Nequi",
  "Daviplata",
  "Banco de Occidente",
  "Scotiabank Colpatria",
  "Banco Popular",
  "Banco Caja Social",
  "Otro",
];

const ESTADO_MSG: Record<string, string> = {
  pendiente_validacion:
    "Estamos validando el estado del inmueble con el propietario. Una vez recibamos su aprobación procederemos con la devolución del depósito.",
  aprobado:
    "El propietario aprobó la devolución del depósito. Procederemos con la transferencia correspondiente.",
  rechazado:
    "El propietario reportó novedades sobre el estado del inmueble. La devolución se encuentra en revisión.",
  en_revision:
    "La devolución del depósito está en proceso de revisión debido a observaciones reportadas por el propietario. Nuestro equipo se comunicará contigo.",
};

function fmtFecha(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(ms));
}

const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);

export function CheckoutPageContent() {
  const params = useParams<{ reference?: string }>();
  const reference = decodeURIComponent(String(params?.reference ?? ""));
  const [data, setData] = useState<CheckoutData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const [titular, setTitular] = useState("");
  const [banco, setBanco] = useState("");
  const [tipo, setTipo] = useState("Ahorros");
  const [numero, setNumero] = useState("");
  const [documento, setDocumento] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    fetch(checkoutEndpoint(reference), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: CheckoutData) => {
        if (!active) return;
        setData(json);
        const c = json.cuenta;
        if (c) {
          setTitular(c.titular ?? "");
          setBanco(c.banco ?? "");
          setTipo(c.tipo ?? "Ahorros");
          setNumero(c.numero ?? "");
          setDocumento(c.documento ?? "");
          setObservaciones(c.observaciones ?? "");
        }
        setStatus("ok");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [reference]);

  const handleSubmit = async () => {
    setError(null);
    if (!titular.trim() || !numero.trim() || !banco.trim()) {
      setError("Completa al menos titular, banco y número de cuenta.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(checkoutEndpoint(reference), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta: {
            titular: titular.trim(),
            tipo: tipo.trim(),
            numero: numero.trim(),
            banco: banco.trim(),
            documento: documento.trim(),
            observaciones: observaciones.trim(),
          },
        }),
      });
      if (!res.ok) {
        setError("No se pudieron guardar los datos. Intenta de nuevo.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
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

  const inputCls =
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20";
  const labelCls =
    "mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500";

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-50 to-white px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-5 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-black text-white shadow-lg">
            F
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            Check-out · Fincas Ya
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
            ¡Gracias por tu estadía!
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-gray-600">
            {data.nombreTitular
              ? `Hola, ${data.nombreTitular.trim().split(/\s+/)[0]} 👋 `
              : "Hola 👋 "}
            Esperamos que hayas tenido una excelente estadía en{" "}
            <span className="font-semibold text-gray-700">
              {data.propertyTitle}
            </span>
            . Te dejamos lo necesario para tu salida.
          </p>
          <p className="mt-1.5 text-xs text-gray-400">
            Salida: {fmtFecha(data.fechaSalida)}
            {data.horaSalida ? ` · ${data.horaSalida}` : ""}
          </p>
        </div>

        {/* Reglas de salida */}
        <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            <Clock className="h-4 w-4 text-emerald-600" /> Reglas de salida
          </p>
          <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            ⏰ Recuerda que la hora máxima de salida es a las{" "}
            <strong>4:00 PM</strong>. Las salidas posteriores podrán generar
            cobros adicionales según las políticas de la reserva.
          </div>
          <ul className="space-y-1 pl-1 text-xs leading-relaxed text-gray-600">
            {data.reglas
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              // La hora máxima ya se muestra arriba en el recuadro destacado.
              .filter((l) => !/hora\s+m[aá]xima|4:00\s*pm/i.test(l))
              .map((l, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-emerald-500">•</span>
                  <span>{l}</span>
                </li>
              ))}
          </ul>
        </div>

        {/* Depósito */}
        <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Depósito de
            garantía
          </p>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-gray-500">Valor</span>
            <span className="font-bold text-gray-900">
              {fmtCOP(data.depositoGarantia)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 py-1.5 text-sm">
            <span className="text-gray-500">Estado</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
              {data.depositoEstadoLabel}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            {ESTADO_MSG[data.depositoEstado] || ESTADO_MSG.pendiente_validacion}
          </p>

          {data.devolucion &&
          (data.devolucion.valor || data.devolucion.comprobanteUrl) ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Devolución realizada
              </p>
              {data.devolucion.valor ? (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-gray-500">Valor devuelto</span>
                  <span className="font-bold text-emerald-700">
                    {fmtCOP(data.devolucion.valor)}
                  </span>
                </div>
              ) : null}
              {data.valorRetenido ? (
                <div className="flex items-center justify-between border-t border-emerald-100 py-1 text-sm">
                  <span className="text-gray-500">Valor retenido</span>
                  <span className="text-gray-800">
                    {fmtCOP(data.valorRetenido)}
                  </span>
                </div>
              ) : null}
              {data.devolucion.fecha ? (
                <div className="flex items-center justify-between border-t border-emerald-100 py-1 text-sm">
                  <span className="text-gray-500">Fecha</span>
                  <span className="text-gray-800">{data.devolucion.fecha}</span>
                </div>
              ) : null}
              {data.devolucion.medio ? (
                <div className="flex items-center justify-between border-t border-emerald-100 py-1 text-sm">
                  <span className="text-gray-500">Medio</span>
                  <span className="text-gray-800">{data.devolucion.medio}</span>
                </div>
              ) : null}
              {data.devolucion.observaciones ? (
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  {data.devolucion.observaciones}
                </p>
              ) : null}
              {data.devolucion.comprobanteUrl ? (
                <a
                  href={data.devolucion.comprobanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  <FileText className="h-4 w-4" /> Ver comprobante de devolución
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Cuenta para devolución */}
        {saved ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-sm font-bold text-emerald-900">
              ¡Datos recibidos!
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              Registramos tu cuenta para la devolución. Vuelve a este mismo
              enlace para ver el estado y el comprobante cuando se realice.
            </p>
            <button
              type="button"
              onClick={() => setSaved(false)}
              className="mt-3 text-xs font-semibold text-emerald-700 underline"
            >
              Editar datos
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Landmark className="h-4 w-4 text-emerald-600" /> Cuenta para la
              devolución
            </p>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
              Registra a dónde transferir el depósito.
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Titular de la cuenta</label>
                <input
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                  placeholder="Nombre completo"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Banco</label>
                  <select
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecciona…</option>
                    {BANCOS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo de cuenta</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className={inputCls}
                  >
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                    <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Número de cuenta</label>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.replace(/\s/g, ""))}
                  inputMode="numeric"
                  placeholder="000000000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Documento del titular</label>
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Ej: CC 1.012.345.678"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Observaciones (opcional)</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Algo que debamos tener en cuenta…"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>
            </div>

            {error ? (
              <p className="mt-3 text-xs font-medium text-red-500">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" /> Enviar datos de devolución
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-400">
              Puedes volver a este mismo enlace para ver el estado de tu
              devolución y el comprobante cuando se realice.
            </p>
          </div>
        )}
      </div>
      <SupportFab context="check-out" />
    </div>
  );
}
