'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Facebook,
  Instagram,
  Loader2,
  MessageCircle,
  MessageCircleMore,
  CheckCircle2,
  Inbox,
  RefreshCw,
  Send,
  Search,
  Bot,
  Plus,
  Trash2,
  LayoutTemplate,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  listCommentInbox,
  listCommentReplies,
  replyToComment,
  updateCommentAutoReply,
  saveCommentTemplates,
  type CommentPostGroup,
  type CommentTemplate,
  type CommentThreadReply,
  type InboxComment,
  type MetaConnection,
} from '@/features/admin/api/meta-channels.api';
import { MetaSocialAvatar, type MetaAvatarPlatform } from '@/features/admin/components/canales/meta-social-avatar';

type FilterMode = 'all' | 'facebook' | 'instagram';
type ReplyFilter = 'all' | 'pending' | 'replied';

function postKey(group: CommentPostGroup) {
  return `${group.provider}:${group.postId}`;
}

function commentAvatarPlatform(provider: InboxComment['provider']): MetaAvatarPlatform {
  return provider === 'instagram' ? 'instagram' : 'facebook';
}

function commentKey(item: InboxComment) {
  return `${item.provider}:${item.id}`;
}

function hasCommentBody(text?: string) {
  return Boolean(text?.trim());
}

function isRecentComment(iso?: string) {
  if (!iso) return false;
  const age = Date.now() - new Date(iso).getTime();
  return age < 24 * 60 * 60 * 1000;
}

function isReplied(item: InboxComment) {
  return Boolean(item.reply) || (item.replyCount ?? 0) > 0;
}

function resolveAutoReply(
  connection: MetaConnection,
  templates: CommentTemplate[],
): {
  enabled: boolean;
  templateId: string;
  mode: 'template' | 'bot';
  instructions: string;
} {
  const mode = connection.autoReplyMode ?? 'template';
  const instructions = connection.autoReplyInstructions?.trim() ?? '';
  const templateId = connection.autoReplyTemplateId ?? '';
  const hasTemplates = templates.length > 0;
  const validTemplate =
    hasTemplates &&
    templateId !== '' &&
    templates.some((t) => t.id === templateId);

  if (mode === 'bot') {
    const enabled = Boolean(connection.autoReplyComments && instructions);
    return { enabled, templateId: '', mode: 'bot', instructions };
  }

  const enabled = Boolean(connection.autoReplyComments && validTemplate);
  return {
    enabled,
    templateId: enabled ? templateId : '',
    mode: 'template',
    instructions,
  };
}

export function CommentsInbox({
  connection,
  embedded = false,
}: {
  connection: MetaConnection;
  embedded?: boolean;
}) {
  const [groups, setGroups] = useState<CommentPostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all');
  const [didAutoPickFilter, setDidAutoPickFilter] = useState(false);
  const [activePostKey, setActivePostKey] = useState<string | null>(null);
  const [activeCommentKey, setActiveCommentKey] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<CommentTemplate[]>(
    connection.commentTemplates ?? [],
  );
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [newTplLabel, setNewTplLabel] = useState('');
  const [newTplText, setNewTplText] = useState('');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyMode, setAutoReplyMode] = useState<'template' | 'bot'>('template');
  const [autoReplyTemplateId, setAutoReplyTemplateId] = useState('');
  const [botInstructions, setBotInstructions] = useState(
    connection.autoReplyInstructions ?? '',
  );
  const [draftInstructions, setDraftInstructions] = useState(
    connection.autoReplyInstructions ?? '',
  );
  const [draftBotEnabled, setDraftBotEnabled] = useState(false);
  const [savingAutoReply, setSavingAutoReply] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [threadReplies, setThreadReplies] = useState<Record<string, CommentThreadReply[]>>({});
  const [loadingThreads, setLoadingThreads] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCommentInbox(connection.pageId, 100);
      setGroups(res.groups ?? []);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar comentarios');
    } finally {
      setLoading(false);
    }
  }, [connection.pageId]);

  useEffect(() => {
    void load();
    setDidAutoPickFilter(false);
  }, [load]);

  useEffect(() => {
    const tpls = connection.commentTemplates ?? [];
    setTemplates(tpls);
    const resolved = resolveAutoReply(connection, tpls);
    setAutoReply(resolved.enabled);
    setAutoReplyTemplateId(resolved.templateId);
    setAutoReplyMode(resolved.mode);
    setBotInstructions(resolved.instructions);
    setDraftInstructions(resolved.instructions);

    const staleOnServer =
      connection.autoReplyComments && !resolved.enabled;
    if (staleOnServer) {
      void updateCommentAutoReply(connection.pageId, false, {
        mode: resolved.mode,
        instructions: resolved.instructions || undefined,
      });
    }
  }, [
    connection.pageId,
    connection.commentTemplates,
    connection.autoReplyComments,
    connection.autoReplyTemplateId,
    connection.autoReplyInstructions,
    connection.autoReplyMode,
  ]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (filter !== 'all') {
      list = list.filter((g) => g.provider === filter);
    }

    list = list
      .map((g) => ({
        ...g,
        comments: g.comments.filter((c) => {
          if (replyFilter === 'pending') return !isReplied(c);
          if (replyFilter === 'replied') return isReplied(c);
          return true;
        }),
      }))
      .filter((g) => g.comments.length > 0);

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list
      .map((g) => ({
        ...g,
        comments: g.comments.filter(
          (c) =>
            c.text?.toLowerCase().includes(q) ||
            c.fromName?.toLowerCase().includes(q) ||
            c.reply?.text?.toLowerCase().includes(q) ||
            g.postPreview?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.comments.length > 0 || g.postPreview?.toLowerCase().includes(q));
  }, [groups, filter, replyFilter, search]);

  const activeGroup =
    filteredGroups.find((g) => postKey(g) === activePostKey) ?? filteredGroups[0] ?? null;

  const activeComments = activeGroup?.comments ?? [];

  const activeComment =
    activeComments.find((c) => commentKey(c) === activeCommentKey) ??
    activeComments[0] ??
    null;

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setActivePostKey(null);
      return;
    }
    if (!activePostKey || !filteredGroups.some((g) => postKey(g) === activePostKey)) {
      setActivePostKey(postKey(filteredGroups[0]));
    }
  }, [filteredGroups, activePostKey]);

  useEffect(() => {
    if (activeComments.length === 0) {
      setActiveCommentKey(null);
      return;
    }
    if (
      !activeCommentKey ||
      !activeComments.some((c) => commentKey(c) === activeCommentKey)
    ) {
      setActiveCommentKey(commentKey(activeComments[0]));
    }
  }, [activeComments, activeCommentKey]);

  useEffect(() => {
    setReplyText('');
  }, [activeCommentKey]);

  const loadThreadReplies = useCallback(
    async (group: CommentPostGroup) => {
      setLoadingThreads(true);
      try {
        const candidates = group.comments.filter(
          (c) => (c.replyCount ?? 0) > 0 || c.reply,
        );
        if (candidates.length === 0) {
          setThreadReplies({});
          return;
        }
        const results = await Promise.all(
          candidates.map(async (c) => {
            const res = await listCommentReplies(
              connection.pageId,
              c.provider,
              c.id,
            );
            return { key: commentKey(c), replies: res.replies ?? [] };
          }),
        );
        setThreadReplies(Object.fromEntries(results.map((r) => [r.key, r.replies])));
      } catch {
        setThreadReplies({});
      } finally {
        setLoadingThreads(false);
      }
    },
    [connection.pageId],
  );

  useEffect(() => {
    if (!activeGroup) {
      setThreadReplies({});
      return;
    }
    void loadThreadReplies(activeGroup);
  }, [activeGroup, loadThreadReplies]);

  async function refreshCommentThread(comment: InboxComment) {
    const res = await listCommentReplies(
      connection.pageId,
      comment.provider,
      comment.id,
    );
    setThreadReplies((prev) => ({
      ...prev,
      [commentKey(comment)]: res.replies ?? [],
    }));
  }

  async function persistTemplates(next: CommentTemplate[]) {
    setSavingTemplates(true);
    try {
      await saveCommentTemplates(connection.pageId, next);
      setTemplates(next);
      if (
        autoReplyMode === 'template' &&
        (next.length === 0 ||
          (autoReplyTemplateId && !next.some((t) => t.id === autoReplyTemplateId)))
      ) {
        setAutoReplyTemplateId('');
        setAutoReply(false);
        if (autoReply) {
          await updateCommentAutoReply(connection.pageId, false, {
            mode: 'template',
          });
        }
      }
      toast.success('Plantillas guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar');
    } finally {
      setSavingTemplates(false);
    }
  }

  async function handleAddTemplate() {
    const label = newTplLabel.trim();
    const text = newTplText.trim();
    if (!label || !text) {
      toast.error('Escribe un nombre y el mensaje de la plantilla');
      return;
    }
    const next = [
      ...templates,
      { id: crypto.randomUUID(), label, text },
    ];
    await persistTemplates(next);
    setNewTplLabel('');
    setNewTplText('');
  }

  async function handleDeleteTemplate(id: string) {
    const next = templates.filter((t) => t.id !== id);
    await persistTemplates(next);
  }

  async function handleSaveBotInstructions() {
    const text = draftInstructions.trim();
    if (!text) {
      toast.error('Escribe cómo debe responder el bot a los comentarios');
      return;
    }
    setSavingBot(true);
    try {
      await updateCommentAutoReply(connection.pageId, draftBotEnabled, {
        mode: 'bot',
        instructions: text,
      });
      setBotInstructions(text);
      setAutoReplyMode('bot');
      setAutoReply(draftBotEnabled);
      setBotModalOpen(false);
      toast.success(
        draftBotEnabled
          ? 'Bot activado con las instrucciones guardadas'
          : 'Instrucciones guardadas · bot desactivado',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingBot(false);
    }
  }

  async function handleAutoReplyToggle(enabled: boolean) {
    if (enabled) {
      if (autoReplyMode === 'bot') {
        if (!botInstructions.trim()) {
          toast.error('Configura las instrucciones del bot primero');
          setDraftInstructions(botInstructions);
          setBotModalOpen(true);
          return;
        }
      } else if (templates.length === 0) {
        if (botInstructions.trim()) {
          setAutoReplyMode('bot');
        } else {
          toast.error(
            'Crea una plantilla o configura el bot con instrucciones',
          );
          setBotModalOpen(true);
          return;
        }
      } else if (!autoReplyTemplateId) {
        const first = templates[0];
        if (first) setAutoReplyTemplateId(first.id);
        else return;
      }
    }

    const mode =
      enabled && autoReplyMode === 'bot' && botInstructions.trim()
        ? 'bot'
        : enabled && templates.length === 0 && botInstructions.trim()
          ? 'bot'
          : 'template';
    const templateId =
      mode === 'template'
        ? autoReplyTemplateId || templates[0]?.id
        : undefined;

    setSavingAutoReply(true);
    try {
      await updateCommentAutoReply(connection.pageId, enabled, {
        mode,
        templateId,
        instructions: botInstructions.trim() || undefined,
      });
      setAutoReply(enabled);
      setAutoReplyMode(mode);
      if (templateId) setAutoReplyTemplateId(templateId);
      toast.success(
        enabled ? 'Respuesta automática activada' : 'Respuesta automática desactivada',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingAutoReply(false);
    }
  }

  async function handleAutoReplyTemplateChange(templateId: string) {
    setAutoReplyTemplateId(templateId);
    setAutoReplyMode('template');
    if (!autoReply) return;
    setSavingAutoReply(true);
    try {
      await updateCommentAutoReply(connection.pageId, true, {
        mode: 'template',
        templateId,
        instructions: botInstructions.trim() || undefined,
      });
      toast.success('Plantilla automática actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingAutoReply(false);
    }
  }

  async function handleSwitchToBotMode() {
    if (!botInstructions.trim()) {
      setDraftInstructions(botInstructions);
      setBotModalOpen(true);
      return;
    }
    setSavingAutoReply(true);
    try {
      await updateCommentAutoReply(connection.pageId, autoReply, {
        mode: 'bot',
        instructions: botInstructions.trim(),
      });
      setAutoReplyMode('bot');
      toast.success('Auto-respuesta con bot activada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingAutoReply(false);
    }
  }

  async function handleSend() {
    if (!activeComment) return;
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await replyToComment(
        connection.pageId,
        activeComment.provider,
        activeComment.id,
        text,
      );
      if (res.ok) {
        toast.success('Respuesta publicada');
        setReplyText('');
        const now = Date.now();
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            comments: g.comments.map((c) =>
              commentKey(c) === commentKey(activeComment)
                ? { ...c, reply: { text, repliedAt: now, auto: false } }
                : c,
            ),
          })),
        );
        await refreshCommentThread(activeComment);
      } else {
        toast.error(res.error || 'No se pudo responder');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al responder');
    } finally {
      setSending(false);
    }
  }

  function timeAgo(iso?: string) {
    if (!iso) return '';
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  }

  function timeAgoMs(ms: number) {
    try {
      return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  }

  const totalComments = filteredGroups.reduce((n, g) => n + g.comments.length, 0);
  const pendingCount = groups.reduce(
    (n, g) => n + g.comments.filter((c) => !isReplied(c)).length,
    0,
  );
  const repliedCount = groups.reduce(
    (n, g) => n + g.comments.filter((c) => isReplied(c)).length,
    0,
  );
  const allCount = groups.reduce((n, g) => n + g.comments.length, 0);

  useEffect(() => {
    if (loading || didAutoPickFilter || groups.length === 0) return;
    if (pendingCount > 0) setReplyFilter('pending');
    setDidAutoPickFilter(true);
  }, [loading, didAutoPickFilter, groups.length, pendingCount]);

  const emptyCopy = (() => {
    if (replyFilter === 'pending') {
      return {
        icon: CheckCircle2,
        title: 'No hay pendientes',
        description:
          pendingCount === 0 && repliedCount > 0
            ? 'Todo al día. Revisa los respondidos o ve todos los comentarios.'
            : 'Cuando llegue un comentario nuevo aparecerá aquí.',
        actions: [
          repliedCount > 0
            ? { label: 'Ver respondidos', onClick: () => setReplyFilter('replied') }
            : null,
          allCount > 0
            ? { label: 'Ver todos', onClick: () => setReplyFilter('all') }
            : null,
        ].filter(Boolean) as { label: string; onClick: () => void }[],
      };
    }
    if (replyFilter === 'replied') {
      return {
        icon: MessageCircleMore,
        title: 'Sin respondidos',
        description: 'Todavía no hay respuestas publicadas en este filtro.',
        actions: [
          pendingCount > 0
            ? { label: 'Ver pendientes', onClick: () => setReplyFilter('pending') }
            : null,
          { label: 'Ver todos', onClick: () => setReplyFilter('all') },
        ].filter(Boolean) as { label: string; onClick: () => void }[],
      };
    }
    return {
      icon: Inbox,
      title: search.trim() ? 'Sin resultados' : 'Sin comentarios aún',
      description: search.trim()
        ? 'Prueba otra búsqueda o limpia el filtro.'
        : 'Los comentarios de tus publicaciones aparecerán aquí.',
      actions: [] as { label: string; onClick: () => void }[],
    };
  })();

  return (
    <div
      className={cn(
        'bg-card flex flex-col overflow-hidden',
        embedded ? 'h-full min-h-0' : 'border-border/60 rounded-2xl border shadow-sm',
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
        <div className="relative min-w-[160px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar publicación o comentario…"
            className="h-9 border-0 bg-muted/70 pl-9 text-xs shadow-none focus-visible:ring-1"
          />
        </div>

        <div className="bg-muted/70 flex items-center gap-0.5 rounded-lg p-0.5">
          {(
            [
              ['all', Layers, 'Todas'],
              ['facebook', Facebook, 'Facebook'],
              ['instagram', Instagram, 'Instagram'],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              title={label}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                filter === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="bg-muted/70 flex items-center gap-0.5 rounded-lg p-0.5">
          {(
            [
              ['pending', `Pendientes`, pendingCount],
              ['replied', `Respondidos`, repliedCount],
              ['all', 'Todos', allCount],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setReplyFilter(value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                replyFilter === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              <span
                className={cn(
                  'ml-1 tabular-nums',
                  replyFilter === value ? 'text-primary' : 'opacity-70',
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8"
          onClick={() => void load()}
          disabled={loading}
          title="Actualizar"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="bg-muted/40 flex flex-wrap items-center gap-3 px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-8 gap-1.5 px-2 text-xs"
          onClick={() => setTemplatesModalOpen(true)}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Plantillas
          <span className="text-foreground/70 tabular-nums">{templates.length}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1.5 px-2 text-xs',
            autoReply && autoReplyMode === 'bot'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => {
            setDraftInstructions(botInstructions);
            setDraftBotEnabled(autoReply && autoReplyMode === 'bot');
            setBotModalOpen(true);
          }}
        >
          <Bot className="h-3.5 w-3.5" />
          Bot
          {autoReply && autoReplyMode === 'bot' ? (
            <span className="bg-primary/15 text-primary rounded px-1 py-0.5 text-[10px] font-medium">
              activo
            </span>
          ) : botInstructions ? (
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[10px] font-medium">
              off
            </span>
          ) : null}
        </Button>

        <div className="bg-border/80 hidden h-4 w-px sm:block" />

        <div className="flex items-center gap-2">
          <Switch
            id="auto-reply"
            checked={autoReply}
            disabled={
              savingAutoReply ||
              (templates.length === 0 && !botInstructions.trim())
            }
            onCheckedChange={(v) => void handleAutoReplyToggle(v)}
          />
          <Label
            htmlFor="auto-reply"
            className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
          >
            Auto-respuesta
          </Label>
        </div>
        {templates.length === 0 && !botInstructions.trim() ? (
          <span className="text-muted-foreground text-[11px]">
            Configura el bot o una plantilla para activarla
          </span>
        ) : null}
        {autoReply && autoReplyMode === 'bot' ? (
          <button
            type="button"
            onClick={() => {
              setDraftInstructions(botInstructions);
              setDraftBotEnabled(true);
              setBotModalOpen(true);
            }}
            className="text-muted-foreground hover:text-foreground max-w-xs truncate text-left text-[11px] underline-offset-2 hover:underline"
            title={botInstructions}
          >
            Bot con instrucciones
          </button>
        ) : null}
        {autoReply && autoReplyMode === 'template' && templates.length > 0 ? (
          <select
            value={autoReplyTemplateId || templates[0]?.id}
            onChange={(e) => void handleAutoReplyTemplateChange(e.target.value)}
            disabled={savingAutoReply}
            className="border-border/80 bg-card h-8 max-w-xs flex-1 rounded-md border px-2 text-xs"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : null}
        {autoReply &&
        autoReplyMode === 'template' &&
        botInstructions.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-[11px]"
            disabled={savingAutoReply}
            onClick={() => void handleSwitchToBotMode()}
          >
            Usar bot
          </Button>
        ) : null}
        <span className="text-muted-foreground ml-auto hidden text-[11px] sm:inline">
          {totalComments} de {allCount} visibles
        </span>
      </div>

      <div className="bg-border/60 h-px w-full" />

      <Dialog open={templatesModalOpen} onOpenChange={setTemplatesModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plantillas de respuesta</DialogTitle>
            <DialogDescription>
              Mensajes reutilizables para responder a mano o configurar el envío automático.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {templates.length > 0 ? (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="bg-muted/40 flex items-start gap-2 rounded-xl p-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setReplyText(tpl.text);
                        setTemplatesModalOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-semibold">{tpl.label}</p>
                      <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
                        {tpl.text}
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                      disabled={savingTemplates}
                      onClick={() => void handleDeleteTemplate(tpl.id)}
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-muted/30 flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center">
                <LayoutTemplate className="text-muted-foreground/50 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  Aún no tienes plantillas. Crea la primera abajo.
                </p>
              </div>
            )}

            <div className="border-border/60 space-y-2 border-t pt-4">
              <p className="text-sm font-semibold">Nueva plantilla</p>
              <Input
                value={newTplLabel}
                onChange={(e) => setNewTplLabel(e.target.value)}
                placeholder="Nombre corto (ej. Catálogo WhatsApp)"
                className="border-0 bg-muted/70 shadow-none"
              />
              <Textarea
                value={newTplText}
                onChange={(e) => setNewTplText(e.target.value)}
                placeholder="Texto del mensaje que se enviará…"
                rows={4}
                className="resize-none border-0 bg-muted/70 shadow-none"
              />
              <Button
                type="button"
                className="gap-1.5"
                disabled={savingTemplates}
                onClick={() => void handleAddTemplate()}
              >
                {savingTemplates ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Crear plantilla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={botModalOpen}
        onOpenChange={(open) => {
          setBotModalOpen(open);
          if (open) {
            setDraftInstructions(botInstructions);
            setDraftBotEnabled(autoReply && autoReplyMode === 'bot');
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bot de comentarios</DialogTitle>
            <DialogDescription>
              Indica la información y la lógica con la que el bot debe contestar
              comentarios nuevos (precios, tono, qué ofrecer, cuándo invitar a
              WhatsApp, etc.).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <Label
                  htmlFor="bot-enabled"
                  className="text-sm font-medium"
                >
                  Activar bot
                </Label>
                <p className="text-muted-foreground text-[11px] leading-snug">
                  {draftBotEnabled
                    ? 'Responderá comentarios nuevos con IA'
                    : 'Guardado, pero no responde hasta que lo actives'}
                </p>
              </div>
              <Switch
                id="bot-enabled"
                checked={draftBotEnabled}
                disabled={savingBot}
                onCheckedChange={setDraftBotEnabled}
              />
            </div>

            <Textarea
              value={draftInstructions}
              onChange={(e) => setDraftInstructions(e.target.value)}
              placeholder={`Ejemplo:
Eres la asesora de FincasYa. Responde comentarios de forma amable y breve.
Si preguntan precios o disponibilidad, pide fechas, número de personas y city, e invita a WhatsApp +57 315 777 3937.
No inventes tarifas. Si solo saludan, agradece y ofrece ayuda.`}
              rows={10}
              className="resize-y text-sm"
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Escribir o enfocar el texto no activa el bot: usa el interruptor de
              arriba y luego Guarda.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBotModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={savingBot || !draftInstructions.trim()}
                onClick={() => void handleSaveBotInstructions()}
              >
                {savingBot ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {draftBotEnabled ? 'Guardar y activar' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
            <emptyCopy.icon className="text-muted-foreground h-7 w-7" strokeWidth={1.6} />
          </div>
          <div className="max-w-sm space-y-1.5">
            <p className="text-sm font-semibold">{emptyCopy.title}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {emptyCopy.description}
            </p>
          </div>
          {emptyCopy.actions.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {emptyCopy.actions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="bg-muted/20 overflow-y-auto lg:border-r lg:border-border/50">
            <p className="text-muted-foreground px-4 py-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase">
              Publicaciones
            </p>
            <ul className="space-y-0.5 px-2 pb-3">
              {filteredGroups.map((group) => {
                const key = postKey(group);
                const active = key === activePostKey;
                const newest = group.comments[0]?.createdTime;
                const hasNew = group.comments.some(
                  (c) => isRecentComment(c.createdTime) && !isReplied(c),
                );
                const pendingInGroup = group.comments.filter((c) => !isReplied(c)).length;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setActivePostKey(key)}
                      className={cn(
                        'flex w-full gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                        active
                          ? 'bg-card shadow-sm ring-1 ring-border/80'
                          : 'hover:bg-card/70',
                      )}
                    >
                      <div className="bg-muted relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                        {group.postImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={group.postImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <MessageCircle className="text-muted-foreground/35 h-4 w-4" />
                          </div>
                        )}
                        <span className="bg-card absolute right-0.5 bottom-0.5 rounded-full p-0.5 shadow-sm">
                          {group.provider === 'instagram' ? (
                            <Instagram className="h-2.5 w-2.5 text-pink-500" />
                          ) : (
                            <Facebook className="h-2.5 w-2.5 text-blue-600" />
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs leading-snug font-medium">
                          {group.postPreview?.trim() || 'Publicación sin texto'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                              hasNew
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {group.comments.length} com.
                          </span>
                          {pendingInGroup > 0 ? (
                            <span className="text-primary text-[10px] font-medium">
                              {pendingInGroup} pend.
                            </span>
                          ) : null}
                          {newest ? (
                            <span className="text-muted-foreground text-[10px]">
                              {timeAgo(newest)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col bg-card">
            {activeGroup && activeComment ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
                    Hilo
                  </p>
                  {loadingThreads ? (
                    <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                  <ul className="space-y-1">
                    {activeComments.map((item) => {
                      const key = commentKey(item);
                      const isActive = key === activeCommentKey;
                      const isNew = isRecentComment(item.createdTime) && !isReplied(item);
                      const replies = threadReplies[key] ?? [];
                      const hasThread = replies.length > 0;

                      return (
                        <li
                          key={key}
                          className={cn(
                            'rounded-xl transition-colors',
                            isActive ? 'bg-muted/50' : 'hover:bg-muted/30',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveCommentKey(key)}
                            className="flex w-full gap-3 px-3 py-3 text-left"
                          >
                            <MetaSocialAvatar
                              pageId={connection.pageId}
                              participantId={item.fromId}
                              platform={commentAvatarPlatform(item.provider)}
                              name={item.fromName}
                              className="h-9 w-9"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm font-semibold">
                                  {item.fromName || 'Usuario'}
                                </span>
                                {isNew ? (
                                  <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                                ) : null}
                                <span className="text-muted-foreground text-[11px]">
                                  {timeAgo(item.createdTime)}
                                </span>
                              </div>
                              {hasCommentBody(item.text) ? (
                                <p className="mt-1 text-sm whitespace-pre-wrap">{item.text}</p>
                              ) : (
                                <p className="text-muted-foreground mt-1 text-sm italic">
                                  Emoji o reacción
                                </p>
                              )}
                            </div>
                          </button>

                          {hasThread ? (
                            <ul className="border-border/40 ml-11 space-y-3 border-l pb-3 pl-4">
                              {replies.map((reply) => (
                                <li key={reply.id} className="flex gap-2.5">
                                  <MetaSocialAvatar
                                    pageId={connection.pageId}
                                    participantId={
                                      reply.isPageAuthor ? connection.pageId : reply.fromId
                                    }
                                    platform={
                                      item.provider === 'instagram' ? 'instagram' : 'facebook'
                                    }
                                    directUrl={
                                      reply.isPageAuthor
                                        ? item.provider === 'instagram'
                                          ? connection.igPictureUrl
                                          : connection.pictureUrl
                                        : undefined
                                    }
                                    name={reply.fromName || connection.pageName}
                                    className="h-8 w-8"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="text-sm font-semibold">
                                        {reply.fromName || connection.pageName || 'Página'}
                                      </span>
                                      {reply.isPageAuthor ? (
                                        <Badge
                                          variant="secondary"
                                          className="h-5 px-1.5 text-[10px]"
                                        >
                                          Autor
                                        </Badge>
                                      ) : null}
                                      {reply.auto ? (
                                        <Badge variant="outline" className="h-5 text-[10px]">
                                          Auto
                                        </Badge>
                                      ) : null}
                                      <span className="text-muted-foreground text-[11px]">
                                        {reply.createdTime ? timeAgo(reply.createdTime) : ''}
                                      </span>
                                    </div>
                                    {reply.text ? (
                                      <p className="mt-1 text-sm whitespace-pre-wrap">
                                        {reply.text}
                                      </p>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : isReplied(item) && item.reply ? (
                            <ul className="border-border/40 ml-11 space-y-3 border-l pb-3 pl-4">
                              <li className="flex gap-2.5">
                                <MetaSocialAvatar
                                  pageId={connection.pageId}
                                  participantId={connection.pageId}
                                  platform={
                                    item.provider === 'instagram' ? 'instagram' : 'facebook'
                                  }
                                  directUrl={
                                    item.provider === 'instagram'
                                      ? connection.igPictureUrl
                                      : connection.pictureUrl
                                  }
                                  name={connection.pageName}
                                  className="h-8 w-8"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-semibold">
                                      {connection.pageName}
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className="h-5 px-1.5 text-[10px]"
                                    >
                                      Autor
                                    </Badge>
                                    {item.reply.auto ? (
                                      <Badge variant="outline" className="h-5 text-[10px]">
                                        Auto
                                      </Badge>
                                    ) : null}
                                    <span className="text-muted-foreground text-[11px]">
                                      {timeAgoMs(item.reply.repliedAt)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm whitespace-pre-wrap">
                                    {item.reply.text}
                                  </p>
                                </div>
                              </li>
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="bg-muted/30 space-y-2.5 px-4 py-3">
                  <p className="text-muted-foreground text-xs">
                    Respondiendo a{' '}
                    <span className="text-foreground font-medium">
                      {activeComment.fromName || 'Usuario'}
                    </span>
                  </p>

                  {templates.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setReplyText(tpl.text)}
                          className="bg-card text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-[11px] ring-1 ring-border/70 transition-colors"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Crea plantillas para insertar respuestas con un clic.
                    </p>
                  )}

                  <div className="bg-card overflow-hidden rounded-xl ring-1 ring-border/70">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe tu respuesta…"
                      rows={3}
                      className="resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                    />
                    <div className="flex justify-end px-2 pb-2">
                      <Button
                        size="sm"
                        disabled={sending || !replyText.trim()}
                        onClick={() => void handleSend()}
                        className="gap-1.5"
                      >
                        {sending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Responder
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <MessageCircle className="h-8 w-8 opacity-30" />
                <p className="text-sm">Selecciona una publicación</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
