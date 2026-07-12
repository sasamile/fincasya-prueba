/**
 * Menú contextual por burbuja (estilo WhatsApp): chevron que abre Responder,
 * Copiar y — solo en mensajes del cliente — Reaccionar (fila de emojis).
 * Únicamente expone acciones que YCloud soporta de verdad.
 */
import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { ChevronDown, Copy, CornerUpLeft, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageMenu({
  conversationId,
  message,
  align,
  onReply,
}: {
  conversationId: Id<'conversations'>;
  message: { id: Id<'messages'>; wamid: string | null; content: string; sender: string };
  align: 'left' | 'right';
  onReply: () => void;
}) {
  const react = useAction(api.inbox.reactToClientMessage);
  const [open, setOpen] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    // Si la burbuja está cerca del fondo, el menú se abre hacia arriba.
    const rect = ref.current?.getBoundingClientRect();
    setDropUp(!!rect && rect.bottom > window.innerHeight - 200);
    setOpen((o) => !o);
    setShowEmojis(false);
  }

  // Solo se puede reaccionar a mensajes del cliente (recibidos) con wamid.
  const canReact = message.sender === 'user' && !!message.wamid;
  const canReply = !!message.wamid;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function copy() {
    void navigator.clipboard?.writeText(message.content);
    setOpen(false);
  }

  function reply() {
    onReply();
    setOpen(false);
  }

  function doReact(emoji: string) {
    void react({ conversationId, messageId: message.id, emoji });
    setOpen(false);
    setShowEmojis(false);
  }

  return (
    <div ref={ref} className="absolute right-1 top-1 z-10">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-foreground/80 opacity-0 shadow transition-opacity hover:bg-black/40 group-hover:opacity-100',
          open && 'opacity-100',
        )}
        aria-label="Opciones del mensaje"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-2xl',
            dropUp ? 'bottom-7' : 'top-7',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {showEmojis ? (
            <div className="flex items-center justify-between px-2 py-1.5">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => doReact(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[20px] transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <>
              {canReply && (
                <button
                  type="button"
                  onClick={reply}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] transition-colors hover:bg-muted"
                >
                  <CornerUpLeft className="h-4 w-4 shrink-0" /> Responder
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] transition-colors hover:bg-muted"
              >
                <Copy className="h-4 w-4 shrink-0" /> Copiar
              </button>
              {canReact && (
                <button
                  type="button"
                  onClick={() => setShowEmojis(true)}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] transition-colors hover:bg-muted"
                >
                  <Smile className="h-4 w-4 shrink-0" /> Reaccionar
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
