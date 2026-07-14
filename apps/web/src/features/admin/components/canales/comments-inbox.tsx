'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Facebook,
  Instagram,
  Loader2,
  MessageCircle,
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
): { enabled: boolean; templateId: string } {
  const templateId = connection.autoReplyTemplateId ?? '';
  const hasTemplates = templates.length > 0;
  const validTemplate =
    hasTemplates &&
    templateId !== '' &&
    templates.some((t) => t.id === templateId);
  const enabled = Boolean(connection.autoReplyComments && validTemplate);
  return {
    enabled,
    templateId: enabled ? templateId : '',
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
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('pending');
  const [activePostKey, setActivePostKey] = useState<string | null>(null);
  const [activeCommentKey, setActiveCommentKey] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<CommentTemplate[]>(
    connection.commentTemplates ?? [],
  );
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [newTplLabel, setNewTplLabel] = useState('');
  const [newTplText, setNewTplText] = useState('');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyTemplateId, setAutoReplyTemplateId] = useState('');
  const [savingAutoReply, setSavingAutoReply] = useState(false);
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
  }, [load]);

  useEffect(() => {
    const tpls = connection.commentTemplates ?? [];
    setTemplates(tpls);
    const resolved = resolveAutoReply(connection, tpls);
    setAutoReply(resolved.enabled);
    setAutoReplyTemplateId(resolved.templateId);

    const staleOnServer =
      connection.autoReplyComments &&
      (!resolved.enabled || connection.autoReplyTemplateId !== resolved.templateId);
    if (staleOnServer) {
      void updateCommentAutoReply(connection.pageId, false);
    }
  }, [
    connection.pageId,
    connection.commentTemplates,
    connection.autoReplyComments,
    connection.autoReplyTemplateId,
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
      if (next.length === 0 || (autoReplyTemplateId && !next.some((t) => t.id === autoReplyTemplateId))) {
        setAutoReplyTemplateId('');
        setAutoReply(false);
        if (autoReply) {
          await updateCommentAutoReply(connection.pageId, false);
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

  async function handleAutoReplyToggle(enabled: boolean) {
    if (enabled && templates.length === 0) {
      toast.error('Crea al menos una plantilla para activar la respuesta automática');
      setTemplatesModalOpen(true);
      return;
    }
    if (enabled && !autoReplyTemplateId) {
      const first = templates[0];
      if (first) setAutoReplyTemplateId(first.id);
      else return;
    }

    const templateId = enabled ? autoReplyTemplateId || templates[0]?.id : undefined;
    setSavingAutoReply(true);
    try {
      await updateCommentAutoReply(connection.pageId, enabled, { templateId });
      setAutoReply(enabled);
      if (templateId) setAutoReplyTemplateId(templateId);
      toast.success(enabled ? 'Respuesta automática activada' : 'Respuesta automática desactivada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingAutoReply(false);
    }
  }

  async function handleAutoReplyTemplateChange(templateId: string) {
    setAutoReplyTemplateId(templateId);
    if (!autoReply) return;
    setSavingAutoReply(true);
    try {
      await updateCommentAutoReply(connection.pageId, true, { templateId });
      toast.success('Plantilla automática actualizada');
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

  return (
    <div
      className={cn(
        'bg-card flex flex-col overflow-hidden',
        embedded ? 'h-full min-h-0' : 'border-border rounded-2xl border shadow-sm',
      )}
    >
      <div className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar publicación o comentario…"
            className="h-9 border-border bg-background pl-8 text-xs"
          />
        </div>
        <div className="bg-muted flex items-center gap-0.5 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            title="Todas las redes"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-background',
            )}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFilter('facebook')}
            title="Facebook"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              filter === 'facebook'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-background',
            )}
          >
            <Facebook className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFilter('instagram')}
            title="Instagram"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              filter === 'instagram'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-background',
            )}
          >
            <Instagram className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {(
            [
              ['pending', `Pendientes (${pendingCount})`],
              ['replied', `Respondidos (${repliedCount})`],
              ['all', 'Todos'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setReplyFilter(value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                replyFilter === value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => void load()}
          disabled={loading}
          title="Actualizar"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="border-border bg-accent/40 flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setTemplatesModalOpen(true)}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Mis plantillas ({templates.length})
        </Button>

        <div className="flex items-center gap-2">
          <Switch
            id="auto-reply"
            checked={autoReply}
            disabled={savingAutoReply || templates.length === 0}
            onCheckedChange={(v) => void handleAutoReplyToggle(v)}
          />
          <Label htmlFor="auto-reply" className="flex items-center gap-1.5 text-xs font-medium">
            <Bot className="h-3.5 w-3.5" />
            Respuesta automática
          </Label>
        </div>
        {templates.length === 0 ? (
          <span className="text-muted-foreground text-[11px]">
            Crea una plantilla para activar el envío automático
          </span>
        ) : null}
        {autoReply && templates.length > 0 ? (
          <select
            value={autoReplyTemplateId || templates[0]?.id}
            onChange={(e) => void handleAutoReplyTemplateChange(e.target.value)}
            disabled={savingAutoReply}
            className="border-border bg-background h-8 max-w-xs flex-1 rounded-lg border px-2 text-xs"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : null}
        <span className="text-muted-foreground ml-auto text-[11px]">
          {totalComments} comentario{totalComments === 1 ? '' : 's'} ·{' '}
          {filteredGroups.length} publicación{filteredGroups.length === 1 ? '' : 'es'}
        </span>
      </div>

      <Dialog open={templatesModalOpen} onOpenChange={setTemplatesModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mis plantillas</DialogTitle>
            <DialogDescription>
              Crea mensajes reutilizables para responder manualmente o configurar el envío
              automático.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {templates.length > 0 ? (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="border-border flex items-start gap-2 rounded-xl border bg-muted/30 p-3"
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
              <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
                Aún no tienes plantillas. Crea la primera abajo.
              </p>
            )}

            <div className="border-border space-y-2 border-t pt-4">
              <p className="text-sm font-semibold">Nueva plantilla</p>
              <Input
                value={newTplLabel}
                onChange={(e) => setNewTplLabel(e.target.value)}
                placeholder="Nombre corto (ej. Catálogo WhatsApp)"
              />
              <Textarea
                value={newTplText}
                onChange={(e) => setNewTplText(e.target.value)}
                placeholder="Texto del mensaje que se enviará…"
                rows={4}
                className="resize-none"
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

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6">
          <MessageCircle className="h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">
            {replyFilter === 'pending'
              ? 'Sin comentarios pendientes'
              : replyFilter === 'replied'
                ? 'No hay comentarios respondidos'
                : 'Bandeja al día'}
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="border-border overflow-y-auto border-b lg:border-r lg:border-b-0">
            <p className="text-muted-foreground border-border border-b px-3 py-2 text-[10px] font-bold tracking-wide uppercase">
              Publicaciones
            </p>
            <ul>
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
                        'hover:bg-muted/60 flex w-full gap-3 border-b px-3 py-3 text-left transition-colors',
                        active && 'bg-primary/8 border-l-primary border-l-2',
                      )}
                    >
                      <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                        {group.postImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={group.postImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <MessageCircle className="text-muted-foreground/30 h-5 w-5" />
                          </div>
                        )}
                        <span className="bg-card absolute right-1 bottom-1 rounded-full p-0.5 shadow-sm">
                          {group.provider === 'instagram' ? (
                            <Instagram className="h-3 w-3 text-pink-500" />
                          ) : (
                            <Facebook className="h-3 w-3 text-blue-600" />
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs leading-snug font-medium">
                          {group.postPreview?.trim() || 'Publicación sin texto'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={hasNew ? 'default' : 'secondary'}
                            className="h-5 text-[10px]"
                          >
                            {group.comments.length} comentario
                            {group.comments.length === 1 ? '' : 's'}
                          </Badge>
                          {pendingInGroup > 0 && pendingInGroup < group.comments.length ? (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              {pendingInGroup} pendiente{pendingInGroup === 1 ? '' : 's'}
                            </Badge>
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

          <div className="flex min-h-0 flex-col">
            {activeGroup && activeComment ? (
              <>
                <div className="border-border bg-panel flex items-center justify-between border-b px-4 py-3">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
                    Hilo de comentarios
                  </p>
                  {loadingThreads ? (
                    <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <ul className="space-y-4">
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
                            'rounded-2xl border transition-colors',
                            isActive
                              ? 'border-primary/30 bg-accent/30'
                              : 'border-transparent',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveCommentKey(key)}
                            className="hover:bg-muted/30 flex w-full gap-3 rounded-2xl px-3 py-3 text-left"
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
                            <ul className="border-border/60 ml-11 space-y-3 border-l pb-3 pl-4">
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
                                        <Badge className="h-5 bg-blue-600 px-1.5 text-[10px] text-white hover:bg-blue-600">
                                          Autor
                                        </Badge>
                                      ) : null}
                                      {reply.auto ? (
                                        <Badge variant="outline" className="h-5 text-[10px]">
                                          Auto
                                        </Badge>
                                      ) : null}
                                      <span className="text-muted-foreground text-[11px]">
                                        {reply.createdTime
                                          ? timeAgo(reply.createdTime)
                                          : ''}
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
                            <ul className="border-border/60 ml-11 space-y-3 border-l pb-3 pl-4">
                              <li className="flex gap-2.5">
                                <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase">
                                  {(connection.pageName || '?')[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-semibold">
                                      {connection.pageName}
                                    </span>
                                    <Badge className="h-5 bg-blue-600 px-1.5 text-[10px] text-white hover:bg-blue-600">
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

                <div className="border-border bg-panel space-y-3 border-t p-4">
                  <p className="text-muted-foreground text-xs">
                    Respondiendo a{' '}
                    <span className="text-foreground font-semibold">
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
                          className="bg-background hover:bg-muted rounded-full border px-2.5 py-1 text-[11px]"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Crea plantillas arriba para insertar respuestas con un clic.
                    </p>
                  )}

                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Comentar como la página…"
                    rows={3}
                    className="resize-none text-sm"
                  />

                  <div className="flex justify-end gap-2">
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
              </>
            ) : (
              <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                Selecciona una publicación
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
