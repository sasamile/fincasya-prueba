'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Send, Heart, CornerDownRight, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  listComments,
  replyToComment,
  type ChannelProvider,
  type MetaComment,
  type MetaPost,
} from '@/features/admin/api/meta-channels.api';

export function CommentsSheet({
  open,
  onOpenChange,
  pageId,
  provider,
  post,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pageId: string;
  provider: ChannelProvider;
  post: MetaPost | null;
}) {
  const [comments, setComments] = useState<MetaComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!post) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listComments(pageId, provider, post.id);
      setComments(res.comments ?? []);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar comentarios');
    } finally {
      setLoading(false);
    }
  }, [pageId, provider, post]);

  useEffect(() => {
    if (open && post) {
      setComments([]);
      setReplyOpen(null);
      setReplyText('');
      void load();
    }
  }, [open, post, load]);

  async function handleReply(commentId: string) {
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await replyToComment(pageId, provider, commentId, text);
      if (res.ok) {
        toast.success('Respuesta publicada');
        setReplyOpen(null);
        setReplyText('');
        void load();
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-base">Comentarios</SheetTitle>
          <SheetDescription className="line-clamp-2 text-xs">
            {post?.message || 'Publicación sin texto'}
          </SheetDescription>
          {post?.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
            >
              Ver en {provider === 'instagram' ? 'Instagram' : 'Facebook'}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Sin comentarios todavía.
            </p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase">
                      {(c.fromName || '?')[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {c.fromName || 'Usuario'}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {timeAgo(c.createdTime)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                      <div className="text-muted-foreground mt-1 flex items-center gap-3 text-[11px]">
                        {typeof c.likeCount === 'number' && (
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3" /> {c.likeCount}
                          </span>
                        )}
                        {typeof c.replyCount === 'number' && c.replyCount > 0 && (
                          <span>{c.replyCount} respuestas</span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setReplyOpen(replyOpen === c.id ? null : c.id)
                          }
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          <CornerDownRight className="h-3 w-3" /> Responder
                        </button>
                      </div>

                      {replyOpen === c.id && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Escribe una respuesta…"
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setReplyOpen(null);
                                setReplyText('');
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              disabled={sending || !replyText.trim()}
                              onClick={() => handleReply(c.id)}
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
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
