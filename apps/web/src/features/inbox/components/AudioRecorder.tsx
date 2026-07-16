/**
 * Barra de grabación de nota de voz (réplica de WhatsApp): papelera para
 * cancelar, punto rojo parpadeante, temporizador en vivo, onda animada, pausa
 * y enviar.
 *
 * Graba directamente en **ogg/opus** con `opus-recorder`, el único formato que
 * WhatsApp acepta como nota de voz (PTT). El `MediaRecorder` nativo produce
 * mp4/webm que WhatsApp rechaza (error 131053 "procesado como octet-stream"),
 * por eso NO se usa aquí. Al enviar, entrega el `Blob` ogg al padre.
 */
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Send, Trash2 } from 'lucide-react';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const BARS = Array.from({ length: 34 });

// Tipado mínimo de opus-recorder (no trae tipos propios).
interface OpusRecorder {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  ondataavailable: (data: Uint8Array) => void;
}

export function AudioRecorder({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (blob: Blob, mimeType: string, seconds: number) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<OpusRecorder | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const actionRef = useRef<'send' | 'cancel'>('cancel');
  const secondsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('opus-recorder');
        const Recorder = mod.default as unknown as new (opts: Record<string, unknown>) => OpusRecorder;
        const rec = new Recorder({
          encoderPath: '/opus/encoderWorker.min.js',
          encoderApplication: 2048, // VOIP (voz)
          encoderSampleRate: 48000,
          numberOfChannels: 1,
          streamPages: false, // entrega el ogg completo al parar
        });
        rec.ondataavailable = (data: Uint8Array) => {
          dataRef.current = data;
        };
        recorderRef.current = rec;
        await rec.start();
        if (cancelled) {
          void rec.stop();
          return;
        }
        setReady(true);
      } catch {
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
      const rec = recorderRef.current;
      if (rec) {
        actionRef.current = 'cancel';
        void rec.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused || !ready) return;
    timer.current = setInterval(() => {
      setSeconds((s) => {
        secondsRef.current = s + 1;
        return s + 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, ready]);

  function handleCancel() {
    actionRef.current = 'cancel';
    onCancel();
  }

  async function handleSend() {
    const rec = recorderRef.current;
    if (!rec) {
      onCancel();
      return;
    }
    actionRef.current = 'send';
    try {
      await rec.stop(); // fuerza el último ondataavailable con el ogg completo
    } catch {
      /* noop */
    }
    const data = dataRef.current;
    if (data && data.byteLength > 0) {
      const blob = new Blob([data as unknown as BlobPart], { type: 'audio/ogg' });
      onSend(blob, 'audio/ogg', secondsRef.current);
    } else {
      onCancel();
    }
  }

  function togglePause() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (paused) {
      rec.resume();
      setPaused(false);
    } else {
      rec.pause();
      setPaused(true);
    }
  }

  return (
    <div className="flex flex-1 select-none items-center gap-3 [-webkit-touch-callout:none]">
      <button
        type="button"
        onClick={handleCancel}
        className="text-muted-foreground transition-colors hover:text-destructive"
        title="Cancelar"
        aria-label="Cancelar grabación"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      <span className={cnDot(paused)} aria-hidden />
      <span className="w-10 shrink-0 text-[14px] tabular-nums text-muted-foreground">
        {fmt(seconds)}
      </span>

      {/* Onda animada */}
      <div className="flex h-8 flex-1 items-center gap-[3px] overflow-hidden">
        {BARS.map((_, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full bg-muted-foreground/70"
            style={{
              height: `${20 + Math.abs(Math.sin(i * 1.3)) * 60}%`,
              animation: paused ? 'none' : `waWave 1s ease-in-out ${i * 40}ms infinite alternate`,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={togglePause}
        className="text-primary transition-colors hover:brightness-110"
        title={paused ? 'Reanudar' : 'Pausar'}
        aria-label={paused ? 'Reanudar' : 'Pausar'}
      >
        {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={() => void handleSend()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
        title="Enviar"
        aria-label="Enviar nota de voz"
      >
        <Send className="h-5 w-5" />
      </button>

      <style>{`@keyframes waWave { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}

function cnDot(paused: boolean): string {
  return [
    'h-2.5 w-2.5 shrink-0 rounded-full bg-destructive',
    paused ? '' : 'animate-pulse',
  ].join(' ');
}
