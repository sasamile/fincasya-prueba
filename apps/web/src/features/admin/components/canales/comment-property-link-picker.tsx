'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Home, Loader2 } from 'lucide-react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const WA =
  'https://wa.me/573157773937?text=' +
  encodeURIComponent(
    'Hola FincasYa! Me interesa esta finca y quiero que un experto me atienda 🏡',
  );

export function buildShortFincaReply(url: string, title?: string): string {
  const wa = title
    ? `https://wa.me/573157773937?text=${encodeURIComponent(
        `Hola FincasYa! Me interesa ${title} y quiero que un experto me atienda 🏡`,
      )}`
    : WA;
  return [
    '¡Hola! 🏡 Aquí puedes ver la finca:',
    url,
    '',
    'Escríbenos por WhatsApp y un experto te atiende 📲',
    wa,
  ].join('\n');
}

/**
 * Busca fincas reales, vincula la publicación y pega respuesta corta
 * (link /fincas/{slug} + WhatsApp FincasYa).
 */
export function CommentPropertyLinkPicker({
  onPickUrl,
  pageId,
  provider,
  postId,
  className,
}: {
  onPickUrl: (url: string, suggestedMessage: string) => void;
  pageId?: string;
  provider?: 'facebook' | 'instagram';
  postId?: string;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const linkPost = useMutation(api.metaChannels.linkPostProperty);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const results = useQuery(
    api.metaChannels.searchPropertyLinks,
    debounced.length >= 2 ? { q: debounced } : 'skip',
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative">
        <Home className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar finca de la publicación…"
          className="h-8 border-0 bg-muted/70 pl-8 text-xs shadow-none"
        />
        {results === undefined && debounced.length >= 2 ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>
      {debounced.length >= 2 && results && results.length === 0 ? (
        <p className="text-muted-foreground px-0.5 text-[11px]">
          No hay fincas con ese nombre o código.
        </p>
      ) : null}
      {results && results.length > 0 ? (
        <ul className="bg-card max-h-36 overflow-y-auto rounded-lg ring-1 ring-border/70">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="hover:bg-muted/60 flex w-full flex-col gap-0.5 px-2.5 py-2 text-left transition-colors"
                onClick={() => {
                  const suggested = buildShortFincaReply(p.url, p.title);
                  onPickUrl(p.url, suggested);
                  if (pageId && provider && postId) {
                    void linkPost({
                      pageId,
                      provider,
                      postId,
                      propertyId: p.id as Id<'properties'>,
                    });
                  }
                  setQ('');
                  setDebounced('');
                }}
              >
                <span className="text-foreground text-xs font-medium">
                  {p.title}
                  {p.code ? (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      · {p.code}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground truncate text-[10px]">
                  {p.url}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
