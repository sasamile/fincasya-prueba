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

/** Clave de teléfono para comparar propietario vs contacto: últimos 10 dígitos
 *  (celular colombiano), ignorando indicativo/país y separadores. */
function ownerPhoneKey(raw?: string | null): string {
  return (raw ?? '').replace(/\D+/g, '').slice(-10);
}

/** "ALBA LUCIA HERRERA" -> "Alba Lucia Herrera". */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normaliza el tratamiento registrado ("Sr", "sra", "señora"...) a señor/señora. */
function normalizeTratamiento(raw?: string): string {
  const t = (raw ?? '').trim().toLowerCase().replace(/\./g, '');
  if (t === 'sr' || t === 'señor' || t === 'senor') return 'señor';
  if (t === 'sra' || t === 'señora' || t === 'senora') return 'señora';
  return '';
}

/** Saludo especial para un propietario registrado (cordial + tuteo). Solo
 *  saluda; el Experto humano continúa la atención. */
function buildOwnerGreeting(name?: string, tratamiento?: string): string {
  const n = titleCase((name ?? '').trim());
  const t = normalizeTratamiento(tratamiento);
  const nombreMostrado = n ? `${t ? `${t} ` : ''}${n}` : '';
  const saludo = nombreMostrado ? `¡Hola, ${nombreMostrado}!` : '¡Hola!';
  return `${saludo} 🏡✨ Te saluda el equipo de FincasYa.com. En un momentito uno de nuestros Expertos se comunica contigo para atenderte personalmente 🤝`;
}

/** Orden de estados de WhatsApp: solo se avanza hacia adelante, nunca atrás. */
const STATUS_RANK: Record<string, number> = {
  failed: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

/** Actualiza el estado de entrega/lectura de un saliente por su wamid (webhook). */
export const updateMessageStatusByWamid = internalMutation({
  args: {
    wamid: v.string(),
    status: v.union(
      v.literal('failed'),
      v.literal('accepted'),
      v.literal('sent'),
      v.literal('delivered'),
      v.literal('read'),
    ),
  },
  handler: async (ctx, { wamid, status }) => {
    const msg = await ctx.db
      .query('messages')
      .withIndex('by_wamid', (q) => q.eq('wamid', wamid))
      .first();
    if (!msg) return { found: false };
    const current = msg.whatsappStatus ?? 'accepted';
    // 'failed' siempre se aplica; el resto solo avanza.
    if (status !== 'failed' && (STATUS_RANK[status] ?? 0) <= (STATUS_RANK[current] ?? 0)) {
      return { found: true, skipped: true };
    }
    await ctx.db.patch(msg._id, { whatsappStatus: status });
    return { found: true };
  },
});

/** Registra/limpia una reacción (emoji) sobre un mensaje por su wamid (webhook). */
export const setMessageReaction = internalMutation({
  args: { wamid: v.string(), emoji: v.string() },
  handler: async (ctx, { wamid, emoji }) => {
    const msg = await ctx.db
      .query('messages')
      .withIndex('by_wamid', (q) => q.eq('wamid', wamid))
      .first();
    if (!msg) return { found: false };
    await ctx.db.patch(msg._id, { reaction: emoji || undefined });
    return { found: true };
  },
});

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
    replyToWamid: v.optional(v.string()),
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

    // Detección de propietario UNA sola vez por contacto: si el teléfono
    // coincide con un propietario registrado, se cachea en el contacto para no
    // volver a escanear en cada mensaje.
    if (contact.ownerChecked !== true) {
      const key = ownerPhoneKey(args.phone);
      let match: { propietarioNombre?: string; propietarioTratamiento?: string } | null = null;
      if (key.length === 10) {
        const owners = await ctx.db.query('propertyOwnerInfo').collect();
        match =
          owners.find((o) => ownerPhoneKey(o.propietarioTelefono) === key) ?? null;
      }
      await ctx.db.patch(contact._id, {
        ownerChecked: true,
        isOwner: !!match,
        ownerName: match?.propietarioNombre,
        ownerTratamiento: match?.propietarioTratamiento,
      });
      contact = {
        ...contact,
        ownerChecked: true,
        isOwner: !!match,
        ownerName: match?.propietarioNombre,
        ownerTratamiento: match?.propietarioTratamiento,
      };
    }

    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_contact', (q) => q.eq('contactId', contact._id))
      .collect();
    const sorted = conversations.sort(
      (a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt),
    );
    // Activa = no eliminada del panel ni resuelta (como WhatsApp: eliminar abre hilo nuevo al volver).
    let conversation = sorted.find((c) => !c.deletedAt && c.status !== 'resolved');

    if (!conversation) {
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
      replyToWamid: args.replyToWamid,
      metadata: { source: 'ycloud_inbound_webhook' },
      createdAt: now,
    });
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      inboxUnreadCount: (conversation.inboxUnreadCount ?? 0) + 1,
      ...(conversation.archived ? { archived: false } : {}),
    });

    // PROPIETARIO: si el contacto es un propietario registrado y aún no lo
    // hemos saludado en esta conversación, se le manda un saludo especial y se
    // escala DIRECTO a un Experto (el bot no lo atiende como cliente).
    if (contact.isOwner === true && conversation.ownerGreeted !== true) {
      await ctx.db.patch(conversation._id, {
        status: 'human',
        priority: 'urgent',
        operationalState: 'requires_advisor',
        isOwner: true,
        ownerGreeted: true,
        aiManualOverride: false,
        lastMessageAt: now,
      });
      await ctx.db.insert('messages', {
        conversationId: conversation._id,
        sender: 'system',
        content: `🏠 Propietario detectado${contact.ownerName ? `: ${contact.ownerName}` : ''}. Escalado a un Experto.`,
        type: 'text',
        createdAt: now + 1,
      });
      await ctx.scheduler.runAfter(0, internal.agent.sendOwnerGreeting, {
        conversationId: conversation._id,
        to: args.phone,
        text: buildOwnerGreeting(contact.ownerName, contact.ownerTratamiento),
      });
      return { duplicate: false, owner: true };
    }

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
