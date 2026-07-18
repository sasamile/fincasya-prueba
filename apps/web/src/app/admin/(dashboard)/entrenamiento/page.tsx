"use client";

/**
 * Panel de entrenamiento del bot: muestra qué ha aprendido el agente IA del
 * historial de conversaciones (cron nocturno 2:30 AM Bogotá / 7:30 UTC).
 */
import { useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Brain, CheckCircle2, Clock, MessageSquare, Star, User, Zap } from "lucide-react";

const LABEL_COLORS: Record<string, string> = {
  venta: "bg-green-100 text-green-800 border border-green-200",
  positiva: "bg-blue-100 text-blue-800 border border-blue-200",
  neutra: "bg-gray-100 text-gray-700 border border-gray-200",
  problematica: "bg-red-100 text-red-800 border border-red-200",
};
const LABEL_LABELS: Record<string, string> = {
  venta: "Venta",
  positiva: "Positiva",
  neutra: "Neutra",
  problematica: "Problemática",
};

const SOURCE_COLORS: Record<string, string> = {
  historico: "bg-violet-100 text-violet-800",
  faq: "bg-amber-100 text-amber-800",
  situacion: "bg-sky-100 text-sky-800",
  playbook: "bg-emerald-100 text-emerald-800",
  otro: "bg-gray-100 text-gray-700",
};
const SOURCE_LABELS: Record<string, string> = {
  historico: "Historial",
  faq: "FAQ",
  situacion: "Situaciones",
  playbook: "Playbook",
  otro: "Otro",
};

function fmt(ts: number) {
  return new Date(ts).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function EntrenamientoPage() {
  const stats = useQuery(api.curation.adminStats);

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 gap-3">
        <Brain className="w-6 h-6 animate-pulse" />
        <span>Cargando entrenamiento…</span>
      </div>
    );
  }

  const { labels, exemplars, recentLabels, recentExemplars } = stats;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-7 h-7 text-violet-600" />
          Entrenamiento del Bot
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          El bot aprende cada noche a las 2:30 AM (Bogotá) de las conversaciones exitosas del equipo.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Conversaciones analizadas" value={labels.total} color="bg-violet-50 text-violet-600" />
        <StatCard icon={Star} label="Ejemplares en el RAG" value={exemplars.total} sub={`${exemplars.humanAuthored} escritos por humanos`} color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle2} label="Embebidos (listos)" value={exemplars.embedded} sub={exemplars.pending > 0 ? `${exemplars.pending} pendientes` : "Todos listos"} color="bg-green-50 text-green-600" />
        <StatCard icon={User} label="Autorías humanas" value={exemplars.humanAuthored} sub="Mejor calidad para RAG" color="bg-blue-50 text-blue-600" />
      </div>

      {/* Distribución de etiquetas */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-500" />
          Clasificación de conversaciones
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["venta", "positiva", "neutra", "problematica"] as const).map((l) => (
            <div key={l} className="text-center rounded-lg border border-gray-100 py-4">
              <div className="text-3xl font-bold text-gray-900">{labels[l]}</div>
              <span className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLORS[l]}`}>
                {LABEL_LABELS[l]}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Solo las conversaciones <strong>Venta</strong> y <strong>Positiva</strong> generan ejemplares en el RAG. Las problemáticas nunca se usan como referencia.
        </p>
      </div>

      {/* Fuentes del RAG */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Fuentes del conocimiento del bot</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(exemplars.bySource).map(([src, count]) => (
            <div key={src} className="flex items-center gap-2 rounded-lg border border-gray-100 px-4 py-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[src] ?? "bg-gray-100 text-gray-700"}`}>
                {SOURCE_LABELS[src] ?? src}
              </span>
              <span className="text-xl font-bold text-gray-800">{count}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-400 space-y-1">
          <p><strong>Historial</strong>: pares pregunta→respuesta extraídos de conversaciones reales exitosas.</p>
          <p><strong>FAQ</strong>: respuestas oficiales del equipo (tarifas, proceso de reserva, horarios).</p>
          <p><strong>Situaciones</strong>: guiones para momentos clave (bienvenida, contrato, temporadas).</p>
          <p><strong>Playbook</strong>: plantillas del equipo curadas manualmente.</p>
        </div>
      </div>

      {/* Últimos ejemplares aprendidos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Últimos 30 ejemplares aprendidos</h2>
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {recentExemplars.map((e) => (
            <div key={e.id} className="rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-colors">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[e.source] ?? "bg-gray-100 text-gray-700"}`}>
                  {SOURCE_LABELS[e.source] ?? e.source}
                </span>
                {e.humanAuthored && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    ✍️ Humano
                  </span>
                )}
                {e.embedded ? (
                  <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Embebido</span>
                ) : (
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Pendiente</span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{fmt(e.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-500 italic mb-1">
                Cliente: <span className="not-italic text-gray-700">{e.clientMessage.slice(0, 120)}{e.clientMessage.length > 120 ? "…" : ""}</span>
              </p>
              <p className="text-xs text-gray-500">
                Bot: <span className="text-gray-700">{e.response.slice(0, 180)}{e.response.length > 180 ? "…" : ""}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Historial de etiquetado reciente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Últimas 20 conversaciones analizadas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">Fecha análisis</th>
                <th className="pb-2 pr-4">Etiqueta</th>
                <th className="pb-2 pr-4">Mensajes</th>
                <th className="pb-2 pr-4">Ejemplares creados</th>
                <th className="pb-2">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentLabels.map((l) => (
                <tr key={l.conversationId} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLORS[l.label]}`}>
                      {LABEL_LABELS[l.label] ?? l.label}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{l.messageCount}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    {l.exemplarsCreated > 0
                      ? <span className="text-green-700 font-medium">+{l.exemplarsCreated}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2 text-xs text-gray-500">{l.reasons.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
