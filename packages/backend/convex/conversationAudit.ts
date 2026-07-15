/**
 * Auditoría de conversaciones (portada de v1): registra quién tomó, liberó,
 * transfirió, resolvió o escribió en cada chat del inbox. Con 2-3 vendedores
 * sobre los mismos chats, esto responde "¿quién atendió esto y cuándo?".
 *
 * A diferencia de v1 (que resolvía nombres contra la tabla `user` al leer),
 * aquí el nombre viaja denormalizado en el evento — los usuarios viven en el
 * componente Better Auth y así evitamos lookups por fila.
 */
import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

export const EVENT_TYPE = v.union(
  v.literal('assigned'),
  v.literal('unassigned'),
  v.literal('transferred'),
  v.literal('resolved'),
  v.literal('message_sent'),
);

export const recordEvent = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    eventType: EVENT_TYPE,
    userId: v.string(),
    userName: v.optional(v.string()),
    previousUserId: v.optional(v.string()),
    previousUserName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('conversationAuditEvents', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** Historial de atención de una conversación (para el panel de contacto). */
export const listByConversation = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const events = await ctx.db
      .query('conversationAuditEvents')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('asc')
      .collect();
    return events.map((e) => ({
      _id: e._id,
      eventType: e.eventType,
      userId: e.userId,
      userName: e.userName ?? e.userId,
      previousUserId: e.previousUserId ?? null,
      previousUserName: e.previousUserName ?? e.previousUserId ?? null,
      createdAt: e.createdAt,
    }));
  },
});

/** Borra la auditoría de una conversación (cascade al eliminar el chat). */
export const removeByConversation = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const events = await ctx.db
      .query('conversationAuditEvents')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .collect();
    await Promise.all(events.map((e) => ctx.db.delete(e._id)));
  },
});
