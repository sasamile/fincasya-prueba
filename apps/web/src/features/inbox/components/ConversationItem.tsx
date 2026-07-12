/** Fila de conversación en el sidebar (estilo WhatsApp). */
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Bot, Image, Mic, Paperclip, Pin, Store, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatListTime } from '@/lib/format';
import { Avatar, DeliveryTick } from '@/features/inbox/components/primitives';
import type { ConversationRow } from '@/features/inbox/types';

export function ConversationItem({
  conv,
  active,
  onClick,
  onContextMenu,
}: {
  conv: ConversationRow;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
}) {
  const p = conv.preview;
  const isProduct = p?.type === 'product';
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

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        'flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted',
        active && 'bg-accent',
        conv.pinned && 'bg-muted/30',
      )}
    >
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
