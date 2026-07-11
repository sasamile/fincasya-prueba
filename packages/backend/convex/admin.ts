/** Utilidades administrativas (solo CLI/dashboard). */
import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

/** Cambia el ID de catalogo Meta del catalogo default (para probar/corregir). */
/** Activa/desactiva un exemplar por su clave (sourceConversationId). */
export const setExemplarEnabled = internalMutation({
  args: { key: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, enabled }) => {
    const doc = await ctx.db
      .query('exemplars')
      .withIndex('by_source_conversation', (q) => q.eq('sourceConversationId', key))
      .first();
    if (!doc) throw new Error(`No existe exemplar con clave ${key}`);
    await ctx.db.patch(doc._id, { enabled, updatedAt: Date.now() });
    return { key, enabled };
  },
});

export const setCatalogMetaId = internalMutation({
  args: { whatsappCatalogId: v.string() },
  handler: async (ctx, { whatsappCatalogId }) => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) throw new Error('No hay catalogo en whatsappCatalogs');
    const previo = catalog.whatsappCatalogId;
    await ctx.db.patch(catalog._id, { whatsappCatalogId, updatedAt: Date.now() });
    return { previo, nuevo: whatsappCatalogId };
  },
});
