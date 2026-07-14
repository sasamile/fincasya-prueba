'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import {
  Facebook,
  Instagram,
  Loader2,
  Plus,
  ChevronDown,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  startFacebookConnect,
  disconnectPage,
  retryWebhook,
  refreshPageData,
  type MetaConnection,
} from '@/features/admin/api/meta-channels.api';
import { CommentsInbox } from '@/features/admin/components/canales/comments-inbox';
import { DmInbox } from '@/features/admin/components/canales/dm-inbox';
import { SocialPostsPanel } from '@/features/admin/components/canales/social-posts-panel';
import { ComposeCrossPostDialog } from '@/features/admin/components/canales/compose-cross-post-dialog';
import {
  SocialCrmIconRail,
  SOCIAL_CRM_VIEW_LABELS,
  type SocialCrmView,
} from '@/features/admin/components/canales/social-crm-icon-rail';

const VALID_VIEWS: SocialCrmView[] = ['inbox', 'comments', 'posts'];

function parseView(tab: string | null): SocialCrmView {
  if (tab && VALID_VIEWS.includes(tab as SocialCrmView)) {
    return tab as SocialCrmView;
  }
  return 'inbox';
}

export default function SocialCrmApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const connections = useQuery(api.metaChannels.listConnections, {}) as
    | MetaConnection[]
    | undefined;

  const [view, setView] = useState<SocialCrmView>(() =>
    parseView(searchParams.get('tab')),
  );
  const [connecting, setConnecting] = useState(false);
  const [retryingWebhook, setRetryingWebhook] = useState(false);
  const [refreshingIg, setRefreshingIg] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const activeConnection =
    connections?.find((c) => c.pageId === activePageId) ?? connections?.[0] ?? null;

  useEffect(() => {
    setView(parseView(searchParams.get('tab')));
  }, [searchParams]);

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

  useEffect(() => {
    if (!activePageId && connections?.length) {
      setActivePageId(connections[0].pageId);
    }
  }, [connections, activePageId]);

  function changeView(next: SocialCrmView) {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/admin/canales?${params.toString()}`, { scroll: false });
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await startFacebookConnect();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo iniciar la conexión');
      setConnecting(false);
    }
  }

  async function handleRefreshIg(pageId: string) {
    setRefreshingIg(true);
    try {
      const res = await refreshPageData(pageId);
      if (res?.igUsername) toast.success(`Instagram @${res.igUsername} vinculado`);
      else toast.info('No se encontró Instagram vinculado a esta página.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al buscar Instagram');
    } finally {
      setRefreshingIg(false);
    }
  }

  async function handleRetryWebhook(pageId: string) {
    setRetryingWebhook(true);
    try {
      const res = await retryWebhook(pageId);
      if (res?.ok) toast.success('Webhook activado');
      else toast.error(res?.error ? `Webhook: ${res.error}` : 'Webhook fallido');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al reintentar');
    } finally {
      setRetryingWebhook(false);
    }
  }

  async function handleDisconnect(pageId: string, name: string) {
    if (!confirm(`¿Desconectar "${name}"?`)) return;
    try {
      await disconnectPage(pageId);
      toast.success('Página desconectada');
      setActivePageId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al desconectar');
    }
  }

  const isLoading = connections === undefined;

  return (
    <div className="bg-background flex h-full min-h-0">
      <SocialCrmIconRail
        activeView={view}
        onViewChange={changeView}
        onCompose={() => setComposeOpen(true)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="bg-card flex h-12 shrink-0 items-center justify-between gap-3 px-4 md:px-5">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">
              {SOCIAL_CRM_VIEW_LABELS[view]}
            </h1>
            <p className="text-muted-foreground truncate text-[11px]">
              {view === 'inbox'
                ? 'Messenger e Instagram Direct'
                : view === 'comments'
                  ? 'Comentarios de Facebook e Instagram'
                  : 'Publicaciones recientes'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {connections && connections.length > 0 && activeConnection ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-border/80 max-w-[220px] gap-2 border bg-transparent"
                  >
                    {activeConnection.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeConnection.pictureUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <Facebook className="h-4 w-4 text-blue-500" />
                    )}
                    <span className="truncate text-xs font-medium">
                      {activeConnection.pageName}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {connections.map((conn) => (
                    <DropdownMenuItem
                      key={conn.pageId}
                      onClick={() => setActivePageId(conn.pageId)}
                      className="gap-2"
                    >
                      <span className="truncate font-medium">{conn.pageName}</span>
                      {conn.pageId === activeConnection.pageId ? (
                        <span className="text-primary ml-auto text-[10px] font-bold">
                          Activa
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {!activeConnection.igUserId ? (
                    <DropdownMenuItem
                      disabled={refreshingIg}
                      onClick={() => handleRefreshIg(activeConnection.pageId)}
                    >
                      <Instagram className="h-4 w-4 text-pink-400" />
                      {refreshingIg ? 'Buscando…' : 'Vincular Instagram'}
                    </DropdownMenuItem>
                  ) : null}
                  {!activeConnection.webhookSubscribed ? (
                    <DropdownMenuItem
                      disabled={retryingWebhook}
                      onClick={() => handleRetryWebhook(activeConnection.pageId)}
                    >
                      Activar webhook
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      handleDisconnect(activeConnection.pageId, activeConnection.pageName)
                    }
                  >
                    <Unplug className="h-4 w-4" />
                    Desconectar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              onClick={handleConnect}
              disabled={connecting}
              className="gap-1.5"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Conectar
            </Button>
          </div>
        </header>
        <div className="bg-border/70 h-px w-full shrink-0" />

        {activeConnection?.lastError ? (
          <div className="border-amber-500/30 bg-amber-500/10 text-amber-200 shrink-0 border-b px-4 py-2 text-xs">
            {activeConnection.lastError}
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-7 w-7 animate-spin" />
            </div>
          ) : !connections?.length ? (
            <EmptyConnect onConnect={handleConnect} connecting={connecting} />
          ) : activeConnection ? (
            <>
              {view === 'inbox' ? (
                <DmInbox connection={activeConnection} embedded />
              ) : null}
              {view === 'comments' ? (
                <CommentsInbox connection={activeConnection} embedded />
              ) : null}
              {view === 'posts' ? (
                <SocialPostsPanel connection={activeConnection} embedded />
              ) : null}
            </>
          ) : null}
        </main>
      </div>

      {activeConnection ? (
        <ComposeCrossPostDialog
          connection={activeConnection}
          open={composeOpen}
          onOpenChange={setComposeOpen}
          onPublished={() => {
            if (view === 'posts') changeView('posts');
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyConnect({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15">
          <Facebook className="h-7 w-7 text-blue-400" />
        </span>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/15">
          <Instagram className="h-7 w-7 text-pink-400" />
        </span>
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-bold">CRM de redes sociales</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Conecta tu página de Facebook para responder mensajes, comentarios y
          publicar en Facebook e Instagram desde una sola bandeja.
        </p>
      </div>
      <Button size="lg" onClick={onConnect} disabled={connecting} className="gap-2">
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Facebook className="h-4 w-4" />
        )}
        Conectar con Facebook
      </Button>
    </div>
  );
}
