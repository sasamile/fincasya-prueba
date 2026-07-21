'use client';

/**
 * Herramienta "Fincas de la semana" del rail (Vane, 21-jul): el equipo
 * selecciona las fincas a IMPULSAR. El bot las prioriza en el catálogo
 * (en la zona pedida van primero; de otras zonas cierran el lote como
 * recomendación). Cupo y disponibilidad se respetan siempre. La lista es
 * manual: aquí se agregan, se apagan (ej. ya se reservó) o se quitan, y
 * cada finca muestra su ocupación próxima leída de las reservas reales.
 */
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  PartyPopper,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

type Lista = 'semana' | 'findeano';

function fmtRango(desde: number, hasta: number): string {
  const f = (ms: number) =>
    new Date(ms).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Bogota',
    });
  return `${f(desde)} → ${f(hasta)}`;
}

export function SemanaTool() {
  const [lista, setLista] = useState<Lista>('semana');
  const picks = useQuery(api.weeklyPicks.list, { lista });
  const [q, setQ] = useState('');
  /** Filtro local de la lista de impulsadas (crece a 40-50 fincas). */
  const [filtro, setFiltro] = useState('');
  const resultados = useQuery(api.weeklyPicks.searchProperties, { q, lista });
  const addMany = useMutation(api.weeklyPicks.addMany);
  const setEnabled = useMutation(api.weeklyPicks.setEnabled);
  const remove = useMutation(api.weeklyPicks.remove);
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * MODO SELECCIÓN (Vane): "Seleccionar todas" marca los resultados, ella
   * DESMARCA las 3-4 que no quiere y confirma con "Agregar seleccionadas".
   * Nada se agrega hasta confirmar. La selección sobrevive a cambios del
   * buscador (puede marcar de varios municipios antes de confirmar).
   */
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const picksFiltradas = (picks ?? []).filter((p) =>
    filtro.trim()
      ? norm(p.title).includes(norm(filtro)) ||
        norm(p.location).includes(norm(filtro)) ||
        norm(p.code ?? '').includes(norm(filtro))
      : true,
  );
  /** Resultados del buscador que aún NO están en la lista (para el lote). */
  const agregables = (resultados ?? []).filter((r) => !r.yaSeleccionada);

  const toggleSeleccion = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setBusy(null);
    }
  }

  const activas = (picks ?? []).filter((p) => p.enabled).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Pestañas: semana / fin de año */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => {
            setLista('semana');
            setSeleccion(new Set());
          }}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold transition-colors',
            lista === 'semana'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Star className="h-3.5 w-3.5" /> Esta semana
        </button>
        <button
          type="button"
          onClick={() => {
            setLista('findeano');
            setSeleccion(new Set());
          }}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold transition-colors',
            lista === 'findeano'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PartyPopper className="h-3.5 w-3.5" /> Fin de año
        </button>
      </div>

      {/* Seleccionadas */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            {lista === 'semana'
              ? 'Impulsadas por el bot'
              : 'Impulsadas en fin de año'}
          </h3>
          <span className="text-[11px] text-muted-foreground/70">
            {picks === undefined ? '…' : `${activas} activas de ${picks.length}`}
          </span>
        </div>

        {picks === undefined ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : picks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Star className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aún no hay fincas seleccionadas.
              <br />
              Busca abajo y agrégalas para que el bot las priorice.
            </p>
          </div>
        ) : (
          <>
            {/* Filtro local: con 40-50 fincas la lista crece — buscar dentro. */}
            {picks.length > 5 && (
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Filtrar seleccionadas…"
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[13px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
            {picksFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ninguna coincide con &quot;{filtro}&quot;
              </p>
            ) : (
          <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {picksFiltradas.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'rounded-xl border border-border p-3 transition-opacity',
                  !p.enabled && 'opacity-55',
                )}
              >
                <div className="flex items-start gap-3">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      loading="lazy"
                      draggable={false}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground/50">
                      <Star className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold leading-tight">
                      {p.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {p.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> {p.capacity} pax
                      </span>
                    </p>
                    {/* Ocupación próxima (reservas + bloqueos reales) */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {!p.enviable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> Apagada del catálogo
                        </span>
                      )}
                      {p.ocupacion.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {lista === 'semana'
                            ? 'Libre próximos 14 días'
                            : 'Libre en fin de año'}
                        </span>
                      ) : (
                        p.ocupacion.map((o, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600"
                          >
                            <CalendarRange className="h-3 w-3" />
                            {fmtRango(o.desde, o.hasta)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Switch
                      checked={p.enabled}
                      disabled={busy === p.id}
                      onCheckedChange={(v) =>
                        void run(
                          p.id,
                          () =>
                            setEnabled({
                              id: p.id as Id<'weeklyPicks'>,
                              enabled: v,
                            }),
                          v ? 'El bot la vuelve a priorizar' : 'Pausada — el bot no la prioriza',
                        )
                      }
                    />
                    <button
                      type="button"
                      title="Quitar de la lista"
                      disabled={busy === p.id}
                      onClick={() =>
                        void run(
                          p.id,
                          () => remove({ id: p.id as Id<'weeklyPicks'> }),
                          'Quitada de la lista',
                        )
                      }
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
          {lista === 'semana'
            ? 'El bot solo las ofrece si el grupo cabe y están libres en las fechas del cliente. Si se reserva, apágala o quítala — el filtro de disponibilidad la bloquea solo para esas fechas de todas formas.'
            : 'Estas se priorizan SOLO cuando el cliente pide fechas de fin de año (15 dic → 15 ene). El resto del año no afectan nada. Cupo y disponibilidad se respetan siempre.'}
        </p>
      </section>

      {/* Agregar */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          Agregar finca
        </h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, código o municipio…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {/* Selección en lote: marcar todas → desmarcar las que no → confirmar. */}
        {agregables.length > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSeleccion((prev) => {
                  const next = new Set(prev);
                  for (const r of agregables) next.add(r.propertyId);
                  return next;
                })
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-[12px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Check className="h-3.5 w-3.5" /> Seleccionar todas ({agregables.length})
            </button>
            {seleccion.size > 0 && (
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-muted-foreground transition-colors hover:text-destructive"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
        <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {(resultados ?? []).map((r) => (
            <li
              key={r.propertyId}
              onClick={() => {
                if (!r.yaSeleccionada) toggleSeleccion(r.propertyId);
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60',
                !r.yaSeleccionada && 'cursor-pointer',
                seleccion.has(r.propertyId) && 'bg-primary/5 ring-1 ring-primary/25',
              )}
            >
              {r.image ? (
                <img
                  src={r.image}
                  alt={r.title}
                  loading="lazy"
                  draggable={false}
                  className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
                />
              ) : (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground/50">
                  <Star className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">{r.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {r.location} · {r.capacity} pax
                  {!r.enviable && ' · ⚠️ apagada del catálogo'}
                </p>
              </div>
              {r.yaSeleccionada ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  En la lista
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
                    seleccion.has(r.propertyId)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  )}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Confirmación del lote: nada se agrega hasta tocar este botón. */}
        {seleccion.size > 0 && (
          <button
            type="button"
            disabled={busy === '__confirm__'}
            onClick={() =>
              void run(
                '__confirm__',
                async () => {
                  await addMany({
                    propertyIds: [...seleccion] as Id<'properties'>[],
                    lista,
                  });
                  setSeleccion(new Set());
                },
                lista === 'semana'
                  ? `${seleccion.size} fincas agregadas — el bot ya las prioriza`
                  : `${seleccion.size} fincas agregadas para fin de año`,
              )
            }
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === '__confirm__' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Agregar seleccionadas ({seleccion.size})
          </button>
        )}
      </section>
    </div>
  );
}
