"use client";

/**
 * AUDIOS DEL BOT: casos con nota de voz pregrabada que el bot envía cuando la
 * conversación cae en la situación configurada (ej. "¿es seguro? ¿son
 * confiables?" → audio de confianza). El equipo crea el caso, sube el audio y
 * lo habilita/deshabilita; el bot lo envía máximo una vez por conversación.
 */
import { useEffect, useRef, useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  AlertTriangle,
  Loader2,
  Mic,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AudioRecorder } from "@/features/inbox/components/AudioRecorder";

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
    msg: "Se enviará, pero NO como nota de voz (WhatsApp solo muestra la onda con OGG/Opus). Para el efecto de voz, graba aquí con el micrófono (sale en OGG) o exporta una nota de WhatsApp.",
  };
}

function blobToAudioFile(blob: Blob, mimeType: string, seconds: number): File {
  const ext =
    mimeType.includes("ogg") || mimeType.includes("opus") ? "ogg" : "webm";
  const name = `nota-voz-${seconds || 0}s-${Date.now()}.${ext}`;
  return new File([blob], name, { type: mimeType || "audio/ogg" });
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
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [recordingNew, setRecordingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edición por tarjeta (textos + audio pendiente de subir)
  const [edits, setEdits] = useState<
    Record<string, { titulo: string; situacion: string; texto: string }>
  >({});
  const [pendingAudio, setPendingAudio] = useState<Record<string, File | null>>(
    {},
  );
  const [pendingPreview, setPendingPreview] = useState<
    Record<string, string | null>
  >({});
  const [recordingEditId, setRecordingEditId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const applyNewFile = (f: File | null) => {
    setFilePreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  };

  const setPendingFile = (key: string, f: File | null) => {
    setPendingPreview((prev) => {
      const old = prev[key];
      if (old) URL.revokeObjectURL(old);
      return {
        ...prev,
        [key]: f ? URL.createObjectURL(f) : null,
      };
    });
    setPendingAudio((prev) => ({ ...prev, [key]: f }));
  };

  const clearPendingFile = (key: string) => {
    setPendingPreview((prev) => {
      const old = prev[key];
      if (old) URL.revokeObjectURL(old);
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPendingAudio((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setEditField = (
    id: string,
    a: AudioRow,
    patch: Partial<{ titulo: string; situacion: string; texto: string }>,
  ) => {
    setEdits((prev) => {
      const cur = prev[id] ?? {
        titulo: a.titulo,
        situacion: a.situacion,
        texto: a.texto ?? "",
      };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

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
      return toast.error(
        "El caso necesita al menos un audio o un texto oficial.",
      );
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
      applyNewFile(null);
      setRecordingNew(false);
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

  const guardarCaso = async (a: AudioRow) => {
    const key = String(a.id);
    const e = edits[key] ?? {
      titulo: a.titulo,
      situacion: a.situacion,
      texto: a.texto ?? "",
    };
    const newFile = pendingAudio[key] ?? null;
    if (newFile && !audioFormat(newFile.type, newFile.name).ok) {
      return toast.error(
        "Ese formato de audio no lo acepta WhatsApp. Usa OGG/Opus o MP3.",
      );
    }
    if (!e.titulo.trim()) return toast.error("El título no puede quedar vacío.");
    if (!e.situacion.trim())
      return toast.error("La situación no puede quedar vacía.");
    if (!e.texto.trim() && !a.url && !newFile) {
      return toast.error(
        "El caso necesita al menos un audio o un texto oficial.",
      );
    }

    setSavingId(key);
    try {
      const patch: {
        id: Id<"botAudios">;
        titulo: string;
        situacion: string;
        texto: string;
        storageId?: Id<"_storage">;
        mimeType?: string;
        filename?: string;
      } = {
        id: a.id,
        titulo: e.titulo,
        situacion: e.situacion,
        texto: e.texto,
      };
      if (newFile) {
        patch.storageId = await uploadFile(newFile);
        patch.mimeType = newFile.type || undefined;
        patch.filename = newFile.name || undefined;
      }
      await updateAudio(patch);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      clearPendingFile(key);
      setRecordingEditId(null);
      const input = replaceInputRefs.current[key];
      if (input) input.value = "";
      toast.success("Caso actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSavingId(null);
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

          {recordingNew ? (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <AudioRecorder
                onCancel={() => setRecordingNew(false)}
                onSend={(blob, mime, seconds) => {
                  applyNewFile(blobToAudioFile(blob, mime, seconds));
                  setRecordingNew(false);
                  toast.success("Audio grabado — listo para crear el caso.");
                }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setRecordingNew(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <Mic className="h-4 w-4" />
                Grabar audio
              </button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-muted">
                <Upload className="w-4 h-4" />
                {file ? file.name : "Cargar archivo"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => applyNewFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && filePreview ? (
                <audio controls src={filePreview} className="h-10 max-w-full" />
              ) : null}
              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    applyNewFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-destructive text-xs underline-offset-2 hover:underline"
                >
                  Quitar audio
                </button>
              ) : null}
              <button
                type="button"
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
          )}
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
            💡 <strong>Grabar audio</strong> genera OGG/Opus (nota de voz con
            onda en WhatsApp). También puedes cargar un archivo exportado desde
            WhatsApp (.opus/.ogg).
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
            const key = String(a.id);
            const e = edits[key];
            const draft = e ?? {
              titulo: a.titulo,
              situacion: a.situacion,
              texto: a.texto ?? "",
            };
            const newFile = pendingAudio[key] ?? null;
            const dirty =
              Boolean(newFile) ||
              draft.titulo !== a.titulo ||
              draft.situacion !== a.situacion ||
              draft.texto !== (a.texto ?? "");
            const previewUrl = pendingPreview[key] || a.url;
            const fmt = newFile
              ? audioFormat(newFile.type, newFile.name)
              : audioFormat(a.mimeType, a.filename);
            const isSaving = savingId === key;
            const isRecordingThis = recordingEditId === key;

            return (
              <div
                key={key}
                className={`rounded-2xl border p-4 shadow-sm space-y-3 ${
                  a.enabled
                    ? "border-border bg-card"
                    : "border-border bg-muted/40 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Título
                    </label>
                    <input
                      value={draft.titulo}
                      onChange={(ev) =>
                        setEditField(key, a, { titulo: ev.target.value })
                      }
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-6">
                    <span className="text-[11px] text-muted-foreground">
                      {a.enabled ? "Activo" : "Inactivo"}
                    </span>
                    <Toggle on={a.enabled} onClick={() => void toggle(a)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Cuándo enviarlo (situación)
                  </label>
                  <textarea
                    value={draft.situacion}
                    onChange={(ev) =>
                      setEditField(key, a, { situacion: ev.target.value })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Texto oficial (opcional)
                  </label>
                  <textarea
                    value={draft.texto}
                    onChange={(ev) =>
                      setEditField(key, a, { texto: ev.target.value })
                    }
                    rows={2}
                    placeholder="Se envía tal cual, después de la nota de voz"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
                  {isRecordingThis ? (
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <AudioRecorder
                        onCancel={() => setRecordingEditId(null)}
                        onSend={(blob, mime, seconds) => {
                          setPendingFile(
                            key,
                            blobToAudioFile(blob, mime, seconds),
                          );
                          setRecordingEditId(null);
                          toast.success(
                            "Audio grabado — pulsa Guardar para aplicarlo.",
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {previewUrl ? (
                        <audio
                          controls
                          src={previewUrl}
                          className="h-10 min-w-0 flex-1"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sin audio todavía
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setRecordingEditId(key)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary hover:bg-primary/10"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        Grabar
                      </button>
                      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
                        <Upload className="h-3.5 w-3.5" />
                        {a.url || newFile ? "Cambiar archivo" : "Subir archivo"}
                        <input
                          ref={(el) => {
                            replaceInputRefs.current[key] = el;
                          }}
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(ev) => {
                            const f = ev.target.files?.[0] ?? null;
                            setPendingFile(key, f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {newFile && (
                    <p className="text-xs text-primary">
                      Nuevo archivo listo: <strong>{newFile.name}</strong> —
                      pulsa Guardar para aplicarlo.
                    </p>
                  )}
                  {fmt.msg && (
                    <p
                      className={`flex items-start gap-1.5 text-xs ${
                        fmt.ok ? "text-amber-600" : "text-red-600"
                      }`}
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {fmt.msg}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold">
                      {(previewUrl || a.url) && draft.texto.trim()
                        ? "🎙️ audio + 💬 texto"
                        : previewUrl || a.url
                          ? "🎙️ solo audio"
                          : "💬 solo texto"}
                    </span>
                    <span>
                      · Enviado {a.sentCount} vez{a.sentCount === 1 ? "" : "es"}
                    </span>
                    {a.filename && !newFile && (
                      <span className="truncate">· {a.filename}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {dirty && (
                    <button
                      type="button"
                      onClick={() => void guardarCaso(a)}
                      disabled={isSaving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Guardar cambios
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void borrar(a)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
