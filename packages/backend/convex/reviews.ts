import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

/**
 * Reseñas por finca (portado de v1, adaptado a `prueba`).
 * Diferencia clave con v1: aquí los usuarios viven en el componente Better Auth
 * (storage aislado, sin lookup desde estas funciones), así que el nombre del
 * huésped viaja DENORMALIZADO en el doc (`userName`) y `list` lo expone como
 * `user: { name, image }` para mantener la forma que espera la UI.
 */

// ============ HELPERS ============

/**
 * Resuelve un propertyId flexible: Id de Convex válido, o `code` de la finca
 * (el slug de la URL suele ser el code) vía el índice `by_code`.
 */
async function resolvePropertyId(
  ctx: QueryCtx,
  propertyId: string,
): Promise<Id<'properties'> | null> {
  const normalized = ctx.db.normalizeId('properties', propertyId);
  if (normalized) return normalized;

  const property = await ctx.db
    .query('properties')
    .withIndex('by_code', (q) => q.eq('code', propertyId))
    .first();
  return property?._id ?? null;
}

/**
 * Recalcula el rating promedio (1 decimal) y el contador de reseñas de una
 * propiedad. Sin reseñas: rating queda undefined (se borra) y reviewsCount 0.
 */
async function updatePropertyStats(ctx: MutationCtx, propertyId: Id<'properties'>) {
  const allReviews = await ctx.db
    .query('reviews')
    .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
    .collect();

  const reviewsCount = allReviews.length;
  const rating =
    reviewsCount > 0
      ? Number(
          (allReviews.reduce((acc, r) => acc + r.rating, 0) / reviewsCount).toFixed(1),
        )
      : undefined;

  await ctx.db.patch(propertyId, { rating, reviewsCount });
}

// ============ QUERIES ============

/** Listar reseñas de una propiedad (desc por creación). */
export const list = query({
  args: {
    propertyId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const propertyId = await resolvePropertyId(ctx, args.propertyId);
    if (!propertyId) return [];

    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
      .order('desc')
      .take(limit);

    // `user` denormalizado: sin lookups a Better Auth (componente aislado).
    return reviews.map((review) => ({
      ...review,
      user: {
        name: review.userName ?? 'Huésped',
        image: null as string | null,
      },
    }));
  },
});

/** Obtener reseña por ID. */
export const getById = query({
  args: { id: v.id('reviews') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============ MUTATIONS ============

/** Crear una nueva reseña y recalcular stats de la propiedad. */
export const create = mutation({
  args: {
    propertyId: v.string(),
    bookingId: v.optional(v.id('bookings')),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    rating: v.number(),
    comment: v.optional(v.string()),
    verified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { propertyId, userName, ...rest } = args;

    if (!Number.isFinite(args.rating) || args.rating < 1 || args.rating > 5) {
      throw new Error('La calificación debe estar entre 1 y 5');
    }

    const normalizedPropertyId = await resolvePropertyId(ctx, propertyId);
    if (!normalizedPropertyId) {
      throw new Error('ID o código de propiedad inválido');
    }

    const now = Date.now();
    const reviewId = await ctx.db.insert('reviews', {
      ...rest,
      propertyId: normalizedPropertyId,
      userName: userName?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    await updatePropertyStats(ctx, normalizedPropertyId);

    return reviewId;
  },
});

/** Actualizar una reseña (rating/comentario) + recálculo de stats si cambió el rating. */
export const update = mutation({
  args: {
    id: v.id('reviews'),
    rating: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    if (
      updates.rating !== undefined &&
      (!Number.isFinite(updates.rating) || updates.rating < 1 || updates.rating > 5)
    ) {
      throw new Error('La calificación debe estar entre 1 y 5');
    }

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('Reseña no encontrada');

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    if (updates.rating !== undefined && updates.rating !== existing.rating) {
      await updatePropertyStats(ctx, existing.propertyId);
    }

    return id;
  },
});

/** Eliminar una reseña + recálculo de stats. */
export const remove = mutation({
  args: { id: v.id('reviews') },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error('Reseña no encontrada');

    await ctx.db.delete(args.id);

    await updatePropertyStats(ctx, existing.propertyId);

    return { success: true };
  },
});
