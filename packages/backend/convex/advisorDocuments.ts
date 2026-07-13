/**
 * Envío de documentos (contratos PDF, etc.) desde el panel del asesor a la
 * conversación de WhatsApp. Mismo patrón que sendAdvisorMessage +
 * deliverAdvisorMessage del inbox, pero con type "document" y link público.
 */
import { v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { sendDocumentToYcloud } from './lib/ycloud/senders';

const ADVISOR_SENDER_ID = 'panel-Experto';

/** Registra el mensaje saliente y devuelve el teléfono del contacto. */
export const recordOutgoingDocument = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    documentUrl: v.string(),
    filename: v.string(),
    caption: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { conversationId, documentUrl, filename, caption },
  ): Promise<{ messageId: string; phone: string } | null> => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return null;

    const now = Date.now();
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: caption?.trim() || filename,
      type: 'document',
      mediaUrl: documentUrl,
      sentByUserId: ADVISOR_SENDER_ID,
      createdAt: now,
    });
    // El Experto toma el control del chat.
    await ctx.db.patch(conversationId, {
      status: 'human',
      lastMessageAt: now,
      aiManualOverride: false,
    });
    return { messageId: String(messageId), phone: contact.phone };
  },
});

/** Envía un documento por WhatsApp a la conversación (contrato, etc.). */
export const sendDocumentToConversation = action({
  args: {
    conversationId: v.id('conversations'),
    documentUrl: v.string(),
    filename: v.string(),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const rec: { messageId: string; phone: string } | null =
      await ctx.runMutation(internal.advisorDocuments.recordOutgoingDocument, args);
    if (!rec) return { ok: false, error: 'Conversación o teléfono no encontrado.' };

    let wamid: string | undefined;
    let failed = false;
    let error: string | undefined;
    try {
      const sent = await sendDocumentToYcloud({
        to: rec.phone,
        documentUrl: args.documentUrl,
        filename: args.filename,
        caption: args.caption,
      });
      wamid = sent.wamid;
    } catch (err) {
      failed = true;
      error = err instanceof Error ? err.message : 'Error al enviar el documento.';
      console.error('[advisorDocuments] fallo el envío del documento', err);
    }
    await ctx.runMutation(internal.inbox.markDelivery, {
      messageId: rec.messageId as never,
      wamid,
      failed,
    });
    return failed ? { ok: false, error } : { ok: true };
  },
});
