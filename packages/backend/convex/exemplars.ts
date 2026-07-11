/**
 * CAPA 2 — Acceso a los ejemplares curados (insercion, embeddings, lectura).
 * La busqueda vectorial se hace en agent.ts (ctx.vectorSearch requiere action).
 */
import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

const exemplarInput = v.object({
  clientMessage: v.string(),
  response: v.string(),
  situation: v.optional(v.string()),
  quality: v.string(),
  source: v.string(),
  humanAuthored: v.boolean(),
  sourceConversationId: v.optional(v.string()),
});

export const insertBatch = internalMutation({
  args: { items: v.array(exemplarInput) },
  handler: async (ctx, { items }) => {
    const now = Date.now();
    for (const item of items) {
      await ctx.db.insert('exemplars', {
        ...item,
        embedded: false,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    return items.length;
  },
});

/**
 * Upsert por clave (sourceConversationId): si el seed cambio en el codigo,
 * actualiza el doc y lo marca para re-embeber; si no existe, lo crea.
 */
export const upsertByKey = internalMutation({
  args: { items: v.array(exemplarInput) },
  handler: async (ctx, { items }): Promise<number> => {
    const now = Date.now();
    let changed = 0;
    for (const item of items) {
      if (!item.sourceConversationId) continue;
      const existing = await ctx.db
        .query('exemplars')
        .withIndex('by_source_conversation', (q) =>
          q.eq('sourceConversationId', item.sourceConversationId),
        )
        .first();
      if (existing) {
        if (
          existing.clientMessage !== item.clientMessage ||
          existing.response !== item.response ||
          existing.situation !== item.situation
        ) {
          await ctx.db.patch(existing._id, {
            clientMessage: item.clientMessage,
            response: item.response,
            situation: item.situation,
            embedded: false,
            updatedAt: now,
          });
          changed++;
        }
      } else {
        await ctx.db.insert('exemplars', {
          ...item,
          embedded: false,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        changed++;
      }
    }
    return changed;
  },
});

/** Evita re-curar la misma conversacion dos veces. */
export const hasExemplarsForConversation = internalQuery({
  args: { sourceConversationId: v.string() },
  handler: async (ctx, { sourceConversationId }) => {
    const one = await ctx.db
      .query('exemplars')
      .withIndex('by_source_conversation', (q) =>
        q.eq('sourceConversationId', sourceConversationId),
      )
      .first();
    return one !== null;
  },
});

export const listUnembedded = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const docs = await ctx.db
      .query('exemplars')
      .withIndex('by_embedded', (q) => q.eq('embedded', false))
      .take(limit);
    return docs.map((d) => ({
      _id: d._id,
      clientMessage: d.clientMessage,
      situation: d.situation,
    }));
  },
});

export const saveEmbeddings = internalMutation({
  args: {
    items: v.array(
      v.object({ id: v.id('exemplars'), embedding: v.array(v.float64()) }),
    ),
  },
  handler: async (ctx, { items }) => {
    const now = Date.now();
    for (const { id, embedding } of items) {
      await ctx.db.patch(id, { embedding, embedded: true, updatedAt: now });
    }
  },
});

export const getByIds = internalQuery({
  args: { ids: v.array(v.id('exemplars')) },
  handler: async (ctx, { ids }) => {
    const out: Array<{ clientMessage: string; response: string }> = [];
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (doc && doc.enabled) {
        out.push({ clientMessage: doc.clientMessage, response: doc.response });
      }
    }
    return out;
  },
});
