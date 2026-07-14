/**
 * FincasYa · Chats — inbox operadores (referencia CRM WhatsApp).
 * El shell (rail + sidebar + panel). Los componentes grandes viven en
 * `@/features/inbox/components/*` y los tipos en `@/features/inbox/types`.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Archive, Bot, ChevronRight, MoreVertical, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingArea } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getAutomationSettings } from '@/features/admin/api/automation-settings.api';
import { ChatHomeScreen } from '@/features/inbox/components/ChatHomeScreen';
import { TemplatesModal } from '@/features/inbox/components/TemplatesModal';
import { ConversationContextMenu } from '@/features/inbox/components/ConversationContextMenu';
import type { CtxTarget } from '@/features/inbox/components/ConversationContextMenu';
import { SidebarFilters } from '@/features/inbox/components/SidebarFilters';
import { BotToggle } from '@/features/inbox/components/primitives';
import { ConversationItem } from '@/features/inbox/components/ConversationItem';
import { IconRail, type AsesorTool } from '@/features/inbox/components/IconRail';
import { AsesorPanel } from '@/features/inbox/components/AsesorPanel';
import { ChatPanel } from '@/features/inbox/components/ChatPanel';
import type { ConversationRow, Filter } from '@/features/inbox/types';

export default function App() {
  // Scroll infinito: se cargan tandas de 60 y se pide más al llegar al fondo.
  const {
    results: conversations,
    status: convStatus,
    loadMore,
  } = usePaginatedQuery(api.inbox.listConversations, {}, { initialNumItems: 60 });
  const agentSettings = useQuery(api.agentSettings.getAgentSettings);
  const setGlobalAi = useMutation(api.agentSettings.setGlobalAiEnabled);
  const markRead = useMutation(api.inbox.markConversationRead);
  const setArchived = useMutation(api.inbox.setConversationArchived);
  const [selectedId, setSelectedId] = useState<ConversationRow['conversationId'] | null>(null);
  const [activeTool, setActiveTool] = useState<AsesorTool | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxTarget | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplatePhone, setPendingTemplatePhone] = useState<string | null>(
    null,
  );
  const labels = useQuery(api.labels.listLabels);

  const archived = useMemo(
    () => conversations.filter((c) => c.archived),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (showArchived) {
      return archived.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
        return true;
      });
    }

    const list = conversations.filter((c) => {
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
    // Fijadas primero; dentro de cada grupo se respeta el orden por último
    // mensaje (que ya trae el servidor). Con paginación este orden se aplica
    // sobre lo cargado.
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [conversations, search, filter, labelFilter, showArchived, archived]);

  const selected = conversations.find((c) => c.conversationId === selectedId) ?? null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showTemplates || pendingTemplatePhone) return; // el modal de plantillas maneja su propio Esc
      if (showArchived) { setShowArchived(false); return; }
      setSelectedId(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showArchived, showTemplates, pendingTemplatePhone]);

  function openConversation(conv: ConversationRow) {
    setSelectedId(conv.conversationId);
    if (conv.unread > 0) void markRead({ conversationId: conv.conversationId });
  }

  /** Abre el chat cuyo número coincida. Si no existe, ofrece iniciar con plantilla
   * (requiere mensajes/plantillas habilitados en Automatizaciones). */
  async function openChatByPhone(phone: string) {
    const d = phone.replace(/\D/g, '');
    if (d.length < 7) {
      toast.error('Número inválido.');
      return;
    }
    const match = conversations.find((c) => {
      const cd = c.phone.replace(/\D/g, '');
      return cd.endsWith(d.slice(-10)) || d.endsWith(cd.slice(-10));
    });
    if (match) {
      openConversation(match);
      return;
    }

    try {
      const settings = await getAutomationSettings();
      if (!settings.scheduledMessagingEnabled) {
        toast.error('No hay un chat con ese número', {
          description:
            'Para iniciar uno con plantilla, activa Automatizaciones cuando las plantillas estén listas.',
          action: {
            label: 'Automatizaciones',
            onClick: () => {
              window.open('/admin/automatizaciones', '_blank', 'noopener,noreferrer');
            },
          },
        });
        return;
      }
      setPendingTemplatePhone(phone);
    } catch {
      toast.error('No se pudo verificar Automatizaciones. Intenta de nuevo.');
    }
  }

  const globalBotHint = agentSettings?.globalAiEnabled
    ? 'Chats nuevos con bot. No se activa en chats con catálogo o proceso.'
    : 'Chats nuevos en humano. Actívalos desde cada conversación.';

  return (
    <div className="flex h-full bg-background">
      {/* Rail de herramientas del asesor (columna extrema izquierda).
          En móvil se oculta solo cuando el chat está a pantalla completa;
          con una herramienta abierta vuelve a verse para cambiar entre ellas. */}
      <IconRail
        activeTool={activeTool}
        onOpenTool={setActiveTool}
        hasSelection={Boolean(selected)}
        className={cn(selected && !activeTool && 'hidden md:flex')}
      />

      {/* Panel de herramienta del asesor (izquierda) o lista de chats.
          El chat de la conversación queda siempre visible a la derecha. */}
      {activeTool ? (
        <AsesorPanel
          tool={activeTool}
          conversation={selected}
          onClose={() => setActiveTool(null)}
          onOpenChat={(phone) => void openChatByPhone(phone)}
        />
      ) : (
      <aside
        className={cn(
          'flex min-w-0 flex-1 flex-col border-r border-border bg-card md:w-[380px] md:flex-none',
          selected && 'hidden md:flex',
        )}
      >
        {/* Cabecera con título y acciones */}
        <header className="flex items-center justify-between px-4 py-3">
          {showArchived ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowArchived(false)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                ← Chats
              </button>
              <span className="text-[11px] text-muted-foreground/60">/</span>
              <h1 className="text-[15px] font-semibold tracking-tight">Archivados</h1>
            </div>
          ) : (
            <>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-muted-foreground"
                  title="Plantillas de WhatsApp"
                  onClick={() => setShowTemplates(true)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </>
          )}
        </header>

        {/* Buscador */}
        <div className="px-3 pb-1.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={showArchived ? 'Buscar en archivados' : 'Buscar un chat o iniciar uno nuevo'}
              className="h-9 rounded-full border-transparent bg-input pl-11 text-[13px]"
            />
          </div>
        </div>

        {/* Filtros: solo en vista principal */}
        {!showArchived && (
          <SidebarFilters
            filter={filter}
            setFilter={setFilter}
            labelFilter={labelFilter}
            setLabelFilter={setLabelFilter}
            labels={labels}
          />
        )}

        <div
          className="flex-1 overflow-y-auto border-t border-border"
          onScroll={(e) => {
            const el = e.currentTarget;
            const nearBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 500;
            if (nearBottom && convStatus === 'CanLoadMore') loadMore(60);
          }}
        >
          {convStatus === 'LoadingFirstPage' ? (
            <LoadingArea className="py-16" />
          ) : (
            <>
              {/* Banner archivados (estilo WhatsApp) — solo en vista principal */}
              {!showArchived && archived.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium">Archivados</p>
                    <p className="text-[12px] text-muted-foreground">
                      {archived.length} {archived.length === 1 ? 'chat' : 'chats'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              {filtered.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  {showArchived ? 'No hay chats archivados' : 'Sin chats'}
                </p>
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

              {/* Pie del scroll infinito */}
              {convStatus === 'LoadingMore' ? (
                <LoadingArea className="py-4" />
              ) : convStatus === 'CanLoadMore' ? (
                <button
                  type="button"
                  onClick={() => loadMore(60)}
                  className="block w-full py-3 text-center text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cargar más conversaciones
                </button>
              ) : null}
            </>
          )}
        </div>
      </aside>
      )}

      {/* Conversación (siempre visible a la derecha; no la tapa el panel).
          En móvil ocupa toda la pantalla, el botón ← vuelve a la lista y el
          botón de herramientas abre el panel del asesor; mientras una
          herramienta está abierta, el chat se oculta (solo en móvil). */}
      {selected ? (
        <ChatPanel
          key={selected.conversationId}
          conv={selected}
          onBack={() => setSelectedId(null)}
          onOpenTool={setActiveTool}
          className={cn(activeTool && 'hidden md:flex')}
        />
      ) : (
        <ChatHomeScreen />
      )}

      {/* Centro de plantillas de WhatsApp (botón "+" o número sin chat) */}
      {(showTemplates || pendingTemplatePhone) && (
        <TemplatesModal
          conversation={pendingTemplatePhone ? null : selected}
          phoneTarget={
            pendingTemplatePhone ? { phone: pendingTemplatePhone } : null
          }
          onClose={() => {
            setShowTemplates(false);
            setPendingTemplatePhone(null);
          }}
          onStarted={(conversationId: Id<'conversations'>) => {
            setSelectedId(conversationId);
            setActiveTool(null);
          }}
        />
      )}

      {/* Menú de clic derecho sobre una conversación */}
      {ctxMenu && (
        <ConversationContextMenu
          target={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onDeleted={() => {
            if (selectedId === ctxMenu.conversationId) setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
