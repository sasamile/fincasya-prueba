/**
 * Barra de grabación de audio (réplica visual de WhatsApp): papelera para
 * cancelar, punto rojo parpadeante, temporizador en vivo, onda animada,
 * pausa y enviar.
 *
 * NOTA: es una animación de UI. El envío real de notas de voz requiere
 * captura de micrófono + subida de media, aún no implementado; "enviar"
 * cierra la barra.
 */
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Send, Trash2 } from 'lucide-react';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const BARS = Array.from({ length: 34 });

export function AudioRecorder({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (seconds: number) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused]);

  return (
    <div className="flex flex-1 items-center gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="text-muted-foreground transition-colors hover:text-destructive"
        title="Cancelar"
        aria-label="Cancelar grabación"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      <span
        className={cnDot(paused)}
        aria-hidden
      />
      <span className="w-10 shrink-0 text-[14px] tabular-nums text-muted-foreground">{fmt(seconds)}</span>

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
        onClick={() => setPaused((p) => !p)}
        className="text-primary transition-colors hover:brightness-110"
        title={paused ? 'Reanudar' : 'Pausar'}
        aria-label={paused ? 'Reanudar' : 'Pausar'}
      >
        {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={() => onSend(seconds)}
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
