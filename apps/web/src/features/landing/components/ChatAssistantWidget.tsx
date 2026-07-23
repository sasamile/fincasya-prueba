'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { cn } from '@/lib/utils';

import { FINCASYA_WHATSAPP_URL } from './WhatsappFab';

/** sessionId estable por navegador (persistente en localStorage). */
function useSessionId(): string {
  const [sid] = useState(() => {
    if (typeof window === 'undefined') return '';
    const KEY = 'fincasya_web_chat_session';
    let v = window.localStorage.getItem(KEY);
    if (!v || v.length < 8) {
      v = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(KEY, v);
    }
    return v;
  });
  return sid;
}

type WidgetMessage = {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  type: string;
  ficha: {
    title: string;
    image: string | null;
    bodyText: string;
    retailerId: string;
  } | null;
  createdAt: number;
};

/** Ficha web (equivalente a la tarjeta de catálogo de WhatsApp). */
function FichaCard({ ficha }: { ficha: NonNullable<WidgetMessage['ficha']> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {ficha.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ficha.image}
          alt={ficha.title}
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="p-3">
        <p className="text-sm font-bold leading-snug text-foreground">{ficha.title}</p>
        {ficha.bodyText ? (
          <p className="mt-1 text-xs text-muted-foreground">{ficha.bodyText}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Chat real (solo se monta cuando el admin habilitó el widget). */
function LiveChat() {
  const sessionId = useSessionId();
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const data = useQuery(
    api.webChat.listMessages,
    started && sessionId ? { sessionId } : 'skip',
  );
  const sendMessage = useMutation(api.webChat.sendMessage);

  const messages = useMemo<WidgetMessage[]>(
    () => (data?.messages ?? []) as WidgetMessage[],
    [data],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await sendMessage({ sessionId, text, name: name.trim() || undefined });
    } catch {
      setDraft(text); // devuelve el texto si falló
    } finally {
      setSending(false);
    }
  }, [draft, sending, sendMessage, sessionId, name]);

  if (!started) {
    return (
      <div className="space-y-3 px-5 py-5">
        <div>
          <h2 className="text-lg font-bold leading-snug text-foreground">
            ¡Hola! Qué gusto tenerte en FincasYa
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cuéntanos tu nombre y con gusto te ayudamos a encontrar tu finca
            ideal: disponibilidad, opciones y todo lo que necesites.
          </p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim().length >= 2) setStarted(true);
          }}
        />
        <button
          type="button"
          disabled={name.trim().length < 2}
          onClick={() => setStarted(true)}
          className="h-11 w-full rounded-xl bg-[#1a5c2e] text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Iniciar conversación
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[26rem] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Escríbenos qué plan tienes en mente 🌿
          </p>
        ) : (
          messages.map((m) =>
            m.type === 'product' && m.ficha ? (
              <div key={m.id} className="max-w-[85%]">
                <FichaCard ficha={m.ficha} />
              </div>
            ) : (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  m.sender === 'user'
                    ? 'ml-auto bg-[#1a5c2e] text-white'
                    : 'bg-muted text-foreground',
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ),
          )
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border/50 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Escribe un mensaje…"
          className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1a5c2e] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** Placeholder público (mientras el chat no esté habilitado). */
function ComingSoon() {
  return (
    <div className="space-y-4 px-5 py-5">
      <div>
        <h2 className="text-lg font-bold leading-snug text-foreground">
          ¡Hola! Qué gusto tenerte en FincasYa
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Gracias por visitarnos. Cuéntanos qué plan tienes en mente y con mucho
          gusto te acompañamos: disponibilidad, opciones a tu medida y todo lo
          que necesites para encontrar tu finca ideal.
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
  );
}

export function ChatAssistantWidget() {
  const [open, setOpen] = useState(false);
  const status = useQuery(api.webChat.getStatus, {});
  const enabled = status?.enabled ?? false;

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
    <div className="relative">
      {open ? (
        <div
          className="fixed inset-0 z-55 bg-black/25 backdrop-blur-[2px]"
          aria-hidden
          onClick={close}
        />
      ) : null}

      <div
        className={cn(
          'absolute right-0 bottom-[calc(100%+0.75rem)] z-56 w-[min(100vw-2.5rem,380px)] origin-bottom-right transition-all duration-300',
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0',
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

          {enabled ? <LiveChat /> : <ComingSoon />}

          <div className="border-t border-border/40 bg-muted/30 px-5 py-3 text-center text-[10px] text-muted-foreground">
            FincasYa.com® · 12 años siendo los expertos en alquiler
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar asistente' : 'Soy Naya, asistente IA de FincasYa'}
        aria-expanded={open}
        className="group relative flex h-11 w-11 items-center justify-center rounded-full bg-[#1a5c2e] shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {!open ? (
          <span
            className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#1a5c2e] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-all duration-200 group-hover:opacity-100 group-hover:-translate-x-0.5 group-focus-visible:opacity-100"
            aria-hidden
          >
            Soy Naya · IA
            <span className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#1a5c2e]" />
          </span>
        ) : null}
        {open ? (
          <X className="h-5 w-5 text-white transition-transform duration-300 group-hover:rotate-90" />
        ) : (
          <img
            src="/favicon2.png"
            alt=""
            className="h-6 w-6 object-contain transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-[-8deg]"
          />
        )}
      </button>
    </div>
  );
}

/** Dispara el modal del asistente (CTAs en la página). */
export function openChatAssistant() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fincasya:open-chat-assistant'));
  }
}
