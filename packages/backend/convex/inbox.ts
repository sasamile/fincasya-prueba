/**
 * Backend del inbox de asesores (panel web estilo WhatsApp).
 *
 * OJO: funciones publicas SIN auth (fase dev en el deployment `prueba`).
 * Antes de exponer esto a internet real hay que ponerle autenticacion.
 *
 * Responder como asesor:
 *   1. guarda el mensaje (sender 'assistant' + sentByUserId 'panel-asesor')
 *   2. pasa la conversacion a 'human' (el agente IA se apaga para ese chat)
 *   3. agenda el envio real por YCloud y actualiza el wamid al confirmarse
 */
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { sendWhatsappText } from './lib/ycloud';
import {
  countEligibilitySignals,
  canManuallyEnableAi,
  ineligibilityLabel,
  isConversationEligibleForAi,
  isQuickEligibleForAi,
} from './lib/agentEligibility';

const ADVISOR_SENDER_ID = 'panel-asesor';

/** Recorte seguro por code points: no parte emojis (surrogates UTF-16). */
function previewSlice(text: string, max: number): string {
  return Array.from(text).slice(0, max).join('');
}

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_last_message')
      .order('desc')
      .take(100);
    const out = [];
    for (const c of conversations) {
      const contact = await ctx.db.get(c.contactId);
      const lastMsg = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .order('desc')
        .first();
      out.push({
        conversationId: c._id,
        name: contact?.name ?? 'Sin nombre',
        phone: contact?.phone ?? '',
        status: c.status,
        channel: c.channel,
        unread: c.inboxUnreadCount ?? 0,
        priority: c.priority ?? null,
        operationalState: c.operationalState ?? null,
        lastMessageAt: c.lastMessageAt ?? c.createdAt,
        aiEligible: isQuickEligibleForAi(c).eligible,
        aiManualOverride: c.aiManualOverride ?? false,
        preview: lastMsg
          ? {
              content: previewSlice(lastMsg.content, 90),
              sender: lastMsg.sender,
              type: lastMsg.type ?? 'text',
            }
          : null,
      });
    }
    return out;
  },
});

export const getMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(200);
    return recent
      .reverse()
      .filter((m) => !m.deletedAt)
      .map((m) => ({
        id: m._id,
        sender: m.sender,
        content: m.content,
        type: m.type ?? 'text',
        mediaUrl: m.mediaUrl ?? null,
        createdAt: m.createdAt,
        whatsappStatus: m.whatsappStatus ?? null,
        byAdvisor: Boolean(m.sentByUserId),
      }));
  },
});

export const sendAdvisorMessage = mutation({
  args: { conversationId: v.id('conversations'), content: v.string() },
  handler: async (ctx, { conversationId, content }) => {
    const text = content.trim();
    if (!text) return;
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error('Conversacion no existe');
    const now = Date.now();
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: text,
      type: 'text',
      sentByUserId: ADVISOR_SENDER_ID,
      createdAt: now,
    });
    // El asesor toma el control: el agente IA deja de responder este chat.
    await ctx.db.patch(conversationId, { status: 'human', lastMessageAt: now, aiManualOverride: false });
    await ctx.scheduler.runAfter(0, internal.inbox.deliverAdvisorMessage, {
      messageId,
      conversationId,
    });
  },
});

export const markConversationRead = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    await ctx.db.patch(conversationId, {
      inboxUnreadCount: 0,
      inboxLastReadAt: Date.now(),
    });
  },
});

export const setConversationStatus = mutation({
  args: {
    conversationId: v.id('conversations'),
    status: v.union(v.literal('ai'), v.literal('human'), v.literal('resolved')),
  },
  handler: async (ctx, { conversationId, status }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error('Conversacion no existe');

    if (status === 'ai') {
      const manual = canManuallyEnableAi(conversation);
      if (!manual.eligible) {
        throw new Error(ineligibilityLabel(manual.reason ?? 'no_elegible'));
      }
    }

    await ctx.db.patch(conversationId, {
      status,
      aiManualOverride: status === 'ai',
    });

    if (status === 'ai') {
      await ctx.scheduler.runAfter(0, internal.agent.runAgentTurn, {
        conversationId,
      });
    }
    return { status };
  },
});

export const getConversationAiEligibility = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    return await buildEligibility(ctx, conversationId);
  },
});

export const getConversationAiEligibilityInternal = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    return await buildEligibility(ctx, conversationId);
  },
});

async function buildEligibility(ctx: QueryCtx, conversationId: Id<'conversations'>) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) return { eligible: false, reason: 'no_existe', label: 'No existe', autoEligible: false };
  const messages = await ctx.db
    .query('messages')
    .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
    .collect();
  const signals = countEligibilitySignals(messages);
  const auto = isConversationEligibleForAi(conversation, signals);
  const manual = canManuallyEnableAi(conversation);
  return {
    eligible: auto.eligible,
    autoEligible: auto.eligible,
    manualAllowed: manual.eligible,
    reason: auto.reason ?? null,
    label: auto.reason ? ineligibilityLabel(auto.reason) : null,
  };
}

export const demoteIneligibleConversation = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    reason: v.string(),
  },
  handler: async (ctx, { conversationId, reason }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.status !== 'ai') return;
    const now = Date.now();
    await ctx.db.patch(conversationId, { status: 'human' });
    await ctx.db.insert('messages', {
      conversationId,
      sender: 'system',
      content: `🤖 Bot desactivado: ${ineligibilityLabel(reason)}`,
      type: 'text',
      createdAt: now,
    });
  },
});

/** Datos minimos para despachar el mensaje del asesor por YCloud. */
export const getDeliveryInfo = internalMutation({
  args: { messageId: v.id('messages'), conversationId: v.id('conversations') },
  handler: async (
    ctx,
    { messageId, conversationId },
  ): Promise<{ phone: string; content: string } | null> => {
    const message = await ctx.db.get(messageId);
    const conversation = await ctx.db.get(conversationId);
    if (!message || !conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return null;
    return { phone: contact.phone, content: message.content };
  },
});

export const markDelivery = internalMutation({
  args: {
    messageId: v.id('messages'),
    wamid: v.optional(v.string()),
    failed: v.boolean(),
  },
  handler: async (ctx, { messageId, wamid, failed }): Promise<void> => {
    await ctx.db.patch(messageId, {
      wamid,
      whatsappStatus: failed ? 'failed' : 'sent',
    });
  },
});

export const deliverAdvisorMessage = internalAction({
  args: { messageId: v.id('messages'), conversationId: v.id('conversations') },
  handler: async (ctx, { messageId, conversationId }): Promise<void> => {
    const info: { phone: string; content: string } | null = await ctx.runMutation(
      internal.inbox.getDeliveryInfo,
      { messageId, conversationId },
    );
    if (!info) return;
    let wamid: string | undefined;
    let failed = false;
    try {
      const sent = await sendWhatsappText({ to: info.phone, text: info.content });
      wamid = sent.wamid;
    } catch (err) {
      failed = true;
      console.error('[inbox] fallo el envio del mensaje del asesor', err);
    }
    await ctx.runMutation(internal.inbox.markDelivery, { messageId, wamid, failed });
  },
});
