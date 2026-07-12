/**
 * Listas/etiquetas (estilo WhatsApp Business). Control del header de la
 * conversación: asignar/quitar listas, crear y editar (nombre + color
 * recomendado + emoji). Los puntos de color se muestran en el sidebar.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Check, ChevronDown, Pencil, Plus, Settings2, Tag, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Label = { id: Id<'labels'>; name: string; color: string; emoji: string | null };

/** Colores recomendados para las listas. */
const PALETTE = [
  '#21c063', '#009de2', '#ec6a9c', '#e0a24e', '#9d8bf0',
  '#e8776f', '#5ec2d4', '#57c76a', '#c58af0', '#8696a0',
];
const QUICK_EMOJIS = ['⭐', '💰', '🔥', '✅', '📌', '🏡', '🐕', '⏳', '💬', '🎉', '❤️', '⚠️'];

export function LabelPicker({
  conversationId,
  assigned,
}: {
  conversationId: Id<'conversations'>;
  assigned: Array<{ id: Id<'labels'>; color: string }>;
}) {
  const labels = useQuery(api.labels.listLabels);
  const toggle = useMutation(api.labels.toggleConversationLabel);
  const create = useMutation(api.labels.createLabel);
  const update = useMutation(api.labels.updateLabel);
  const remove = useMutation(api.labels.deleteLabel);

  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [editor, setEditor] = useState<null | { id?: Id<'labels'>; name: string; color: string; emoji: string }>(null);
  const ref = useRef<HTMLDivElement>(null);

  const assignedIds = new Set(assigned.map((l) => String(l.id)));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setManage(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function openCreate() {
    setEditor({ name: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)]!, emoji: '' });
  }

  async function saveEditor() {
    if (!editor) return;
    if (!editor.name.trim()) return;
    if (editor.id) await update({ id: editor.id, name: editor.name, color: editor.color, emoji: editor.emoji || undefined });
    else await create({ name: editor.name, color: editor.color, emoji: editor.emoji || undefined });
    setEditor(null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
        title="Listas"
      >
        {assigned.length > 0 ? (
          <span className="flex -space-x-1">
            {assigned.slice(0, 3).map((l, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full ring-2 ring-[var(--panel-header)]"
                style={{ backgroundColor: l.color }}
              />
            ))}
          </span>
        ) : (
          <Tag className="h-4 w-4" />
        )}
        <span>{assigned.length > 0 ? `${assigned.length} en lista` : 'Añadir a la lista'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl">
          {labels === undefined ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">Cargando…</p>
          ) : labels.length === 0 && !manage ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">Aún no tienes listas.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {labels.map((l: Label) => (
                <div key={l.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60">
                  <button
                    type="button"
                    onClick={() => void toggle({ conversationId, labelId: l.id })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="truncate text-[14px]">
                      {l.emoji ? `${l.emoji} ` : ''}
                      {l.name}
                    </span>
                    <span
                      className={cn(
                        'ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        assignedIds.has(String(l.id))
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40',
                      )}
                    >
                      {assignedIds.has(String(l.id)) && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                  {manage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditor({ id: l.id, name: l.name, color: l.color, emoji: l.emoji ?? '' })}
                        className="text-muted-foreground hover:text-foreground"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove({ id: l.id })}
                        className="text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="my-1 border-t border-border/70" />
          <button
            type="button"
            onClick={openCreate}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[14px] transition-colors hover:bg-muted/60"
          >
            <Plus className="h-4 w-4" /> Nueva lista
          </button>
          <button
            type="button"
            onClick={() => setManage((m) => !m)}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[14px] transition-colors hover:bg-muted/60"
          >
            <Settings2 className="h-4 w-4" /> {manage ? 'Listo' : 'Administrar listas'}
          </button>
        </div>
      )}

      {/* Modal crear/editar lista */}
      {editor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditor(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <button type="button" onClick={() => setEditor(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-[16px] font-medium">{editor.id ? 'Editar lista' : 'Crea una nueva lista'}</h3>
            </div>

            {/* Nombre con vista previa del color/emoji */}
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
                title="Sin emoji"
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
                {editor.id ? 'Guardar' : 'Crear lista'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
