'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

import { FINCASYA_WHATSAPP_URL } from './WhatsappFab';

export function ChatAssistantWidget() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('fincasya:open-chat-assistant', handler);
    return () => window.removeEventListener('fincasya:open-chat-assistant', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[55] bg-black/25 backdrop-blur-[2px]"
          aria-hidden
          onClick={close}
        />
      ) : null}

      <div
        className={cn(
          'fixed bottom-24 left-5 z-[56] w-[min(100vw-2.5rem,380px)] transition-all duration-300 origin-bottom-left',
          open
            ? 'scale-100 opacity-100 pointer-events-auto'
            : 'scale-95 opacity-0 pointer-events-none',
        )}
        role="dialog"
        aria-label="Asistente FincasYa"
        aria-hidden={!open}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3 bg-[#1a5c2e] px-4 py-3.5 text-white">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/20">
              <img
                src="/favicon2.png"
                alt=""
                className="h-8 w-8 object-contain"
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">Asistente FincasYa</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/85">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Reservas y consultas · en línea
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div>
              <h2 className="text-lg font-bold text-foreground leading-snug">
                ¡Hola! Qué gusto tenerte en FincasYa
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Gracias por visitarnos. Cuéntanos qué plan tienes en mente y con
                mucho gusto te acompañamos: disponibilidad, opciones a tu medida y
                todo lo que necesites para encontrar tu finca ideal.
              </p>
            </div>
            <a
              href={FINCASYA_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white shadow-md transition-transform hover:bg-[#20bd5a] active:scale-[0.98]"
            >
              <MessageCircle className="h-5 w-5" />
              Hablar con un experto por WhatsApp
            </a>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Quedamos atentos para ayudarte a reservar tu finca perfecta. Pronto
              estará disponible este agente IA.
            </p>
          </div>

          <div className="border-t border-border/40 bg-muted/30 px-5 py-3 text-center text-[10px] text-muted-foreground">
            FincasYa.com® · 12 años siendo los expertos en alquiler
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente FincasYa'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-5 left-5 z-[56] flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105',
          open ? 'bg-[#1a5c2e]' : 'bg-[#1a5c2e]',
        )}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <img src="/favicon2.png" alt="" className="h-8 w-8 object-contain" />
        )}
      </button>
    </>
  );
}

/** Dispara el modal del asistente (CTAs en la página). */
export function openChatAssistant() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fincasya:open-chat-assistant'));
  }
}
