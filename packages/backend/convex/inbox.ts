/**
 * Backend del inbox de Expertoes (panel web estilo WhatsApp).
 *
 * OJO: funciones publicas SIN auth (fase dev en el deployment `prueba`).
 * Antes de exponer esto a internet real hay que ponerle autenticacion.
 *
 * Responder como Experto:
 *   1. guarda el mensaje (sender 'assistant' + sentByUserId 'panel-Experto')
 *   2. pasa la conversacion a 'human' (el agente IA se apaga para ese chat)
 *   3. agenda el envio real por YCloud y actualiza el wamid al confirmarse
 */
import {
  action,
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
import { sendWhatsappReaction, sendWhatsappText } from './lib/ycloud';
import { sendCatalogCard, BETWEEN_CATALOG_SENDS_MS, MAX_CATALOG_CARDS, formatCop } from './lib/catalogSend';
import {
  buildWebFichaCaption,
  sendWebFichaCard,
  BETWEEN_WEB_FICHA_SENDS_MS,
} from './lib/webFichaSend';
import { isInvalidCatalogMapping } from './lib/metaCatalog';
import {
  countEligibilitySignals,
  canManuallyEnableAi,
  ineligibilityLabel,
  isConversationEligibleForAi,
  isQuickEligibleForAi,
} from './lib/agentEligibility';

const ADVISOR_SENDER_ID = 'panel-Experto';

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
    // Catálogo de listas/etiquetas (una vez) para resolver los ids por conversación.
    const allLabels = await ctx.db.query('labels').collect();
    const labelById = new Map(allLabels.map((l) => [String(l._id), l]));

    const out = [];
    for (const c of conversations) {
      const contact = await ctx.db.get(c.contactId);
      const lastMsg = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .order('desc')
        .first();
      const labels = (c.labelIds ?? [])
        .map((id) => labelById.get(String(id)))
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => ({ id: l._id, name: l.name, color: l.color, emoji: l.emoji ?? null }));
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
        pinned: c.pinned ?? false,
        archived: c.archived ?? false,
        isOwner: c.isOwner ?? false,
        labels,
        preview: lastMsg
          ? {
              content: previewSlice(lastMsg.content, 90),
              sender: lastMsg.sender,
              type: lastMsg.type ?? 'text',
              // Estado de entrega solo para salientes (no 'user'/'system').
              whatsappStatus:
                lastMsg.sender === 'assistant' ? lastMsg.whatsappStatus ?? null : null,
              outbound: lastMsg.sender === 'assistant',
            }
          : null,
      });
    }
    // Fijadas primero; dentro de cada grupo se respeta el orden por último mensaje.
    out.sort((a, b) => Number(b.pinned) - Number(a.pinned));
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
    const ordered = recent.reverse().filter((m) => !m.deletedAt);

    // Mapa wamid -> mensaje, para resolver respuestas citadas dentro del set.
    const byWamid = new Map<string, (typeof ordered)[number]>();
    for (const m of ordered) if (m.wamid) byWamid.set(m.wamid, m);

    // Si hay fichas de producto, mapear retailerId -> propertyId una vez.
    const hasProduct = ordered.some((m) => (m.type ?? 'text') === 'product');
    let retailerToProp: Map<string, Id<'properties'>> | null = null;
    if (hasProduct) {
      retailerToProp = new Map();
      const maps = await ctx.db.query('propertyWhatsAppCatalog').collect();
      for (const mp of maps) retailerToProp.set(mp.productRetailerId, mp.propertyId);
    }

    const out = [];
    for (const m of ordered) {
      // Ficha de catálogo -> imagen/precio de la finca (tarjeta rica en el inbox).
      let product: {
        title: string;
        image: string | null;
        priceFrom: number;
        priceOriginal: number | null;
        capacity: number;
        url: string | null;
      } | null = null;
      if ((m.type ?? 'text') === 'product' && retailerToProp) {
        const meta = (m.metadata ?? null) as { productRetailerId?: string } | null;
        const rid = meta?.productRetailerId;
        const pid = rid ? retailerToProp.get(rid) : undefined;
        if (pid) {
          const p = await ctx.db.get(pid);
          if (p) {
            const img = await ctx.db
              .query('propertyImages')
              .withIndex('by_property', (q) => q.eq('propertyId', pid))
              .first();
            const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
              (x): x is number => typeof x === 'number' && x > 0,
            );
            product = {
              title: p.title,
              image: img?.url ?? null,
              priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
              priceOriginal: p.priceOriginal ?? null,
              capacity: p.capacity,
              url: p.slug ? `https://fincasya.com/fincas/${p.slug}` : null,
            };
          }
        }
      }

      // Respuesta citada -> preview del mensaje al que responde.
      let replyTo: { content: string; sender: string; fromAdvisor: boolean } | null = null;
      if (m.replyToWamid) {
        const q = byWamid.get(m.replyToWamid);
        if (q) {
          replyTo = {
            content: previewSlice(q.content, 120),
            sender: q.sender,
            fromAdvisor: Boolean(q.sentByUserId),
          };
        }
      }

      out.push({
        id: m._id,
        sender: m.sender,
        content: m.content,
        type: m.type ?? 'text',
        mediaUrl: m.mediaUrl ?? null,
        createdAt: m.createdAt,
        whatsappStatus: m.whatsappStatus ?? null,
        byAdvisor: Boolean(m.sentByUserId),
        reaction: m.reaction ?? null,
        transcription: m.transcription ?? null,
        // wamid: necesario para citar (Responder) y reaccionar por WhatsApp.
        wamid: m.wamid ?? null,
        product,
        replyTo,
      });
    }
    return out;
  },
});

/* ── Info del contacto (panel lateral, editable de verdad) ── */

export const getContactInfo = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return null;
    const c = await ctx.db.get(conv.contactId);
    if (!c) return null;
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .collect();
    const sharedCount = msgs.filter((m) => m.mediaUrl || m.type === 'product').length;
    const allLabels = await ctx.db.query('labels').collect();
    const labelById = new Map(allLabels.map((l) => [String(l._id), l]));
    const labels = (conv.labelIds ?? [])
      .map((id) => labelById.get(String(id)))
      .filter((l): l is NonNullable<typeof l> => !!l)
      .map((l) => ({ id: l._id, name: l.name, color: l.color, emoji: l.emoji ?? null }));
    return {
      name: c.name,
      phone: c.phone,
      notes: c.notes ?? '',
      photoUrl: c.photoUrl ?? null,
      sharedCount,
      labels,
    };
  },
});

/** Archivos, enlaces y documentos compartidos en la conversación. */
export const getSharedMedia = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(400);

    // Mapa retailerId -> propertyId para las fichas de catálogo (si hay).
    const hasProduct = msgs.some((m) => (m.type ?? 'text') === 'product');
    let retailerToProp: Map<string, Id<'properties'>> | null = null;
    if (hasProduct) {
      retailerToProp = new Map();
      const maps = await ctx.db.query('propertyWhatsAppCatalog').collect();
      for (const mp of maps) retailerToProp.set(mp.productRetailerId, mp.propertyId);
    }

    const urlRe = /(https?:\/\/[^\s]+)/i;
    const items: Array<{
      id: Id<'messages'>;
      kind: 'image' | 'video' | 'audio' | 'document' | 'product' | 'link';
      mediaUrl: string | null;
      thumb: string | null;
      title: string;
      url: string | null;
      createdAt: number;
    }> = [];

    for (const m of msgs) {
      if (m.deletedAt) continue;
      const type = m.type ?? 'text';
      if (type === 'product') {
        let thumb: string | null = null;
        let title = m.content.replace(/^🏡\s*Ficha de catálogo:\s*/i, '');
        const meta = (m.metadata ?? null) as { productRetailerId?: string } | null;
        const pid = meta?.productRetailerId ? retailerToProp?.get(meta.productRetailerId) : undefined;
        if (pid) {
          const img = await ctx.db
            .query('propertyImages')
            .withIndex('by_property', (q) => q.eq('propertyId', pid))
            .first();
          thumb = img?.url ?? null;
          const p = await ctx.db.get(pid);
          if (p) title = p.title;
        }
        items.push({ id: m._id, kind: 'product', mediaUrl: null, thumb, title, url: null, createdAt: m.createdAt });
      } else if (m.mediaUrl && (type === 'image' || type === 'video' || type === 'audio' || type === 'document')) {
        items.push({
          id: m._id,
          kind: type,
          mediaUrl: m.mediaUrl,
          thumb: type === 'image' || type === 'video' ? m.mediaUrl : null,
          title: m.content.replace(/^\[[^\]]+\]\s*/, '') || type,
          url: m.mediaUrl,
          createdAt: m.createdAt,
        });
      } else if (type === 'text') {
        const match = m.content.match(urlRe);
        if (match) {
          items.push({
            id: m._id,
            kind: 'link',
            mediaUrl: null,
            thumb: null,
            title: match[1],
            url: match[1],
            createdAt: m.createdAt,
          });
        }
      }
    }
    return items;
  },
});

export const updateContactName = mutation({
  args: { conversationId: v.id('conversations'), name: v.string() },
  handler: async (ctx, { conversationId, name }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error('Conversación no existe');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('El nombre no puede estar vacío');
    await ctx.db.patch(conv.contactId, {
      name: trimmed,
      baseName: trimmed,
      updatedAt: Date.now(),
    });
  },
});

export const updateContactNotes = mutation({
  args: { conversationId: v.id('conversations'), notes: v.string() },
  handler: async (ctx, { conversationId, notes }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error('Conversación no existe');
    await ctx.db.patch(conv.contactId, {
      notes: notes.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

/** URL temporal de subida a Convex storage (fotos de cliente, media). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const setContactPhoto = mutation({
  args: { conversationId: v.id('conversations'), storageId: v.id('_storage') },
  handler: async (ctx, { conversationId, storageId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error('Conversación no existe');
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error('No se pudo obtener la URL de la foto');
    await ctx.db.patch(conv.contactId, { photoUrl: url, updatedAt: Date.now() });
    return { url };
  },
});

export const sendAdvisorMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    /** wamid del mensaje citado (Responder). */
    replyToWamid: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, content, replyToWamid }) => {
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
      replyToWamid,
      createdAt: now,
    });
    // El Experto toma el control: el agente IA deja de responder este chat.
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

/** Datos minimos para despachar el mensaje del Experto por YCloud. */
export const getDeliveryInfo = internalMutation({
  args: { messageId: v.id('messages'), conversationId: v.id('conversations') },
  handler: async (
    ctx,
    { messageId, conversationId },
  ): Promise<{ phone: string; content: string; replyToWamid?: string } | null> => {
    const message = await ctx.db.get(messageId);
    const conversation = await ctx.db.get(conversationId);
    if (!message || !conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return null;
    return { phone: contact.phone, content: message.content, replyToWamid: message.replyToWamid };
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
    const info: { phone: string; content: string; replyToWamid?: string } | null =
      await ctx.runMutation(internal.inbox.getDeliveryInfo, { messageId, conversationId });
    if (!info) return;
    let wamid: string | undefined;
    let failed = false;
    try {
      const sent = await sendWhatsappText({
        to: info.phone,
        text: info.content,
        contextWamid: info.replyToWamid,
      });
      wamid = sent.wamid;
    } catch (err) {
      failed = true;
      console.error('[inbox] fallo el envio del mensaje del Experto', err);
    }
    await ctx.runMutation(internal.inbox.markDelivery, { messageId, wamid, failed });
  },
});

/* ─────────────────────────────────────────────────────────────
 * Menú por burbuja: reaccionar a un mensaje del cliente.
 * ───────────────────────────────────────────────────────────── */

export const getReactionTarget = internalQuery({
  args: { conversationId: v.id('conversations'), messageId: v.id('messages') },
  handler: async (ctx, { conversationId, messageId }): Promise<{ phone: string; wamid: string } | null> => {
    const message = await ctx.db.get(messageId);
    const conversation = await ctx.db.get(conversationId);
    if (!message || !conversation || !message.wamid) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return null;
    return { phone: contact.phone, wamid: message.wamid };
  },
});

export const setMessageReactionLocal = internalMutation({
  args: { messageId: v.id('messages'), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    await ctx.db.patch(messageId, { reaction: emoji || undefined });
  },
});

/** Reacciona (emoji) a un mensaje del cliente vía WhatsApp. Emoji vacío la quita. */
export const reactToClientMessage = action({
  args: {
    conversationId: v.id('conversations'),
    messageId: v.id('messages'),
    emoji: v.string(),
  },
  handler: async (ctx, { conversationId, messageId, emoji }): Promise<{ ok: boolean; motivo?: string }> => {
    const target = await ctx.runQuery(internal.inbox.getReactionTarget, { conversationId, messageId });
    if (!target) return { ok: false, motivo: 'No se puede reaccionar a este mensaje' };
    try {
      await sendWhatsappReaction({ to: target.phone, wamid: target.wamid, emoji });
    } catch (err) {
      console.error('[inbox] fallo la reacción', err);
      return { ok: false, motivo: err instanceof Error ? err.message : 'Error al reaccionar' };
    }
    await ctx.runMutation(internal.inbox.setMessageReactionLocal, { messageId, emoji });
    return { ok: true };
  },
});

/* ─────────────────────────────────────────────────────────────
 * Menú del sidebar (clic derecho): fijar, archivar, marcar no leído.
 * ───────────────────────────────────────────────────────────── */

export const setConversationPinned = mutation({
  args: { conversationId: v.id('conversations'), pinned: v.boolean() },
  handler: async (ctx, { conversationId, pinned }) => {
    await ctx.db.patch(conversationId, { pinned });
  },
});

export const setConversationArchived = mutation({
  args: { conversationId: v.id('conversations'), archived: v.boolean() },
  handler: async (ctx, { conversationId, archived }) => {
    await ctx.db.patch(conversationId, { archived });
  },
});

export const markConversationUnread = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    await ctx.db.patch(conversationId, {
      inboxUnreadCount: Math.max(1, conv?.inboxUnreadCount ?? 0),
      inboxLastReadAt: undefined,
    });
  },
});

/* ─────────────────────────────────────────────────────────────
 * Catálogo manual: el Experto elige fincas y las envía él mismo.
 * ───────────────────────────────────────────────────────────── */

export type CatalogPropertyRow = {
  propertyId: Id<'properties'>;
  title: string;
  location: string;
  /** Departamento de Colombia (para agrupar el catálogo por categoría). */
  departamento: string | null;
  capacity: number;
  priceFrom: number;
  priceOriginal: number | null;
  image: string | null;
  code: string | null;
  slug: string | null;
  rating: number | null;
  url: string | null;
  /** Incluida en envíos de catálogo Meta/WhatsApp. */
  inWhatsAppCatalog: boolean;
  /** Puede enviarse como ficha web (slug + foto). */
  webSendable: boolean;
  /** false = la finca no tiene ficha registrada en el catálogo Meta → no se puede enviar. */
  sendable: boolean;
};

/** Lista las fincas del catálogo Meta por defecto para el modal "Enviar catálogo". */
export const listCatalogProperties = query({
  args: {},
  handler: async (ctx): Promise<CatalogPropertyRow[]> => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());

    const props = await ctx.db.query('properties').collect();
    const rows: CatalogPropertyRow[] = [];
    for (const p of props) {
      if (p.visible === false) continue;

      const slug = p.slug?.trim() || null;
      const inWhatsAppCatalog = p.visibleInWhatsAppCatalog !== false;

      let sendable = false;
      if (catalog && inWhatsAppCatalog) {
        const mapping = await ctx.db
          .query('propertyWhatsAppCatalog')
          .withIndex('by_property_and_catalog', (q) =>
            q.eq('propertyId', p._id).eq('catalogId', catalog._id),
          )
          .first();
        sendable = Boolean(mapping) && !isInvalidCatalogMapping(mapping!.productRetailerId, String(p._id));
      }

      const img = await ctx.db
        .query('propertyImages')
        .withIndex('by_property', (q) => q.eq('propertyId', p._id))
        .first();

      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const priceFrom = prices.length > 0 ? Math.min(...prices) : 0;
      const imageUrl = img?.url ?? null;

      rows.push({
        propertyId: p._id,
        title: p.title,
        location: p.location,
        departamento: p.departamentos?.[0] ?? null,
        capacity: p.capacity,
        priceFrom,
        priceOriginal: p.priceOriginal ?? null,
        image: imageUrl,
        code: p.code ?? null,
        slug,
        rating: p.rating ?? null,
        url: slug ? `https://fincasya.com/fincas/${slug}` : null,
        inWhatsAppCatalog,
        webSendable: Boolean(slug && imageUrl),
        sendable,
      });
    }

    // Favoritas primero, luego por precio ascendente.
    const favById = new Map(props.map((p) => [String(p._id), p.isFavorite === true]));
    rows.sort((a, b) => {
      const aFav = favById.get(String(a.propertyId)) ? 0 : 1;
      const bFav = favById.get(String(b.propertyId)) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.priceFrom - b.priceFrom;
    });
    return rows;
  },
});

/** Arma las fichas Meta (retailerId + body) para las fincas seleccionadas. */
export const buildCatalogCardsForSelection = internalQuery({
  args: {
    conversationId: v.id('conversations'),
    propertyIds: v.array(v.id('properties')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds },
  ): Promise<
    | { ok: false; motivo: string }
    | {
        ok: true;
        to: string;
        catalogMetaId: string;
        cards: Array<{ propertyId: Id<'properties'>; title: string; retailerId: string; bodyText: string }>;
      }
  > => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return { ok: false, motivo: 'Conversación no existe' };
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return { ok: false, motivo: 'El contacto no tiene teléfono' };

    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) return { ok: false, motivo: 'No hay catálogo WhatsApp configurado' };

    const cards: Array<{
      propertyId: Id<'properties'>;
      title: string;
      retailerId: string;
      bodyText: string;
    }> = [];
    for (const propertyId of propertyIds) {
      const p = await ctx.db.get(propertyId);
      if (!p) continue;
      const mapping = await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_property_and_catalog', (q) =>
          q.eq('propertyId', p._id).eq('catalogId', catalog._id),
        )
        .first();
      if (!mapping) continue; // finca sin ficha Meta → se omite
      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const desde = prices.length > 0 ? Math.min(...prices) : 0;
      const parts: string[] = [];
      if (desde > 0) parts.push(`💰 Desde ${formatCop(desde)} por noche`);
      parts.push(`👥 Hasta ${p.capacity} personas`);
      cards.push({
        propertyId: p._id,
        title: p.title,
        retailerId: mapping.productRetailerId,
        bodyText: parts.join(' · '),
      });
    }
    if (cards.length === 0)
      return { ok: false, motivo: 'Ninguna finca seleccionada tiene ficha en el catálogo Meta' };
    return { ok: true, to: contact.phone, catalogMetaId: catalog.whatsappCatalogId, cards };
  },
});

const catalogQueueCard = v.object({
  propertyId: v.id('properties'),
  title: v.string(),
  retailerId: v.string(),
  bodyText: v.string(),
});

const webFichaQueueCard = v.object({
  propertyId: v.id('properties'),
  title: v.string(),
  imageUrl: v.string(),
  caption: v.string(),
  url: v.string(),
});

/** Envía una ficha Meta y agenda la siguiente (cola en segundo plano). */
export const deliverCatalogStep = internalAction({
  args: {
    conversationId: v.id('conversations'),
    to: v.string(),
    catalogMetaId: v.string(),
    cards: v.array(catalogQueueCard),
    index: v.number(),
    okCount: v.number(),
  },
  handler: async (ctx, { conversationId, to, catalogMetaId, cards, index, okCount }) => {
    if (index >= cards.length || okCount >= MAX_CATALOG_CARDS) return;

    const card = cards[index];
    const row = await sendCatalogCard({
      to,
      catalogId: catalogMetaId,
      card: { productRetailerId: card.retailerId, bodyText: card.bodyText },
    });

    let nextOk = okCount;
    if (row.ok) {
      nextOk++;
      await ctx.runMutation(internal.agent.recordCatalogSend, {
        conversationId,
        sent: [
          {
            propertyId: card.propertyId,
            title: card.title,
            retailerId: card.retailerId,
            wamid: row.wamid,
          },
        ],
      });
    }

    const nextIndex = index + 1;
    if (nextIndex < cards.length && nextOk < MAX_CATALOG_CARDS) {
      await ctx.scheduler.runAfter(BETWEEN_CATALOG_SENDS_MS, internal.inbox.deliverCatalogStep, {
        conversationId,
        to,
        catalogMetaId,
        cards,
        index: nextIndex,
        okCount: nextOk,
      });
    }
  },
});

/**
 * Envía manualmente las fichas de catálogo seleccionadas por el Experto.
 * Encola el envío en segundo plano para no bloquear el panel.
 */
export const sendCatalogSelection = action({
  args: {
    conversationId: v.id('conversations'),
    propertyIds: v.array(v.id('properties')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds },
  ): Promise<{ ok: boolean; sent: number; failed: number; queued?: number; motivo?: string }> => {
    if (propertyIds.length === 0) return { ok: false, sent: 0, failed: 0, motivo: 'Sin selección' };

    const built = await ctx.runQuery(internal.inbox.buildCatalogCardsForSelection, {
      conversationId,
      propertyIds,
    });
    if (!built.ok) return { ok: false, sent: 0, failed: 0, motivo: built.motivo };

    await ctx.runMutation(internal.inbox.takeOverConversation, { conversationId });
    await ctx.scheduler.runAfter(0, internal.inbox.deliverCatalogStep, {
      conversationId,
      to: built.to,
      catalogMetaId: built.catalogMetaId,
      cards: built.cards,
      index: 0,
      okCount: 0,
    });

    return { ok: true, sent: 0, failed: 0, queued: built.cards.length };
  },
});

/** Arma las fichas web (imagen + caption + enlace) para las fincas seleccionadas. */
export const buildWebFichasForSelection = internalQuery({
  args: {
    conversationId: v.id('conversations'),
    propertyIds: v.array(v.id('properties')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds },
  ): Promise<
    | { ok: false; motivo: string }
    | {
        ok: true;
        to: string;
        cards: Array<{
          propertyId: Id<'properties'>;
          title: string;
          imageUrl: string;
          caption: string;
          url: string;
        }>;
      }
  > => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return { ok: false, motivo: 'Conversación no existe' };
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return { ok: false, motivo: 'El contacto no tiene teléfono' };

    const cards: Array<{
      propertyId: Id<'properties'>;
      title: string;
      imageUrl: string;
      caption: string;
      url: string;
    }> = [];

    for (const propertyId of propertyIds) {
      const p = await ctx.db.get(propertyId);
      if (!p || p.visible === false) continue;
      const slug = p.slug?.trim();
      if (!slug) continue;

      const img = await ctx.db
        .query('propertyImages')
        .withIndex('by_property', (q) => q.eq('propertyId', p._id))
        .first();
      if (!img?.url) continue;

      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const priceFrom = prices.length > 0 ? Math.min(...prices) : 0;
      const url = `https://fincasya.com/fincas/${slug}`;

      cards.push({
        propertyId: p._id,
        title: p.title,
        imageUrl: img.url,
        url,
        caption: buildWebFichaCaption({
          title: p.title,
          location: p.location,
          capacity: p.capacity,
          priceFrom,
          rating: p.rating ?? null,
          url,
        }),
      });
    }

    if (cards.length === 0) {
      return { ok: false, motivo: 'Ninguna finca seleccionada tiene slug y foto para ficha web' };
    }
    return { ok: true, to: contact.phone, cards };
  },
});

/** Registra una ficha web enviada (cola en segundo plano). */
export const recordWebFichaOne = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    card: v.object({
      propertyId: v.id('properties'),
      title: v.string(),
      imageUrl: v.string(),
      caption: v.string(),
      url: v.string(),
      wamid: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { conversationId, card }): Promise<void> => {
    const now = Date.now();
    await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: card.caption,
      type: 'image',
      mediaUrl: card.imageUrl,
      wamid: card.wamid,
      whatsappStatus: card.wamid ? 'sent' : undefined,
      sentByUserId: ADVISOR_SENDER_ID,
      metadata: { propertyId: card.propertyId, url: card.url, source: 'advisor_web_ficha' },
      createdAt: now,
    });
    await ctx.db.patch(conversationId, { lastMessageAt: now });
  },
});

/** Envía una ficha web y agenda la siguiente (cola en segundo plano). */
export const deliverWebFichaStep = internalAction({
  args: {
    conversationId: v.id('conversations'),
    to: v.string(),
    cards: v.array(webFichaQueueCard),
    index: v.number(),
  },
  handler: async (ctx, { conversationId, to, cards, index }) => {
    if (index >= cards.length) return;

    const card = cards[index];
    const row = await sendWebFichaCard({
      to,
      card: {
        propertyId: String(card.propertyId),
        imageUrl: card.imageUrl,
        caption: card.caption,
      },
    });

    if (row.ok) {
      await ctx.runMutation(internal.inbox.recordWebFichaOne, {
        conversationId,
        card: { ...card, wamid: row.wamid },
      });
    }

    const nextIndex = index + 1;
    if (nextIndex < cards.length) {
      await ctx.scheduler.runAfter(BETWEEN_WEB_FICHA_SENDS_MS, internal.inbox.deliverWebFichaStep, {
        conversationId,
        to,
        cards,
        index: nextIndex,
      });
    }
  },
});

/** Registra fichas web enviadas manualmente por el Experto (lote síncrono legacy). */
export const recordWebFichaSend = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    sent: v.array(
      v.object({
        propertyId: v.id('properties'),
        title: v.string(),
        imageUrl: v.string(),
        caption: v.string(),
        url: v.string(),
        wamid: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { conversationId, sent }): Promise<void> => {
    const now = Date.now();
    for (const card of sent) {
      await ctx.db.insert('messages', {
        conversationId,
        sender: 'assistant',
        content: card.caption,
        type: 'image',
        mediaUrl: card.imageUrl,
        wamid: card.wamid,
        whatsappStatus: card.wamid ? 'sent' : undefined,
        sentByUserId: ADVISOR_SENDER_ID,
        metadata: { propertyId: card.propertyId, url: card.url, source: 'advisor_web_ficha' },
        createdAt: now,
      });
    }
    await ctx.db.patch(conversationId, { lastMessageAt: now });
  },
});

/** Envía manualmente fichas web (foto + enlace fincasya.com) seleccionadas por el Experto. */
export const sendWebFichaSelection = action({
  args: {
    conversationId: v.id('conversations'),
    propertyIds: v.array(v.id('properties')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds },
  ): Promise<{ ok: boolean; sent: number; failed: number; queued?: number; motivo?: string }> => {
    if (propertyIds.length === 0) return { ok: false, sent: 0, failed: 0, motivo: 'Sin selección' };

    const built = await ctx.runQuery(internal.inbox.buildWebFichasForSelection, {
      conversationId,
      propertyIds,
    });
    if (!built.ok) return { ok: false, sent: 0, failed: 0, motivo: built.motivo };

    await ctx.runMutation(internal.inbox.takeOverConversation, { conversationId });
    await ctx.scheduler.runAfter(0, internal.inbox.deliverWebFichaStep, {
      conversationId,
      to: built.to,
      cards: built.cards,
      index: 0,
    });

    return { ok: true, sent: 0, failed: 0, queued: built.cards.length };
  },
});

/** El Experto toma el control del chat tras enviar catálogo (apaga el bot). */
export const takeOverConversation = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<void> => {
    await ctx.db.patch(conversationId, {
      status: 'human',
      aiManualOverride: false,
      lastMessageAt: Date.now(),
    });
  },
});
