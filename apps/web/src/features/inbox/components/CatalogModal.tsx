/**
 * Modal "Compartir fincas" — el Experto elige fincas y las envía manualmente
 * por WhatsApp: fichas Meta (catálogo) o fichas web (foto + enlace fincasya.com).
 * El envío automático (como el bot) vive en AutoCatalogModal.
 */
import { useMemo, useRef, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Link2, Search, Store, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { propertyMatchesSearchQuery } from '@/lib/property/property-search';
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
  if (String(p.capacity).includes(q)) return true;
  return propertyMatchesSearchQuery(
    { title: p.title, location: p.location, code: p.code },
    q,
  );
}

function CatalogListRow({
  property: p,
  mode,
  selected,
  alreadySent,
  onToggle,
  onBlocked,
}: {
  property: CatalogRow;
  mode: ShareMode;
  selected: boolean;
  /** Ya se envió en ESTE chat (bot o manual) — se avisa para no repetir. */
  alreadySent?: boolean;
  onToggle: () => void;
  onBlocked: (property: CatalogRow) => void;
}) {
  const sendable = mode === 'meta' ? p.sendable : p.webSendable;
  return (
    <button
      type="button"
      onClick={() => {
        if (!sendable) {
          onBlocked(p);
          return;
        }
        onToggle();
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
        sendable ? 'hover:bg-muted' : 'cursor-not-allowed opacity-45',
      )}
      aria-disabled={!sendable}
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
          {alreadySent && (
            <span className="font-semibold text-sky-600"> · ✓ ya enviada en este chat</span>
          )}
        </p>
        <p className="text-[13px]">
          <span className="font-medium text-foreground">
            {p.priceIsDesde ? `Desde ${formatCop(p.priceFrom)}` : formatCop(p.priceFrom)}
          </span>
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
  initialAuto = false,
  catalogSeed,
}: {
  conversationId: Id<'conversations'>;
  onClose: () => void;
  /** Abre directo el envío automático (p. ej. desde el asistente). */
  initialAuto?: boolean;
  catalogSeed?: {
    fechaEntrada?: string;
    fechaSalida?: string;
    personas?: number;
    zona?: string;
  };
}) {
  /**
   * TEMPORADA DEL PRECIO (Vane 21-jul): el envío manual sale con el precio de
   * la temporada elegida. Por defecto se marca la temporada EN LA QUE ESTAMOS
   * HOY (según las reglas de /admin/pricing-rules); el operador puede cambiar
   * a otra o a "Sin temporada" (precio "Desde $mín").
   */
  const seasonRules = useQuery(api.globalPricing.list);
  const activeSeasons = useMemo(
    () =>
      (seasonRules ?? []).filter(
        (r: { activa?: boolean }) => r.activa !== false,
      ) as Array<{
        _id: string;
        nombre: string;
        fechas?: string[];
        fechaDesde?: string;
        fechaHasta?: string;
      }>,
    [seasonRules],
  );
  /** Id de la temporada que cubre HOY (Bogotá), si alguna. */
  const todaySeasonId = useMemo(() => {
    const mmdd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .replace('/', '-');
    for (const r of activeSeasons) {
      if (r.fechas?.includes(mmdd)) return r._id;
      if (r.fechaDesde && r.fechaHasta) {
        const inRange =
          r.fechaDesde <= r.fechaHasta
            ? mmdd >= r.fechaDesde && mmdd <= r.fechaHasta
            : mmdd >= r.fechaDesde || mmdd <= r.fechaHasta;
        if (inRange) return r._id;
      }
    }
    return null;
  }, [activeSeasons]);
  /** undefined = aún sin inicializar; null = "Sin temporada". */
  const [temporadaId, setTemporadaId] = useState<string | null | undefined>(
    undefined,
  );
  const temporadaEfectiva = temporadaId === undefined ? todaySeasonId : temporadaId;
  /** Ref anti-stale: el Enviar siempre lee la temporada visible en pantalla. */
  const temporadaRef = useRef(temporadaEfectiva);
  temporadaRef.current = temporadaEfectiva;
  const temporadaNombre =
    temporadaEfectiva == null
      ? null
      : (activeSeasons.find((r) => r._id === temporadaEfectiva)?.nombre ?? null);

  // Lista con precio de la temporada elegida (si hay). Sin temporada → "Desde $mín".
  const catalogArgs =
    temporadaEfectiva != null
      ? { temporadaGlobalId: temporadaEfectiva as Id<'globalPricing'> }
      : {};
  const liveProperties = useQuery(api.inbox.listCatalogProperties, catalogArgs);
  // Cache solo para la vista sin temporada (evita flash al abrir); con temporada
  // siempre esperamos el precio correcto.
  const properties =
    liveProperties ??
    (temporadaEfectiva == null
      ? (catalogCache.value as typeof liveProperties)
      : undefined);
  if (liveProperties !== undefined && temporadaEfectiva == null) {
    catalogCache.value = liveProperties;
  }
  /** Fincas ya enviadas en este chat (bot o manual) → se marcan en la lista. */
  const sentIds = useQuery(api.inbox.getSentCatalogIds, { conversationId });
  const sentSet = useMemo(() => new Set(sentIds ?? []), [sentIds]);
  const sendCatalog = useAction(api.inbox.sendCatalogSelection);
  const sendWebFichas = useAction(api.inbox.sendWebFichaSelection);
  const [mode, setMode] = useState<ShareMode>('meta');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dept, setDept] = useState<string>('Todos');
  const [showAuto, setShowAuto] = useState(initialAuto);

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

  function explainBlocked(p: CatalogRow) {
    if (mode === 'meta' && !p.sendable) {
      if (p.webSendable) {
        toast.message('Sin ficha Meta', {
          description:
            'Esta finca no está enlazada al catálogo de WhatsApp. Cambia a “Ficha web” para enviarla, o enlázala en Admin → Catálogos.',
          action: {
            label: 'Usar ficha web',
            onClick: () => switchMode('web'),
          },
        });
      } else {
        toast.error(
          'Sin ficha Meta: esta finca no está en el catálogo de WhatsApp. Enlázala en Admin → Catálogos.',
        );
      }
      return;
    }
    if (mode === 'web' && !p.webSendable) {
      toast.error(
        'No se puede enviar como ficha web: falta slug o foto de la finca.',
      );
    }
  }

  function switchMode(next: ShareMode) {
    if (next === mode) return;
    setMode(next);
    setSelected(new Set());
    setResult(null);
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    // No enviar hasta saber la temporada: si las reglas aún cargan, el precio
    // saldría como "Desde $mín" aunque el operador ya vea los chips.
    if (seasonRules === undefined) {
      toast.message('Cargando temporadas…', {
        description: 'Espera un segundo y vuelve a enviar.',
      });
      return;
    }
    setSending(true);
    setResult(null);
    const propertyIds = [...selected] as Id<'properties'>[];
    const chosenTemporada = temporadaRef.current;
    try {
      const temporadaGlobalId = chosenTemporada
        ? (chosenTemporada as Id<'globalPricing'>)
        : undefined;
      const res =
        mode === 'meta'
          ? await sendCatalog({ conversationId, propertyIds, temporadaGlobalId })
          : await sendWebFichas({ conversationId, propertyIds, temporadaGlobalId });
      if (res.ok) {
        const label = mode === 'meta' ? 'ficha(s) Meta' : 'ficha(s) web';
        const seasonBit = temporadaNombre ? ` · ${temporadaNombre}` : '';
        setResult(
          res.queued
            ? `✓ Enviando ${res.queued} ${label}${seasonBit}…`
            : `✓ ${res.sent} ${label} enviada(s)${seasonBit}${res.failed ? ` · ${res.failed} fallaron` : ''}`,
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

      {/* Temporada del precio: por defecto la de HOY; el precio de las fichas
          que se envían sale de la temporada elegida. */}
      {activeSeasons.length > 0 && (
        <div className="px-4 pb-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Temporada del precio
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {activeSeasons.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => setTemporadaId(r._id)}
                data-active={temporadaEfectiva === r._id}
                className="wa-chip shrink-0 whitespace-nowrap px-3 py-1 text-[13px] font-medium"
                title={
                  r._id === todaySeasonId
                    ? 'Temporada en la que estamos hoy'
                    : undefined
                }
              >
                {r.nombre}
                {r._id === todaySeasonId ? ' · hoy' : ''}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTemporadaId(null)}
              data-active={temporadaEfectiva === null}
              className="wa-chip shrink-0 whitespace-nowrap px-3 py-1 text-[13px] font-medium"
              title="Enviar con el precio 'Desde $mínimo' (sin temporada)"
            >
              Sin temporada
            </button>
          </div>
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
                alreadySent={sentSet.has(id)}
                onToggle={() => toggle(id, sendable)}
                onBlocked={explainBlocked}
              />
            );
          })
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="min-w-0 text-[13px] text-muted-foreground">
          {result ?? (
            <>
              {selected.size} finca(s) seleccionada(s)
              {temporadaNombre ? (
                <span className="text-foreground"> · {temporadaNombre}</span>
              ) : seasonRules !== undefined ? (
                <span> · sin temporada</span>
              ) : null}
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={selected.size === 0 || sending || seasonRules === undefined}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-5 py-2 text-[14px] font-medium transition-colors',
            selected.size === 0 || sending || seasonRules === undefined
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
          seed={catalogSeed}
          onClose={() => setShowAuto(false)}
          onSent={onClose}
        />
      )}
    </div>
  );
}
