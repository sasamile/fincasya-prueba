/**
 * Envío de documentos (contratos PDF, etc.) desde el panel del asesor a la
 * conversación de WhatsApp. Mismo patrón que sendAdvisorMessage +
 * deliverAdvisorMessage del inbox, pero con type "document" y link público.
 * También envía imágenes por URL (flyers / QR de cuentas bancarias).
 */
import { v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import {
  sendDocumentToYcloud,
  sendImageToYcloud,
} from './lib/ycloud/senders';
import { normalizePhone } from './lib/ycloud';

const ADVISOR_SENDER_ID = 'panel-Experto';

function guessMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.doc')) return 'application/msword';
  return 'application/octet-stream';
}

function guessImageMime(filename: string, contentType?: string | null): string {
  const ct = contentType?.split(';')[0]?.trim().toLowerCase();
  if (ct?.startsWith('image/')) return ct;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop()?.trim();
    if (base && /\.(jpe?g|png|webp|gif)$/i.test(base)) return base;
  } catch {
    /* ignore */
  }
  return fallback;
}

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
    const safeName = filename.trim() || 'documento.pdf';
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: caption?.trim() || safeName,
      type: 'document',
      mediaUrl: documentUrl,
      mediaFilename: safeName,
      mediaMime: guessMime(safeName),
      sentByUserId: ADVISOR_SENDER_ID,
      createdAt: now,
    });
    // El Experto toma el control del chat.
    await ctx.db.patch(conversationId, {
      status: 'human',
      lastMessageAt: now,
      aiManualOverride: false,
    });
    return { messageId: String(messageId), phone: normalizePhone(contact.phone) };
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
    // WhatsApp acepta PDF de forma fiable; .docx suele fallar en el cliente.
    const filename = args.filename.trim() || 'contrato.pdf';
    if (!/\.pdf$/i.test(filename)) {
      return {
        ok: false,
        error:
          'WhatsApp requiere PDF para el contrato. Convierte a PDF antes de enviar (usa «Ver y enviar»).',
      };
    }

    const rec: { messageId: string; phone: string } | null =
      await ctx.runMutation(internal.advisorDocuments.recordOutgoingDocument, {
        ...args,
        filename,
      });
    if (!rec) return { ok: false, error: 'Conversación o teléfono no encontrado.' };
    if (!rec.phone || rec.phone.length < 10) {
      return { ok: false, error: 'El contacto no tiene un teléfono válido.' };
    }

    let wamid: string | undefined;
    let failed = false;
    let error: string | undefined;
    try {
      const sent = await sendDocumentToYcloud({
        to: rec.phone,
        documentUrl: args.documentUrl,
        filename,
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

/** Registra un mensaje saliente de tipo imagen (flyer / QR de pago). */
export const recordOutgoingImage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    imageUrl: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    caption: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { conversationId, imageUrl, filename, mimeType, caption },
  ): Promise<{ messageId: string; phone: string } | null> => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return null;

    const now = Date.now();
    const safeName = filename.trim() || 'pago.jpg';
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: caption?.trim() || '[imagen]',
      type: 'image',
      mediaUrl: imageUrl,
      mediaFilename: safeName,
      mediaMime: mimeType,
      sentByUserId: ADVISOR_SENDER_ID,
      createdAt: now,
    });
    await ctx.db.patch(conversationId, {
      status: 'human',
      lastMessageAt: now,
      aiManualOverride: false,
    });
    return { messageId: String(messageId), phone: normalizePhone(contact.phone) };
  },
});

/**
 * Envía una imagen por WhatsApp a partir de una URL pública (S3).
 * Usado al mandar el contrato: flyers / QR de las cuentas seleccionadas.
 */
export const sendImageToConversation = action({
  args: {
    conversationId: v.id('conversations'),
    imageUrl: v.string(),
    filename: v.optional(v.string()),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const imageUrl = args.imageUrl.trim();
    if (!imageUrl) {
      return { ok: false, error: 'URL de imagen vacía.' };
    }

    let buffer: Uint8Array;
    let mimeType: string;
    let filename: string;
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        throw new Error(`No se pudo descargar la imagen (${res.status}).`);
      }
      const ab = await res.arrayBuffer();
      buffer = new Uint8Array(ab);
      filename =
        args.filename?.trim() ||
        filenameFromUrl(imageUrl, 'medios-de-pago.jpg');
      mimeType = guessImageMime(filename, res.headers.get('content-type'));
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'No se pudo leer la imagen de la cuenta.',
      };
    }

    const rec: { messageId: string; phone: string } | null =
      await ctx.runMutation(internal.advisorDocuments.recordOutgoingImage, {
        conversationId: args.conversationId,
        imageUrl,
        filename,
        mimeType,
        caption: args.caption,
      });
    if (!rec) return { ok: false, error: 'Conversación o teléfono no encontrado.' };
    if (!rec.phone || rec.phone.length < 10) {
      return { ok: false, error: 'El contacto no tiene un teléfono válido.' };
    }

    let wamid: string | undefined;
    let failed = false;
    let error: string | undefined;
    try {
      const sent = await sendImageToYcloud({
        to: rec.phone,
        imageBuffer: buffer,
        mimeType,
        filename,
        caption: args.caption,
      });
      wamid = sent.wamid;
    } catch (err) {
      failed = true;
      error =
        err instanceof Error ? err.message : 'Error al enviar la imagen.';
      console.error('[advisorDocuments] fallo el envío de imagen', err);
    }
    await ctx.runMutation(internal.inbox.markDelivery, {
      messageId: rec.messageId as never,
      wamid,
      failed,
    });
    return failed ? { ok: false, error } : { ok: true };
  },
});
