/**
 * Listas/etiquetas del inbox (estilo WhatsApp Business). Cada conversación
 * puede pertenecer a varias listas; en el sidebar se muestran como puntos de
 * color. CRUD de listas + asignación por conversación.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const listLabels = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('labels').collect();
    return rows
      .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      .map((l) => ({ id: l._id, name: l.name, color: l.color, emoji: l.emoji ?? null }));
  },
});

export const createLabel = mutation({
  args: { name: v.string(), color: v.string(), emoji: v.optional(v.string()) },
  handler: async (ctx, { name, color, emoji }) => {
    const nm = name.trim();
    if (!nm) throw new Error('El nombre de la lista no puede estar vacío');
    const id = await ctx.db.insert('labels', {
      name: nm,
      color: color || '#21c063',
      emoji: emoji?.trim() || undefined,
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const updateLabel = mutation({
  args: {
    id: v.id('labels'),
    name: v.string(),
    color: v.string(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, color, emoji }) => {
    const nm = name.trim();
    if (!nm) throw new Error('El nombre de la lista no puede estar vacío');
    await ctx.db.patch(id, { name: nm, color: color || '#21c063', emoji: emoji?.trim() || undefined });
  },
});

export const deleteLabel = mutation({
  args: { id: v.id('labels') },
  handler: async (ctx, { id }) => {
    // Quita la etiqueta de las conversaciones que la tengan.
    const convs = await ctx.db.query('conversations').collect();
    for (const c of convs) {
      if (c.labelIds?.some((x) => x === id)) {
        await ctx.db.patch(c._id, { labelIds: c.labelIds.filter((x) => x !== id) });
      }
    }
    await ctx.db.delete(id);
  },
});

/** Asigna/quita una lista a una conversación (toggle). */
export const toggleConversationLabel = mutation({
  args: { conversationId: v.id('conversations'), labelId: v.id('labels') },
  handler: async (ctx, { conversationId, labelId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error('Conversación no existe');
    const current = conv.labelIds ?? [];
    const next = current.some((x) => x === labelId)
      ? current.filter((x) => x !== labelId)
      : [...current, labelId];
    await ctx.db.patch(conversationId, { labelIds: next });
    return { labelIds: next };
  },
});
