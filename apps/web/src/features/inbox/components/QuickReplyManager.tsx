/**
 * Administrador de "Respuestas rápidas" (réplica de WhatsApp). Crear/editar
 * atajos "/gracias", "/horario"… (en un modal centrado), buscarlos y borrarlos.
 * Se usan escribiendo "/" en el compositor.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Pencil, Plus, Search, Trash2, X, Zap } from 'lucide-react';
import { LoadingArea } from '@/components/ui/spinner';

type Reply = { id: Id<'quickReplies'>; shortcut: string; message: string };

export function QuickReplyManager({ onClose }: { onClose: () => void }) {
  const replies = useQuery(api.quickReplies.listQuickReplies);
  const create = useMutation(api.quickReplies.createQuickReply);
  const update = useMutation(api.quickReplies.updateQuickReply);
  const remove = useMutation(api.quickReplies.deleteQuickReply);

  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<'quickReplies'> | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return replies ?? [];
    return (replies ?? []).filter(
      (r) => r.shortcut.toLowerCase().includes(q) || r.message.toLowerCase().includes(q),
    );
  }, [replies, search]);

  function openCreate() {
    setEditingId(null);
    setShortcut('');
    setMessage('');
    setError(null);
    setEditorOpen(true);
  }

  function openEdit(r: Reply) {
    setEditingId(r.id);
    setShortcut(r.shortcut);
    setMessage(r.message);
    setError(null);
    setEditorOpen(true);
  }

  async function handleSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      if (editingId) await update({ id: editingId, shortcut, message });
      else await create({ shortcut, message });
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-card">
      <header className="flex items-center gap-4 px-4 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-[17px] font-medium">Respuestas rápidas</h2>
        <button
          type="button"
          onClick={openCreate}
          className="text-muted-foreground transition-colors hover:text-foreground"
          title="Añadir"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* Buscador */}
      <div className="px-4 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar respuesta rápida"
            className="h-9 w-full rounded-full border border-transparent bg-input pl-11 pr-3 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {replies === undefined ? (
          <LoadingArea />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted-foreground">
            <Zap className="h-8 w-8" />
            <p className="text-[14px]">
              {search.trim()
                ? 'Sin resultados.'
                : 'Crea accesos directos con los mensajes que envías seguido. Para usarlos escribe “/” en el chat.'}
            </p>
          </div>
        ) : (
          filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openEdit(r)}
              className="group flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">/{r.shortcut}</p>
                <p className="truncate text-[13px] text-muted-foreground">{r.message}</p>
              </div>
              <Pencil className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  void remove({ id: r.id });
                }}
                className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </span>
            </button>
          ))
        )}
      </div>

      {/* Modal de alta/edición (centrado, como WhatsApp) */}
      {editorOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditorOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-[16px] font-medium">
                {editingId ? 'Editar respuesta rápida' : 'Añade una respuesta rápida'}
              </h3>
            </div>

            <input
              autoFocus
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Acceso directo (ej. gracias)"
              className="mb-3 h-11 w-full rounded-lg border border-border bg-input px-3 text-[15px] outline-none focus-visible:border-primary/70"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensaje de respuesta"
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2.5 text-[15px] outline-none focus-visible:border-primary/70"
            />
            {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-full px-5 py-2 text-[14px] font-medium text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!shortcut.trim() || !message.trim() || saving}
                className="rounded-full bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
