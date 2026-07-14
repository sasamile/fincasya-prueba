'use client';

/**
 * Centro de plantillas de WhatsApp (botón "+" del inbox): trae las plantillas
 * de la cuenta YCloud, permite crear nuevas (van a revisión de Meta) y enviar
 * una plantilla aprobada al chat seleccionado — o a un número sin chat previo
 * (crea la conversación al enviar).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { toast } from 'sonner';
import {
  FileStack,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationRow } from '@/features/inbox/types';

type Template = {
  name: string;
  language: string;
  category: string;
  status: string;
  qualityRating: string | null;
  reason: string | null;
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  buttons: string[];
  variablesCount: number;
};

function statusBadge(status: string): { label: string; className: string } {
  const s = status.toUpperCase();
  if (s === 'APPROVED') return { label: 'Aprobada', className: 'bg-emerald-500/15 text-emerald-500' };
  if (s === 'PENDING' || s === 'IN_APPEAL')
    return { label: 'En revisión', className: 'bg-amber-500/15 text-amber-500' };
  if (s === 'REJECTED') return { label: 'Rechazada', className: 'bg-red-500/15 text-red-500' };
  return { label: status, className: 'bg-muted text-muted-foreground' };
}

/** Sustituye {{1}}, {{2}}… por los valores dados (o los deja si faltan). */
function renderBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, n) => {
    const val = params[Number(n) - 1]?.trim();
    return val || match;
  });
}

export function TemplatesModal({
  conversation,
  phoneTarget,
  onClose,
  onStarted,
}: {
  conversation: ConversationRow | null;
  /** Número sin chat: al enviar se crea la conversación y luego la plantilla. */
  phoneTarget?: { phone: string; name?: string } | null;
  onClose: () => void;
  /** Tras iniciar chat por plantilla (número nuevo). */
  onStarted?: (conversationId: Id<'conversations'>) => void;
}) {
  const listTemplates = useAction(api.whatsappTemplates.listTemplates);
  const createTemplate = useAction(api.whatsappTemplates.createTemplate);
  const sendTemplate = useAction(api.whatsappTemplates.sendTemplate);
  const ensureConversation = useMutation(api.whatsappTemplates.ensureConversationByPhone);

  const [tab, setTab] = useState<'enviar' | 'crear'>('enviar');
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'MARKETING' | 'UTILITY'>('UTILITY');
  const [newBody, setNewBody] = useState('');
  const [newFooter, setNewFooter] = useState('');
  const [creating, setCreating] = useState(false);

  const canSend = Boolean(conversation || phoneTarget?.phone);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listTemplates({});
      setTemplates(res.items as Template[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron traer las plantillas');
    } finally {
      setLoading(false);
    }
  }, [listTemplates]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const rendered = useMemo(
    () => (selected ? renderBody(selected.bodyText, params) : ''),
    [selected, params],
  );

  const paramsComplete =
    !selected ||
    Array.from({ length: selected.variablesCount }, (_, i) => params[i]?.trim()).every(Boolean);

  async function handleSend() {
    if (!selected) return;
    setSending(true);
    try {
      let conversationId = conversation?.conversationId as
        | Id<'conversations'>
        | undefined;

      if (!conversationId) {
        if (!phoneTarget?.phone) {
          toast.error('Abre un chat o indica un número para enviar');
          return;
        }
        const ensured = await ensureConversation({
          phone: phoneTarget.phone,
          name: phoneTarget.name,
        });
        conversationId = ensured.conversationId;
      }

      await sendTemplate({
        conversationId,
        name: selected.name,
        language: selected.language,
        bodyParams: params.slice(0, selected.variablesCount),
        renderedText: rendered,
      });
      toast.success(`Plantilla "${selected.name}" enviada`);
      if (!conversation && conversationId) {
        onStarted?.(conversationId);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar la plantilla');
    } finally {
      setSending(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newBody.trim()) {
      toast.error('Nombre y cuerpo son obligatorios');
      return;
    }
    setCreating(true);
    try {
      const res = await createTemplate({
        name: newName,
        category: newCategory,
        bodyText: newBody,
        footerText: newFooter.trim() || undefined,
      });
      toast.success(`Plantilla "${res.name}" creada — queda en revisión de Meta`);
      setNewName('');
      setNewBody('');
      setNewFooter('');
      setTab('enviar');
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la plantilla');
    } finally {
      setCreating(false);
    }
  }

  const fl =
    'mb-1 block text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground';
  const input =
    'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

  const targetLabel = conversation
    ? conversation.name
    : phoneTarget?.name || phoneTarget?.phone || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileStack className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">Plantillas de WhatsApp</h2>
            <p className="truncate text-xs text-muted-foreground">
              {phoneTarget && !conversation
                ? `Iniciar chat con ${targetLabel} · plantilla`
                : targetLabel
                  ? `Enviar a ${targetLabel}`
                  : 'Abre un chat para poder enviar'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            title="Sincronizar con YCloud"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {phoneTarget && !conversation ? (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-800 dark:text-amber-200">
            Este número aún no tiene chat. Al enviar la plantilla se crea la
            conversación en el inbox.
          </div>
        ) : null}

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(
            [
              { id: 'enviar', label: 'Enviar plantilla' },
              { id: 'crear', label: 'Crear nueva' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition',
                tab === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'enviar' ? (
            <div className="space-y-2">
              {loading && templates === null ? (
                <div className="grid place-items-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : loadError ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                  {loadError}
                </p>
              ) : (templates ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                  La cuenta no tiene plantillas todavía. Crea la primera en la
                  pestaña “Crear nueva”.
                </p>
              ) : (
                (templates ?? []).map((t) => {
                  const badge = statusBadge(t.status);
                  const isSelected =
                    selected?.name === t.name && selected.language === t.language;
                  return (
                    <div
                      key={`${t.name}:${t.language}`}
                      className={cn(
                        'rounded-xl border transition',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(isSelected ? null : t);
                          setParams([]);
                        }}
                        className="w-full p-3 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                            {t.name}
                            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                              {t.language} · {t.category.toLowerCase()}
                            </span>
                          </p>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12px] text-muted-foreground">
                          {t.bodyText}
                        </p>
                      </button>

                      {isSelected && (
                        <div className="space-y-2 border-t border-border/60 p-3">
                          {t.status.toUpperCase() !== 'APPROVED' && (
                            <p className="text-[11px] text-amber-600">
                              Solo las plantillas aprobadas por Meta se pueden
                              enviar.
                              {t.reason ? ` Motivo del rechazo: ${t.reason}` : ''}
                            </p>
                          )}
                          {Array.from({ length: t.variablesCount }, (_, i) => (
                            <div key={i}>
                              <label className={fl}>{`Variable {{${i + 1}}}`}</label>
                              <input
                                value={params[i] ?? ''}
                                onChange={(e) => {
                                  const next = [...params];
                                  next[i] = e.target.value;
                                  setParams(next);
                                }}
                                placeholder={`Valor para {{${i + 1}}}`}
                                className={input}
                              />
                            </div>
                          ))}
                          <div className="rounded-xl bg-muted/40 p-2.5 text-[12.5px] whitespace-pre-wrap">
                            {rendered}
                          </div>
                          <button
                            type="button"
                            disabled={
                              !canSend ||
                              sending ||
                              !paramsComplete ||
                              t.status.toUpperCase() !== 'APPROVED'
                            }
                            onClick={() => void handleSend()}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {sending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            {canSend
                              ? phoneTarget && !conversation
                                ? `Iniciar chat · enviar a ${targetLabel}`
                                : `Enviar a ${targetLabel}`
                              : 'Abre un chat para enviar'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={fl}>Nombre</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej. confirmacion_reserva"
                  className={input}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Minúsculas, números y guión bajo (los espacios se convierten).
                </p>
              </div>
              <div>
                <label className={fl}>Categoría</label>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'UTILITY', label: 'Utilidad (transaccional)' },
                      { id: 'MARKETING', label: 'Marketing' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewCategory(c.id)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                        newCategory === c.id
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={fl}>Cuerpo del mensaje</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  placeholder={'Hola {{1}}, tu reserva {{2}} está confirmada'}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {'Usa {{1}}, {{2}}… para las variables que llenas al enviar.'}
                </p>
              </div>
              <div>
                <label className={fl}>Pie (opcional)</label>
                <input
                  value={newFooter}
                  onChange={(e) => setNewFooter(e.target.value)}
                  placeholder="FincasYa.com — Los expertos en alquiler"
                  className={input}
                />
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreate()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Crear plantilla (va a revisión de Meta)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
