'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BarChart3,
  Bookmark,
  Eye,
  Facebook,
  Heart,
  Instagram,
  Loader2,
  MessageCircle,
  RefreshCw,
  Share2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  listPosts,
  type MetaConnection,
  type MetaPost,
} from '@/features/admin/api/meta-channels.api';

function formatMetric(value?: number) {
  if (value === undefined || value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function metricValue(post: MetaPost, key: keyof NonNullable<MetaPost['insights']>) {
  const fromInsights = post.insights?.[key];
  if (typeof fromInsights === 'number') return fromInsights;
  if (key === 'likes') return post.likeCount;
  if (key === 'comments') return post.commentCount;
  if (key === 'shares') return post.shareCount;
  return undefined;
}

function PostMetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: number;
}) {
  return (
    <div className="border-border bg-muted/40 flex flex-col gap-1 rounded-xl border px-3 py-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{formatMetric(value)}</p>
    </div>
  );
}

function PostInsightsModal({
  post,
  provider,
  open,
  onOpenChange,
}: {
  post: MetaPost | null;
  provider: 'facebook' | 'instagram';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!post) return null;

  const views = metricValue(post, 'views') ?? post.insights?.impressions;
  const reach = metricValue(post, 'reach');
  const likes = metricValue(post, 'likes');
  const comments = metricValue(post, 'comments');
  const shares = metricValue(post, 'shares');
  const saved = metricValue(post, 'saved');
  const interactions =
    post.insights?.totalInteractions ??
    (typeof likes === 'number' && typeof comments === 'number' && typeof shares === 'number'
      ? likes + comments + shares
      : undefined);
  const engaged = post.insights?.engagedUsers;
  const hasInsights = post.insights?.insightsAvailable !== false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="text-primary h-4 w-4" />
            Impulso de la publicación
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              {post.mediaType ? (
                <Badge variant="outline" className="text-[10px]">
                  {post.mediaType}
                </Badge>
              ) : null}
              {post.createdTime ? (
                <span className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(post.createdTime), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <PostMetricCard icon={Eye} label="Vistas" value={views} />
            <PostMetricCard icon={Users} label="Alcance" value={reach} />
            <PostMetricCard icon={Heart} label="Me gusta" value={likes} />
            <PostMetricCard icon={MessageCircle} label="Comentarios" value={comments} />
            <PostMetricCard icon={Share2} label="Compartidos" value={shares} />
            {provider === 'instagram' ? (
              <PostMetricCard icon={Bookmark} label="Guardados" value={saved} />
            ) : (
              <PostMetricCard icon={TrendingUp} label="Personas activas" value={engaged} />
            )}
            {typeof interactions === 'number' ? (
              <div className="col-span-2">
                <PostMetricCard
                  icon={TrendingUp}
                  label="Interacciones totales"
                  value={interactions}
                />
              </div>
            ) : null}
          </div>

          {!hasInsights && post.insights?.insightsError ? (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Métricas detalladas no disponibles. Se muestran los contadores básicos.
              Reconecta la página para pedir permisos de insights.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Datos de Meta (pueden tardar hasta 48 h en actualizarse).
            </p>
          )}

          {post.permalink ? (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex text-sm font-medium hover:underline"
            >
              Ver en {provider === 'instagram' ? 'Instagram' : 'Facebook'}
            </a>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SocialPostsPanel({
  connection,
  embedded = false,
}: {
  connection: MetaConnection;
  embedded?: boolean;
}) {
  const [provider, setProvider] = useState<'facebook' | 'instagram'>('facebook');
  const [posts, setPosts] = useState<MetaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsPost, setInsightsPost] = useState<MetaPost | null>(null);
  const canShowIg = !!connection.igUserId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPosts(connection.pageId, provider);
      setPosts(res.posts ?? []);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [connection.pageId, provider]);

  useEffect(() => {
    void load();
    setInsightsPost(null);
  }, [load]);

  return (
    <div className={cn('flex flex-col', embedded ? 'h-full min-h-0' : 'space-y-4')}>
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b bg-panel px-4 py-3">
        <div className="bg-muted flex rounded-xl p-1">
          <button
            type="button"
            onClick={() => setProvider('facebook')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              provider === 'facebook'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            <Facebook className="h-3.5 w-3.5" /> Facebook
          </button>
          {canShowIg ? (
            <button
              type="button"
              onClick={() => setProvider('instagram')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                provider === 'instagram'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              <Instagram className="h-3.5 w-3.5" /> Instagram
            </button>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto p-4', embedded && 'bg-background')}>
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
            Sin publicaciones recientes.
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const likes = metricValue(post, 'likes');
              const comments = metricValue(post, 'comments');

              return (
                <article
                  key={post.id}
                  className="border-border bg-card group overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => setInsightsPost(post)}
                    className="block w-full text-left"
                  >
                    <div className="bg-muted relative aspect-4/5 overflow-hidden">
                      {post.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.imageUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <MessageCircle className="text-muted-foreground/25 h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent p-3 pt-16">
                        {post.message ? (
                          <p className="line-clamp-3 text-xs leading-relaxed text-white">
                            {post.message}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/90">
                          {typeof likes === 'number' ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Heart className="h-3 w-3" /> {formatMetric(likes)}
                            </span>
                          ) : null}
                          {typeof comments === 'number' ? (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageCircle className="h-3 w-3" /> {formatMetric(comments)}
                            </span>
                          ) : null}
                          {post.createdTime ? (
                            <span className="ml-auto text-white/70">
                              {formatDistanceToNow(new Date(post.createdTime), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <span className="bg-primary/90 absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                      <BarChart3 className="h-3 w-3" />
                      Métricas
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <PostInsightsModal
        post={insightsPost}
        provider={provider}
        open={insightsPost !== null}
        onOpenChange={(open) => {
          if (!open) setInsightsPost(null);
        }}
      />
    </div>
  );
}
