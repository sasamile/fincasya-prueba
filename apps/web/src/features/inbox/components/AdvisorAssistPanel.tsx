'use client';

/**
 * Asistente del Experto — texto por defecto + voz opcional.
 * Puede redactar un mensaje O interpretar una orden (p. ej. abrir catálogo).
 */
import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import {
  Loader2,
  Mic,
  RefreshCw,
  Sparkles,
  Square,
  Store,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssistCatalogAction = {
  type: 'open_catalog';
  label: string;
  fechaEntrada?: string;
  fechaSalida?: string;
  personas?: number;
  zona?: string;
};

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((ev: {
        results: ArrayLike<
          { isFinal?: boolean } & ArrayLike<{ transcript: string }>
        >;
      }) => void)
    | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AdvisorAssistPanel({
  conversationId,
  open,
  onClose,
  onUseSuggestion,
  onOpenCatalog,
}: {
  conversationId: Id<'conversations'>;
  open: boolean;
  onClose: () => void;
  onUseSuggestion: (text: string) => void;
  /** Cuando la IA detecta una orden de catálogo. */
  onOpenCatalog?: (action: AssistCatalogAction) => void;
}) {
  const suggest = useAction(api.inbox.suggestAdvisorReply);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [action, setAction] = useState<AssistCatalogAction | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);
  const noteRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSuggestRef = useRef(false);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    setNote('');
    noteRef.current = '';
    setSuggestion(null);
    setAction(null);
    setError(null);
    setLoading(false);
    pendingSuggestRef.current = false;
    stopListening(false);
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, open]);

  useEffect(() => {
    return () => stopListening(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopListening(shouldSuggest: boolean) {
    pendingSuggestRef.current = shouldSuggest;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }

  async function runSuggest(instruction: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setAction(null);
    try {
      const res = await suggest({
        conversationId,
        note: instruction.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? 'No se pudo sugerir');
        return;
      }
      if (res.suggestion) setSuggestion(res.suggestion);
      if (res.action?.type === 'open_catalog') {
        setAction(res.action);
      }
      if (!res.suggestion && !res.action) {
        setError(res.error ?? 'No se pudo sugerir');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sugerir');
    } finally {
      setLoading(false);
    }
  }

  function startListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      setError('Tu navegador no soporta voz. Escribe la instrucción abajo.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setSuggestion(null);
    setAction(null);
    stopListening(false);

    const rec = new Ctor();
    rec.lang = 'es-CO';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let text = '';
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row?.[0]?.transcript) text += row[0].transcript;
      }
      const clean = text.trim();
      noteRef.current = clean;
      setNote(clean);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === 'not-allowed') {
        setError('Permite el micrófono o escribe la instrucción.');
      } else if (ev.error !== 'aborted') {
        setError('No se pudo escuchar. Puedes escribir la instrucción.');
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (pendingSuggestRef.current) {
        pendingSuggestRef.current = false;
        void runSuggest(noteRef.current);
      } else {
        inputRef.current?.focus();
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('No se pudo iniciar el micrófono. Escribe la instrucción.');
      setListening(false);
      inputRef.current?.focus();
    }
  }

  function toggleMic() {
    if (listening) {
      stopListening(true);
      return;
    }
    startListening();
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (listening) {
      stopListening(true);
      return;
    }
    void runSuggest(note);
  }

  if (!open) return null;

  const hasResult = Boolean(suggestion || action);

  return (
    <div className="mb-2 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <header className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-[12px] font-medium text-foreground">
          {listening
            ? 'Escuchando… toca el mic de nuevo'
            : loading
              ? action || note.match(/ficha|cat[aá]logo/i)
                ? 'Interpretando tu orden…'
                : 'Redactando…'
              : '¿Qué quieres hacer o responder?'}
        </p>
        <button
          type="button"
          onClick={() => {
            stopListening(false);
            onClose();
          }}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-2.5 p-3">
        <textarea
          ref={inputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading || listening}
          rows={2}
          placeholder='Ej: envíale fichas del 16 al 19 de agosto para 13…'
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] leading-snug placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={loading}
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
              listening
                ? 'bg-primary text-primary-foreground ring-2 ring-primary/25'
                : 'border border-border bg-background text-foreground hover:bg-muted',
              loading && 'opacity-50',
            )}
            aria-label={listening ? 'Dejar de escuchar' : 'Dictar instrucción'}
            title={listening ? 'Dejar de escuchar' : 'Dictar'}
          >
            {listening ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          <button
            type="submit"
            disabled={loading || listening}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {note.trim() ? 'Interpretar' : 'Sugerir respuesta'}
          </button>
        </div>

        {!listening && !loading && !hasResult ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Órdenes (“envíale fichas…”) abren el catálogo. Pedidos de texto
            (“pídele cédula…”) redactan el mensaje.
          </p>
        ) : null}

        {!supported ? (
          <p className="text-[11px] text-muted-foreground">
            Voz no disponible aquí — escribe la instrucción.
          </p>
        ) : null}
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

        {hasResult ? (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            {action ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Orden detectada
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (suggestion) onUseSuggestion(suggestion);
                    onOpenCatalog?.(action);
                    onClose();
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <Store className="h-4 w-4" />
                  {action.label}
                </button>
              </div>
            ) : null}

            {suggestion ? (
              <div className={cn(action && 'border-t border-border/60 pt-2')}>
                {action ? (
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Mensaje de acompañamiento
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
                  {suggestion}
                </p>
              </div>
            ) : null}

            <div className="flex gap-2 pt-0.5">
              {suggestion ? (
                <button
                  type="button"
                  onClick={() => {
                    onUseSuggestion(suggestion);
                    onClose();
                  }}
                  className="flex h-9 flex-1 items-center justify-center rounded-xl border border-border bg-background px-3 text-[12px] font-semibold transition hover:bg-muted"
                >
                  {action ? 'Solo el texto' : 'Usar en el input'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSuggestion(null);
                  setAction(null);
                  inputRef.current?.focus();
                }}
                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-[12px] font-medium transition hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Otra vez
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
