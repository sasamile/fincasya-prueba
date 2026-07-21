/**
 * FINCAS DE LA SEMANA (herramienta del inbox, Vane 21-jul).
 *
 * El equipo selecciona fincas a IMPULSAR (de cualquier municipio). El bot las
 * prioriza en enviar_catalogo: dentro de la zona pedida van PRIMERO; las de
 * otras zonas se agregan AL FINAL del lote como recomendación extra. Cupo y
 * disponibilidad SIEMPRE se respetan (jamás se ofrece una finca que no le
 * sirve al cliente o que está reservada en sus fechas).
 *
 * Lista MANUAL sin vencimiento: se agrega/apaga/quita a mano. El panel muestra
 * la ocupación próxima leyendo propertyAvailability (reservas + bloqueos) para
 * que el equipo vea cuándo conviene sacarla de la lista.
 */
import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { authComponent } from './betterAuth/auth';
import { fetchPrimaryPropertyImageUrl } from './lib/propertyImages';

const ADMIN_ROLES = new Set(['admin', 'assistant', 'superadmin']);

async function requireOperator(ctx: Parameters<typeof authComponent.safeGetAuthUser>[0]) {
  const user = (await authComponent.safeGetAuthUser(ctx)) as
    | { _id: string; name?: string | null; email?: string | null; role?: string | null }
    | null;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) throw new Error('No autorizado');
  return user.name?.trim() || user.email?.trim() || user._id;
}

/** Ventana de ocupación que muestra el panel (próximos 14 días). */
const OCUPACION_DIAS = 14;

/** Listas disponibles: impulso de la semana o temporada de fin de año. */
export type ListaPicks = 'semana' | 'findeano';
const listaValidator = v.union(v.literal('semana'), v.literal('findeano'));

/**
 * Ventana de FIN DE AÑO próxima (15-dic → 15-ene): si estamos en enero antes
 * del 15, es la temporada en curso; si no, la de diciembre que viene. La misma
 * ventana usa el agente para decidir cuándo aplicar la lista 'findeano'.
 */
export function ventanaFinDeAno(ahora: number): { desde: number; hasta: number } {
  const y = new Date(ahora).getUTCFullYear();
  const finVentanaAnterior = Date.UTC(y, 0, 16); // 15-ene inclusive
  if (ahora < finVentanaAnterior) {
    return { desde: Date.UTC(y - 1, 11, 15), hasta: finVentanaAnterior };
  }
  return { desde: Date.UTC(y, 11, 15), hasta: Date.UTC(y + 1, 0, 16) };
}

type Ocupacion = { desde: number; hasta: number };

async function ocupacionEnVentana(
  ctx: QueryCtx,
  propertyId: Id<'properties'>,
  desde: number,
  hasta: number,
): Promise<Ocupacion[]> {
  const blocks = await ctx.db
    .query('propertyAvailability')
    .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
    .collect();
  return blocks
    .filter((b) => b.fechaEntrada < hasta && b.fechaSalida > desde)
    .sort((a, b) => a.fechaEntrada - b.fechaEntrada)
    .slice(0, 6)
    .map((b) => ({ desde: b.fechaEntrada, hasta: b.fechaSalida }));
}

export type WeeklyPickRow = {
  id: string;
  propertyId: string;
  enabled: boolean;
  title: string;
  code: string | null;
  capacity: number;
  location: string;
  /** Imagen principal de la finca (la misma de la ficha del catálogo). */
  image: string | null;
  /** false si la finca está apagada del catálogo (active/visible/catálogo WA). */
  enviable: boolean;
  /** Reservas/bloqueos que se cruzan con los próximos 14 días. */
  ocupacion: Ocupacion[];
  updatedAt: number;
  updatedBy: string | null;
};

/** Lista seleccionada (semana o fin de año) con estado de cada finca. */
export const list = query({
  args: { lista: v.optional(listaValidator) },
  handler: async (ctx, args): Promise<WeeklyPickRow[]> => {
    const lista: ListaPicks = args.lista ?? 'semana';
    const picks = (await ctx.db.query('weeklyPicks').collect()).filter(
      (w) => (w.lista ?? 'semana') === lista,
    );
    const ahora = Date.now();
    // Semana: ocupación de los próximos 14 días. Fin de año: ocupación dentro
    // de la temporada (15-dic → 15-ene) — es lo que le importa al equipo.
    const ventana =
      lista === 'findeano'
        ? ventanaFinDeAno(ahora)
        : { desde: ahora, hasta: ahora + OCUPACION_DIAS * 24 * 3600 * 1000 };
    const rows: WeeklyPickRow[] = [];
    for (const pick of picks) {
      const p = await ctx.db.get(pick.propertyId);
      if (!p) continue; // finca borrada → la fila se ignora
      rows.push({
        id: String(pick._id),
        propertyId: String(pick.propertyId),
        enabled: pick.enabled,
        title: p.title,
        code: p.code?.trim() || null,
        capacity: p.capacity,
        location: p.location,
        image: await fetchPrimaryPropertyImageUrl(ctx, pick.propertyId),
        enviable:
          p.active !== false &&
          p.visible !== false &&
          p.visibleInWhatsAppCatalog !== false,
        ocupacion: await ocupacionEnVentana(
          ctx,
          pick.propertyId,
          ventana.desde,
          ventana.hasta,
        ),
        updatedAt: pick.updatedAt,
        updatedBy: pick.updatedBy ?? null,
      });
    }
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Buscador liviano de fincas para agregar (sin imágenes ni features). */
export const searchProperties = query({
  args: { q: v.optional(v.string()), lista: v.optional(listaValidator) },
  handler: async (
    ctx,
    { q, lista: listaArg },
  ): Promise<
    Array<{
      propertyId: string;
      title: string;
      code: string | null;
      capacity: number;
      location: string;
      image: string | null;
      enviable: boolean;
      yaSeleccionada: boolean;
    }>
  > => {
    const lista: ListaPicks = listaArg ?? 'semana';
    const [all, picks] = await Promise.all([
      ctx.db.query('properties').collect(),
      ctx.db.query('weeklyPicks').collect(),
    ]);
    const picked = new Set(
      picks
        .filter((p) => (p.lista ?? 'semana') === lista)
        .map((p) => String(p.propertyId)),
    );
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const filtro = norm((q ?? '').trim());
    const matched = all
      .filter((p) =>
        filtro
          ? norm(p.title).includes(filtro) ||
            norm(p.code ?? '').includes(filtro) ||
            norm(p.location).includes(filtro)
          : true,
      )
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 40);
    return await Promise.all(
      matched.map(async (p) => ({
        propertyId: String(p._id),
        title: p.title,
        code: p.code?.trim() || null,
        capacity: p.capacity,
        location: p.location,
        image: await fetchPrimaryPropertyImageUrl(ctx, p._id),
        enviable:
          p.active !== false &&
          p.visible !== false &&
          p.visibleInWhatsAppCatalog !== false,
        yaSeleccionada: picked.has(String(p._id)),
      })),
    );
  },
});

/** Agrega una finca a la lista indicada (idempotente: re-activa si existe). */
export const add = mutation({
  args: { propertyId: v.id('properties'), lista: v.optional(listaValidator) },
  handler: async (ctx, { propertyId, lista: listaArg }) => {
    const by = await requireOperator(ctx);
    const lista: ListaPicks = listaArg ?? 'semana';
    const prop = await ctx.db.get(propertyId);
    if (!prop) throw new Error('La finca no existe');
    const now = Date.now();
    // Una finca puede estar en AMBAS listas (semana y fin de año) a la vez.
    const existing = (
      await ctx.db
        .query('weeklyPicks')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .collect()
    ).find((w) => (w.lista ?? 'semana') === lista);
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: true, updatedAt: now, updatedBy: by });
      return existing._id;
    }
    return await ctx.db.insert('weeklyPicks', {
      propertyId,
      lista,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: by,
    });
  },
});

/**
 * Agrega VARIAS fincas de una (botón "Seleccionar todas" del panel).
 * Idempotente: las que ya estaban solo se re-activan.
 */
export const addMany = mutation({
  args: {
    propertyIds: v.array(v.id('properties')),
    lista: v.optional(listaValidator),
  },
  handler: async (ctx, { propertyIds, lista: listaArg }): Promise<number> => {
    const by = await requireOperator(ctx);
    const lista: ListaPicks = listaArg ?? 'semana';
    if (propertyIds.length === 0) return 0;
    if (propertyIds.length > 200) throw new Error('Demasiadas fincas de una');
    const now = Date.now();
    const existentes = new Map(
      (await ctx.db.query('weeklyPicks').collect())
        .filter((w) => (w.lista ?? 'semana') === lista)
        .map((w) => [String(w.propertyId), w] as const),
    );
    let agregadas = 0;
    for (const propertyId of propertyIds) {
      const prop = await ctx.db.get(propertyId);
      if (!prop) continue;
      const existing = existentes.get(String(propertyId));
      if (existing) {
        if (!existing.enabled) {
          await ctx.db.patch(existing._id, { enabled: true, updatedAt: now, updatedBy: by });
          agregadas++;
        }
        continue;
      }
      await ctx.db.insert('weeklyPicks', {
        propertyId,
        lista,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: by,
      });
      agregadas++;
    }
    return agregadas;
  },
});

/** Prende/apaga una finca de la lista sin quitarla. */
export const setEnabled = mutation({
  args: { id: v.id('weeklyPicks'), enabled: v.boolean() },
  handler: async (ctx, { id, enabled }) => {
    const by = await requireOperator(ctx);
    const pick = await ctx.db.get(id);
    if (!pick) throw new Error('No existe esa selección');
    await ctx.db.patch(id, { enabled, updatedAt: Date.now(), updatedBy: by });
  },
});

/** Quita una finca de la lista de la semana. */
export const remove = mutation({
  args: { id: v.id('weeklyPicks') },
  handler: async (ctx, { id }) => {
    await requireOperator(ctx);
    const pick = await ctx.db.get(id);
    if (!pick) return;
    await ctx.db.delete(id);
  },
});

/** IDs de fincas ACTIVAS de una lista — apoyo para debug/CLI. */
export const listEnabledIds = internalQuery({
  args: { lista: v.optional(listaValidator) },
  handler: async (ctx, args): Promise<string[]> => {
    const lista: ListaPicks = args.lista ?? 'semana';
    const picks = await ctx.db.query('weeklyPicks').collect();
    return picks
      .filter((p) => p.enabled && (p.lista ?? 'semana') === lista)
      .map((p) => String(p.propertyId));
  },
});
