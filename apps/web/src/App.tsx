/**
 * FincasYa · Chats — inbox operadores (referencia CRM WhatsApp).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import {
  Bot,
  Check,
  CheckCheck,
  CircleAlert,
  CircleDashed,
  FileText,
  Image,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Pin,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Smile,
  Store,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingArea, Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { avatarColorFor } from '@/lib/avatarColor';
import { messagesCache, withCache } from '@/lib/queryCache';
import { AttachMenu } from '@/components/chat/AttachMenu';
import { AudioRecorder } from '@/components/chat/AudioRecorder';
import { CatalogModal } from '@/components/chat/CatalogModal';
import { ChatHomeScreen } from '@/components/chat/ChatHomeScreen';
import { ContactInfo } from '@/components/chat/ContactInfo';
import { ConversationContextMenu } from '@/components/chat/ConversationContextMenu';
import type { CtxTarget } from '@/components/chat/ConversationContextMenu';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { MessageMenu } from '@/components/chat/MessageMenu';
import { LabelPicker } from '@/components/chat/LabelPicker';
import { QuickReplyManager } from '@/components/chat/QuickReplyManager';
import { SharedMedia } from '@/components/chat/SharedMedia';
import { SidebarFilters } from '@/components/chat/SidebarFilters';
import profileAvatar from '@/assets/image.png';

type ConversationRow = FunctionReturnType<typeof api.inbox.listConversations>[number];
type Filter = 'todas' | 'human' | 'ai' | 'unread' | 'whatsapp' | 'web' | 'nuevas';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatListTime(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(ms);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function formatDay(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatCop(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-CO')}`;
}

function BotToggle({
  enabled,
  disabled,
  onChange,
  title,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        'toggle-track relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
      data-on={enabled}
      title={title ?? (enabled ? 'Bot activo' : 'Bot apagado')}
    >
      <span className="toggle-thumb absolute left-0.5 h-3.5 w-3.5 rounded-full transition-transform" />
    </button>
  );
}

/**
 * Avatar por defecto de WhatsApp (default-contact-refreshed de Meta):
 * círculo gris con la silueta oficial. SVG exacto del cliente de WhatsApp.
 */
export function DefaultContactSvg({ fill = '#8a9399', className }: { fill?: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <path
        fill={fill}
        d="M24 23q-1.86 0-3.18-1.32T19.5 18.5t1.32-3.18T24 14t3.18 1.32q1.32 1.32 1.32 3.18t-1.32 3.18T24 23m-6.75 10q-.93 0-1.59-.66T15 30.75v-.9q0-.96.5-1.76a3.3 3.3 0 0 1 1.3-1.22 16.7 16.7 0 0 1 3.54-1.3q1.8-.44 3.66-.44t3.66.43 3.54 1.31q.82.42 1.3 1.22t.5 1.76v.9q0 .93-.66 1.59t-1.59.66z"
      />
    </svg>
  );
}

function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const dim = size === 'xs' ? 'h-7 w-7' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const { bg, fg } = avatarColorFor(name);
  return (
    <div
      title={name}
      className={cn('shrink-0 overflow-hidden rounded-full', dim, className)}
      style={{ backgroundColor: bg }}
    >
      <DefaultContactSvg fill={fg} className="h-full w-full" />
    </div>
  );
}

function DeliveryTick({ status }: { status: string | null }) {
  if (!status) return null;
  const cls = 'h-3.5 w-3.5 shrink-0';
  const stroke = 2.25;
  if (status === 'failed') {
    return <CircleAlert className={cn(cls, 'text-destructive')} strokeWidth={stroke} />;
  }
  if (status === 'read') {
    return <CheckCheck className={cn(cls, 'text-[#53bdeb]')} strokeWidth={stroke} />;
  }
  if (status === 'delivered') {
    return <CheckCheck className={cn(cls, 'text-[#8696a0]')} strokeWidth={stroke} />;
  }
  return <Check className={cn(cls, 'text-[#8696a0]')} strokeWidth={stroke} />;
}

function ConversationItem({
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

type Message = NonNullable<FunctionReturnType<typeof api.inbox.getMessages>>[number];

/** Tarjeta de ficha de catálogo (imagen + precio + Ver), réplica de WhatsApp. */
function ProductCard({
  product,
  timeLabel,
  status,
}: {
  product: NonNullable<Message['product']>;
  timeLabel: string;
  status: string | null;
}) {
  return (
    <div className="w-[18rem] max-w-full">
      {/* Panel de producto: imagen + título + precio */}
      <div className="overflow-hidden rounded-md bg-black/20">
        {product.image ? (
          <img src={product.image} alt="" className="h-44 w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-black/30 text-muted-foreground">
            <Image className="h-8 w-8" />
          </div>
        )}
        <div className="px-2.5 pb-2.5 pt-2">
          <p className="text-[15px] font-semibold leading-snug">{product.title}</p>
          <p className="mt-1 text-[14px]">{formatCop(product.priceOriginal ?? product.priceFrom)}</p>
        </div>
      </div>

      {/* Cuerpo (descripción de la ficha) */}
      <p className="mt-1.5 px-1 text-[14px] leading-snug">
        💰 Desde <span className="font-medium">{formatCop(product.priceFrom)}</span> por noche · 👥
        Hasta {product.capacity} personas
      </p>

      {/* Footer: negocio + hora + ticks */}
      <div className="mt-0.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-muted-foreground">FincasYa</span>
        <span className="bubble-meta flex items-center gap-1 text-[11px]">
          {timeLabel}
          <DeliveryTick status={status} />
        </span>
      </div>

      {/* Botón Ver */}
      {product.url ? (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block border-t border-white/10 py-2 text-center text-[14px] font-medium text-[#53bdeb] transition-colors hover:bg-white/5"
        >
          Ver
        </a>
      ) : null}
    </div>
  );
}

/** Resalta las coincidencias de `term` dentro de `text`. */
function Highlighted({ text, term }: { text: string; term?: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = term.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(q);
  let key = 0;
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded bg-primary/40 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
    idx = lower.indexOf(q, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}

function formatDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Reproductor de nota de voz estilo WhatsApp: botón play/pausa, waveform con
 * progreso (clic para buscar), duración y avatar del emisor con micrófono.
 */
function WaAudioPlayer({ src, contactName }: { src: string; contactName: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Barras del waveform: pseudo-aleatorias pero estables para la misma nota.
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    return Array.from({ length: 38 }, () => 0.28 + rand() * 0.72);
  }, [src]);

  const pct = duration > 0 ? Math.min(current / duration, 1) : 0;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  function seek(e: ReactMouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  }

  return (
    <div className="flex items-center gap-3 py-0.5 pr-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
      </button>

      <div className="min-w-0 flex-1">
        <div onClick={seek} className="flex h-6 cursor-pointer items-center gap-[2px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-[2.5px] shrink-0 rounded-full"
              style={{
                height: `${Math.round(h * 100)}%`,
                backgroundColor: i / bars.length <= pct ? 'var(--primary)' : 'rgba(255,255,255,0.28)',
              }}
            />
          ))}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatDur(playing || current > 0 ? current : duration)}
        </div>
      </div>

      <div className="relative shrink-0 self-start">
        <Avatar name={contactName} size="sm" />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary text-white">
          <Mic className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  );
}

/**
 * Nota de voz con opción "Transcribir" (estilo WhatsApp): reproduce el audio y,
 * bajo demanda, llama a Whisper y muestra el texto para leerlo en vez de oírlo.
 */
function AudioMessage({ message, contactName }: { message: Message; contactName: string }) {
  const transcribe = useAction(api.media.transcribeMessageAudio);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Transcripción ya disponible: campo `transcription` o el contenido "🎙️ …"
  // que deja el procesamiento automático de media (sin el emoji).
  const initialText =
    message.transcription ??
    (message.content.startsWith('🎙️') ? message.content.replace(/^🎙️\s*/, '') : null);
  const [text, setText] = useState<string | null>(initialText);

  async function onTranscribe() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await transcribe({ messageId: message.id as Id<'messages'> });
      if (res.ok && res.text) setText(res.text);
      else setError(res.motivo ?? 'No se pudo transcribir');
    } catch {
      setError('No se pudo transcribir');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-1 w-64 max-w-full">
      <WaAudioPlayer src={message.mediaUrl!} contactName={contactName} />
      {text ? (
        <div className="mt-1 rounded-md bg-black/20 px-2 py-1.5 text-[12.5px] leading-[16px] text-foreground/85">
          {text}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void onTranscribe()}
          disabled={loading}
          className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#53bdeb] hover:underline disabled:opacity-60"
        >
          {loading ? (
            <>
              <Spinner className="h-3 w-3" /> Transcribiendo…
            </>
          ) : (
            <>
              <FileText className="h-3 w-3" /> Transcribir
            </>
          )}
        </button>
      )}
      {error && <div className="mt-0.5 text-[11px] text-destructive">{error}</div>}
    </div>
  );
}

function MessageBubble({
  message,
  highlight,
  contactName,
  conversationId,
  onReply,
}: {
  message: Message;
  highlight?: string;
  contactName: string;
  conversationId: Id<'conversations'>;
  onReply?: (m: Message) => void;
}) {
  const isUser = message.sender === 'user';
  const isBot = !isUser && !message.byAdvisor;

  if (message.sender === 'system') {
    return (
      <div className="my-3 flex justify-center">
        <span className="max-w-[90%] rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-center text-[11px] text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  const hasProduct = message.type === 'product' && message.product;
  const isMedia =
    !!message.mediaUrl && (message.type === 'image' || message.type === 'video');

  return (
    <div className={cn('flex flex-col', message.reaction ? 'mb-5' : 'mb-1', isUser ? 'items-start' : 'items-end')}>
      <div
        className={cn(
          'group relative max-w-[min(75%,26rem)]',
          hasProduct || isMedia ? 'p-1.5' : 'px-2 py-1.5',
          isUser ? 'bubble-in' : 'bubble-out',
        )}
      >
        {onReply && (
          <MessageMenu
            conversationId={conversationId}
            message={{ id: message.id, wamid: message.wamid, content: message.content, sender: message.sender }}
            align={isUser ? 'left' : 'right'}
            onReply={() => onReply(message)}
          />
        )}
        {!isUser && (
          <div
            className={cn(
              'mb-0.5 flex items-center gap-1 px-1 text-[10px] font-medium',
              isBot ? 'text-[#7fe0c4]' : 'text-[#ffd7a0]',
            )}
          >
            {isBot ? (
              <>
                <Bot className="h-3 w-3" /> Bot
              </>
            ) : (
              <>
                <UserRound className="h-3 w-3" /> Experto
              </>
            )}
          </div>
        )}

        {/* Respuesta citada */}
        {message.replyTo && (
          <div className="mb-1 overflow-hidden rounded border-l-[3px] border-primary/70 bg-black/25 px-2 py-1">
            <div className="text-[12px] font-medium text-primary">
              {message.replyTo.sender === 'user'
                ? 'Cliente'
                : message.replyTo.fromAdvisor
                  ? 'Experto'
                  : 'Bot'}
            </div>
            <div className="truncate text-[12px] text-muted-foreground">{message.replyTo.content}</div>
          </div>
        )}

        {/* Contenido */}
        {hasProduct ? (
          <ProductCard
            product={message.product!}
            timeLabel={formatTime(message.createdAt)}
            status={message.whatsappStatus}
          />
        ) : isMedia ? (
          <div>
            {message.type === 'image' ? (
              <img src={message.mediaUrl!} alt="" className="max-h-72 w-full rounded-md object-cover" loading="lazy" />
            ) : (
              <video src={message.mediaUrl!} controls className="max-h-72 w-full rounded-md" />
            )}
            {message.content && !message.content.startsWith('[') && (
              <div className="whitespace-pre-wrap wrap-break-word px-1 pt-1 text-[14.2px] leading-[19px]">
                {message.content}
              </div>
            )}
          </div>
        ) : (
          <>
            {message.type === 'audio' && message.mediaUrl && (
              <AudioMessage message={message} contactName={contactName} />
            )}
            {message.type === 'document' && message.mediaUrl && (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-1 flex items-center gap-1 text-[12px] text-[#53bdeb] underline"
              >
                <Paperclip className="h-3 w-3" /> documento
              </a>
            )}
            {/* El audio muestra su propia transcripción; el placeholder
                "[nota de voz]"/"[documento]" no se muestra como texto. */}
            {message.type !== 'audio' && !(message.mediaUrl && message.content.startsWith('[')) && (
              <div className="whitespace-pre-wrap wrap-break-word px-1 text-[14.2px] leading-[19px]">
                <Highlighted text={message.content} term={highlight} />
              </div>
            )}
          </>
        )}

        {!hasProduct && (
          <div className="bubble-meta -mt-0.5 flex items-center justify-end gap-1 px-1 text-[11px]">
            {formatTime(message.createdAt)}
            {!isUser && <DeliveryTick status={message.whatsappStatus} />}
          </div>
        )}

        {/* Reacción (emoji) sobre la burbuja */}
        {message.reaction && (
          <span
            className={cn(
              'absolute -bottom-4 flex items-center rounded-full border border-border bg-card px-1.5 py-0.5 text-[13px] leading-none shadow-md',
              isUser ? 'left-2' : 'right-2',
            )}
          >
            {message.reaction}
          </span>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ conv }: { conv: ConversationRow }) {
  const liveMessages = useQuery(api.inbox.getMessages, {
    conversationId: conv.conversationId,
  });
  // Muestra al instante lo último cacheado mientras llega la versión en vivo.
  const messages = withCache(liveMessages, messagesCache, conv.conversationId);
  const eligibility = useQuery(api.inbox.getConversationAiEligibility, {
    conversationId: conv.conversationId,
  });
  const sendMessage = useMutation(api.inbox.sendAdvisorMessage);
  const setStatus = useMutation(api.inbox.setConversationStatus);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showShared, setShowShared] = useState(false);
  const [showQuickReplyMgr, setShowQuickReplyMgr] = useState(false);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const quickReplies = useQuery(api.quickReplies.listQuickReplies);
  // Sugerencias de respuesta rápida cuando el borrador empieza con "/".
  const quickMatches = useMemo(() => {
    if (!draft.startsWith('/')) return [];
    const q = draft.slice(1).toLowerCase();
    return (quickReplies ?? []).filter((r) => r.shortcut.startsWith(q)).slice(0, 6);
  }, [draft, quickReplies]);

  const botEnabled = conv.status === 'ai';
  const canEnableBot = eligibility?.manualAllowed ?? conv.status !== 'resolved';
  const autoOnly = eligibility?.autoEligible === false && !conv.aiManualOverride;

  const searchTerm = searchQuery.trim().toLowerCase();
  const searchMatches = useMemo(() => {
    if (!searchTerm) return 0;
    return (messages ?? []).filter((m) => m.content.toLowerCase().includes(searchTerm)).length;
  }, [messages, searchTerm]);

  function handleAttachSelect(id: string) {
    setShowAttach(false);
    if (id === 'catalogo') {
      setShowCatalog(true);
      return;
    }
    if (id === 'respuestas') {
      setShowQuickReplyMgr(true);
      return;
    }
    const labels: Record<string, string> = {
      documento: 'Documento',
      fotos: 'Fotos y videos',
      camara: 'Cámara',
      audio: 'Audio',
      contacto: 'Contacto',
      encuesta: 'Encuesta',
      evento: 'Evento',
      sticker: 'Nuevo sticker',
    };
    setAttachNotice(`"${labels[id] ?? id}" aún no está disponible`);
    setTimeout(() => setAttachNotice(null), 2200);
  }

  function insertEmoji(emoji: string) {
    setDraft((d) => d + emoji);
    draftRef.current?.focus();
  }

  function applyQuickReply(message: string) {
    setDraft(message);
    draftRef.current?.focus();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
  }, [messages?.length, conv.conversationId]);

  // El compositor crece con el contenido (como WhatsApp), hasta ~45% del alto.
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.45))}px`;
  }, [draft]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage({
        conversationId: conv.conversationId,
        content: text,
        replyToWamid: replyingTo?.wamid ?? undefined,
      });
      setDraft('');
      setReplyingTo(null);
    } finally {
      setSending(false);
    }
  }

  function startReply(m: Message) {
    setReplyingTo(m);
    draftRef.current?.focus();
  }

  async function handleBotToggle(on: boolean) {
    setBotError(null);
    if (on && !canEnableBot) {
      setBotError('Conversación cerrada — no se puede activar el bot');
      return;
    }
    try {
      await setStatus({
        conversationId: conv.conversationId,
        status: on ? 'ai' : 'human',
      });
    } catch (err) {
      setBotError(err instanceof Error ? err.message : 'No se pudo activar el bot');
    }
  }

  const grouped = useMemo(() => {
    const groups: Array<{ day: string; items: Message[] }> = [];
    for (const m of messages ?? []) {
      const day = formatDay(m.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="relative flex h-full min-w-0 flex-1 flex-col bg-background">
        {/* Header */}
        <header className="wa-panel flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="flex min-w-0 items-center gap-3 text-left"
            title="Ver info del contacto"
          >
            <Avatar name={conv.name} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-medium">{conv.name}</h2>
              <p className="text-[12px] text-muted-foreground">+{conv.phone}</p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <BotToggle
                  enabled={botEnabled}
                  disabled={conv.status === 'resolved'}
                  onChange={(on) => void handleBotToggle(on)}
                  title={
                    conv.status === 'resolved'
                      ? 'Conversación cerrada'
                      : botEnabled
                        ? 'Bot activo en este chat'
                        : 'Activar bot manualmente'
                  }
                />
              </div>
              {botError && (
                <span className="max-w-[200px] text-right text-[10px] text-destructive">{botError}</span>
              )}
            
            </div>

            <LabelPicker conversationId={conv.conversationId} assigned={conv.labels} />

            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-9 w-9 rounded-full', showSearch && 'text-primary')}
                onClick={() => {
                  setShowSearch((v) => !v);
                  if (showSearch) setSearchQuery('');
                }}
                title="Buscar en el chat"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setShowInfo(true)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Barra de búsqueda en el chat */}
        {showSearch && (
          <div className="wa-panel flex items-center gap-2 border-b border-border px-4 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en esta conversación…"
                className="h-9 rounded-full border-transparent bg-input pl-10 text-[13px]"
              />
            </div>
            <span className="shrink-0 text-[12px] text-muted-foreground">
              {searchTerm ? `${searchMatches} resultado(s)` : ''}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Área de chat: doodle de fondo hasta abajo (mensajes + compositor) */}
        <div className="chat-bg flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {messages === undefined ? (
            <LoadingArea />
          ) : (
            grouped
              .map((group) => ({
                day: group.day,
                items: searchTerm
                  ? group.items.filter((m) => m.content.toLowerCase().includes(searchTerm))
                  : group.items,
              }))
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.day}>
                  <div className="my-4 flex justify-center">
                    <span className="rounded-md bg-muted/60 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                      {group.day}
                    </span>
                  </div>
                  {group.items.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      highlight={searchTerm}
                      contactName={conv.name}
                      conversationId={conv.conversationId}
                      onReply={startReply}
                    />
                  ))}
                </div>
              ))
          )}
          {searchTerm && searchMatches === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin resultados para “{searchQuery}”
            </div>
          )}
          <div ref={bottomRef} />
          </div>

        {/* Composer — píldora unificada estilo WhatsApp */}
        <footer className="wa-composer-footer relative">
          {attachNotice && (
            <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-muted px-3 py-1.5 text-[12px] text-foreground shadow-lg">
              {attachNotice}
            </div>
          )}
          {/* Barra de "Responder" (cita) sobre el compositor. */}
          {replyingTo && (
            <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-[3px] border-primary bg-muted/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-primary">
                  {replyingTo.sender === 'user' ? conv.name : replyingTo.byAdvisor ? 'Experto' : 'Bot'}
                </div>
                <div className="truncate text-[12.5px] text-muted-foreground">
                  {replyingTo.type === 'audio'
                    ? '🎙️ Nota de voz'
                    : replyingTo.type === 'image'
                      ? '📷 Foto'
                      : replyingTo.content}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Cancelar respuesta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {recording ? (
            <AudioRecorder
              onCancel={() => setRecording(false)}
              onSend={() => setRecording(false)}
            />
          ) : (
            <div className="wa-composer-pill">
              <div className="relative">
                <button
                  type="button"
                  className="wa-composer-icon"
                  title="Adjuntar"
                  aria-label="Adjuntar"
                  onClick={() => {
                    setShowAttach((v) => !v);
                    setShowEmoji(false);
                  }}
                >
                  <Plus className="h-6 w-6" strokeWidth={1.5} />
                </button>
                {showAttach && (
                  <AttachMenu onSelect={handleAttachSelect} onClose={() => setShowAttach(false)} />
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className="wa-composer-icon"
                  title="Emoji"
                  aria-label="Emoji"
                  onClick={() => {
                    setShowEmoji((v) => !v);
                    setShowAttach(false);
                  }}
                >
                  <Smile className="h-6 w-6" strokeWidth={1.5} />
                </button>
                {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
              </div>
              <div className="relative min-w-0 flex-1">
                {quickMatches.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl">
                    <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Respuestas rápidas
                    </p>
                    {quickMatches.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => applyQuickReply(r.message)}
                        className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <span className="text-[14px] font-medium">/{r.shortcut}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">{r.message}</span>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (quickMatches.length > 0) applyQuickReply(quickMatches[0]!.message);
                      else void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe un mensaje"
                  className="wa-composer-field"
                />
              </div>
              {draft.trim() ? (
                <button
                  type="button"
                  className="wa-composer-send"
                  title="Enviar"
                  aria-label="Enviar"
                  onClick={() => void handleSend()}
                  disabled={sending}
                >
                  <Send className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <button
                  type="button"
                  className="wa-composer-icon"
                  title="Grabar audio"
                  aria-label="Grabar audio"
                  onClick={() => setRecording(true)}
                >
                  <Mic className="h-6 w-6" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </footer>
        </div>

        {/* Modal de catálogo (overlay sobre el chat) */}
        {showCatalog && (
          <CatalogModal conversationId={conv.conversationId} onClose={() => setShowCatalog(false)} />
        )}

        {/* Administrador de respuestas rápidas */}
        {showQuickReplyMgr && <QuickReplyManager onClose={() => setShowQuickReplyMgr(false)} />}
      </div>

      {/* Drawer derecho: archivos compartidos o info del contacto */}
      {showShared ? (
        <SharedMedia
          conversationId={conv.conversationId}
          onClose={() => setShowShared(false)}
        />
      ) : showInfo ? (
        <ContactInfo
          conversationId={conv.conversationId}
          onClose={() => {
            setShowInfo(false);
            setShowShared(false);
          }}
          onOpenShared={() => setShowShared(true)}
          onOpenSearch={() => {
            setShowInfo(false);
            setShowShared(false);
            setShowSearch(true);
          }}
        />
      ) : null}
    </div>
  );
}

/** Icono del rail de navegación (columna extrema izquierda de WhatsApp). */
function RailIcon({
  icon: Icon,
  label,
  active,
  dot,
}: {
  icon: typeof MessageCircle;
  label: string;
  active?: boolean;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
      {dot && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </button>
  );
}

/** Rail de navegación vertical estilo WhatsApp Web. */
function IconRail() {
  return (
    <nav className="flex w-[68px] shrink-0 flex-col items-center justify-between border-r border-border bg-background py-4">
      <div className="flex flex-col items-center gap-2">
        <RailIcon icon={MessageCircle} label="Chats" active />
        <RailIcon icon={CircleDashed} label="Estados" dot />
        <RailIcon icon={Radio} label="Canales" />
        <RailIcon icon={Users} label="Comunidades" />
        <RailIcon icon={Store} label="Catálogo" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <RailIcon icon={Settings} label="Ajustes" />
        <img
          src={profileAvatar}
          alt="FincasYa"
          title="FincasYa"
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/40"
          draggable={false}
        />
      </div>
    </nav>
  );
}

export default function App() {
  const conversations = useQuery(api.inbox.listConversations);
  const agentSettings = useQuery(api.agentSettings.getAgentSettings);
  const setGlobalAi = useMutation(api.agentSettings.setGlobalAiEnabled);
  const markRead = useMutation(api.inbox.markConversationRead);
  const [selectedId, setSelectedId] = useState<ConversationRow['conversationId'] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxTarget | null>(null);
  const labels = useQuery(api.labels.listLabels);

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      // Las archivadas no aparecen en el listado principal.
      if (c.archived) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      if (labelFilter && !c.labels.some((l) => String(l.id) === labelFilter)) return false;
      if (filter === 'ai') return c.status === 'ai';
      if (filter === 'human') return c.status === 'human';
      if (filter === 'unread') return c.unread > 0;
      if (filter === 'nuevas') return c.aiEligible;
      if (filter === 'whatsapp') return c.channel === 'whatsapp';
      if (filter === 'web') return c.channel === 'web';
      return true;
    });
  }, [conversations, search, filter, labelFilter]);

  const selected = conversations?.find((c) => c.conversationId === selectedId) ?? null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setSelectedId(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function openConversation(conv: ConversationRow) {
    setSelectedId(conv.conversationId);
    if (conv.unread > 0) void markRead({ conversationId: conv.conversationId });
  }

  const globalBotHint = agentSettings?.globalAiEnabled
    ? 'Chats nuevos con bot. No se activa en chats con catálogo o proceso.'
    : 'Chats nuevos en humano. Actívalos desde cada conversación.';

  return (
    <div className="flex h-full bg-background">
      {/* Rail de navegación (columna extrema izquierda) */}
      <IconRail />

      {/* Lista de chats */}
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-border bg-card">
        {/* Cabecera con título y acciones */}
        <header className="flex items-center justify-between px-4 py-3">
          <h1 className="text-[22px] font-semibold tracking-tight">Chats</h1>
          <div className="flex items-center gap-1">
            <div
              title={globalBotHint}
              className="mr-1 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"
            >
              <Bot
                className={cn(
                  'h-3.5 w-3.5',
                  agentSettings?.globalAiEnabled ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <BotToggle
                enabled={agentSettings?.globalAiEnabled ?? false}
                onChange={(on) => void setGlobalAi({ enabled: on })}
                title={globalBotHint}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground">
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Buscador */}
        <div className="px-3 pb-1.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar un chat o iniciar uno nuevo"
              className="h-9 rounded-full border-transparent bg-input pl-11 text-[13px]"
            />
          </div>
        </div>

        {/* Filtros: chips principales + dropdown de listas (sin scroll en x) */}
        <SidebarFilters
          filter={filter}
          setFilter={setFilter}
          labelFilter={labelFilter}
          setLabelFilter={setLabelFilter}
          labels={labels}
        />

        <div className="flex-1 overflow-y-auto border-t border-border">
          {conversations === undefined ? (
            <LoadingArea className="py-16" />
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Sin chats</p>
          ) : (
            filtered.map((c) => (
              <ConversationItem
                key={c.conversationId}
                conv={c}
                active={c.conversationId === selectedId}
                onClick={() => openConversation(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({
                    conversationId: c.conversationId,
                    pinned: c.pinned,
                    archived: c.archived,
                    labelIds: c.labels.map((l) => String(l.id)),
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
              />
            ))
          )}
        </div>
      </aside>

      {/* Panel principal */}
      {selected ? (
        <ChatPanel key={selected.conversationId} conv={selected} />
      ) : (
        <ChatHomeScreen />
      )}

      {/* Menú de clic derecho sobre una conversación */}
      {ctxMenu && (
        <ConversationContextMenu target={ctxMenu} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}
