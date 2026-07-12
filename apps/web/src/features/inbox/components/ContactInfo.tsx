/**
 * Panel "Info. del contacto" (drawer derecho de WhatsApp) — FUNCIONAL.
 * Editar nombre, notas del cliente, copiar número y asignar foto (subida real
 * a Convex storage). Se abre al hacer clic sobre el nombre en la cabecera.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Bell, Camera, Check, ChevronRight, Copy, Pencil, Search, Star, X } from 'lucide-react';
import { avatarColorFor } from '@/lib/avatarColor';
import { LoadingArea } from '@/components/ui/spinner';

export function ContactInfo({
  conversationId,
  onClose,
  onOpenShared,
  onOpenSearch,
}: {
  conversationId: Id<'conversations'>;
  onClose: () => void;
  onOpenShared: () => void;
  onOpenSearch?: () => void;
}) {
  const info = useQuery(api.inbox.getContactInfo, { conversationId });
  const updateName = useMutation(api.inbox.updateContactName);
  const updateNotes = useMutation(api.inbox.updateContactNotes);
  const generateUploadUrl = useMutation(api.inbox.generateUploadUrl);
  const setContactPhoto = useMutation(api.inbox.setContactPhoto);

  const [muted, setMuted] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sincroniza los borradores cuando llega/cambia la info.
  useEffect(() => {
    if (info) {
      setNameDraft(info.name);
      if (!notesDirty) setNotesDraft(info.notes);
    }
  }, [info, notesDirty]);

  if (info === undefined) {
    return (
      <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-card">
        <LoadingArea />
      </aside>
    );
  }
  if (info === null) {
    return (
      <aside className="flex h-full w-[380px] shrink-0 items-center justify-center border-l border-border bg-card text-sm text-muted-foreground">
        Sin datos
      </aside>
    );
  }

  const { bg, fg } = avatarColorFor(info.name);

  async function saveName() {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (trimmed && trimmed !== info!.name) {
      await updateName({ conversationId, name: trimmed });
    } else {
      setNameDraft(info!.name);
    }
  }

  async function saveNotes() {
    if (!notesDirty) return;
    await updateNotes({ conversationId, notes: notesDraft });
    setNotesDirty(false);
  }

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(`+${info!.phone}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      await setContactPhoto({ conversationId, storageId });
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-6 px-4 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-[17px] font-medium">Info. del contacto</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Avatar (con subida de foto) + nombre */}
        <div className="flex flex-col items-center gap-3 px-6 py-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-32 w-32 overflow-hidden rounded-full"
            style={{ backgroundColor: info.photoUrl ? undefined : bg }}
            title="Cambiar foto"
          >
            {info.photoUrl ? (
              <img src={info.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg viewBox="0 0 48 48" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
                <path
                  fill={fg}
                  d="M24 23q-1.86 0-3.18-1.32T19.5 18.5t1.32-3.18T24 14t3.18 1.32q1.32 1.32 1.32 3.18t-1.32 3.18T24 23m-6.75 10q-.93 0-1.59-.66T15 30.75v-.9q0-.96.5-1.76a3.3 3.3 0 0 1 1.3-1.22 16.7 16.7 0 0 1 3.54-1.3q1.8-.44 3.66-.44t3.66.43 3.54 1.31q.82.42 1.3 1.22t.5 1.76v.9q0 .93-.66 1.59t-1.59.66z"
                />
              </svg>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-3 w-3" /> {uploading ? 'Subiendo…' : 'Cambiar'}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          {/* Nombre editable */}
          {editingName ? (
            <div className="flex w-full items-center justify-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName();
                  if (e.key === 'Escape') {
                    setNameDraft(info.name);
                    setEditingName(false);
                  }
                }}
                className="min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1 text-center text-[20px] outline-none"
              />
              <button type="button" onClick={() => void saveName()} className="text-primary" title="Guardar">
                <Check className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-2"
              title="Editar nombre"
            >
              <h3 className="text-[22px] font-normal">{info.name}</h3>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          {/* Teléfono + copiar */}
          <button
            type="button"
            onClick={() => void copyPhone()}
            className="flex items-center gap-2 text-[15px] text-muted-foreground transition-colors hover:text-foreground"
            title="Copiar número"
          >
            +{info.phone}
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </button>
          {copied && <span className="-mt-1 text-[11px] text-primary">¡Copiado!</span>}
        </div>

        <Divider />

        {/* Notas del cliente (editable) */}
        <div className="px-6 py-4">
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
            Notas sobre el cliente
          </label>
          <textarea
            value={notesDraft}
            onChange={(e) => {
              setNotesDraft(e.target.value);
              setNotesDirty(true);
            }}
            onBlur={() => void saveNotes()}
            placeholder="Añade notas sobre tu cliente…"
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-input px-2.5 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:border-primary/60"
          />
          {notesDirty && <span className="text-[11px] text-muted-foreground">Se guarda al salir del campo</span>}
        </div>

        <Divider />

        <button
          type="button"
          onClick={onOpenShared}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/50"
        >
          <span className="text-[15px]">Archivos, enlaces y documentos</span>
          <span className="flex items-center gap-1 text-[15px] text-muted-foreground">
            {info.sharedCount}
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>

        <Divider />

        <button
          type="button"
          className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50"
        >
          <Star className="h-5 w-5 text-muted-foreground" />
          <span className="text-[15px]">Mensajes destacados</span>
        </button>

        <Divider />

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="text-[15px]">Silenciar notificaciones</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={muted}
            onClick={() => setMuted((m) => !m)}
            className="toggle-track relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors"
            data-on={muted}
          >
            <span className="toggle-thumb absolute left-0.5 h-3.5 w-3.5 rounded-full transition-transform" />
          </button>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border/70 px-6 py-5">
        <button
          type="button"
          onClick={onOpenSearch}
          className="mx-auto mb-4 flex flex-col items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Search className="h-5 w-5" />
          </span>
          <span className="text-[13px]">Busca</span>
        </button>

        {info.labels.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {info.labels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                {l.emoji ? `${l.emoji} ` : ''}
                {l.name}
              </span>
            ))}
          </div>
        ) : null}
      </footer>
    </aside>
  );
}

function Divider() {
  return <div className="mx-6 border-t border-border/70" />;
}
