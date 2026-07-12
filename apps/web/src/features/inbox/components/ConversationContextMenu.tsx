/**
 * Menú de clic derecho sobre una conversación del sidebar (estilo WhatsApp):
 * Fijar, Marcar como no leído, Cambiar de lista y Archivar. Solo acciones que
 * tienen efecto real en el CRM.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Archive, Check, ListChecks, Mail, Pin, PinOff } from 'lucide-react';

export type CtxTarget = {
  conversationId: Id<'conversations'>;
  pinned: boolean;
  archived: boolean;
  labelIds: string[];
  x: number;
  y: number;
};

export function ConversationContextMenu({
  target,
  onClose,
}: {
  target: CtxTarget;
  onClose: () => void;
}) {
  const setPinned = useMutation(api.inbox.setConversationPinned);
  const setArchived = useMutation(api.inbox.setConversationArchived);
  const markUnread = useMutation(api.inbox.markConversationUnread);
  const toggleLabel = useMutation(api.labels.toggleConversationLabel);
  const labels = useQuery(api.labels.listLabels);
  const [showLists, setShowLists] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  // No dejar que el menú se salga por abajo/derecha de la pantalla.
  const x = Math.min(target.x, window.innerWidth - 240);
  const y = Math.min(target.y, window.innerHeight - 240);
  const assigned = new Set(target.labelIds);

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-[70] w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl"
    >
      {showLists ? (
        <>
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Cambiar de lista
          </p>
          {labels === undefined ? (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">Cargando…</p>
          ) : labels.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">Aún no tienes listas.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {labels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => void toggleLabel({ conversationId: target.conversationId, labelId: l.id })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-muted"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="flex-1 truncate">
                    {l.emoji ? `${l.emoji} ` : ''}
                    {l.name}
                  </span>
                  {assigned.has(String(l.id)) && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <MenuItem
            icon={target.pinned ? PinOff : Pin}
            label={target.pinned ? 'Desfijar chat' : 'Fijar chat'}
            onClick={() => {
              void setPinned({ conversationId: target.conversationId, pinned: !target.pinned });
              onClose();
            }}
          />
          <MenuItem
            icon={Mail}
            label="Marcar como no leído"
            onClick={() => {
              void markUnread({ conversationId: target.conversationId });
              onClose();
            }}
          />
          <MenuItem icon={ListChecks} label="Cambiar de lista" onClick={() => setShowLists(true)} />
          <div className="my-1 border-t border-border/70" />
          <MenuItem
            icon={Archive}
            label={target.archived ? 'Desarchivar chat' : 'Archivar chat'}
            onClick={() => {
              void setArchived({ conversationId: target.conversationId, archived: !target.archived });
              onClose();
            }}
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pin;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] transition-colors hover:bg-muted"
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} /> {label}
    </button>
  );
}
