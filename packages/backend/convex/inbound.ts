/**
 * Persistencia de mensajes entrantes: contacto -> conversacion -> mensaje,
 * con dedup por evento YCloud, y agenda el turno del agente.
 */
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import {
  countEligibilitySignals,
  ineligibilityLabel,
  isConversationEligibleForAi,
} from './lib/agentEligibility';

const AGENT_DEBOUNCE_MS = 7000;
const SETTINGS_KEY = 'default';

export const ingestInboundMessage = internalMutation({
  args: {
    eventId: v.string(),
    phone: v.string(),
    customerName: v.string(),
    content: v.string(),
    msgType: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('audio'),
      v.literal('video'),
      v.literal('document'),
    ),
    mediaUrl: v.optional(v.string()),
    wamid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query('ycloudEvents')
      .withIndex('by_event', (q) => q.eq('eventId', args.eventId))
      .first();
    if (seen) return { duplicate: true };
    await ctx.db.insert('ycloudEvents', {
      eventId: args.eventId,
      createdAt: Date.now(),
    });

    const now = Date.now();
    const settingsRow = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', SETTINGS_KEY))
      .first();
    const globalAiEnabled = settingsRow?.globalAiEnabled ?? false;

    let contact = await ctx.db
      .query('contacts')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first();
    if (!contact) {
      const contactId = await ctx.db.insert('contacts', {
        phone: args.phone,
        name: args.customerName || args.phone,
        createdAt: now,
      });
      contact = await ctx.db.get(contactId);
    }
    if (!contact) return { duplicate: false };

    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_contact', (q) => q.eq('contactId', contact._id))
      .collect();
    let conversation = conversations.sort(
      (a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt),
    )[0];

    if (!conversation || conversation.status === 'resolved') {
      const conversationId = await ctx.db.insert('conversations', {
        contactId: contact._id,
        channel: 'whatsapp',
        status: globalAiEnabled ? 'ai' : 'human',
        operationalState: 'pending_data',
        aiManualOverride: false,
        createdAt: now,
        lastMessageAt: now,
      });
      const created = await ctx.db.get(conversationId);
      if (!created) return { duplicate: false };
      conversation = created;
    }

    const messageId = await ctx.db.insert('messages', {
      conversationId: conversation._id,
      sender: 'user',
      content: args.content,
      type: args.msgType,
      mediaUrl: args.mediaUrl,
      wamid: args.wamid,
      metadata: { source: 'ycloud_inbound_webhook' },
      createdAt: now,
    });
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      inboxUnreadCount: (conversation.inboxUnreadCount ?? 0) + 1,
    });

    if (conversation.status === 'ai') {
      const isManual = conversation.aiManualOverride === true;
      if (!isManual) {
        const messages = await ctx.db
          .query('messages')
          .withIndex('by_conversation', (q) => q.eq('conversationId', conversation._id))
          .collect();
        const signals = countEligibilitySignals(messages);
        const eligibility = isConversationEligibleForAi(conversation, signals);
        if (!eligibility.eligible) {
          await ctx.db.patch(conversation._id, { status: 'human', aiManualOverride: false });
          await ctx.db.insert('messages', {
            conversationId: conversation._id,
            sender: 'system',
            content: `🤖 Bot desactivado: ${ineligibilityLabel(eligibility.reason ?? 'no_elegible')}`,
            type: 'text',
            createdAt: now + 1,
          });
          return { duplicate: false };
        }
      }

      if (
        (args.msgType === 'audio' || args.msgType === 'image') &&
        args.mediaUrl
      ) {
        await ctx.scheduler.runAfter(0, internal.media.processInboundMedia, {
          messageId,
          conversationId: conversation._id,
        });
      } else {
        await ctx.scheduler.runAfter(
          AGENT_DEBOUNCE_MS,
          internal.agent.runAgentTurn,
          { conversationId: conversation._id, triggerMessageId: messageId },
        );
      }
    }
    return { duplicate: false };
  },
});
