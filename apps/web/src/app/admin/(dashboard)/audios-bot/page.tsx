"use client";

/**
 * AUDIOS DEL BOT: casos con nota de voz pregrabada que el bot envía cuando la
 * conversación cae en la situación configurada (ej. "¿es seguro? ¿son
 * confiables?" → audio de confianza). El equipo crea el caso, sube el audio y
 * lo habilita/deshabilita; el bot lo envía máximo una vez por conversación.
 */
import { useRef, useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { AlertTriangle, Loader2, Mic, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

type AudioRow = {
  id: Id<"botAudios">;
  titulo: string;
  situacion: string;
  texto: string | null;
  enabled: boolean;
  sentCount: number;
  filename: string | null;
  mimeType: string | null;
  url: string | null;
  createdAt: number;
};

/**
 * WhatsApp SOLO muestra la nota de voz (burbuja con onda) para OGG/Opus. MP3 y
 * M4A se envían como audio normal (reproduce, pero no se ve como voz). WebM
 * (grabación del navegador) Meta lo rechaza — hay que evitarlo.
 */
function audioFormat(mime: string | null, name: string | null): {
  ok: boolean;
  voiceNote: boolean;
  msg: string | null;
} {
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  const isOgg = m.includes("ogg") || n.endsWith(".ogg") || n.endsWith(".opus");
  const isWebm = m.includes("webm") || n.endsWith(".webm");
  if (isOgg) return { ok: true, voiceNote: true, msg: null };
  if (isWebm)
    return {
      ok: false,
      voiceNote: false,
      msg: "WhatsApp NO acepta este formato (.webm). Conviértelo a OGG/Opus o graba la nota de voz en WhatsApp y expórtala.",
    };
  return {
    ok: true,
    voiceNote: false,
    msg: "Se enviará, pero NO como nota de voz (WhatsApp solo muestra la onda con OGG/Opus). Para el efecto de voz, graba la nota en WhatsApp y compártela — sale en .opus.",
  };
}

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AudiosBotPage() {
  const audios = useConvexQuery(api.botAudios.list, {}) as
    | AudioRow[]
    | undefined;
  const generateUploadUrl = useConvexMutation(api.botAudios.generateUploadUrl);
  const createAudio = useConvexMutation(api.botAudios.create);
  const updateAudio = useConvexMutation(api.botAudios.update);
  const removeAudio = useConvexMutation(api.botAudios.remove);

  // Formulario de caso nuevo
  const [titulo, setTitulo] = useState("");
  const [situacion, setSituacion] = useState("");
  const [texto, setTexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edición por tarjeta (solo textos; el toggle guarda directo)
  const [edits, setEdits] = useState<
    Record<string, { titulo: string; situacion: string; texto: string }>
  >({});

  const uploadFile = async (f: File): Promise<Id<"_storage">> => {
    const url = await generateUploadUrl({});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": f.type || "application/octet-stream" },
      body: f,
    });
    if (!res.ok) throw new Error("No se pudo subir el archivo.");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
  };

  const crear = async () => {
    if (!titulo.trim()) return toast.error("Ponle un título al caso.");
    if (!situacion.trim())
      return toast.error("Describe cuándo debe enviarse la respuesta.");
    if (!file && !texto.trim())
      return toast.error("El caso necesita al menos un audio o un texto oficial.");
    if (file && !audioFormat(file.type, file.name).ok)
      return toast.error(
        "Ese formato de audio no lo acepta WhatsApp. Usa OGG/Opus (nota de voz de WhatsApp) o MP3.",
      );
    setSaving(true);
    try {
      const storageId = file ? await uploadFile(file) : undefined;
      await createAudio({
        titulo: titulo.trim(),
        situacion: situacion.trim(),
        storageId,
        mimeType: file?.type || undefined,
        filename: file?.name || undefined,
        texto: texto.trim() || undefined,
      });
      setTitulo("");
      setSituacion("");
      setTexto("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Caso creado — el bot ya puede enviar esta respuesta.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: AudioRow) => {
    try {
      await updateAudio({ id: a.id, enabled: !a.enabled });
      toast.success(
        !a.enabled
          ? "Activado — el bot puede enviarlo."
          : "Desactivado — el bot ya no lo envía.",
      );
    } catch {
      toast.error("No se pudo actualizar.");
    }
  };

  const guardarTextos = async (a: AudioRow) => {
    const e = edits[String(a.id)];
    if (!e) return;
    try {
      await updateAudio({
        id: a.id,
        titulo: e.titulo,
        situacion: e.situacion,
        texto: e.texto,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[String(a.id)];
        return next;
      });
      toast.success("Caso actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  };

  const borrar = async (a: AudioRow) => {
    if (
      !window.confirm(
        `¿Eliminar el caso "${a.titulo}"? El bot dejará de enviar este audio.`,
      )
    )
      return;
    try {
      await removeAudio({ id: a.id });
      toast.success("Caso eliminado.");
    } catch {
      toast.error("No se pudo eliminar.");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <Mic className="w-5 h-5 text-primary" />
          </span>
          Audios del bot
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-11">
          Respuestas oficiales (nota de voz, texto o ambos) que el bot envía
          cuando la conversación cae en la situación que definas (ej. el
          cliente pregunta si somos confiables). El texto sale tal cual lo
          escribas. Máximo una vez por conversación.
        </p>
      </div>

      {/* Crear caso nuevo */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <h3 className="font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo caso
        </h3>
        <div className="space-y-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={'Título — ej: "¿Es seguro / son confiables?"'}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
          <textarea
            value={situacion}
            onChange={(e) => setSituacion(e.target.value)}
            placeholder={
              'Cuándo debe enviarlo el bot — ej: "el cliente duda de la seriedad de la empresa: pregunta si es seguro, si es confiable, si no es estafa, si de verdad existen"'
            }
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              "Texto oficial (opcional) — se envía TAL CUAL, después de la nota de voz. Déjalo vacío si el caso es solo audio."
            }
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-muted">
              <Upload className="w-4 h-4" />
              {file ? file.name : "Cargar audio (opcional — mp3, ogg, m4a…)"}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <audio controls src={URL.createObjectURL(file)} className="h-10" />
            )}
            <button
              onClick={() => void crear()}
              disabled={saving}
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Crear caso
            </button>
          </div>
          {file &&
            (() => {
              const f = audioFormat(file.type, file.name);
              if (!f.msg) return null;
              return (
                <p
                  className={`flex items-start gap-1.5 text-xs ${
                    f.ok ? "text-amber-600" : "text-red-600"
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {f.msg}
                </p>
              );
            })()}
          <p className="text-xs text-muted-foreground">
            💡 Para que suene como <strong>nota de voz</strong> (con la onda),
            graba el audio en WhatsApp, mantén pulsado el mensaje →{" "}
            <em>Compartir/Exportar</em>, y sube ese archivo (.opus/.ogg).
          </p>
        </div>
      </div>

      {/* Lista de casos */}
      {audios === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : audios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aún no hay casos. Crea el primero arriba — por ejemplo, un audio para
          cuando el cliente pregunta si la empresa es confiable.
        </div>
      ) : (
        <div className="space-y-3">
          {audios.map((a) => {
            const e = edits[String(a.id)];
            const dirty =
              e &&
              (e.titulo !== a.titulo ||
                e.situacion !== a.situacion ||
                e.texto !== (a.texto ?? ""));
            return (
              <div
                key={String(a.id)}
                className={`rounded-2xl border p-4 shadow-sm space-y-2.5 ${
                  a.enabled
                    ? "border-border bg-card"
                    : "border-border bg-muted/40 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <input
                    value={e?.titulo ?? a.titulo}
                    onChange={(ev) =>
                      setEdits((prev) => ({
                        ...prev,
                        [String(a.id)]: {
                          titulo: ev.target.value,
                          situacion: e?.situacion ?? a.situacion,
                          texto: e?.texto ?? a.texto ?? "",
                        },
                      }))
                    }
                    className="w-full bg-transparent text-sm font-bold outline-none"
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {a.enabled ? "Activo" : "Inactivo"}
                    </span>
                    <Toggle on={a.enabled} onClick={() => void toggle(a)} />
                  </div>
                </div>
                <textarea
                  value={e?.situacion ?? a.situacion}
                  onChange={(ev) =>
                    setEdits((prev) => ({
                      ...prev,
                      [String(a.id)]: {
                        titulo: e?.titulo ?? a.titulo,
                        situacion: ev.target.value,
                        texto: e?.texto ?? a.texto ?? "",
                      },
                    }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <textarea
                  value={e?.texto ?? a.texto ?? ""}
                  onChange={(ev) =>
                    setEdits((prev) => ({
                      ...prev,
                      [String(a.id)]: {
                        titulo: e?.titulo ?? a.titulo,
                        situacion: e?.situacion ?? a.situacion,
                        texto: ev.target.value,
                      },
                    }))
                  }
                  rows={2}
                  placeholder="Texto oficial (opcional) — se envía tal cual, después de la nota de voz"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center gap-3">
                  {a.url && <audio controls src={a.url} className="h-10" />}
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {a.url && (a.texto ?? "").trim()
                      ? "🎙️ audio + 💬 texto"
                      : a.url
                        ? "🎙️ solo audio"
                        : "💬 solo texto"}
                  </span>
                  {a.url &&
                    !audioFormat(a.mimeType, a.filename).voiceNote && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        No es nota de voz (no es OGG/Opus)
                      </span>
                    )}
                  <span className="text-xs text-muted-foreground">
                    Enviado {a.sentCount} vez{a.sentCount === 1 ? "" : "es"}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {dirty && (
                      <button
                        onClick={() => void guardarTextos(a)}
                        className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Guardar cambios
                      </button>
                    )}
                    <button
                      onClick={() => void borrar(a)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
