/**
 * FincasYa · Chats — inbox operadores (referencia CRM WhatsApp).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@fincasya/backend/convex/_generated/api';
import {
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Image,
  ListFilter,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Smile,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ConversationRow = FunctionReturnType<typeof api.inbox.listConversations>[number];
type Filter = 'todas' | 'human' | 'ai' | 'unread' | 'whatsapp' | 'web' | 'nuevas';

const OPERATIONAL_LABELS: Record<string, string> = {
  pending_data: 'Pendiente datos',
  requires_advisor: 'Requiere asesor',
  validate_availability: 'Validar disponibilidad',
  ready_to_book: 'Listo reservar',
  pending_payment: 'Pendiente pago',
};

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const AVATAR_COLORS = [
  'bg-zinc-700 text-zinc-100',
  'bg-emerald-800 text-emerald-100',
  'bg-slate-700 text-slate-100',
  'bg-teal-800 text-teal-100',
  'bg-zinc-600 text-zinc-100',
];

function avatarColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

function OperationalBadge({ state }: { state: string | null }) {
  if (!state) return null;
  const label = OPERATIONAL_LABELS[state] ?? state;
  return <Badge variant="state">{label}</Badge>;
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

function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const dim =
    size === 'xs' ? 'h-7 w-7 text-[10px]' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        dim,
        avatarColor(name),
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

function DeliveryTick({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === 'failed') return <CircleAlert className="h-3 w-3 text-destructive" />;
  if (status === 'read') return <CheckCheck className="h-3 w-3 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 opacity-60" />;
  return <Check className="h-3 w-3 opacity-60" />;
}

function ConversationItem({
  conv,
  active,
  onClick,
}: {
  conv: ConversationRow;
  active: boolean;
  onClick: () => void;
}) {
  const preview = conv.preview
    ? (conv.preview.sender === 'user' ? '' : '✓ ') +
      (conv.preview.type !== 'text' ? `[${conv.preview.type}] ` : '') +
      conv.preview.content
    : 'Sin mensajes';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        active && 'border-l-2 border-l-primary bg-muted/60',
      )}
    >
      <Avatar name={conv.name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-[13px]',
              conv.unread > 0 ? 'font-semibold' : 'font-medium',
            )}
          >
            {conv.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatListTime(conv.lastMessageAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{preview}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {conv.channel === 'whatsapp' && (
            <span className="h-2 w-2 rounded-full bg-primary" title="WhatsApp" />
          )}
          {conv.status === 'ai' && <Badge variant="ai">Bot</Badge>}
          {conv.status === 'human' && <Badge variant="human">Humano</Badge>}
          {!conv.aiEligible && conv.status !== 'ai' && (
            <Badge variant="outline">Sin auto</Badge>
          )}
          {conv.operationalState && (
            <Badge variant="channel">
              {OPERATIONAL_LABELS[conv.operationalState]?.split(' ').pop() ?? 'Estado'}
            </Badge>
          )}
          {conv.unread > 0 && (
            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {conv.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

type Message = NonNullable<FunctionReturnType<typeof api.inbox.getMessages>>[number];

function MessageBubble({
  message,
  contactName,
  showAvatar,
}: {
  message: Message;
  contactName: string;
  showAvatar: boolean;
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

  return (
    <div className={cn('mb-1 flex items-end gap-2', isUser ? 'justify-start' : 'justify-end')}>
      {isUser && (
        <div className="w-7 shrink-0">
          {showAvatar && <Avatar name={contactName} size="xs" />}
        </div>
      )}
      <div
        className={cn(
          'max-w-[min(72%,26rem)] px-3 py-2',
          isUser ? 'bubble-in' : isBot ? 'bubble-bot' : 'bubble-advisor',
        )}
      >
        {!isUser && (
          <div
            className={cn(
              'mb-1 flex items-center gap-1 text-[10px] font-medium',
              isBot ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isBot ? (
              <>
                <Bot className="h-3 w-3" /> Bot
              </>
            ) : (
              <>
                <UserRound className="h-3 w-3" /> Asesor
              </>
            )}
          </div>
        )}
        {message.mediaUrl && (
          <div className="mb-1 flex items-center gap-1 text-[11px] italic text-muted-foreground">
            <Paperclip className="h-3 w-3" /> adjunto
          </div>
        )}
        <div className="whitespace-pre-wrap wrap-break-word text-[13px] leading-relaxed">
          {message.content}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground/70">
          {formatTime(message.createdAt)}
          {!isUser && <DeliveryTick status={message.whatsappStatus} />}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ conv }: { conv: ConversationRow }) {
  const messages = useQuery(api.inbox.getMessages, {
    conversationId: conv.conversationId,
  });
  const eligibility = useQuery(api.inbox.getConversationAiEligibility, {
    conversationId: conv.conversationId,
  });
  const sendMessage = useMutation(api.inbox.sendAdvisorMessage);
  const setStatus = useMutation(api.inbox.setConversationStatus);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const botEnabled = conv.status === 'ai';
  const canEnableBot = eligibility?.manualAllowed ?? conv.status !== 'resolved';
  const autoOnly = eligibility?.autoEligible === false && !conv.aiManualOverride;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
  }, [messages?.length, conv.conversationId]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId: conv.conversationId, content: text });
      setDraft('');
    } finally {
      setSending(false);
    }
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
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{conv.name}</h2>
            <OperationalBadge state={conv.operationalState} />
          </div>
          <p className="text-xs text-muted-foreground">+{conv.phone}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs text-muted-foreground">Sin asignar</span>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              ▾
            </Button>
          </div>

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
            {autoOnly && !botEnabled && !botError && (
              <span className="max-w-[200px] text-right text-[10px] text-muted-foreground">
                {eligibility?.label ?? 'No auto'} — puedes activarlo manualmente
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mensajes */}
      <div className="chat-bg flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages === undefined ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.day}>
              <div className="my-4 flex justify-center">
                <span className="rounded-md bg-muted/60 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                  {group.day}
                </span>
              </div>
              {group.items.map((m, i) => {
                const prev = group.items[i - 1];
                const showAvatar =
                  m.sender === 'user' && (!prev || prev.sender !== 'user' || prev.sender === 'system');
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    contactName={conv.name}
                    showAvatar={showAvatar}
                  />
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <footer className="border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-1 pb-2 text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Image className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Smile className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Bot className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500">
            <UserRound className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder="Escribe tu mensaje como operador…"
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
          {draft.trim() ? (
            <Button
              size="icon"
              className="h-[42px] w-[42px] shrink-0"
              onClick={() => void handleSend()}
              disabled={sending}
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-[42px] w-[42px] shrink-0 text-destructive">
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

const FILTERS: Array<{ id: Filter; label: string; group?: 'estado' | 'canal' }> = [
  { id: 'todas', label: 'Todas', group: 'estado' },
  { id: 'nuevas', label: 'Solo nuevas', group: 'estado' },
  { id: 'human', label: 'Humano', group: 'estado' },
  { id: 'ai', label: 'Bot', group: 'estado' },
  { id: 'unread', label: 'No leídos', group: 'estado' },
  { id: 'web', label: 'Bot web', group: 'canal' },
  { id: 'whatsapp', label: 'Bot WhatsApp', group: 'canal' },
];

function FilterMenu({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (filter: Filter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = FILTERS.find((f) => f.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'h-8 gap-1.5 px-2.5 text-xs',
          value !== 'todas' && 'border-primary/40 text-primary',
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <ListFilter className="h-3.5 w-3.5" />
        <span className="max-w-[88px] truncate">{value === 'todas' ? 'Filtros' : current?.label}</span>
        <ChevronDown className={cn('h-3 w-3 opacity-60 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-border bg-card py-1 shadow-md"
        >
          {(['estado', 'canal'] as const).map((group, gi) => (
            <div key={group}>
              {gi > 0 ? <div className="my-1 border-t border-border/60" /> : null}
              <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group === 'estado' ? 'Estado' : 'Canal'}
              </p>
              {FILTERS.filter((f) => f.group === group).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="option"
                  aria-selected={value === f.id}
                  onClick={() => {
                    onChange(f.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/60',
                    value === f.id ? 'bg-primary/10 font-medium text-primary' : 'text-foreground',
                  )}
                >
                  {value === f.id ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3" />}
                  {f.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
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

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      if (filter === 'ai') return c.status === 'ai';
      if (filter === 'human') return c.status === 'human';
      if (filter === 'unread') return c.unread > 0;
      if (filter === 'nuevas') return c.aiEligible;
      if (filter === 'whatsapp') return c.channel === 'whatsapp';
      if (filter === 'web') return c.channel === 'web';
      return true;
    });
  }, [conversations, search, filter]);

  const selected = conversations?.find((c) => c.conversationId === selectedId) ?? null;

  function openConversation(conv: ConversationRow) {
    setSelectedId(conv.conversationId);
    if (conv.unread > 0) void markRead({ conversationId: conv.conversationId });
  }

  const globalBotHint = agentSettings?.globalAiEnabled
    ? 'Chats nuevos con bot. No se activa en chats con catálogo o proceso.'
    : 'Chats nuevos en humano. Actívalos desde cada conversación.';

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-border bg-card">
        <div className="space-y-2 border-b border-border p-3">
          <div
            title={globalBotHint}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5',
              agentSettings?.globalAiEnabled
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-muted/20',
            )}
          >
            <Bot
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                agentSettings?.globalAiEnabled ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium">Bot automático</p>
                <Badge variant={agentSettings?.globalAiEnabled ? 'ai' : 'outline'} className="shrink-0">
                  {agentSettings?.globalAiEnabled ? 'ON' : 'OFF'}
                </Badge>
              </div>
            </div>
            <BotToggle
              enabled={agentSettings?.globalAiEnabled ?? false}
              onChange={(on) => void setGlobalAi({ enabled: on })}
              title={globalBotHint}
            />
          </div>

          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar chat…"
                className="h-8 rounded-md border-border bg-input pl-8 text-xs"
              />
            </div>
            <FilterMenu value={filter} onChange={setFilter} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations === undefined ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Sin chats</p>
          ) : (
            filtered.map((c) => (
              <ConversationItem
                key={c.conversationId}
                conv={c}
                active={c.conversationId === selectedId}
                onClick={() => openConversation(c)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Panel principal */}
      {selected ? (
        <ChatPanel key={selected.conversationId} conv={selected} />
      ) : (
        <div className="chat-bg flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Selecciona un chat para comenzar</p>
        </div>
      )}
    </div>
  );
}
