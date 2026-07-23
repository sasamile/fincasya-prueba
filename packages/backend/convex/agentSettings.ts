/**
 * Configuración global del agente IA (singleton).
 * globalAiEnabled: las conversaciones NUEVAS y elegibles entran en modo bot.
 * Al APAGARLO también pasa a humano todos los chats que estén en modo bot.
 */
import { internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';

const SETTINGS_KEY = 'default';

export const getAgentSettings = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', SETTINGS_KEY))
      .first();
    return {
      globalAiEnabled: row?.globalAiEnabled ?? false,
      metaBotEnabled: row?.metaBotEnabled ?? false,
    };
  },
});

export const setGlobalAiEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', SETTINGS_KEY))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { globalAiEnabled: enabled, updatedAt: now });
    } else {
      await ctx.db.insert('agentSettings', {
        key: SETTINGS_KEY,
        globalAiEnabled: enabled,
        updatedAt: now,
      });
    }

    let deactivatedCount = 0;
    if (!enabled) {
      const aiConversations = await ctx.db
        .query('conversations')
        .withIndex('by_status', (q) => q.eq('status', 'ai'))
        .collect();
      for (const conversation of aiConversations) {
        await ctx.db.patch(conversation._id, {
          status: 'human',
          aiManualOverride: false,
        });
        deactivatedCount += 1;
      }
    }

    return { globalAiEnabled: enabled, deactivatedCount };
  },
});

/** Bot de Messenger/Instagram: switch aparte del de WhatsApp. */
export const setMetaBotEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', SETTINGS_KEY))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { metaBotEnabled: enabled, updatedAt: now });
    } else {
      await ctx.db.insert('agentSettings', {
        key: SETTINGS_KEY,
        globalAiEnabled: false,
        metaBotEnabled: enabled,
        updatedAt: now,
      });
    }
    return { metaBotEnabled: enabled };
  },
});

export const getMetaBotEnabledInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const row = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', SETTINGS_KEY))
      .first();
    return row?.metaBotEnabled ?? false;
  },
});

export const getGlobalAiEnabledInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const row = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', SETTINGS_KEY))
      .first();
    return row?.globalAiEnabled ?? false;
  },
});
