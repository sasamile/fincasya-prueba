/**
 * Modal "Compartir fincas" — el Experto elige fincas y las envía manualmente
 * por WhatsApp: fichas Meta (catálogo) o fichas web (foto + enlace fincasya.com).
 * El envío automático (como el bot) vive en AutoCatalogModal.
 */
import { useMemo, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Link2, Search, Store, X, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { catalogCache } from '@/lib/queryCache';
import { LoadingArea } from '@/components/ui/spinner';
import { AutoCatalogModal } from '@/features/inbox/components/AutoCatalogModal';

type CatalogRow = FunctionReturnType<typeof api.inbox.listCatalogProperties>[number];
type ShareMode = 'meta' | 'web';

function formatCop(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-CO')}`;
}

function matchesSearch(p: CatalogRow, q: string): boolean {
  if (!q) return true;
  const cupo = /^\d+$/.test(q) ? Number(q) : null;
  if (cupo != null && p.capacity >= cupo) return true;
  return (
    p.title.toLowerCase().includes(q) ||
    p.location.toLowerCase().includes(q) ||
    (p.code ?? '').toLowerCase().includes(q) ||
    String(p.capacity).includes(q)
  );
}

function CatalogListRow({
  property: p,
  mode,
  selected,
  onToggle,
}: {
  property: CatalogRow;
  mode: ShareMode;
  selected: boolean;
  onToggle: () => void;
}) {
  const sendable = mode === 'meta' ? p.sendable : p.webSendable;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!sendable}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
        sendable ? 'hover:bg-muted' : 'cursor-not-allowed opacity-45',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/50',
        )}
      >
        {selected && (
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M5 12l5 5L20 6" />
          </svg>
        )}
      </span>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {p.image ? (
          <img
            src={p.image}
            alt=""
            className="h-full w-full object-cover object-center"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{p.title}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          👥 Hasta {p.capacity} · {p.location}
          {mode === 'meta' && !p.sendable && ' · sin ficha Meta'}
          {mode === 'web' && !p.webSendable && ' · sin slug o foto'}
          {/* El toggle de catálogo apagado NO impide enviarla a mano: solo
              avisa que el bot no la ofrece sola. */}
          {p.sendable && !p.inWhatsAppCatalog && (
            <span className="text-amber-600"> · el bot no la envía</span>
          )}
        </p>
        <p className="text-[13px]">
          <span className="font-medium text-foreground">{formatCop(p.priceFrom)}</span>
          {p.priceOriginal && p.priceOriginal > p.priceFrom ? (
            <span className="ml-2 text-[12px] text-muted-foreground line-through">
              {formatCop(p.priceOriginal)}
            </span>
          ) : null}
        </p>
      </div>
    </button>
  );
}

export function CatalogModal({
  conversationId,
  onClose,
}: {
  conversationId: Id<'conversations'>;
  onClose: () => void;
}) {
  const liveProperties = useQuery(api.inbox.listCatalogProperties);
  const properties = liveProperties ?? (catalogCache.value as typeof liveProperties);
  if (liveProperties !== undefined) catalogCache.value = liveProperties;
  const sendCatalog = useAction(api.inbox.sendCatalogSelection);
  const sendWebFichas = useAction(api.inbox.sendWebFichaSelection);
  const [mode, setMode] = useState<ShareMode>('meta');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dept, setDept] = useState<string>('Todos');
  const [showAuto, setShowAuto] = useState(false);

  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of properties ?? []) {
      const d = p.departamento?.trim();
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }, [properties]);

  const filtered = useMemo(() => {
    if (!properties) return [];
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      // OJO: NO se filtra por `inWhatsAppCatalog`. Ese toggle solo le dice al
      // BOT que no la ofrezca sola; el Experto sí puede enviarla a mano si el
      // cliente la pide (la ficha lleva el aviso "el bot no la envía").
      if (dept !== 'Todos' && p.departamento !== dept) return false;
      return matchesSearch(p, q);
    });
  }, [properties, search, dept, mode]);

  function toggle(id: string, sendable: boolean) {
    if (!sendable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchMode(next: ShareMode) {
    if (next === mode) return;
    setMode(next);
    setSelected(new Set());
    setResult(null);
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setResult(null);
    const propertyIds = [...selected] as Id<'properties'>[];
    try {
      const res =
        mode === 'meta'
          ? await sendCatalog({ conversationId, propertyIds })
          : await sendWebFichas({ conversationId, propertyIds });
      if (res.ok) {
        const label = mode === 'meta' ? 'ficha(s) Meta' : 'ficha(s) web';
        setResult(
          res.queued
            ? `✓ Enviando ${res.queued} ${label} en segundo plano…`
            : `✓ ${res.sent} ${label} enviada(s)${res.failed ? ` · ${res.failed} fallaron` : ''}`,
        );
        setSelected(new Set());
        setTimeout(onClose, res.queued ? 400 : 900);
      } else {
        setResult(res.motivo ?? 'No se pudo enviar');
      }
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-card">
      <header className="flex items-start gap-3 px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
          <Store className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-medium">Compartir fincas</h2>
          <p className="text-[12px] text-muted-foreground">
            Catálogo Meta o ficha con foto y enlace a la web
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setShowAuto(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 text-left transition hover:bg-primary/15"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">
              Catálogo automático (como el bot)
            </span>
            <span className="block text-[12px] text-muted-foreground">
              Fechas, personas y zona → preview y envío
            </span>
          </span>
        </button>
      </div>

      <div className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        O elige fincas manualmente
      </div>

      <div className="flex gap-2 px-4 pb-2">
        <button
          type="button"
          onClick={() => switchMode('meta')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors',
            mode === 'meta'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <Store className="h-4 w-4" />
          Catálogo Meta
        </button>
        <button
          type="button"
          onClick={() => switchMode('web')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors',
            mode === 'web'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <Link2 className="h-4 w-4" />
          Ficha web
        </button>
      </div>

      <div className="px-4 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === 'web'
                ? 'Buscar por nombre, código, ubicación o cupo (ej. 15)…'
                : 'Buscar finca por nombre, código o municipio'
            }
            className="h-9 rounded-full border-transparent bg-input pl-11 text-[13px]"
          />
        </div>
      </div>

      {departments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {['Todos', ...departments].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDept(d)}
              data-active={dept === d}
              className="wa-chip shrink-0 whitespace-nowrap px-3 py-1 text-[13px] font-medium"
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {properties === undefined ? (
          <LoadingArea label="Cargando catálogo…" />
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sin fincas</p>
        ) : (
          filtered.map((p) => {
            const id = String(p.propertyId);
            const sendable = mode === 'meta' ? p.sendable : p.webSendable;
            return (
              <CatalogListRow
                key={id}
                property={p}
                mode={mode}
                selected={selected.has(id)}
                onToggle={() => toggle(id, sendable)}
              />
            );
          })
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-[13px] text-muted-foreground">
          {result ?? `${selected.size} finca(s) seleccionada(s)`}
        </span>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={selected.size === 0 || sending}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-5 py-2 text-[14px] font-medium transition-colors',
            selected.size === 0 || sending
              ? 'cursor-not-allowed bg-muted text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:brightness-110',
          )}
        >
          {mode === 'web' && <Link2 className="h-4 w-4" />}
          {sending ? 'Enviando…' : mode === 'web' ? 'Enviar fichas' : 'Enviar'}
        </button>
      </footer>

      {showAuto && (
        <AutoCatalogModal
          conversationId={conversationId}
          onClose={() => setShowAuto(false)}
          onSent={onClose}
        />
      )}
    </div>
  );
}
