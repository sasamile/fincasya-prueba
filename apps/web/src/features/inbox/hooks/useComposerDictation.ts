'use client';

/**
 * Dictado al borrador: habla → texto en el input (sin IA).
 * Web Speech API (Chrome / Edge).
 */
import { useEffect, useRef, useState } from 'react';

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onerror: (() => void) | null;
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

export function useComposerDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }

  useEffect(() => () => stop(), []);

  function start(currentDraft: string) {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError('Dictado no disponible. Usa Chrome o Edge.');
      return;
    }
    setError(null);
    stop();
    baseRef.current = currentDraft.trim();

    const rec = new Ctor();
    rec.lang = 'es-CO';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let spoken = '';
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row?.[0]?.transcript) spoken += row[0].transcript;
      }
      const clean = spoken.trim();
      const next = baseRef.current
        ? clean
          ? `${baseRef.current} ${clean}`
          : baseRef.current
        : clean;
      onTranscriptRef.current(next);
    };
    rec.onerror = () => {
      setListening(false);
      setError('No se pudo escuchar. Revisa el micrófono.');
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('No se pudo iniciar el dictado.');
      setListening(false);
    }
  }

  function toggle(currentDraft: string) {
    if (listening) stop();
    else start(currentDraft);
  }

  return { listening, error, clearError: () => setError(null), toggle, stop };
}
