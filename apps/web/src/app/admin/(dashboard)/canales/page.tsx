'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import {
  Facebook,
  Instagram,
  Loader2,
  Plus,
  RefreshCw,
  MessageCircle,
  Heart,
  Share2,
  ExternalLink,
  Radio,
  Unplug,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  startFacebookConnect,
  disconnectPage,
  listPosts,
  type ChannelProvider,
  type MetaConnection,
  type MetaPost,
} from '@/features/admin/api/meta-channels.api';
import { CommentsSheet } from '@/features/admin/components/canales/comments-sheet';
import { MetaSetupGuide } from '@/features/admin/components/canales/setup-guide';

type Channel = {
  key: string;
  pageId: string;
  provider: ChannelProvider;
  name: string;
  handle?: string;
  pictureUrl?: string;
  webhookSubscribed: boolean;
  lastError?: string;
};

/** Deriva canales seleccionables (FB Page + IG account) de las conexiones. */
function toChannels(connections: MetaConnection[]): Channel[] {
  const out: Channel[] = [];
  for (const c of connections) {
    out.push({
      key: `fb:${c.pageId}`,
      pageId: c.pageId,
      provider: 'facebook',
      name: c.pageName,
      handle: c.category,
      pictureUrl: c.pictureUrl,
      webhookSubscribed: c.webhookSubscribed,
      lastError: c.lastError,
    });
    if (c.igUserId) {
      out.push({
        key: `ig:${c.pageId}`,
        pageId: c.pageId,
        provider: 'instagram',
        name: c.igUsername ? `@${c.igUsername}` : 'Instagram',
        handle: c.pageName,
        pictureUrl: c.igPictureUrl,
        webhookSubscribed: c.webhookSubscribed,
      });
    }
  }
  return out;
}

export default function CanalesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const connections = useQuery(api.metaChannels.listConnections, {}) as
    | MetaConnection[]
    | undefined;

  const [connecting, setConnecting] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [posts, setPosts] = useState<MetaPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<MetaPost | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const channels = useMemo(
    () => (connections ? toChannels(connections) : []),
    [connections],
  );
  const activeChannel = channels.find((c) => c.key === activeKey) ?? null;

  // Feedback del callback de OAuth (?success / ?error).
  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    if (error) {
      toast.error(`No se pudo conectar: ${error}`);
      router.replace('/admin/canales');
    } else if (success) {
      const n = searchParams.get('connected');
      toast.success(
        n && Number(n) > 0
          ? `Conectado: ${n} página(s)`
          : 'Cuenta conectada, pero sin páginas administrables',
      );
      router.replace('/admin/canales');
    }
  }, [searchParams, router]);

  // Selecciona el primer canal cuando cargan las conexiones.
  useEffect(() => {
    if (!activeKey && channels.length > 0) setActiveKey(channels[0].key);
  }, [channels, activeKey]);

  const loadPosts = useCallback(async () => {
    if (!activeChannel) return;
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const res = await listPosts(activeChannel.pageId, activeChannel.provider);
      setPosts(res.posts ?? []);
      if (res.error) setPostsError(res.error);
    } catch (e) {
      setPostsError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoadingPosts(false);
    }
  }, [activeChannel]);

  useEffect(() => {
    if (activeChannel) void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await startFacebookConnect();
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo iniciar la conexión',
      );
      setConnecting(false);
    }
  }

  async function handleDisconnect(pageId: string, name: string) {
    if (!confirm(`¿Desconectar "${name}"? Se quitará el acceso a sus datos.`))
      return;
    try {
      await disconnectPage(pageId);
      toast.success('Página desconectada');
      setActiveKey(null);
      setPosts([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al desconectar');
    }
  }

  const isLoading = connections === undefined;
  const hasChannels = channels.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Canales</h1>
          <p className="text-muted-foreground text-sm">
            Conecta Facebook e Instagram para ver y responder tus publicaciones y
            comentarios desde aquí.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Conectar con Facebook
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : !hasChannels ? (
        /* Estado vacío + guía */
        <Card className="space-y-5 p-6">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/40">
                <Facebook className="h-6 w-6" />
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-950/40">
                <Instagram className="h-6 w-6" />
              </span>
            </div>
            <h2 className="text-lg font-semibold">Aún no hay canales conectados</h2>
            <p className="text-muted-foreground max-w-md text-sm">
              Conecta una página de Facebook (y su cuenta de Instagram vinculada)
              para traer tus publicaciones y comentarios. Necesitas ser
              administrador de la página.
            </p>
            <Button onClick={handleConnect} disabled={connecting} className="mt-1">
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Facebook className="h-4 w-4" />
              )}
              Conectar con Facebook
            </Button>
          </div>
          <div className="border-t pt-4">
            <MetaSetupGuide />
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Lista de canales */}
          <div className="space-y-2">
            <p className="text-muted-foreground px-1 text-[11px] font-bold uppercase tracking-widest">
              Canales conectados
            </p>
            {channels.map((ch) => {
              const isActive = ch.key === activeKey;
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setActiveKey(ch.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent/50',
                  )}
                >
                  <div className="relative shrink-0">
                    {ch.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ch.pictureUrl}
                        alt={ch.name}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
                        {ch.provider === 'instagram' ? (
                          <Instagram className="h-4 w-4 text-pink-600" />
                        ) : (
                          <Facebook className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    )}
                    <span className="bg-background absolute -right-1 -bottom-1 rounded-full p-0.5">
                      {ch.provider === 'instagram' ? (
                        <Instagram className="h-3 w-3 text-pink-600" />
                      ) : (
                        <Facebook className="h-3 w-3 text-blue-600" />
                      )}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{ch.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {ch.handle}
                    </p>
                  </div>
                </button>
              );
            })}

            <div className="pt-2">
              <MetaSetupGuide />
            </div>
          </div>

          {/* Panel de publicaciones */}
          <div className="min-w-0 space-y-4">
            {activeChannel && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{activeChannel.name}</h2>
                  {activeChannel.webhookSubscribed ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-green-700 dark:text-green-400"
                    >
                      <Radio className="h-3 w-3" /> Tiempo real activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Webhook pendiente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPosts}
                    disabled={loadingPosts}
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', loadingPosts && 'animate-spin')}
                    />
                    Actualizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() =>
                      handleDisconnect(activeChannel.pageId, activeChannel.name)
                    }
                  >
                    <Unplug className="h-4 w-4" /> Desconectar
                  </Button>
                </div>
              </div>
            )}

            {activeChannel?.lastError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                {activeChannel.lastError}
              </div>
            )}

            {loadingPosts ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : postsError ? (
              <Card className="space-y-2 p-6 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
                <p className="text-sm font-medium">No se pudieron cargar las publicaciones</p>
                <p className="text-muted-foreground text-xs">{postsError}</p>
              </Card>
            ) : posts.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No hay publicaciones para mostrar.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    provider={activeChannel!.provider}
                    onOpenComments={() => {
                      setSelectedPost(post);
                      setCommentsOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeChannel && (
        <CommentsSheet
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          pageId={activeChannel.pageId}
          provider={activeChannel.provider}
          post={selectedPost}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  provider,
  onOpenComments,
}: {
  post: MetaPost;
  provider: ChannelProvider;
  onOpenComments: () => void;
}) {
  function timeAgo(iso?: string) {
    if (!iso) return '';
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  }
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="bg-muted flex aspect-video w-full items-center justify-center">
          {provider === 'instagram' ? (
            <Instagram className="text-muted-foreground/40 h-8 w-8" />
          ) : (
            <Facebook className="text-muted-foreground/40 h-8 w-8" />
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="line-clamp-3 flex-1 text-sm">
          {post.message || (
            <span className="text-muted-foreground italic">Sin texto</span>
          )}
        </p>
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          {typeof post.likeCount === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {post.likeCount}
            </span>
          )}
          {typeof post.commentCount === 'number' && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {post.commentCount}
            </span>
          )}
          {typeof post.shareCount === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" /> {post.shareCount}
            </span>
          )}
          <span className="ml-auto">{timeAgo(post.createdTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onOpenComments}
          >
            <MessageCircle className="h-4 w-4" /> Comentarios
          </Button>
          {post.permalink && (
            <Button variant="ghost" size="icon" asChild>
              <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
