/**
 * Bloqueo MANUAL de fincas por fechas (panel de Reservas).
 *
 * Sirve cuando una finca ya está tomada pero la reserva no quedó cargada en el
 * sistema: el operador la bloquea por un rango de fechas para que el bot NO la
 * envíe en el catálogo (el selector del catálogo ya filtra por
 * `propertyAvailability`, así que un bloqueo aquí la saca automáticamente).
 *
 * Los bloqueos MANUALES no tienen `bookingId` (los que sí lo tienen vienen de
 * una reserva y no se tocan desde aquí).
 */
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  getPrimaryPropertyImageUrl,
  sortPropertyImages,
} from './lib/propertyImages';

/** Fincas activas para el selector de bloqueo (con miniatura). */
export const listBlockableFincas = query({
  args: {},
  handler: async (ctx) => {
    const [props, allImages] = await Promise.all([
      ctx.db.query('properties').collect(),
      ctx.db.query('propertyImages').collect(),
    ]);

    const imagesByProperty = new Map<string, typeof allImages>();
    for (const img of allImages) {
      const key = String(img.propertyId);
      const list = imagesByProperty.get(key);
      if (list) list.push(img);
      else imagesByProperty.set(key, [img]);
    }

    return props
      .filter((p) => p.active !== false)
      .map((p) => {
        const images = sortPropertyImages(
          imagesByProperty.get(String(p._id)) ?? [],
        );
        return {
          id: p._id,
          title: p.title,
          code: p.code ?? null,
          location: p.location,
          image: getPrimaryPropertyImageUrl(images),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  },
});

/** Bloquea una finca en un rango de fechas (bloqueo manual, sin reserva). */
export const blockProperty = mutation({
  args: {
    propertyId: v.id('properties'),
    /** ms epoch. */
    fechaEntrada: v.number(),
    fechaSalida: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(args.fechaSalida > args.fechaEntrada)) {
      throw new Error('La fecha de salida debe ser posterior a la de entrada.');
    }
    const prop = await ctx.db.get(args.propertyId);
    if (!prop) throw new Error('Finca no encontrada.');
    return await ctx.db.insert('propertyAvailability', {
      propertyId: args.propertyId,
      fechaEntrada: args.fechaEntrada,
      fechaSalida: args.fechaSalida,
      blocked: true,
      reason: args.reason?.trim() || 'Bloqueo manual',
    });
  },
});

/**
 * Bloquea varias fincas con las mismas fechas/motivo.
 * Útil desde el modal "Bloquear fincas" cuando el operador selecciona 1+.
 */
export const blockProperties = mutation({
  args: {
    propertyIds: v.array(v.id('properties')),
    fechaEntrada: v.number(),
    fechaSalida: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(args.fechaSalida > args.fechaEntrada)) {
      throw new Error('La fecha de salida debe ser posterior a la de entrada.');
    }
    const uniqueIds = [...new Set(args.propertyIds.map(String))];
    if (uniqueIds.length === 0) {
      throw new Error('Selecciona al menos una finca.');
    }

    const reason = args.reason?.trim() || 'Bloqueo manual';
    const inserted: string[] = [];

    for (const idStr of uniqueIds) {
      const propertyId = ctx.db.normalizeId('properties', idStr);
      if (!propertyId) continue;
      const prop = await ctx.db.get(propertyId);
      if (!prop) continue;
      const blockId = await ctx.db.insert('propertyAvailability', {
        propertyId,
        fechaEntrada: args.fechaEntrada,
        fechaSalida: args.fechaSalida,
        blocked: true,
        reason,
      });
      inserted.push(String(blockId));
    }

    if (inserted.length === 0) {
      throw new Error('No se pudo bloquear ninguna finca.');
    }

    return { ok: true as const, count: inserted.length };
  },
});

/** Lista los bloqueos MANUALES (sin reserva) con el nombre de la finca. */
export const listBlocks = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('propertyAvailability').collect();
    const manual = all.filter((b) => b.blocked === true && !b.bookingId);
    const rows = [];
    for (const b of manual) {
      const p = await ctx.db.get(b.propertyId);
      rows.push({
        id: b._id,
        propertyId: b.propertyId,
        finca: p?.title ?? '—',
        code: p?.code ?? null,
        fechaEntrada: b.fechaEntrada,
        fechaSalida: b.fechaSalida,
        reason: b.reason ?? '',
      });
    }
    return rows.sort((a, b) => a.fechaEntrada - b.fechaEntrada);
  },
});

/** Quita un bloqueo MANUAL (no permite borrar bloqueos que vienen de reservas). */
export const unblockProperty = mutation({
  args: { blockId: v.id('propertyAvailability') },
  handler: async (ctx, { blockId }) => {
    const b = await ctx.db.get(blockId);
    if (!b) return { ok: false };
    if (b.bookingId) {
      throw new Error(
        'Ese bloqueo viene de una reserva; gestiónalo desde la reserva, no aquí.',
      );
    }
    await ctx.db.delete(blockId);
    return { ok: true };
  },
});
