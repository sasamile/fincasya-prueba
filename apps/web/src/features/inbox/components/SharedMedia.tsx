/**
 * Visor de "Archivos, enlaces y documentos" de una conversación (como el de
 * WhatsApp): grilla de imágenes/videos/fichas + lista de documentos/enlaces.
 */
import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { FileText, ChevronLeft, LinkIcon, Play, Store } from 'lucide-react';
import { LoadingArea } from '@/components/ui/spinner';

type Item = FunctionReturnType<typeof api.inbox.getSharedMedia>[number];

export function SharedMedia({
  conversationId,
  onClose,
}: {
  conversationId: Id<'conversations'>;
  onClose: () => void;
}) {
  const items = useQuery(api.inbox.getSharedMedia, { conversationId });

  const { media, docs, links } = useMemo(() => {
    const media: Item[] = [];
    const docs: Item[] = [];
    const links: Item[] = [];
    for (const it of items ?? []) {
      if (it.kind === 'image' || it.kind === 'video' || it.kind === 'product') media.push(it);
      else if (it.kind === 'document' || it.kind === 'audio') docs.push(it);
      else links.push(it);
    }
    return { media, docs, links };
  }, [items]);

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-6 px-4 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Volver"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h2 className="flex-1 text-[17px] font-medium">Archivos, enlaces y documentos</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {items === undefined ? (
          <LoadingArea />
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nada compartido todavía.
          </p>
        ) : (
          <>
            {media.length > 0 && (
              <section className="mb-4">
                <p className="mb-1.5 px-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Multimedia
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {media.map((it) => (
                    <a
                      key={it.id}
                      href={it.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-square overflow-hidden rounded-md bg-muted"
                      title={it.title}
                    >
                      {it.thumb ? (
                        <img src={it.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Store className="h-6 w-6" />
                        </span>
                      )}
                      {it.kind === 'video' && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                          <Play className="h-6 w-6" />
                        </span>
                      )}
                      {it.kind === 'product' && (
                        <span className="absolute bottom-0 inset-x-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">
                          {it.title}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {docs.length > 0 && (
              <section className="mb-4">
                <p className="mb-1.5 px-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Documentos
                </p>
                {docs.map((it) => (
                  <a
                    key={it.id}
                    href={it.url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[14px]">{it.title}</span>
                  </a>
                ))}
              </section>
            )}

            {links.length > 0 && (
              <section className="mb-4">
                <p className="mb-1.5 px-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Enlaces
                </p>
                {links.map((it) => (
                  <a
                    key={it.id}
                    href={it.url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                  >
                    <LinkIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[13px] text-[#53bdeb]">{it.title}</span>
                  </a>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
