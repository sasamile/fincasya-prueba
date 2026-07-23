/**
 * BOT EN MESSENGER / INSTAGRAM DIRECT (Adriana, 22-jul).
 *
 * Los DMs de Meta viven en `metaDmThreads`/`metaDmMessages`, que el agente no
 * ve. Este módulo los ESPEJA en `conversations` (el mismo modelo de WhatsApp y
 * del widget web) para que corra EL MISMO agente: mismas fincas, mismas
 * políticas, mismo escalado. Las fichas salen como ficha web (link), no como
 * catálogo de Meta.
 *
 * Teléfono sintético `meta:<threadId>` — mismo truco que el widget (`web:`),
 * así `sendWhatsappText` no intenta mandarlo por WhatsApp.
 *
 * KILL-SWITCH: nada de esto corre si `metaBotEnabled` está apagado, y arranca
 * apagado. El asesor sigue respondiendo a mano como hasta ahora.
 */
import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

/** Teléfono sintético del hilo de Meta. */
export function metaPhone(threadId: string): string {
  return `meta:${threadId}`;
}

/**
 * Espeja un DM entrante en `conversations` y lanza el turno del agente.
 * No hace nada si el bot de Meta está apagado.
 */
export const handleInboundDm = internalMutation({
  args: {
    threadId: v.string(),
    platform: v.union(v.literal('messenger'), v.literal('instagram')),
    participantName: v.optional(v.string()),
    text: v.string(),
  },
  handler: async (ctx, args): Promise<{ handled: boolean }> => {
    const settings = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    if (!(settings?.metaBotEnabled ?? false)) return { handled: false };

    const texto = args.text.trim();
    if (!texto) return { handled: false };

    const phone = metaPhone(args.threadId);
    const now = Date.now();

    // Contacto (uno por hilo de Meta).
    let contact = await ctx.db
      .query('contacts')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();
    if (!contact) {
      const contactId = await ctx.db.insert('contacts', {
        phone,
        name: args.participantName ?? 'Cliente',
        baseName: args.participantName ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
      contact = await ctx.db.get(contactId);
    }
    if (!contact) return { handled: false };

    // Conversación espejo.
    let conversation = await ctx.db
      .query('conversations')
      .withIndex('by_contact', (q) => q.eq('contactId', contact!._id))
      .first();
    if (!conversation) {
      const conversationId = await ctx.db.insert('conversations', {
        contactId: contact._id,
        channel: args.platform,
        metaThreadId: args.threadId,
        status: 'ai',
        lastMessageAt: now,
        createdAt: now,
      });
      conversation = await ctx.db.get(conversationId);
    } else if (!conversation.metaThreadId) {
      await ctx.db.patch(conversation._id, { metaThreadId: args.threadId });
    }
    if (!conversation) return { handled: false };

    // Si un Experto ya tomó el chat, el bot no vuelve a entrar.
    if (conversation.status !== 'ai') return { handled: false };

    const messageId = await ctx.db.insert('messages', {
      conversationId: conversation._id,
      sender: 'user',
      content: texto,
      type: 'text',
      createdAt: now,
    });
    await ctx.db.patch(conversation._id, { lastMessageAt: now });

    await ctx.scheduler.runAfter(0, internal.agent.runAgentTurn, {
      conversationId: conversation._id,
      triggerMessageId: messageId,
    });
    return { handled: true };
  },
});

/**
 * Entrega por la API de Meta un mensaje que el bot ya guardó.
 * Lo llama `agent.saveAssistantMessage`, el único punto por el que pasan TODOS
 * los mensajes del bot — así ninguno se queda sin enviar.
 */
export const deliverBotMessage = internalAction({
  args: { threadId: v.string(), text: v.string() },
  handler: async (ctx, { threadId, text }): Promise<void> => {
    try {
      const thread = await ctx.runQuery(internal.metaBot.getThreadPage, {
        threadId: threadId as Id<'metaDmThreads'>,
      });
      if (!thread?.pageId) return;
      await ctx.runAction(api.metaChannels.sendDmMessage, {
        pageId: thread.pageId,
        threadId: threadId as Id<'metaDmThreads'>,
        message: text,
      });
    } catch (err) {
      console.error('[metaBot] no se pudo entregar el mensaje del bot', err);
    }
  },
});

/** Página a la que pertenece el hilo (para el envío). */
export const getThreadPage = internalQuery({
  args: { threadId: v.id('metaDmThreads') },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    return thread ? { pageId: thread.pageId } : null;
  },
});
