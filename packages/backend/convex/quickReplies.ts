/**
 * Respuestas rápidas del Experto (atajos "/gracias", "/horario", …).
 * Se administran desde el inbox y se insertan en el compositor al escribir "/".
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/** Normaliza el atajo: minúsculas, sin barra inicial, sin espacios extra. */
function normShortcut(raw: string): string {
  return raw.trim().replace(/^\/+/, '').toLowerCase();
}

export const listQuickReplies = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('quickReplies').collect();
    return rows
      .map((r) => ({ id: r._id, shortcut: r.shortcut, message: r.message }))
      .sort((a, b) => a.shortcut.localeCompare(b.shortcut));
  },
});

export const createQuickReply = mutation({
  args: { shortcut: v.string(), message: v.string() },
  handler: async (ctx, { shortcut, message }) => {
    const sc = normShortcut(shortcut);
    const msg = message.trim();
    if (!sc) throw new Error('El atajo no puede estar vacío');
    if (!msg) throw new Error('El mensaje no puede estar vacío');
    const existing = await ctx.db
      .query('quickReplies')
      .withIndex('by_shortcut', (q) => q.eq('shortcut', sc))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { message: msg, updatedAt: Date.now() });
      return { id: existing._id, updated: true };
    }
    const id = await ctx.db.insert('quickReplies', {
      shortcut: sc,
      message: msg,
      createdAt: Date.now(),
    });
    return { id, updated: false };
  },
});

export const updateQuickReply = mutation({
  args: { id: v.id('quickReplies'), shortcut: v.string(), message: v.string() },
  handler: async (ctx, { id, shortcut, message }) => {
    const sc = normShortcut(shortcut);
    const msg = message.trim();
    if (!sc) throw new Error('El atajo no puede estar vacío');
    if (!msg) throw new Error('El mensaje no puede estar vacío');
    // Que el atajo no choque con OTRA respuesta.
    const clash = await ctx.db
      .query('quickReplies')
      .withIndex('by_shortcut', (q) => q.eq('shortcut', sc))
      .first();
    if (clash && clash._id !== id) {
      throw new Error(`Ya existe una respuesta con el atajo "/${sc}"`);
    }
    await ctx.db.patch(id, { shortcut: sc, message: msg, updatedAt: Date.now() });
  },
});

export const deleteQuickReply = mutation({
  args: { id: v.id('quickReplies') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
