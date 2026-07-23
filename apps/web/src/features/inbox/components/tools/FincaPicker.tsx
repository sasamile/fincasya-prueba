'use client';

/** Selector de finca con imagen + buscador (reutilizable en las herramientas). */
import { useState } from 'react';
import { ChevronDown, Home, Search } from 'lucide-react';
import { propertyMatchesSearchQuery } from '@/lib/property/property-search';
import { cn } from '@/lib/utils';

export type FincaOption = {
  _id: string;
  title: string;
  code?: string;
  location?: string;
  images?: string[];
};

export function FincaPicker({
  fincas,
  value,
  onChange,
  emptyLabel = 'Selecciona una finca…',
  allowAll = false,
}: {
  fincas: FincaOption[] | undefined;
  value: string;
  onChange: (id: string, title: string) => void;
  /** Texto del botón cuando no hay selección. */
  emptyLabel?: string;
  /** Muestra una opción "Todas" (para filtros). */
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = fincas?.find((f) => f._id === value) ?? null;

  const list = (fincas ?? []).filter((f) =>
    propertyMatchesSearchQuery(
      { title: f.title, code: f.code, location: f.location },
      query,
    ),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-2 text-left transition hover:border-primary/40"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {selected?.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.images[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Home className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {selected ? selected.title : emptyLabel}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {selected
              ? [selected.code, selected.location].filter(Boolean).join(' · ')
              : 'Toca para buscar'}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe nombre o código"
                className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {allowAll ? (
              <button
                type="button"
                onClick={() => {
                  onChange('', '');
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-muted',
                  !value && 'bg-primary/10',
                )}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <Home className="h-4 w-4" />
                </div>
                <p className="text-[13px] font-semibold">Todas las fincas</p>
              </button>
            ) : null}
            {list.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              list.map((f) => (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => {
                    onChange(f._id, f.title);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-muted',
                    f._id === value && 'bg-primary/10',
                  )}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {f.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <Home className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{f.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[f.code, f.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
