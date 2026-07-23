"use client";

/**
 * Panel flotante sobre el compositor: lista los casos de /admin/audios-bot,
 * permite filtrar por situación/título y enviar la nota de voz al chat.
 */
import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  Headphones,
  Loader2,
  Pause,
  Play,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AudioRow = {
  id: Id<"botAudios">;
  titulo: string;
  situacion: string;
  texto: string | null;
  enabled: boolean;
  filename: string | null;
  mimeType: string | null;
  url: string | null;
};

export function BotAudiosPicker({
  conversationId,
  open,
  onClose,
}: {
  conversationId: Id<"conversations">;
  open: boolean;
  onClose: () => void;
}) {
  const audios = useQuery(api.botAudios.list, open ? {} : "skip") as
    | AudioRow[]
    | undefined;
  const sendToChat = useAction(api.botAudios.sendToConversation);

  const [filter, setFilter] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const enabled = useMemo(() => {
    const rows = (audios ?? []).filter(
      (a) => a.enabled && (a.url || a.texto?.trim()),
    );
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.titulo.toLowerCase().includes(q) ||
        a.situacion.toLowerCase().includes(q) ||
        (a.texto ?? "").toLowerCase().includes(q),
    );
  }, [audios, filter]);

  function stopPreview() {
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
    }
    setAudioEl(null);
    setPlayingId(null);
  }

  function togglePreview(a: AudioRow) {
    if (!a.url) return;
    if (playingId === a.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const el = new Audio(a.url);
    el.onended = () => {
      setPlayingId(null);
      setAudioEl(null);
    };
    void el.play().catch(() => {
      toast.error("No se pudo reproducir el audio.");
      setPlayingId(null);
    });
    setAudioEl(el);
    setPlayingId(a.id);
  }

  async function handleSend(a: AudioRow) {
    setSendingId(a.id);
    stopPreview();
    try {
      const res = await sendToChat({
        conversationId,
        audioId: a.id,
        includeTexto: true,
      });
      const bits = [
        res.audioSent ? "nota de voz" : null,
        res.textoSent ? "texto" : null,
      ].filter(Boolean);
      toast.success(`Enviado: ${bits.join(" + ") || a.titulo}`);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo enviar el audio.",
      );
    } finally {
      setSendingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="mb-2 flex max-h-[min(52vh,420px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2">
        <Headphones className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight">Audios del bot</p>
          <p className="truncate text-[10px] text-muted-foreground">
            Filtra por situación y envía al chat
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            stopPreview();
            onClose();
          }}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar: confianza, precios, mascotas…"
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[12px] outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {audios === undefined ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando audios…
          </div>
        ) : enabled.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            {filter.trim()
              ? "Ningún audio coincide con el filtro."
              : "No hay audios habilitados. Cárgalos en Admin → Audios del bot."}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {enabled.map((a) => {
              const busy = sendingId === a.id;
              const playing = playingId === a.id;
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-2 px-3 py-2.5 hover:bg-muted/40"
                >
                  <button
                    type="button"
                    disabled={!a.url || busy}
                    onClick={() => togglePreview(a)}
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground disabled:opacity-40",
                      playing && "border-primary text-primary",
                    )}
                    title={a.url ? "Escuchar" : "Sin archivo de audio"}
                  >
                    {playing ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-tight">
                      {a.titulo}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {a.situacion}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.url ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Audio
                        </span>
                      ) : null}
                      {a.texto?.trim() ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          + Texto
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !!sendingId}
                    onClick={() => void handleSend(a)}
                    className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Enviar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
