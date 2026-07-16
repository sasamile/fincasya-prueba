/** Fila de conversación en el sidebar (estilo WhatsApp). */
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { Bot, Check, Image, Mic, Paperclip, Pin, Store, User, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatListTime } from '@/lib/format';
import { Avatar, DeliveryTick } from '@/features/inbox/components/primitives';
import type { ConversationRow } from '@/features/inbox/types';

const LONG_PRESS_MS = 480;

export function ConversationItem({
  conv,
  active,
  onClick,
  onContextMenu,
  selectMode = false,
  selected = false,
}: {
  conv: ConversationRow;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: ReactMouseEvent | { clientX: number; clientY: number; preventDefault: () => void }) => void;
  /** Modo selección múltiple (menú ⋮ → asignar / marcar leídos). */
  selectMode?: boolean;
  selected?: boolean;
}) {
  const p = conv.preview;
  const isProduct = p?.type === 'product';
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current != null) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // Ícono + etiqueta corta para media (estilo WhatsApp), en vez del placeholder.
  const PreviewIcon =
    p?.type === 'audio'
      ? Mic
      : p?.type === 'image'
        ? Image
        : p?.type === 'video'
          ? Video
          : p?.type === 'document'
            ? Paperclip
            : isProduct
              ? Store
              : null;
  const previewText = p
    ? p.type === 'audio'
      ? 'Nota de voz'
      : p.type === 'image'
        ? 'Foto'
        : p.type === 'video'
          ? 'Video'
          : p.type === 'document'
            ? 'Documento'
            : isProduct
              ? p.content.replace(/^🏡\s*Ficha de catálogo:\s*/i, '')
              : p.content
    : 'Sin mensajes';

  // Mismo criterio que el filtro "Escalados": humano + prioridad urgente.
  const isEscalated = conv.status === 'human' && conv.priority === 'urgent';

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onClick();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onTouchStart={(e) => {
        if (selectMode || !onContextMenu) return;
        const t = e.touches[0];
        if (!t) return;
        longPressFired.current = false;
        touchStart.current = { x: t.clientX, y: t.clientY };
        clearLongPress();
        longPressTimer.current = window.setTimeout(() => {
          longPressFired.current = true;
          onContextMenu({
            clientX: t.clientX,
            clientY: t.clientY,
            preventDefault: () => {},
          });
          // Vibración suave si el dispositivo lo soporta.
          try {
            navigator.vibrate?.(12);
          } catch {
            /* ignore */
          }
        }, LONG_PRESS_MS);
      }}
      onTouchMove={(e) => {
        const start = touchStart.current;
        const t = e.touches[0];
        if (!start || !t) return;
        if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) {
          clearLongPress();
        }
      }}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      className={cn(
        'flex w-full select-none items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors',
        '[-webkit-touch-callout:none] [-webkit-user-select:none]',
        isEscalated
          ? 'bg-[#504437] hover:bg-[#5c4e40]'
          : 'hover:bg-muted',
        !isEscalated && conv.pinned && 'bg-muted/30',
        active && (isEscalated ? 'bg-[#5c4e40]' : 'bg-accent'),
        selectMode && selected && 'bg-primary/10',
      )}
    >
      {selectMode && (
        <span
          className={cn(
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
            selected
              ? 'border-primary bg-primary text-white'
              : 'border-muted-foreground/40',
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      )}
      <Avatar name={conv.name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span
            className={cn('truncate text-[14px]', conv.unread > 0 ? 'font-semibold' : 'font-medium')}
          >
            {conv.name}
          </span>
          {conv.labels.length > 0 ? (
            <span className="flex shrink-0 -space-x-1">
              {conv.labels.slice(0, 3).map((l) => (
                <span
                  key={l.id}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full ring-2',
                    active ? 'ring-accent' : 'ring-card',
                  )}
                  style={{ backgroundColor: l.color }}
                  title={(l.emoji ? `${l.emoji} ` : '') + l.name}
                />
              ))}
            </span>
          ) : null}
          {conv.assignedUserName && (
            <span
              className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title={`Asignado a ${conv.assignedUserName}`}
            >
              <User className="h-2.5 w-2.5" />
              {conv.assignedUserName.split(' ')[0]}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted-foreground">
          {p?.outbound && <DeliveryTick status={p.whatsappStatus} />}
          {PreviewIcon && <PreviewIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{previewText}</span>
        </div>
      </div>

      {/* Columna derecha: hora arriba, badges (bot / no leídos) abajo. */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5">
        <span
          className={cn(
            'text-[11px]',
            conv.unread > 0 ? 'font-medium text-primary' : 'text-muted-foreground',
          )}
        >
          {formatListTime(conv.lastMessageAt)}
        </span>
        <div className="flex items-center gap-1.5">
          {conv.pinned && (
            <span title="Fijado" className="flex">
              <Pin className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          {conv.status === 'ai' && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0a040] text-white"
              title="Bot activo en este chat"
            >
              <Bot className="h-3 w-3" />
            </span>
          )}
          {conv.unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
              {conv.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
