/** Panel de conversación: burbujas, reproductor de audio, compositor. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import {
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  Download,
  FileText,
  Image,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Smile,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingArea, Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';
import { messagesCache, withCache } from '@/lib/queryCache';
import { formatCop, formatDay, formatTime } from '@/lib/format';
import { Avatar, BotToggle, DeliveryTick } from '@/features/inbox/components/primitives';
import { AttachMenu } from '@/features/inbox/components/AttachMenu';
import { PdfThumbnail } from '@/features/inbox/components/PdfThumbnail';
import { AudioRecorder } from '@/features/inbox/components/AudioRecorder';
import { CatalogModal } from '@/features/inbox/components/CatalogModal';
import { ContactInfo } from '@/features/inbox/components/ContactInfo';
import { EmojiPicker } from '@/features/inbox/components/EmojiPicker';
import { MessageMenu } from '@/features/inbox/components/MessageMenu';
import { SwipeToReply } from '@/features/inbox/components/SwipeToReply';
import { LabelPicker } from '@/features/inbox/components/LabelPicker';
import { QuickReplyManager } from '@/features/inbox/components/QuickReplyManager';
import { ASESOR_TOOLS, type AsesorTool } from '@/features/inbox/components/IconRail';
import { SharedMedia } from '@/features/inbox/components/SharedMedia';
import {
  extractFirstHttpUrl,
  LinkPreviewCard,
  type LinkPreviewData,
} from '@/features/inbox/components/LinkPreviewCard';
import type { ConversationRow, Message } from '@/features/inbox/types';

/** Formatea bytes a "240 KB" / "1.4 MB" para la tarjeta de documento. */
function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extensión del archivo en minúscula (pdf, docx, xlsx…) para la tarjeta. */
function docExt(filename?: string | null, mime?: string | null): string {
  const fromName =
    filename && filename.includes('.') ? filename.split('.').pop() : undefined;
  return (fromName ?? mime?.split('/')[1] ?? 'archivo').toLowerCase();
}

/** Línea "354 KB • pdf" (tamaño + extensión) para la tarjeta de documento. */
function formatDocMeta(
  filename?: string | null,
  mime?: string | null,
  size?: number | null,
): string {
  const ext = docExt(filename, mime);
  const sz = formatBytes(size);
  return sz ? `${sz} • ${ext}` : ext;
}

/** Ícono de documento coloreado por tipo con esquina doblada, réplica de WhatsApp. */
function DocThumbIcon({
  filename,
  mime,
}: {
  filename?: string | null;
  mime?: string | null;
}) {
  const ext = docExt(filename, mime);
  const color =
    ext === 'pdf'
      ? '#f0392b'
      : /^docx?$|rtf/.test(ext)
        ? '#2b7fff'
        : /^xlsx?$|csv/.test(ext)
          ? '#12a150'
          : /^pptx?$/.test(ext)
            ? '#f79009'
            : '#667085';
  const label = ext.slice(0, 4).toUpperCase();
  return (
    <svg width="34" height="40" viewBox="0 0 34 40" className="shrink-0" aria-hidden>
      <path
        d="M4 1h18l11 11v25a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z"
        fill={color}
      />
      <path d="M22 1l11 11h-9a2 2 0 0 1-2-2z" fill="rgba(0,0,0,0.18)" />
      <text
        x="17.5"
        y="31"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fill="#fff"
      >
        {label}
      </text>
    </svg>
  );
}

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
    <div
      className={cn(
        'flex w-full',
        message.reaction ? 'mb-5' : 'mb-1',
        isUser ? 'justify-start' : 'justify-end',
      )}
    >
      <SwipeToReply
        direction={isUser ? 'right' : 'left'}
        disabled={!onReply || !message.wamid}
        onReply={() => onReply?.(message)}
      >
        <div
          className={cn(
            'group relative w-fit max-w-[min(80%,26rem)]',
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
              <div className="mb-1 overflow-hidden rounded-lg bg-black/6 dark:bg-white/6">
                {(message.mediaMime?.includes('pdf') ||
                  /\.pdf$/i.test(message.mediaFilename ?? '')) && (
                  <PdfThumbnail url={message.mediaUrl} />
                )}
                <a
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={message.mediaFilename ?? undefined}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/6"
                >
                  <DocThumbIcon
                    filename={message.mediaFilename}
                    mime={message.mediaMime}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {message.mediaFilename ?? 'Documento'}
                    </span>
                    <span className="mt-0.5 block text-[11px] opacity-60">
                      {formatDocMeta(
                        message.mediaFilename,
                        message.mediaMime,
                        message.mediaSize,
                      )}
                    </span>
                  </span>
                  <Download className="h-4 w-4 shrink-0 opacity-60" />
                </a>
              </div>
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
      </SwipeToReply>
    </div>
  );
}

export function ChatPanel({
  conv,
  onBack,
  onOpenTool,
  className,
}: {
  conv: ConversationRow;
  /** Vuelve a la lista de chats (solo visible en móvil). */
  onBack?: () => void;
  /** Abre una herramienta del asesor (menú visible solo en móvil). */
  onOpenTool?: (tool: AsesorTool) => void;
  className?: string;
}) {
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
  const generateUploadUrl = useMutation(api.inbox.generateUploadUrl);
  const sendMedia = useMutation(api.inbox.sendAdvisorMedia);
  const improveText = useAction(api.inbox.improveMessageText);
  // Actor logueado — viaja en las mutaciones para el historial de atención.
  const { data: session } = authClient.useSession();
  const actorId = session?.user?.id ? String(session.user.id) : undefined;
  const actorName = session?.user?.name ?? undefined;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [improving, setImproving] = useState(false);

  async function handleImprove() {
    const text = draft.trim();
    if (!text || improving) return;
    setImproving(true);
    try {
      const res = await improveText({ text });
      if (res?.improved) setDraft(res.improved);
    } catch {
      // Silencioso: si la IA falla, el operador conserva su texto.
    } finally {
      setImproving(false);
      draftRef.current?.focus();
    }
  }
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
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewDismissed, setLinkPreviewDismissed] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileDocRef = useRef<HTMLInputElement>(null);
  const filePhotoRef = useRef<HTMLInputElement>(null);
  const fileCameraRef = useRef<HTMLInputElement>(null);
  const fileAudioRef = useRef<HTMLInputElement>(null);

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

  /** Sube el archivo a Convex storage y lo envía por WhatsApp (YCloud). */
  async function uploadAndSend(
    file: File,
    kind: 'image' | 'video' | 'audio' | 'document',
  ) {
    if (uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error('upload falló');
      const { storageId } = (await res.json()) as { storageId: string };
      await sendMedia({
        conversationId: conv.conversationId,
        storageId: storageId as Id<'_storage'>,
        kind,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        actorId,
        actorName,
      });
    } catch {
      setAttachNotice('No se pudo enviar el archivo');
      setTimeout(() => setAttachNotice(null), 2500);
    } finally {
      setUploadingMedia(false);
    }
  }

  /** Handler de <input type="file">: normaliza el tipo y dispara el envío. */
  function handleFilePicked(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'image' | 'audio' | 'document',
  ) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    // "Fotos y videos" acepta ambos: distingue por el MIME real.
    const realKind: 'image' | 'video' | 'audio' | 'document' =
      kind === 'image' && file.type.startsWith('video/') ? 'video' : kind;
    void uploadAndSend(file, realKind);
  }

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
    if (id === 'documento') {
      fileDocRef.current?.click();
      return;
    }
    if (id === 'fotos') {
      filePhotoRef.current?.click();
      return;
    }
    if (id === 'camara') {
      fileCameraRef.current?.click();
      return;
    }
    if (id === 'audio') {
      fileAudioRef.current?.click();
      return;
    }
    const labels: Record<string, string> = {
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

  // Preview de link (OG) al pegar/escribir una URL, como WhatsApp.
  useEffect(() => {
    const url = extractFirstHttpUrl(draft);
    if (!url) {
      setLinkPreview(null);
      setLinkPreviewLoading(false);
      setLinkPreviewDismissed(null);
      return;
    }
    if (linkPreviewDismissed === url) {
      setLinkPreview(null);
      setLinkPreviewLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLinkPreviewLoading(true);
      void fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('preview failed');
          return (await res.json()) as LinkPreviewData;
        })
        .then((data) => {
          if (cancelled) return;
          if (!data.title && !data.description && !data.image) {
            setLinkPreview(null);
            return;
          }
          setLinkPreview(data);
        })
        .catch(() => {
          if (!cancelled) setLinkPreview(null);
        })
        .finally(() => {
          if (!cancelled) setLinkPreviewLoading(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft, linkPreviewDismissed]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage({
        conversationId: conv.conversationId,
        content: text,
        replyToWamid: replyingTo?.wamid ?? undefined,
        actorId,
        actorName,
      });
      setDraft('');
      setReplyingTo(null);
      setLinkPreview(null);
      setLinkPreviewDismissed(null);
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
        actorId,
        actorName,
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
    <div className={cn('relative flex h-full min-w-0 flex-1', className)}>
      <div className="relative flex h-full min-w-0 flex-1 flex-col bg-background">
        {/* Header */}
        <header className="wa-panel flex items-center justify-between gap-2 border-b border-border px-2 py-2.5 md:gap-4 md:px-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Volver a la lista de chats"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
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

          <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
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

            {/* En móvil las etiquetas viven en la info del contacto; aquí no caben. */}
            <div className="hidden sm:block">
              <LabelPicker conversationId={conv.conversationId} assigned={conv.labels} />
            </div>

            <div className="flex items-center gap-0.5">
              {/* Herramientas del asesor — en móvil el rail está oculto con el
                  chat abierto, así que se accede desde este menú. */}
              {onOpenTool && (
                <div className="relative md:hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-9 w-9 rounded-full', showToolsMenu && 'text-primary')}
                    onClick={() => setShowToolsMenu((v) => !v)}
                    title="Herramientas del asesor"
                    aria-label="Herramientas del asesor"
                  >
                    <BriefcaseBusiness className="h-4 w-4" />
                  </Button>
                  {showToolsMenu && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-30 cursor-default"
                        aria-label="Cerrar menú de herramientas"
                        onClick={() => setShowToolsMenu(false)}
                      />
                      <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl">
                        {ASESOR_TOOLS.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => {
                              setShowToolsMenu(false);
                              onOpenTool(tool.id);
                            }}
                            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-muted"
                          >
                            <tool.icon className="h-4 w-4 text-muted-foreground" />
                            {tool.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
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
          {(linkPreviewLoading || linkPreview) && (
            <LinkPreviewCard
              preview={linkPreview}
              loading={linkPreviewLoading}
              onDismiss={() => {
                const url = extractFirstHttpUrl(draft);
                if (url) setLinkPreviewDismissed(url);
                setLinkPreview(null);
                setLinkPreviewLoading(false);
              }}
            />
          )}
          {recording ? (
            <AudioRecorder
              onCancel={() => setRecording(false)}
              onSend={(blob, mime) => {
                setRecording(false);
                const ext = mime.includes('mp4')
                  ? 'm4a'
                  : mime.includes('ogg')
                    ? 'ogg'
                    : 'webm';
                const file = new File([blob], `nota-de-voz.${ext}`, {
                  type: mime,
                });
                void uploadAndSend(file, 'audio');
              }}
            />
          ) : (
            <div
              className="wa-composer-pill"
              onClick={(e) => {
                // Clic en el vacío de la píldora (no en + / emoji / mic) → escribir.
                const t = e.target as HTMLElement;
                if (t.closest('button, a, input[type="file"]')) return;
                draftRef.current?.focus();
              }}
            >
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
                {/* Inputs ocultos para adjuntar archivos (documento/fotos/cámara/audio). */}
                <input
                  ref={fileDocRef}
                  type="file"
                  hidden
                  onChange={(e) => handleFilePicked(e, 'document')}
                />
                <input
                  ref={filePhotoRef}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => handleFilePicked(e, 'image')}
                />
                <input
                  ref={fileCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => handleFilePicked(e, 'image')}
                />
                <input
                  ref={fileAudioRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => handleFilePicked(e, 'audio')}
                />
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
              <div className="relative flex min-h-full min-w-0 flex-1 items-stretch">
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
                  spellCheck
                  lang="es"
                  autoCorrect="on"
                  className="wa-composer-field"
                />
              </div>
              {draft.trim() && (
                <button
                  type="button"
                  className="wa-composer-icon"
                  title="Mejorar redacción con IA (tono FincasYa)"
                  aria-label="Mejorar redacción con IA"
                  onClick={() => void handleImprove()}
                  disabled={improving}
                >
                  {improving ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-6 w-6" strokeWidth={1.5} />
                  )}
                </button>
              )}
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
