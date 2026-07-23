'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import {
  Facebook,
  ImageIcon,
  Instagram,
  Layers,
  Loader2,
  MessageSquare,
  MessageSquareText,
  Mic,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Smile,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { EmojiPicker } from '@/features/inbox/components/EmojiPicker';
import { AudioRecorder } from '@/features/inbox/components/AudioRecorder';
import { MetaSocialAvatar } from '@/features/admin/components/canales/meta-social-avatar';
import {
  syncDmInbox,
  sendDmMessage,
  markDmThreadRead,
  saveDmTemplates,
  type DmMessage,
  type DmPlatform,
  type DmSavedResponse,
  type DmThread,
  type MetaConnection,
} from '@/features/admin/api/meta-channels.api';

type FilterMode = 'all' | DmPlatform;
type ListFilter = 'all' | 'unread';
type TemplatesView = 'list' | 'create';
type DmAttachmentType = 'image' | 'audio' | 'video' | 'file';

const DM_MESSAGE_MAX = 1000;

function expandShortcutAtCursor(
  value: string,
  cursor: number,
  templates: DmSavedResponse[],
): { value: string; cursor: number } | null {
  const before = value.slice(0, cursor);
  const match = before.match(/(\S+)$/);
  if (!match) return null;
  const word = match[1];
  const tpl = templates.find((t) => t.shortcut === word.toLowerCase());
  if (!tpl) return null;
  const start = before.length - word.length;
  const newValue = value.slice(0, start) + tpl.text + value.slice(cursor);
  return { value: newValue, cursor: start + tpl.text.length };
}

async function uploadDmMedia(file: File, kind: DmAttachmentType): Promise<string> {
  const folder =
    kind === 'image'
      ? 'images'
      : kind === 'video'
        ? 'videos'
        : kind === 'audio'
          ? 'audios'
          : 'documents';
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'No se pudo subir el archivo');
  }
  return json.url;
}

function mediaKindFromFile(file: File): DmAttachmentType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatMessageTime(ts: number) {
  return format(new Date(ts), 'h:mm a', { locale: es }).toLowerCase();
}

function formatThreadTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return formatMessageTime(ts);
  }
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

function DmMessageBody({
  msg,
  outbound,
}: {
  msg: DmMessage;
  outbound: boolean;
}) {
  const linkClass = outbound
    ? 'text-white/90 underline'
    : 'text-primary underline';

  return (
    <>
      {msg.attachmentUrl && msg.attachmentType === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={msg.attachmentUrl}
          alt=""
          className="mb-1 max-h-48 max-w-full rounded-lg object-cover"
        />
      ) : null}
      {msg.attachmentUrl && msg.attachmentType === 'video' ? (
        <video
          src={msg.attachmentUrl}
          controls
          className="mb-1 max-h-48 max-w-full rounded-lg"
        />
      ) : null}
      {msg.attachmentUrl && msg.attachmentType === 'audio' ? (
        <audio src={msg.attachmentUrl} controls className="mb-1 max-w-full" />
      ) : null}
      {msg.attachmentUrl && msg.attachmentType === 'file' ? (
        <a
          href={msg.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('mb-1 block text-xs', linkClass)}
        >
          📎 Ver archivo
        </a>
      ) : null}
      {msg.text ? <span className="whitespace-pre-wrap">{msg.text}</span> : null}
      {!msg.text && !msg.attachmentUrl ? <span>—</span> : null}
    </>
  );
}

function platformLabel(p: DmPlatform) {
  return p === 'instagram' ? 'Instagram' : 'Messenger';
}

function composerPlaceholder(platform: DmPlatform) {
  return platform === 'instagram'
    ? 'Responde en Instagram…'
    : 'Responde en Messenger…';
}

function PlatformIcon({ platform, className }: { platform: DmPlatform; className?: string }) {
  if (platform === 'instagram') {
    return <Instagram className={cn('text-pink-500', className)} />;
  }
  return <Facebook className={cn('text-blue-600', className)} />;
}

function displayName(thread: DmThread) {
  if (thread.participantName?.trim()) return thread.participantName;
  if (thread.platform === 'instagram') return 'Usuario de Instagram';
  return 'Usuario de Messenger';
}

function isThreadUnread(thread: DmThread) {
  const readAt = thread.lastReadAt ?? 0;
  return thread.lastMessageAt > readAt;
}

export function DmInbox({
  connection,
  embedded = false,
}: {
  connection: MetaConnection;
  embedded?: boolean;
}) {
  const threads = useQuery(api.metaChannels.listDmThreads, {
    pageId: connection.pageId,
    limit: 80,
  }) as DmThread[] | undefined;

  const templates = useMemo(
    () => connection.dmTemplates ?? [],
    [connection.dmTemplates, connection.updatedAt],
  );

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [syncing, setSyncing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesView, setTemplatesView] = useState<TemplatesView>('list');
  const [newShortcut, setNewShortcut] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<DmMessage[]>([]);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    api.metaChannels.listDmMessages,
    activeThreadId
      ? { threadId: activeThreadId as Id<'metaDmThreads'>, limit: 200 }
      : 'skip',
  ) as DmMessage[] | undefined;

  const handleSync = useCallback(async (silent = false) => {
    setSyncing(true);
    if (!silent) setSyncError(null);
    try {
      const res = await syncDmInbox(connection.pageId);
      if (res.error && !silent) {
        setSyncError(res.error);
      }
    } catch (e) {
      if (!silent) {
        const msg = e instanceof Error ? e.message : 'Error al sincronizar';
        setSyncError(msg);
      }
    } finally {
      setSyncing(false);
    }
  }, [connection.pageId]);

  useEffect(() => {
    void handleSync(true);
  }, [connection.pageId, handleSync]);

  useEffect(() => {
    const pollMs = 20_000;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void handleSync(true);
      }
    };
    const intervalId = window.setInterval(tick, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void handleSync(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connection.pageId, handleSync]);

  const filtered = useMemo(() => {
    let list = threads ?? [];
    if (filter !== 'all') list = list.filter((t) => t.platform === filter);
    if (listFilter === 'unread') list = list.filter(isThreadUnread);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.participantName?.toLowerCase().includes(q) ||
        t.lastMessageText?.toLowerCase().includes(q) ||
        t.participantId.includes(q),
    );
  }, [threads, filter, listFilter, search]);

  const unreadCount = useMemo(
    () => (threads ?? []).filter(isThreadUnread).length,
    [threads],
  );

  /** No auto-abrir: el chat solo se abre al hacer clic (evita marcar todos leídos). */
  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return (threads ?? []).find((t) => t._id === activeThreadId) ?? null;
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    if (!(threads ?? []).some((t) => t._id === activeThreadId)) {
      setActiveThreadId(null);
    }
  }, [threads, activeThreadId]);

  function openThread(threadId: string) {
    setActiveThreadId(threadId);
    void markDmThreadRead(threadId);
  }

  useEffect(() => {
    setReplyText('');
    setShowEmoji(false);
    setRecording(false);
    setAttachOpen(false);
    setTemplatesOpen(false);
    setTemplatesView('list');
    setNewShortcut('');
    setNewMessage('');
    setOptimisticMessages([]);
  }, [activeThreadId]);

  const displayMessages = useMemo(() => {
    const base = messages ?? [];
    if (optimisticMessages.length === 0) return base;
    const pending = optimisticMessages.filter(
      (m) => !base.some(
        (real) =>
          real.direction === 'outbound' &&
          real.text === m.text &&
          Math.abs(real.createdAt - m.createdAt) < 60_000,
      ),
    );
    return [...base, ...pending];
  }, [messages, optimisticMessages]);

  useEffect(() => {
    if (!messages?.length || optimisticMessages.length === 0) return;
    setOptimisticMessages((prev) =>
      prev.filter(
        (opt) =>
          !messages.some(
            (real) =>
              real.direction === 'outbound' &&
              real.text === opt.text &&
              Math.abs(real.createdAt - opt.createdAt) < 60_000,
          ),
      ),
    );
  }, [messages, optimisticMessages.length]);

  function resetCreateForm() {
    setNewShortcut('');
    setNewMessage('');
    setTemplatesView('list');
  }

  async function persistTemplates(next: DmSavedResponse[]) {
    setSavingTemplates(true);
    try {
      await saveDmTemplates(connection.pageId, next);
      toast.success('Respuestas guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar');
      throw e;
    } finally {
      setSavingTemplates(false);
    }
  }

  async function handleCreateSavedResponse() {
    const shortcut = newShortcut.trim().toLowerCase();
    const text = newMessage.trim();
    if (shortcut.length < 3) {
      toast.error('El método abreviado debe tener al menos 3 caracteres');
      return;
    }
    if (!text) {
      toast.error('Escribe el mensaje de la respuesta');
      return;
    }
    if (text.length > DM_MESSAGE_MAX) {
      toast.error(`El mensaje no puede superar ${DM_MESSAGE_MAX} caracteres`);
      return;
    }
    if (templates.some((t) => t.shortcut === shortcut)) {
      toast.error('Ese método abreviado ya existe');
      return;
    }
    const next: DmSavedResponse[] = [
      ...templates,
      { id: crypto.randomUUID(), shortcut, text },
    ];
    try {
      await persistTemplates(next);
      resetCreateForm();
      setTemplatesOpen(false);
    } catch {
      // toast ya mostrado
    }
  }

  async function handleDeleteSavedResponse(id: string) {
    const next = templates.filter((t) => t.id !== id);
    try {
      await persistTemplates(next);
    } catch {
      // toast ya mostrado
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, activeThreadId]);

  function insertEmoji(emoji: string) {
    setReplyText((prev) => prev + emoji);
    replyRef.current?.focus();
  }

  function insertTemplate(text: string) {
    setReplyText(text);
    setTemplatesOpen(false);
    resetCreateForm();
    replyRef.current?.focus();
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === ' ' || e.key === 'Tab') {
      const el = replyRef.current;
      if (!el || templates.length === 0) return;
      const expanded = expandShortcutAtCursor(replyText, el.selectionStart, templates);
      if (expanded) {
        e.preventDefault();
        setReplyText(expanded.value);
        requestAnimationFrame(() => {
          el.selectionStart = expanded.cursor;
          el.selectionEnd = expanded.cursor;
        });
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const trimmed = replyText.trim().toLowerCase();
      const shortcutTpl = templates.find((t) => t.shortcut === trimmed);
      if (shortcutTpl) {
        e.preventDefault();
        setReplyText(shortcutTpl.text);
        return;
      }
      e.preventDefault();
      void handleSendText();
    }
  }

  async function handleSendText(text?: string) {
    const body = (text ?? replyText).trim();
    if (!activeThread || !body || sending) return;

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: DmMessage = {
      _id: optimisticId,
      threadId: activeThread._id,
      direction: 'outbound',
      text: body,
      createdAt: Date.now(),
    };

    if (!text) setReplyText('');
    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);

    try {
      const res = await sendDmMessage(connection.pageId, activeThread._id, {
        message: body,
      });
      if (res.ok) {
        toast.success('Mensaje enviado');
      } else {
        setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId));
        if (!text) setReplyText(body);
        const err = res.error ?? 'No se pudo enviar';
        if (err.includes('Instagram') || err.includes('usuario')) {
          toast.error(err, {
            description:
              'Prueba: Sincronizar → que el cliente escriba de nuevo → reconectar la página en Canales.',
            duration: 8000,
          });
        } else {
          toast.error(err);
        }
      }
    } catch (e) {
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      if (!text) setReplyText(body);
      toast.error(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  async function handleSendLike() {
    await handleSendText('👍');
  }

  async function handleSendAttachment(file: File, kind?: DmAttachmentType) {
    if (!activeThread) return;
    const attachmentType = kind ?? mediaKindFromFile(file);
    setUploading(true);
    setAttachOpen(false);
    try {
      const url = await uploadDmMedia(file, attachmentType);
      const res = await sendDmMessage(connection.pageId, activeThread._id, {
        attachmentType,
        attachmentUrl: url,
      });
      if (res.ok) {
        toast.success('Archivo enviado');
      } else {
        toast.error(res.error ?? 'No se pudo enviar');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar archivo');
    } finally {
      setUploading(false);
    }
  }

  async function handleFilePicked(
    e: React.ChangeEvent<HTMLInputElement>,
    fallbackKind: DmAttachmentType,
  ) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await handleSendAttachment(file, fallbackKind);
  }

  const isLoading = threads === undefined;

  const syncBanner = syncError ? (
    <div className="border-amber-500/30 bg-amber-500/10 shrink-0 border-b px-4 py-2.5 text-xs text-amber-800">
      {syncError.includes('permission') || syncError.includes('Permiso') ? (
        <>
          Meta aún no tiene aprobados los permisos de mensajería. Activa{' '}
          <code className="text-[10px]">META_ENABLE_MESSAGING=1</code> en Convex,
          reconecta la página y pide <strong>pages_messaging</strong> e{' '}
          <strong>instagram_manage_messages</strong>.
        </>
      ) : (
        syncError
      )}
    </div>
  ) : null;

  return (
    <div className={cn('flex flex-col', embedded ? 'h-full min-h-0' : 'space-y-3')}>
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-muted-foreground text-sm">
            Chats de Messenger e Instagram Direct.
          </p>
          <Button variant="outline" size="sm" onClick={() => void handleSync()} disabled={syncing}>
            <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
            Sincronizar
          </Button>
        </div>
      ) : null}

      {syncBanner}

      <div
        className={cn(
          'border-border bg-card flex min-h-0 overflow-hidden',
          embedded
            ? 'h-full flex-1 border-0'
            : 'h-[min(70vh,640px)] rounded-xl border',
        )}
      >
        {/* Lista de conversaciones */}
        <div className="border-border flex w-full max-w-[340px] shrink-0 flex-col border-r bg-card">
          <div className="border-border space-y-2 border-b p-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
                <Input
                  placeholder="Buscar"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 border-0 bg-muted pl-8 text-sm"
                />
              </div>
              {embedded ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  title="Sincronizar"
                >
                  <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(
                  [
                    ['all', 'Todos'],
                    ['unread', `No leídos${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setListFilter(mode)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      listFilter === mode
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="bg-muted/50 ml-auto flex items-center gap-0.5 rounded-full p-0.5">
                <button
                  type="button"
                  title="Todas las redes"
                  onClick={() => setFilter('all')}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                    filter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-background',
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Messenger"
                  onClick={() => setFilter('messenger')}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                    filter === 'messenger'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-background',
                  )}
                >
                  <Facebook className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Instagram"
                  onClick={() => setFilter('instagram')}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                    filter === 'instagram'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-background',
                  )}
                >
                  <Instagram className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground p-6 text-center text-sm">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
                {listFilter === 'unread'
                  ? 'No hay conversaciones sin leer.'
                  : 'Sin conversaciones aún.'}
              </div>
            ) : (
              filtered.map((thread) => {
                const active = thread._id === activeThread?._id;
                const unread = isThreadUnread(thread);
                return (
                  <button
                    key={thread._id}
                    type="button"
                    onClick={() => openThread(thread._id)}
                    className={cn(
                      'flex w-full gap-2 px-3 py-3 text-left transition-colors',
                      active ? 'bg-primary/15' : 'hover:bg-muted',
                    )}
                  >
                    <MetaSocialAvatar
                      pageId={connection.pageId}
                      participantId={thread.participantId}
                      platform={thread.platform}
                      name={displayName(thread)}
                      className="h-12 w-12"
                      badge={<PlatformIcon platform={thread.platform} className="h-3.5 w-3.5" />}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={cn(
                            'truncate text-[15px]',
                            unread ? 'font-bold text-foreground' : 'font-medium',
                          )}
                        >
                          {displayName(thread)}
                        </p>
                        <span className="text-muted-foreground shrink-0 text-[11px]">
                          {formatThreadTime(thread.lastMessageAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'truncate text-[13px]',
                          unread
                            ? 'font-semibold text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {thread.lastMessageText ?? '—'}
                      </p>
                    </div>
                    {unread ? (
                      <span className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat activo */}
        <div className="flex min-w-0 flex-1 flex-col bg-card">
          {!activeThread ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center px-6 text-center text-sm">
              <p>Selecciona un chat para abrirlo</p>
              <p className="mt-1 text-xs">
                Los chats no se abren solos (así no se marcan leídos al filtrar).
              </p>
            </div>
          ) : (
            <>
              <div className="border-border flex items-center gap-3 border-b px-4 py-3">
                <MetaSocialAvatar
                  pageId={connection.pageId}
                  participantId={activeThread.participantId}
                  platform={activeThread.platform}
                  name={displayName(activeThread)}
                  className="h-10 w-10"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {displayName(activeThread)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {platformLabel(activeThread.platform)}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {messages === undefined ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                  </div>
                ) : displayMessages.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">
                    Sin mensajes en este hilo.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {displayMessages.map((msg) => {
                      const outbound = msg.direction === 'outbound';
                      const isPending = msg._id.startsWith('opt-');
                      return (
                        <div
                          key={msg._id}
                          className={cn(
                            'flex flex-col',
                            outbound ? 'items-end' : 'items-start',
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[75%] rounded-2xl px-3 py-2 text-[15px] leading-snug',
                              outbound
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground',
                              isPending && sending && 'opacity-80',
                            )}
                          >
                            <DmMessageBody msg={msg} outbound={outbound} />
                          </div>
                          <span className="text-muted-foreground mt-0.5 px-1 text-[11px]">
                            {isPending && sending
                              ? 'Enviando…'
                              : formatMessageTime(msg.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 pt-1">
                {recording ? (
                  <div className="border-border rounded-lg border bg-card p-2 shadow-sm">
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
                        void handleSendAttachment(file, 'audio');
                      }}
                    />
                  </div>
                ) : (
                  <div className="border-border rounded-lg border bg-card shadow-sm">
                    <textarea
                      ref={replyRef}
                      placeholder={composerPlaceholder(activeThread.platform)}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={1}
                      className="max-h-32 min-h-[44px] w-full resize-none border-0 bg-transparent px-3 pt-3 pb-1 text-[15px] outline-none"
                      onKeyDown={handleComposerKeyDown}
                    />

                    <div className="flex items-center justify-end gap-0.5 px-2 pb-2">
                      <Popover open={attachOpen} onOpenChange={setAttachOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="Adjuntar"
                            aria-label="Adjuntar"
                            disabled={uploading || sending}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                              attachOpen
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {uploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Paperclip className="h-4 w-4" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-52 p-1">
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm"
                            onClick={() => imageInputRef.current?.click()}
                          >
                            <ImageIcon className="h-4 w-4" />
                            Foto o video
                          </button>
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm"
                            onClick={() => {
                              setAttachOpen(false);
                              setRecording(true);
                            }}
                          >
                            <Mic className="h-4 w-4" />
                            Nota de voz
                          </button>
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm"
                            onClick={() => audioInputRef.current?.click()}
                          >
                            <Paperclip className="h-4 w-4" />
                            Subir archivo
                          </button>
                        </PopoverContent>
                      </Popover>

                      <Popover
                        open={templatesOpen}
                        onOpenChange={(open) => {
                          setTemplatesOpen(open);
                          if (!open) resetCreateForm();
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="Respuestas guardadas"
                            aria-label="Respuestas guardadas"
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                              templatesOpen
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <MessageSquareText className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          side="top"
                          className="w-[min(400px,calc(100vw-2rem))] p-0"
                        >
                          {templatesView === 'create' ? (
                            <div className="p-4">
                              <h3 className="text-[15px] font-semibold text-foreground">
                                Crear respuesta guardada
                              </h3>
                              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                                Agrega un método abreviado de texto para insertar
                                rápidamente esta respuesta. Los métodos abreviados deben
                                tener al menos tres caracteres.
                              </p>

                              <div className="mt-4 space-y-3">
                                <div>
                                  <label className="text-sm font-semibold">
                                    Método abreviado
                                  </label>
                                  <Input
                                    value={newShortcut}
                                    onChange={(e) =>
                                      setNewShortcut(
                                        e.target.value.replace(/\s/g, '').toLowerCase(),
                                      )
                                    }
                                    placeholder="Agrega un método abreviado"
                                    className="mt-1.5 h-10"
                                    maxLength={32}
                                  />
                                </div>

                                <div>
                                  <label className="text-sm font-semibold">Mensaje</label>
                                  <div className="border-border mt-1.5 overflow-hidden rounded-lg border">
                                    <Textarea
                                      value={newMessage}
                                      onChange={(e) =>
                                        setNewMessage(
                                          e.target.value.slice(0, DM_MESSAGE_MAX),
                                        )
                                      }
                                      placeholder="Escribe un mensaje…"
                                      rows={5}
                                      className="min-h-[120px] resize-none border-0 shadow-none focus-visible:ring-0"
                                    />
                                    <div className="text-muted-foreground flex items-center justify-end border-t px-3 py-1.5 text-xs">
                                      {newMessage.length} / {DM_MESSAGE_MAX}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={resetCreateForm}
                                  disabled={savingTemplates}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90"
                                  disabled={
                                    savingTemplates ||
                                    newShortcut.trim().length < 3 ||
                                    !newMessage.trim()
                                  }
                                  onClick={() => void handleCreateSavedResponse()}
                                >
                                  {savingTemplates ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Guardar'
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2">
                              {templates.length > 0 ? (
                                <div className="max-h-52 space-y-0.5 overflow-y-auto">
                                  {templates.map((tpl) => (
                                    <div
                                      key={tpl.id}
                                      className="hover:bg-muted/60 flex items-start gap-1 rounded-md"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => insertTemplate(tpl.text)}
                                        className="min-w-0 flex-1 px-2 py-2 text-left"
                                      >
                                        <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                                          {tpl.shortcut}
                                        </span>
                                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                          {tpl.text}
                                        </p>
                                      </button>
                                      <button
                                        type="button"
                                        title="Eliminar"
                                        disabled={savingTemplates}
                                        onClick={() =>
                                          void handleDeleteSavedResponse(tpl.id)
                                        }
                                        className="text-muted-foreground hover:text-destructive mt-2 mr-1 shrink-0 p-1"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground px-2 py-3 text-xs">
                                  Aún no tienes respuestas guardadas.
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => setTemplatesView('create')}
                                className="text-primary hover:bg-muted mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium"
                              >
                                <Plus className="h-4 w-4" />
                                Crear respuesta guardada
                              </button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>

                      <div className="relative">
                        <button
                          type="button"
                          title="Emoji"
                          aria-label="Emoji"
                          onClick={() => setShowEmoji((v) => !v)}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                            showEmoji
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        {showEmoji ? (
                          <EmojiPicker
                            align="right"
                            onPick={insertEmoji}
                            onClose={() => setShowEmoji(false)}
                          />
                        ) : null}
                      </div>

                      <button
                        type="button"
                        title="Me gusta"
                        aria-label="Enviar me gusta"
                        disabled={sending || uploading}
                        onClick={() => void handleSendLike()}
                        className="text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-40"
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </button>
                    </div>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*,video/*"
                      hidden
                      onChange={(e) => void handleFilePicked(e, 'image')}
                    />
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*,application/pdf,.doc,.docx"
                      hidden
                      onChange={(e) => void handleFilePicked(e, 'audio')}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
