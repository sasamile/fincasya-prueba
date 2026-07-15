/**
 * Filtros del sidebar (estilo WhatsApp Web): chips principales + un dropdown
 * "▾" con las listas para filtrar por etiqueta, canales y "Nueva lista".
 * Sin scroll horizontal.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { ChevronDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Filter } from '@/features/inbox/types';

type Label = { id: Id<'labels'>; name: string; color: string; emoji: string | null };

const PRIMARY: Array<{ id: Filter; label: string }> = [
  { id: 'todas', label: 'Todos' },
  { id: 'unread', label: 'No leídos' },
  { id: 'ai', label: 'Bot' },
  { id: 'human', label: 'Humano' },
];
const PALETTE = [
  '#21c063', '#009de2', '#ec6a9c', '#e0a24e', '#9d8bf0',
  '#e8776f', '#5ec2d4', '#57c76a', '#c58af0', '#8696a0',
];
const QUICK_EMOJIS = ['⭐', '💰', '🔥', '✅', '📌', '🏡', '🐕', '⏳', '💬', '🎉', '❤️', '⚠️'];

export function SidebarFilters({
  filter,
  setFilter,
  labelFilter,
  setLabelFilter,
  labels,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  labelFilter: string | null;
  setLabelFilter: (id: string | null) => void;
  labels: Label[] | undefined;
}) {
  const createLabel = useMutation(api.labels.createLabel);
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<null | { name: string; color: string; emoji: string }>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeLabel = labels?.find((l) => String(l.id) === labelFilter) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function saveEditor() {
    if (!editor?.name.trim()) return;
    await createLabel({ name: editor.name, color: editor.color, emoji: editor.emoji || undefined });
    setEditor(null);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2 px-3 pb-2.5">
      {PRIMARY.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            setFilter(c.id);
            setLabelFilter(null);
          }}
          data-active={!labelFilter && filter === c.id}
          className="wa-chip shrink-0 px-3 py-1 text-[13px] font-medium"
        >
          {c.label}
        </button>
      ))}

      {/* Chip de lista activa */}
      {activeLabel && (
        <button
          type="button"
          onClick={() => setLabelFilter(null)}
          className="flex min-w-0 max-w-30 shrink items-center gap-1.5 truncate rounded-full px-3 py-1 text-[13px] font-medium"
          style={{ backgroundColor: `${activeLabel.color}33`, color: activeLabel.color }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeLabel.color }} />
          <span className="truncate">
            {activeLabel.emoji ? `${activeLabel.emoji} ` : ''}
            {activeLabel.name}
          </span>
          <X className="h-3 w-3 shrink-0" />
        </button>
      )}

      {/* Botón dropdown — resalta si Escalados (u otro filtro del menú) está activo */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-active={
          !labelFilter &&
          (filter === 'escalated' ||
            filter === 'whatsapp' ||
            filter === 'web' ||
            filter === 'nuevas')
        }
        className="wa-chip ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        title="Más filtros y listas"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-3 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl">
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Estado
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('escalated');
              setLabelFilter(null);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center px-3 py-1.5 text-left text-[14px] hover:bg-muted/60',
              !labelFilter && filter === 'escalated' && 'bg-muted/40 font-medium',
            )}
          >
            Escalados
            <span className="ml-auto text-[11px] text-muted-foreground">bot → humano</span>
          </button>

          <div className="my-1 border-t border-border/70" />
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Canales
          </p>
          {(['whatsapp', 'web', 'nuevas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setLabelFilter(null);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-left text-[14px] hover:bg-muted/60',
                !labelFilter && filter === f && 'bg-muted/40 font-medium',
              )}
            >
              {f === 'whatsapp' ? 'WhatsApp' : f === 'web' ? 'Web' : 'Favoritos'}
            </button>
          ))}

          {labels && labels.length > 0 && (
            <>
              <div className="my-1 border-t border-border/70" />
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Listas
              </p>
              {labels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLabelFilter(String(l.id));
                    setFilter('todas');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[14px] hover:bg-muted/60"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="truncate">
                    {l.emoji ? `${l.emoji} ` : ''}
                    {l.name}
                  </span>
                </button>
              ))}
            </>
          )}

          <div className="my-1 border-t border-border/70" />
          <button
            type="button"
            onClick={() => {
              setEditor({ name: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)]!, emoji: '' });
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] hover:bg-muted/60"
          >
            <Plus className="h-4 w-4" /> Nueva lista
          </button>
        </div>
      )}

      {/* Modal crear lista */}
      {editor && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditor(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <button type="button" onClick={() => setEditor(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-[16px] font-medium">Crea una nueva lista</h3>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-input px-3">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: editor.color }} />
              <input
                autoFocus
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="Nombre de la lista"
                className="h-11 flex-1 bg-transparent text-[15px] outline-none"
              />
              {editor.emoji ? <span className="text-[18px]">{editor.emoji}</span> : null}
            </div>
            <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Color</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditor({ ...editor, color: c })}
                  className={cn(
                    'h-7 w-7 rounded-full transition-transform',
                    editor.color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Emoji (opcional)</p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEditor({ ...editor, emoji: '' })}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md border text-[12px]',
                  !editor.emoji ? 'border-primary text-primary' : 'border-border text-muted-foreground',
                )}
              >
                —
              </button>
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEditor({ ...editor, emoji: e })}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md border text-[18px]',
                    editor.emoji === e ? 'border-primary' : 'border-border hover:bg-muted',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditor(null)} className="rounded-full px-5 py-2 text-[14px] font-medium text-primary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEditor()}
                disabled={!editor.name.trim()}
                className="rounded-full bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground disabled:opacity-40"
              >
                Crear lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
