'use client';

/**
 * Asistente del Experto — voz primero.
 * Hablas lo que quieres (ej. "pídele la cédula"), la IA sugiere el mensaje
 * y lo dejas en el borrador. No envía por WhatsApp.
 */
import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Loader2, Mic, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: {
    results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>>;
  }) => void) | null;
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
}: {
  conversationId: Id<'conversations'>;
  open: boolean;
  onClose: () => void;
  onUseSuggestion: (text: string) => void;
}) {
  const suggest = useAction(api.inbox.suggestAdvisorReply);
  const [heard, setHeard] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);
  const heardRef = useRef('');
  const pendingSuggestRef = useRef(false);

  useEffect(() => {
    setHeard('');
    heardRef.current = '';
    setSuggestion(null);
    setError(null);
    setLoading(false);
    pendingSuggestRef.current = false;
    stopListening(false);
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

  async function runSuggest(note: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await suggest({
        conversationId,
        note: note.trim() || undefined,
      });
      if (!res.ok || !res.suggestion) {
        setError(res.error ?? 'No se pudo sugerir');
        return;
      }
      setSuggestion(res.suggestion);
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
      setError('Tu navegador no soporta voz. Prueba Chrome o Edge.');
      return;
    }
    setError(null);
    setSuggestion(null);
    stopListening(false);
    heardRef.current = '';
    setHeard('');

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
      heardRef.current = clean;
      setHeard(clean);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === 'not-allowed') {
        setError('Permite el micrófono para hablarle al asistente.');
      } else if (ev.error !== 'aborted') {
        setError('No se pudo escuchar. Revisa el micrófono.');
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (pendingSuggestRef.current) {
        pendingSuggestRef.current = false;
        const note = heardRef.current.trim();
        void runSuggest(note);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('No se pudo iniciar el micrófono.');
      setListening(false);
    }
  }

  function toggleMic() {
    if (listening) {
      stopListening(true);
      return;
    }
    startListening();
  }

  if (!open) return null;

  return (
    <div className="mb-2 overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-lg backdrop-blur-sm">
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <p className="min-w-0 flex-1 text-[12px] font-medium text-muted-foreground">
          {listening
            ? 'Escuchando… habla y toca de nuevo para sugerir'
            : loading
              ? 'Redactando sugerencia…'
              : 'Háblale: dile qué quieres responder'}
        </p>
        <button
          type="button"
          onClick={() => {
            stopListening(false);
            onClose();
          }}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex flex-col items-center gap-2 px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={toggleMic}
          disabled={loading}
          className={cn(
            'grid h-14 w-14 place-items-center rounded-full transition',
            listening
              ? 'bg-primary text-primary-foreground shadow-[0_0_0_6px_hsl(var(--primary)/0.25)]'
              : 'bg-primary text-primary-foreground hover:opacity-90',
            loading && 'opacity-50',
          )}
          aria-label={listening ? 'Dejar de escuchar' : 'Hablar al asistente'}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : listening ? (
            <Square className="h-5 w-5 fill-current" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>

        {heard ? (
          <p className="max-w-full text-center text-[13px] text-foreground/90">
            “{heard}”
          </p>
        ) : !listening && !loading && !suggestion ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Ej: “pídele cédula y correo” · o toca sin hablar para sugerir solo
          </p>
        ) : null}

        {!listening && !loading && (
          <button
            type="button"
            onClick={() => void runSuggest(heard)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {heard ? 'Sugerir con lo que dije' : 'Sugerir sin instrucción'}
          </button>
        )}

        {!supported ? (
          <p className="text-[11px] text-amber-600">
            Voz no disponible aquí — usa Chrome o Edge.
          </p>
        ) : null}
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

        {suggestion ? (
          <div className="w-full rounded-xl border border-border bg-muted/40 p-2.5">
            <p className="whitespace-pre-wrap text-[13px] leading-snug">
              {suggestion}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onUseSuggestion(suggestion);
                  onClose();
                }}
                className="flex-1 rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background"
              >
                Usar en el input
              </button>
              <button
                type="button"
                onClick={startListening}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted"
              >
                Otra vez
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
