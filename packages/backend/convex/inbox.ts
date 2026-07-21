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
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { sendWhatsappReaction, sendWhatsappText } from './lib/ycloud';
import {
  sendAudioToYcloud,
  sendDocumentToYcloud,
  sendImageToYcloud,
  sendVideoToYcloud,
} from './lib/ycloud/senders';
import { sendCatalogCard, BETWEEN_CATALOG_SENDS_MS, MAX_CATALOG_CARDS, formatCop } from './lib/catalogSend';
import {
  createGlobalPricingCache,
  priceForGlobalRule,
  resolveSeasonNightly,
} from './lib/seasonPricing';
import { buildCatalogoIntro } from './lib/copys';
import { chatCompletion } from './lib/openai';
import {
  buildWebFichaCaption,
  sendWebFichaCard,
  BETWEEN_WEB_FICHA_SENDS_MS,
} from './lib/webFichaSend';
import { isInvalidCatalogMapping } from './lib/metaCatalog';
import { extractCatalogHintsFromChat } from './lib/catalogHints';
import {
  countEligibilitySignals,
  canManuallyEnableAi,
  ineligibilityLabel,
  isConversationEligibleForAi,
  isQuickEligibleForAi,
} from './lib/agentEligibility';
import { fetchPrimaryPropertyImageUrl } from './lib/propertyImages';

const ADVISOR_SENDER_ID = 'panel-Experto';

/**
 * Fuentes de mensajes AUTOMÁTICOS de ausencia / fuera de horario: cuando el
 * cliente solo recibió una de estas plantillas, el chat sigue NO LEÍDO (nadie
 * lo atendió de verdad). Ver el conteo de no leídos en `list`.
 */
const AUTO_AWAY_SOURCES = new Set<string | undefined>([
  'out_of_hours',
  'ycloud_smb_echo_auto',
]);

/** Registra un evento de auditoría de la conversación (trazabilidad multi-asesor). */
async function audit(
  ctx: MutationCtx,
  ev: {
    conversationId: Id<'conversations'>;
    eventType: 'assigned' | 'unassigned' | 'transferred' | 'resolved' | 'message_sent';
    userId: string;
    userName?: string;
    previousUserId?: string;
    previousUserName?: string;
  },
): Promise<void> {
  await ctx.db.insert('conversationAuditEvents', { ...ev, createdAt: Date.now() });
}

/** Recorte seguro por code points: no parte emojis (surrogates UTF-16). */
function previewSlice(text: string, max: number): string {
  return Array.from(text).slice(0, max).join('');
}

/** Extrae product_retailer_id de metadata o del cuerpo plano del pick de catálogo. */
function extractProductRetailerId(m: {
  content: string;
  metadata?: unknown;
  type?: string;
}): string | undefined {
  const meta = (m.metadata ?? null) as {
    productRetailerId?: string;
    product_retailer_id?: string;
  } | null;
  const fromMeta = String(
    meta?.productRetailerId ?? meta?.product_retailer_id ?? '',
  ).trim();
  if (fromMeta) return fromMeta;
  const match = m.content.match(/product_retailer_id:\s*([^\s)\n]+)/i);
  return match?.[1]?.trim() || undefined;
}

type ProductCard = {
  title: string;
  image: string | null;
  priceFrom: number;
  priceOriginal: number | null;
  capacity: number;
  url: string | null;
  productRetailerId: string;
};

async function buildProductCard(
  ctx: QueryCtx,
  retailerId: string,
  retailerToProp: Map<string, Id<'properties'>>,
): Promise<ProductCard | null> {
  let pid = retailerToProp.get(retailerId);
  if (!pid) {
    // Meta a veces manda un retailerId que no es Convex ID (ej. código corto).
    // normalizeId evita el crash "Invalid ID length".
    const asId = ctx.db.normalizeId('properties', retailerId);
    if (asId) {
      const direct = await ctx.db.get(asId);
      if (direct) pid = asId;
    }
  }
  if (!pid) return null;
  const p = await ctx.db.get(pid);
  if (!p) return null;
  const image = await fetchPrimaryPropertyImageUrl(ctx, pid);
  const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
    (x): x is number => typeof x === 'number' && x > 0,
  );
  return {
    title: p.title,
    image,
    priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
    priceOriginal: p.priceOriginal ?? null,
    capacity: p.capacity,
    url: p.slug ? `https://fincasya.com/fincas/${p.slug}` : null,
    productRetailerId: retailerId,
  };
}

/** Fila del listado del inbox (misma forma que `listConversations.page[]`). */
async function toInboxRows(ctx: QueryCtx, conversations: Doc<'conversations'>[]) {
  const allLabels = await ctx.db.query('labels').collect();
  const labelById = new Map(allLabels.map((l) => [String(l._id), l]));
  const catalogMaps = await ctx.db.query('propertyWhatsAppCatalog').collect();
  const retailerToProp = new Map(
    catalogMaps.map((mp) => [mp.productRetailerId, mp.propertyId] as const),
  );

  const out = [];
  for (const c of conversations) {
    if (c.deletedAt) continue;
    const contact = await ctx.db.get(c.contactId);
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
      .order('desc')
      .take(50);
    const visible = recent.filter((m) => !m.deletedAt);
    const lastMsg = visible[0] ?? null;
    const lastReadAt = c.inboxLastReadAt ?? 0;
    let unread = 0;
    for (const m of visible) {
      if (m.sender === 'assistant') {
        if (AUTO_AWAY_SOURCES.has(m.metadata?.source)) continue;
        break;
      }
      if (m.sender === 'system') continue;
      if (m.createdAt <= lastReadAt) break;
      unread++;
    }
    // "Marcar como no leído" manual: inboxUnreadCount ≥ 1 aunque el último
    // mensaje sea del Experto (si no, el badge nunca aparece).
    const forced = c.inboxUnreadCount ?? 0;
    if (forced > unread) unread = forced;
    const labels = (c.labelIds ?? [])
      .map((id) => labelById.get(String(id)))
      .filter((l): l is NonNullable<typeof l> => !!l)
      .map((l) => ({ id: l._id, name: l.name, color: l.color, emoji: l.emoji ?? null }));

    let preview: {
      content: string;
      sender: string;
      type: string;
      whatsappStatus: string | null;
      outbound: boolean;
    } | null = null;
    if (lastMsg) {
      const rid = extractProductRetailerId(lastMsg);
      let content = previewSlice(lastMsg.content, 90);
      let type = lastMsg.type ?? 'text';
      if (rid) {
        type = 'product';
        const card = await buildProductCard(ctx, rid, retailerToProp);
        content = card?.title
          ? `🏡 ${card.title}`
          : '🏡 Seleccionó una finca del catálogo';
      }
      preview = {
        content,
        sender: lastMsg.sender,
        type,
        whatsappStatus:
          lastMsg.sender === 'assistant' ? lastMsg.whatsappStatus ?? null : null,
        outbound: lastMsg.sender === 'assistant',
      };
    }

    out.push({
      conversationId: c._id,
      name: contact?.name ?? 'Sin nombre',
      phone: contact?.phone ?? '',
      status: c.status,
      channel: c.channel,
      unread,
      priority: c.priority ?? null,
      operationalState: c.operationalState ?? null,
      assignedUserId: c.assignedUserId ?? null,
      assignedUserName: c.assignedUserName ?? null,
      lastMessageAt: c.lastMessageAt ?? c.createdAt,
      aiEligible: isQuickEligibleForAi(c).eligible,
      aiManualOverride: c.aiManualOverride ?? false,
      pinned: c.pinned ?? false,
      archived: c.archived ?? false,
      isOwner: c.isOwner ?? false,
      labels,
      preview,
    });
  }
  return out;
}

export const listConversations = query({
  // Requerido por usePaginatedQuery (si es optional, el typecheck de Next falla).
  args: {
    paginationOpts: paginationOptsValidator,
    // Filtro por fecha del último mensaje (ms). El cliente calcula los límites
    // en hora local (Colombia) para "hoy/ayer/antier/rango".
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    // Filtro por Experto asignado (para "ver solo los míos / de X").
    assignedUserId: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, from, to, assignedUserId }) => {
    // Paginado (scroll infinito en el panel): se cargan tandas por orden de
    // último mensaje; el cliente pide más al llegar al fondo de la lista.
    // Con rango de fechas se acota el índice (seek directo, sin escanear todo).
    const useRange = from != null || to != null;
    const indexed = useRange
      ? ctx.db.query('conversations').withIndex('by_last_message', (ix) =>
          ix
            .gte('lastMessageAt', from ?? 0)
            .lte('lastMessageAt', to ?? Number.MAX_SAFE_INTEGER),
        )
      : ctx.db.query('conversations').withIndex('by_last_message');
    let ordered = indexed.order('desc');
    if (assignedUserId != null) {
      ordered = ordered.filter((f) =>
        f.eq(f.field('assignedUserId'), assignedUserId),
      );
    }
    const result = await ordered.paginate(paginationOpts);
    const out = await toInboxRows(ctx, result.page);
    // OJO: el orden "fijadas primero" se aplica en el cliente sobre lo ya
    // cargado — con paginación el servidor entrega por último mensaje.
    return { ...result, page: out };
  },
});

/**
 * Búsqueda GLOBAL de chats por nombre o teléfono (no solo la página cargada).
 * Usa search indexes de contacts; mínimo 2 caracteres.
 */
export const searchConversations = query({
  args: {
    search: v.string(),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    assignedUserId: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const raw = args.search.trim();
    const digits = raw.replace(/\D/g, '');
    if (raw.length < 2 && digits.length < 2) return [];

    const limit = Math.min(Math.max(args.limit ?? 40, 1), 60);
    const contactIds = new Set<Id<'contacts'>>();

    if (raw.length >= 2) {
      const byName = await ctx.db
        .query('contacts')
        .withSearchIndex('search_name', (q) => q.search('name', raw))
        .take(40);
      for (const c of byName) contactIds.add(c._id);
    }

    if (digits.length >= 2) {
      const byPhone = await ctx.db
        .query('contacts')
        .withSearchIndex('search_phone', (q) => q.search('phone', digits))
        .take(40);
      for (const c of byPhone) contactIds.add(c._id);

      // Coincidencia exacta / sufijo común (últimos 10 dígitos) vía índice.
      if (digits.length >= 7) {
        const suffix = digits.slice(-10);
        const candidates = [
          digits,
          suffix,
          `57${suffix}`,
          `+57${suffix}`,
        ];
        for (const phone of candidates) {
          const hit = await ctx.db
            .query('contacts')
            .withIndex('by_phone', (q) => q.eq('phone', phone))
            .first();
          if (hit) contactIds.add(hit._id);
        }
      }
    }

    if (contactIds.size === 0) return [];

    const convs: Doc<'conversations'>[] = [];
    for (const contactId of contactIds) {
      const rows = await ctx.db
        .query('conversations')
        .withIndex('by_contact', (q) => q.eq('contactId', contactId))
        .collect();
      for (const c of rows) {
        if (c.deletedAt) continue;
        if (!args.includeArchived && c.archived) continue;
        if (args.assignedUserId != null && c.assignedUserId !== args.assignedUserId) {
          continue;
        }
        const at = c.lastMessageAt ?? c.createdAt;
        if (args.from != null && at < args.from) continue;
        if (args.to != null && at > args.to) continue;
        convs.push(c);
      }
    }

    convs.sort(
      (a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt),
    );
    return await toInboxRows(ctx, convs.slice(0, limit));
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

    // Fichas Meta + picks de catálogo (texto con product_retailer_id).
    const needsCatalog = ordered.some(
      (m) =>
        (m.type ?? 'text') === 'product' ||
        /product_retailer_id:/i.test(m.content),
    );
    const retailerToProp = new Map<string, Id<'properties'>>();
    if (needsCatalog) {
      const maps = await ctx.db.query('propertyWhatsAppCatalog').collect();
      for (const mp of maps) retailerToProp.set(mp.productRetailerId, mp.propertyId);
    }

    const out = [];
    for (const m of ordered) {
      const rid = extractProductRetailerId(m);
      let product: ProductCard | null = null;
      if (rid) {
        product = await buildProductCard(ctx, rid, retailerToProp);
        // Aunque no resolvamos la finca, devolvemos ficha mínima con el
        // retailerId para que la UI nunca pinte IDs crudos ni pierda el lookup.
        if (!product) {
          product = {
            title: 'Finca del catálogo',
            image: null,
            priceFrom: 0,
            priceOriginal: null,
            capacity: 0,
            url: null,
            productRetailerId: rid,
          };
        }
      }

      // Respuesta citada -> preview del mensaje al que responde. Si el mensaje
      // citado está en la ventana cargada, sale del mapa; si es más viejo (fuera
      // de la ventana), se resuelve por el índice by_wamid para que la cita
      // igual aparezca. Incluye `id` para que la UI pueda saltar al original.
      let replyTo: {
        id: Id<'messages'>;
        content: string;
        sender: string;
        fromAdvisor: boolean;
      } | null = null;
      if (m.replyToWamid) {
        let q = byWamid.get(m.replyToWamid) ?? null;
        if (!q) {
          q = await ctx.db
            .query('messages')
            .withIndex('by_wamid', (ix) => ix.eq('wamid', m.replyToWamid))
            .first();
        }
        if (q) {
          const label =
            q.type === 'audio'
              ? '🎤 Nota de voz'
              : q.type === 'image'
                ? '📷 Foto'
                : q.type === 'video'
                  ? '🎥 Video'
                  : q.type === 'document'
                    ? '📄 Documento'
                    : q.type === 'product'
                      ? '🏡 Ficha de catálogo'
                      : previewSlice(q.content, 120);
          replyTo = {
            id: q._id,
            content: label,
            sender: q.sender,
            fromAdvisor: Boolean(q.sentByUserId),
          };
        }
      }

      const isCatalogPick = Boolean(rid) && m.sender === 'user';
      const isCatalogSend =
        Boolean(rid) && m.sender === 'assistant' && (m.type ?? 'text') === 'product';
      out.push({
        id: m._id,
        sender: m.sender,
        // Contenido limpio para la UI: no mostramos IDs crudos del catálogo.
        content: isCatalogPick
          ? product
            ? `Seleccioné: ${product.title}`
            : 'Seleccioné una finca del catálogo'
          : isCatalogSend && product
            ? `🏡 Ficha de catálogo: ${product.title}`
            : m.content,
        type: product || isCatalogPick || isCatalogSend ? 'product' : (m.type ?? 'text'),
        mediaUrl: m.mediaUrl ?? null,
        mediaFilename: m.mediaFilename ?? null,
        mediaMime: m.mediaMime ?? null,
        mediaSize: m.mediaSize ?? null,
        createdAt: m.createdAt,
        whatsappStatus: m.whatsappStatus ?? null,
        byAdvisor: Boolean(m.sentByUserId),
        reaction: m.reaction ?? null,
        transcription: m.transcription ?? null,
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
          thumb = await fetchPrimaryPropertyImageUrl(ctx, pid);
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
    /** Actor (auditoría): user._id y nombre del Experto logueado. */
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, content, replyToWamid, actorId, actorName }) => {
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
    if (actorId) {
      await audit(ctx, {
        conversationId,
        eventType: 'message_sent',
        userId: actorId,
        userName: actorName,
      });
    }
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
    /** Actor (auditoría): user._id y nombre del Experto logueado. */
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, status, actorId, actorName }) => {
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

    if (status === 'resolved' && actorId) {
      await audit(ctx, {
        conversationId,
        eventType: 'resolved',
        userId: actorId,
        userName: actorName,
      });
    }

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

const MEDIA_KIND = v.union(
  v.literal('image'),
  v.literal('video'),
  v.literal('audio'),
  v.literal('document'),
);

/**
 * El Experto envía un archivo (imagen / video / documento / audio) por WhatsApp.
 * El front sube el archivo a Convex storage (`generateUploadUrl`) y pasa el
 * `storageId`. Aquí se persiste el mensaje saliente y se agenda el envío por
 * YCloud (imágenes/video/audio van por buffer subido a YCloud; los documentos
 * por link público del storage).
 */
export const sendAdvisorMedia = mutation({
  args: {
    conversationId: v.id('conversations'),
    storageId: v.id('_storage'),
    kind: MEDIA_KIND,
    filename: v.string(),
    mimeType: v.string(),
    size: v.optional(v.number()),
    caption: v.optional(v.string()),
    /** Actor (auditoría): user._id y nombre del Experto logueado. */
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { conversationId, storageId, kind, filename, mimeType, size, caption, actorId, actorName },
  ) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error('Conversacion no existe');
    if (actorId) {
      await audit(ctx, {
        conversationId,
        eventType: 'message_sent',
        userId: actorId,
        userName: actorName,
      });
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error('No se pudo obtener la URL del archivo');
    const now = Date.now();
    const cap = caption?.trim() || undefined;
    const placeholder =
      kind === 'image'
        ? '[imagen]'
        : kind === 'video'
          ? '[video]'
          : kind === 'audio'
            ? '[nota de voz]'
            : `[documento] ${filename}`;
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: cap ?? placeholder,
      type: kind,
      mediaUrl: url,
      mediaFilename: filename,
      mediaMime: mimeType,
      mediaSize: size,
      sentByUserId: ADVISOR_SENDER_ID,
      createdAt: now,
    });
    // El Experto toma el control: el agente IA deja de responder este chat.
    await ctx.db.patch(conversationId, {
      status: 'human',
      lastMessageAt: now,
      aiManualOverride: false,
    });
    await ctx.scheduler.runAfter(0, internal.inbox.deliverAdvisorMedia, {
      messageId,
      conversationId,
      storageId,
      kind,
      filename,
      mimeType,
      caption: cap,
    });
    // Nota de voz del Experto desde el panel → transcribir para que el RAG
    // aprenda también de las respuestas por audio (no dispara turno del agente).
    if (kind === 'audio') {
      await ctx.scheduler.runAfter(0, internal.media.autoTranscribeAudio, {
        messageId,
      });
    }
    return { messageId };
  },
});

export const deliverAdvisorMedia = internalAction({
  args: {
    messageId: v.id('messages'),
    conversationId: v.id('conversations'),
    storageId: v.id('_storage'),
    kind: MEDIA_KIND,
    filename: v.string(),
    mimeType: v.string(),
    caption: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { messageId, conversationId, storageId, kind, filename, mimeType, caption },
  ): Promise<void> => {
    const info = await ctx.runMutation(internal.inbox.getDeliveryInfo, {
      messageId,
      conversationId,
    });
    if (!info) return;
    let wamid: string | undefined;
    let failed = false;
    try {
      if (kind === 'document') {
        const url = await ctx.storage.getUrl(storageId);
        if (!url) throw new Error('sin URL de storage para el documento');
        const sent = await sendDocumentToYcloud({
          to: info.phone,
          documentUrl: url,
          filename,
          caption,
        });
        wamid = sent.wamid;
      } else {
        const blob = await ctx.storage.get(storageId);
        if (!blob) throw new Error('sin archivo en storage');
        const buffer = new Uint8Array(await blob.arrayBuffer());
        if (kind === 'image') {
          const sent = await sendImageToYcloud({
            to: info.phone,
            imageBuffer: buffer,
            mimeType,
            filename,
            caption,
          });
          wamid = sent.wamid;
        } else if (kind === 'video') {
          const sent = await sendVideoToYcloud({
            to: info.phone,
            videoBuffer: buffer,
            mimeType,
            filename,
            caption,
          });
          wamid = sent.wamid;
        } else {
          const sent = await sendAudioToYcloud({
            to: info.phone,
            audioBuffer: buffer,
            mimeType,
            filename,
          });
          wamid = sent.wamid;
        }
      }
    } catch (err) {
      failed = true;
      console.error('[inbox] fallo el envio de media del Experto', err);
    }
    await ctx.runMutation(internal.inbox.markDelivery, { messageId, wamid, failed });
  },
});

/**
 * Envía un documento por URL como Experto (ej. PDF de confirmación de
 * reserva que ya vive en una URL — no pasa por _storage).
 */
export const sendAdvisorDocumentByUrl = mutation({
  args: {
    conversationId: v.id('conversations'),
    documentUrl: v.string(),
    filename: v.string(),
    caption: v.optional(v.string()),
    /** Actor (auditoría): user._id y nombre del Experto logueado. */
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, documentUrl, filename, caption, actorId, actorName }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error('Conversacion no existe');
    if (actorId) {
      await audit(ctx, {
        conversationId,
        eventType: 'message_sent',
        userId: actorId,
        userName: actorName,
      });
    }
    const now = Date.now();
    const cap = caption?.trim() || undefined;
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content: cap ?? `[documento] ${filename}`,
      type: 'document',
      mediaUrl: documentUrl,
      mediaFilename: filename,
      mediaMime: 'application/pdf',
      sentByUserId: ADVISOR_SENDER_ID,
      createdAt: now,
    });
    // El Experto toma el control: el agente IA deja de responder este chat.
    await ctx.db.patch(conversationId, {
      status: 'human',
      lastMessageAt: now,
      aiManualOverride: false,
    });
    await ctx.scheduler.runAfter(0, internal.inbox.deliverAdvisorDocumentByUrl, {
      messageId,
      conversationId,
      documentUrl,
      filename,
      caption: cap,
    });
    return { messageId };
  },
});

export const deliverAdvisorDocumentByUrl = internalAction({
  args: {
    messageId: v.id('messages'),
    conversationId: v.id('conversations'),
    documentUrl: v.string(),
    filename: v.string(),
    caption: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { messageId, conversationId, documentUrl, filename, caption },
  ): Promise<void> => {
    const info = await ctx.runMutation(internal.inbox.getDeliveryInfo, {
      messageId,
      conversationId,
    });
    if (!info) return;
    let wamid: string | undefined;
    let failed = false;
    try {
      const sent = await sendDocumentToYcloud({
        to: info.phone,
        documentUrl,
        filename,
        caption,
      });
      wamid = sent.wamid;
    } catch (err) {
      failed = true;
      console.error('[inbox] fallo el envio del documento por URL', err);
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

export const deleteConversation = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const now = Date.now();
    await ctx.db.patch(conversationId, { deletedAt: now });
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .collect();
    await Promise.all(msgs.map((m) => ctx.db.patch(m._id, { deletedAt: now })));
    // Cascade: la auditoría de un chat eliminado no debe quedar huérfana.
    await ctx.runMutation(internal.conversationAudit.removeByConversation, {
      conversationId,
    });
  },
});

export const clearConversationMessages = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .collect();
    await Promise.all(msgs.map((m) => ctx.db.patch(m._id, { deletedAt: Date.now() })));
  },
});

export const markConversationUnread = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return;
    // Fuerza badge ≥ 1 y “olvida” la lectura previa (WhatsApp-like).
    await ctx.db.patch(conversationId, {
      inboxUnreadCount: Math.max(1, conv.inboxUnreadCount ?? 0),
      inboxLastReadAt: undefined,
    });
  },
});

/* ─────────────────────────────────────────────────────────────
 * Acciones en bloque del inbox (menú ⋮): filtros por fecha, asignar
 * chats a un Experto y marcar como leídos por rango. Los límites de
 * fecha los calcula el cliente en hora local (Colombia) y llegan en ms.
 * ───────────────────────────────────────────────────────────── */

const BULK_LIMIT = 2000;

/** Junta las conversaciones activas (no borradas/archivadas) en un rango de
 * último mensaje, opcionalmente filtradas por Experto asignado. */
async function collectConversationsByRange(
  ctx: MutationCtx,
  from?: number,
  to?: number,
  assignedUserId?: string,
) {
  const useRange = from != null || to != null;
  const indexed = useRange
    ? ctx.db.query('conversations').withIndex('by_last_message', (ix) =>
        ix
          .gte('lastMessageAt', from ?? 0)
          .lte('lastMessageAt', to ?? Number.MAX_SAFE_INTEGER),
      )
    : ctx.db.query('conversations').withIndex('by_last_message');
  let q = indexed.order('desc');
  if (assignedUserId != null) {
    q = q.filter((f) => f.eq(f.field('assignedUserId'), assignedUserId));
  }
  const rows = await q.take(BULK_LIMIT);
  return rows.filter((c) => !c.deletedAt && !c.archived);
}

/**
 * Auditoría de una (des)asignación: assigned si no tenía dueño, transferred si
 * cambia de manos, unassigned si se libera. Sin evento si no cambió nada.
 */
async function auditAssignment(
  ctx: MutationCtx,
  conv: Doc<'conversations'>,
  next: { id: string | null; name?: string },
  actor: { id?: string; name?: string },
): Promise<void> {
  const prevId = conv.assignedUserId;
  const prevName = conv.assignedUserName;
  if (!next.id) {
    if (!prevId) return; // ya estaba libre
    await audit(ctx, {
      conversationId: conv._id,
      eventType: 'unassigned',
      userId: actor.id ?? 'system',
      userName: actor.name,
      previousUserId: prevId,
      previousUserName: prevName,
    });
    return;
  }
  if (prevId === next.id) return; // sin cambio
  await audit(ctx, {
    conversationId: conv._id,
    eventType: prevId ? 'transferred' : 'assigned',
    userId: next.id,
    userName: next.name,
    ...(prevId ? { previousUserId: prevId, previousUserName: prevName } : {}),
  });
}

/** Asigna (o desasigna con assignedUserId=null) una selección manual de chats. */
export const assignConversations = mutation({
  args: {
    conversationIds: v.array(v.id('conversations')),
    assignedUserId: v.union(v.string(), v.null()),
    assignedUserName: v.optional(v.string()),
    /** Actor (auditoría): quién hace la asignación desde el panel. */
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { conversationIds, assignedUserId, assignedUserName, actorId, actorName },
  ) => {
    const name = assignedUserName?.trim() || undefined;
    const patch: {
      assignedUserId: string | undefined;
      assignedUserName: string | undefined;
    } = assignedUserId
      ? { assignedUserId, assignedUserName: name }
      : { assignedUserId: undefined, assignedUserName: undefined };
    let done = 0;
    for (const id of conversationIds) {
      const conv = await ctx.db.get(id);
      if (!conv) continue;
      await auditAssignment(
        ctx,
        conv,
        { id: assignedUserId, name },
        { id: actorId, name: actorName },
      );
      await ctx.db.patch(id, patch);
      done++;
    }
    return { done };
  },
});

/** Asigna en bloque todas las conversaciones de un rango de fechas a un Experto. */
export const assignByRange = mutation({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    assignedUserId: v.union(v.string(), v.null()),
    assignedUserName: v.optional(v.string()),
    /** Actor (auditoría): quién hace la asignación desde el panel. */
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { from, to, assignedUserId, assignedUserName, actorId, actorName },
  ) => {
    const rows = await collectConversationsByRange(ctx, from, to);
    const name = assignedUserName?.trim() || undefined;
    const patch: {
      assignedUserId: string | undefined;
      assignedUserName: string | undefined;
    } = assignedUserId
      ? { assignedUserId, assignedUserName: name }
      : { assignedUserId: undefined, assignedUserName: undefined };
    let done = 0;
    for (const c of rows) {
      await auditAssignment(
        ctx,
        c,
        { id: assignedUserId, name },
        { id: actorId, name: actorName },
      );
      await ctx.db.patch(c._id, patch);
      done++;
    }
    return { done, capped: rows.length >= BULK_LIMIT };
  },
});

/** Marca como leídas en bloque todas las conversaciones de un rango de fechas. */
export const markReadByRange = mutation({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    assignedUserId: v.optional(v.string()),
  },
  handler: async (ctx, { from, to, assignedUserId }) => {
    const now = Date.now();
    const rows = await collectConversationsByRange(ctx, from, to, assignedUserId);
    let done = 0;
    for (const c of rows) {
      await ctx.db.patch(c._id, { inboxUnreadCount: 0, inboxLastReadAt: now });
      done++;
    }
    return { done, capped: rows.length >= BULK_LIMIT };
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

      // `sendable` = ¿se puede enviar TÉCNICAMENTE la ficha Meta? Solo depende
      // de que la finca tenga producto registrado en el catálogo Meta.
      // OJO: NO se mira `inWhatsAppCatalog` aquí. Ese toggle es una regla para
      // el BOT ("no la ofrezcas sola"); el Experto sí puede enviarla a mano
      // cuando el cliente la pide. El modal muestra el aviso "el bot no la
      // envía" pero la deja seleccionable.
      let sendable = false;
      if (catalog) {
        const mapping = await ctx.db
          .query('propertyWhatsAppCatalog')
          .withIndex('by_property_and_catalog', (q) =>
            q.eq('propertyId', p._id).eq('catalogId', catalog._id),
          )
          .first();
        sendable =
          Boolean(mapping) &&
          !isInvalidCatalogMapping(mapping!.productRetailerId, String(p._id));
      }

      const imageUrl = await fetchPrimaryPropertyImageUrl(ctx, p._id);

      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const priceFrom = prices.length > 0 ? Math.min(...prices) : 0;

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
    /**
     * ms epoch — si vienen (catálogo automático), el precio de cada ficha es
     * el de la TEMPORADA de esas fechas. Si no vienen (envío manual), se usan
     * las últimas fechas conocidas del chat (lastCatalogSearch); sin nada de
     * eso, cae al "Desde $mín" histórico.
     */
    fechaEntradaMs: v.optional(v.number()),
    fechaSalidaMs: v.optional(v.number()),
    /**
     * Temporada elegida A MANO en el modal (selector, Vane 21-jul): manda
     * sobre las fechas — el precio de cada ficha sale de esa regla global.
     */
    temporadaGlobalId: v.optional(v.id('globalPricing')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds, fechaEntradaMs, fechaSalidaMs, temporadaGlobalId },
  ): Promise<
    | { ok: false; motivo: string }
    | {
        ok: true;
        to: string;
        catalogMetaId: string;
        cards: Array<{
          propertyId: Id<'properties'>;
          title: string;
          retailerId: string;
          bodyText: string;
          alternateRetailerIds?: string[];
        }>;
      }
  > => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return { ok: false, motivo: 'Conversación no existe' };
    // Fechas para el precio de temporada: las del envío o, en manual, las
    // últimas que el cliente pidió en este chat (guardadas por el bot).
    const feMs = fechaEntradaMs ?? conversation.lastCatalogSearch?.fechaEntrada;
    const fsMs = fechaSalidaMs ?? conversation.lastCatalogSearch?.fechaSalida;
    const hayFechas =
      typeof feMs === 'number' && typeof fsMs === 'number' && fsMs > feMs;
    const globalPricingCache = createGlobalPricingCache();
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
      alternateRetailerIds?: string[];
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
      // Precio: temporada elegida a mano > temporada de las fechas > "Desde".
      let season: { nightly: number } | null = null;
      if (temporadaGlobalId) {
        season = {
          nightly: await priceForGlobalRule(ctx.db, p, temporadaGlobalId),
        };
      } else if (hayFechas) {
        season = await resolveSeasonNightly(
          ctx.db,
          p,
          feMs as number,
          fsMs as number,
          globalPricingCache,
        );
      }
      const parts: string[] = [];
      if (season && season.nightly > 0) {
        parts.push(`💰 ${formatCop(season.nightly)} por noche`);
      } else {
        const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
          (x): x is number => typeof x === 'number' && x > 0,
        );
        const desde = prices.length > 0 ? Math.min(...prices) : 0;
        if (desde > 0) parts.push(`💰 Desde ${formatCop(desde)} por noche`);
      }
      parts.push(`👥 Hasta ${p.capacity} personas`);
      cards.push({
        propertyId: p._id,
        title: p.title,
        retailerId: mapping.productRetailerId,
        bodyText: parts.join(' · '),
        alternateRetailerIds: p.code?.trim() ? [p.code.trim()] : undefined,
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
  alternateRetailerIds: v.optional(v.array(v.string())),
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
      card: {
        productRetailerId: card.retailerId,
        bodyText: card.bodyText,
        alternateRetailerIds: card.alternateRetailerIds,
      },
    });

    let nextOk = okCount;
    if (row.ok) {
      nextOk++;
      await ctx.runMutation(internal.agent.recordCatalogSend, {
        conversationId,
        sentByUserId: ADVISOR_SENDER_ID,
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

    // Si esta ficha salió por el catálogo fallback, las siguientes parten de ahí.
    const nextCatalogMetaId = row.catalogIdUsed ?? catalogMetaId;

    const nextIndex = index + 1;
    if (nextIndex < cards.length && nextOk < MAX_CATALOG_CARDS) {
      await ctx.scheduler.runAfter(BETWEEN_CATALOG_SENDS_MS, internal.inbox.deliverCatalogStep, {
        conversationId,
        to,
        catalogMetaId: nextCatalogMetaId,
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
    /** Temporada elegida en el selector del modal (opcional). */
    temporadaGlobalId: v.optional(v.id('globalPricing')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds, temporadaGlobalId },
  ): Promise<{ ok: boolean; sent: number; failed: number; queued?: number; motivo?: string }> => {
    if (propertyIds.length === 0) return { ok: false, sent: 0, failed: 0, motivo: 'Sin selección' };

    const built = await ctx.runQuery(internal.inbox.buildCatalogCardsForSelection, {
      conversationId,
      propertyIds,
      temporadaGlobalId,
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

/**
 * Fincas YA ENVIADAS en esta conversación (bot o manual) — el modal de
 * catálogo las marca para que el Experto no repita sin querer (Vane 21-jul).
 */
export const getSentCatalogIds = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<string[]> => {
    const conv = await ctx.db.get(conversationId);
    return (conv?.lastSentCatalogPropertyIds ?? []).map(String);
  },
});

/** Contexto minimo (telefono + nombre) para el envio automatico de catalogo. */
export const _autoCatalogContact = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return null;
    const contact = await ctx.db.get(conv.contactId);
    if (!contact?.phone) return null;
    return { to: contact.phone, name: contact.baseName ?? contact.name ?? '' };
  },
});

/**
 * Envio MANUAL de catalogo con la MISMA logica del bot (disponibilidad +
 * favoritas + cupo + zona), en un clic. Lo dispara el operador desde el chat
 * cuando esta ocupado. Envia el intro oficial + las fichas y toma la
 * conversacion (queda en modo humano).
 *
 * Si `propertyIds` viene, se respetan (el Experto desmarcó algunas del preview);
 * si no, se usa el pick automático del bot.
 */
export const sendAutoCatalog = action({
  args: {
    conversationId: v.id('conversations'),
    personas: v.optional(v.number()),
    zona: v.optional(v.string()),
    mascotas: v.optional(v.boolean()),
    /** YYYY-MM-DD (para filtrar por disponibilidad). */
    fechaEntrada: v.optional(v.string()),
    fechaSalida: v.optional(v.string()),
    /** Subconjunto elegido en el preview (opcional). */
    propertyIds: v.optional(v.array(v.id('properties'))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    queued?: number;
    enviadas?: string[];
    motivo?: string;
  }> => {
    const feMs = args.fechaEntrada ? Date.parse(args.fechaEntrada) : NaN;
    const fsMs = args.fechaSalida ? Date.parse(args.fechaSalida) : NaN;
    const feOk = Number.isFinite(feMs) ? feMs : undefined;
    const fsOk = Number.isFinite(fsMs) ? fsMs : undefined;

    let propertyIds: Id<'properties'>[];
    let enviadasTitles: string[] | undefined;

    if (args.propertyIds && args.propertyIds.length > 0) {
      propertyIds = args.propertyIds;
    } else {
      const pick = await ctx.runQuery(internal.agent.toolCatalogPick, {
        conversationId: args.conversationId,
        personas: args.personas,
        zona: args.zona,
        mascotas: args.mascotas,
        fechaEntradaMs: feOk,
        fechaSalidaMs: fsOk,
      });
      if (!pick.ok) return { ok: false, motivo: pick.motivo };
      if (pick.items.length === 0) {
        return {
          ok: false,
          motivo:
            'No hay fincas disponibles con esos filtros (fechas / cupo / zona). Ajusta el filtro o busca en otra zona.',
        };
      }
      propertyIds = pick.items
        .slice(0, MAX_CATALOG_CARDS)
        .map((i) => i.propertyId as Id<'properties'>);
      enviadasTitles = pick.items.map((i) => i.title);
    }

    const built = await ctx.runQuery(
      internal.inbox.buildCatalogCardsForSelection,
      {
        conversationId: args.conversationId,
        propertyIds,
        // Precio de temporada según las fechas del filtro del operador.
        fechaEntradaMs: feOk,
        fechaSalidaMs: fsOk,
      },
    );
    if (!built.ok) return { ok: false, motivo: built.motivo };
    if (built.cards.length === 0) {
      return {
        ok: false,
        motivo: 'Ninguna de las fincas seleccionadas tiene ficha Meta lista para enviar.',
      };
    }

    // Persiste filtros para el próximo prefill del modal.
    await ctx.runMutation(internal.agent.saveCatalogSearch, {
      conversationId: args.conversationId,
      location: args.zona,
      fechaEntradaMs: feOk,
      fechaSalidaMs: fsOk,
      minCapacity: args.personas,
      hasPets: args.mascotas,
    });

    await ctx.runMutation(internal.inbox.takeOverConversation, {
      conversationId: args.conversationId,
    });

    // Intro oficial (con el nombre del cliente), igual que el bot.
    const cinfo = await ctx.runQuery(internal.inbox._autoCatalogContact, {
      conversationId: args.conversationId,
    });
    if (cinfo?.to) {
      const introText = buildCatalogoIntro(cinfo.name);
      let introWamid: string | undefined;
      try {
        const s = await sendWhatsappText({ to: cinfo.to, text: introText });
        introWamid = s.wamid;
      } catch (err) {
        console.error('[sendAutoCatalog] fallo el intro', err);
      }
      await ctx.runMutation(internal.agent.saveAssistantMessage, {
        conversationId: args.conversationId,
        content: introText,
        wamid: introWamid,
      });
    }

    await ctx.scheduler.runAfter(0, internal.inbox.deliverCatalogStep, {
      conversationId: args.conversationId,
      to: built.to,
      catalogMetaId: built.catalogMetaId,
      cards: built.cards,
      index: 0,
      okCount: 0,
    });

    return {
      ok: true,
      queued: built.cards.length,
      enviadas: enviadasTitles,
    };
  },
});

/**
 * Preview de lo que mandaría el bot con esos filtros — el Experto puede
 * desmarcar fincas antes de enviar.
 */
export const previewAutoCatalog = action({
  args: {
    conversationId: v.id('conversations'),
    personas: v.optional(v.number()),
    zona: v.optional(v.string()),
    mascotas: v.optional(v.boolean()),
    fechaEntrada: v.optional(v.string()),
    fechaSalida: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    motivo?: string;
    items: Array<{
      propertyId: Id<'properties'>;
      title: string;
      location: string;
      capacity: number;
      priceFrom: number;
      image: string | null;
      isFavorite: boolean;
    }>;
  }> => {
    const feMs = args.fechaEntrada ? Date.parse(args.fechaEntrada) : NaN;
    const fsMs = args.fechaSalida ? Date.parse(args.fechaSalida) : NaN;
    const pick = await ctx.runQuery(internal.agent.toolCatalogPick, {
      conversationId: args.conversationId,
      personas: args.personas,
      zona: args.zona,
      mascotas: args.mascotas,
      fechaEntradaMs: Number.isFinite(feMs) ? feMs : undefined,
      fechaSalidaMs: Number.isFinite(fsMs) ? fsMs : undefined,
    });
    if (!pick.ok) return { ok: false, motivo: pick.motivo, items: [] };
    const slice = pick.items.slice(0, MAX_CATALOG_CARDS);
    const items = await ctx.runQuery(internal.inbox._enrichCatalogPreviewItems, {
      propertyIds: slice.map((i) => i.propertyId as Id<'properties'>),
    });
    return { ok: true, items };
  },
});

/** Datos de UI para el preview del catálogo automático. */
export const _enrichCatalogPreviewItems = internalQuery({
  args: { propertyIds: v.array(v.id('properties')) },
  handler: async (ctx, { propertyIds }) => {
    const out: Array<{
      propertyId: Id<'properties'>;
      title: string;
      location: string;
      capacity: number;
      priceFrom: number;
      image: string | null;
      isFavorite: boolean;
    }> = [];
    for (const propertyId of propertyIds) {
      const p = await ctx.db.get(propertyId);
      if (!p) continue;
      const image = await fetchPrimaryPropertyImageUrl(ctx, p._id);
      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (n): n is number => typeof n === 'number' && n > 0,
      );
      out.push({
        propertyId: p._id,
        title: p.title,
        location: p.location ?? '',
        capacity: p.capacity ?? 0,
        priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
        image,
        isFavorite: p.isFavorite === true,
      });
    }
    return out;
  },
});

/**
 * Mejora la redacción de un borrador del operador con IA, en el tono del equipo
 * FincasYa (botón "✨ Mejorar" del composer). Corrige ortografía/gramática y
 * pule el estilo SIN inventar datos ni agregar información nueva.
 */
export const improveMessageText = action({
  args: { text: v.string() },
  returns: v.object({ improved: v.string() }),
  handler: async (ctx, { text }): Promise<{ improved: string }> => {
    const draft = text.trim();
    if (draft.length === 0) return { improved: '' };
    const system = `Eres el editor de estilo del equipo de FincasYa.com (alquiler de fincas para descanso, atencion por WhatsApp). Reescribe el mensaje que el operador le va a enviar a un cliente. REGLAS:
- Corrige ortografia, tildes y gramatica en espanol colombiano; sin espanglish.
- Aplica el tono del equipo: calido, empatico, profesional y breve (es WhatsApp, no un correo). TUTEO ("tu", "te", "cuentanos") + titulo "Sr."/"Sra." + nombre SOLO si el nombre ya aparece en el mensaje. Nunca "usted".
- 1 a 3 emojis naturales al FINAL del mensaje (🏡 🤝 ✨ 📅 😊 🙌), nunca a media frase.
- PROHIBIDO "pet friendly": di "fincas que aceptan mascotas".
- NO inventes ni agregues datos que no esten en el mensaje (precios, fechas, disponibilidad, nombres, promesas). NO agregues despedidas ni frases nuevas: solo mejora lo que el operador ya escribio.
- Conserva el idioma y la intencion original.
Devuelve UNICAMENTE el mensaje reescrito, sin comillas ni explicaciones.`;
    try {
      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: draft },
        ],
        temperature: 0.4,
      });
      const improved = (content ?? '').trim();
      return { improved: improved.length > 0 ? improved : draft };
    } catch (err) {
      console.error('[improveMessageText] fallo IA', err);
      // Si la IA falla, devolvemos el texto original (el operador no pierde nada).
      return { improved: draft };
    }
  },
});

/**
 * Asistente del Experto: lee el chat y sugiere un mensaje para el borrador.
 * Si la instrucción es una ORDEN operativa (p. ej. enviar catálogo), también
 * devuelve una `action` para abrir esa herramienta con prefill.
 * NO envía por WhatsApp ni escribe en la base — solo recomienda.
 */
export const suggestAdvisorReply = action({
  args: {
    conversationId: v.id('conversations'),
    /** Instrucción opcional del asesor ("pídele la cédula", "envíale fichas…"…). */
    note: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    suggestion: v.string(),
    action: v.optional(
      v.object({
        type: v.literal('open_catalog'),
        label: v.string(),
        fechaEntrada: v.optional(v.string()),
        fechaSalida: v.optional(v.string()),
        personas: v.optional(v.number()),
        zona: v.optional(v.string()),
      }),
    ),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { conversationId, note },
  ): Promise<{
    ok: boolean;
    suggestion: string;
    action?: {
      type: 'open_catalog';
      label: string;
      fechaEntrada?: string;
      fechaSalida?: string;
      personas?: number;
      zona?: string;
    };
    error?: string;
  }> => {
    const context = await ctx.runQuery(internal.agent.getAgentContext, {
      conversationId,
    });
    if (!context) {
      return { ok: false, suggestion: '', error: 'Conversación no existe' };
    }
    const history = context.history.slice(-18);
    if (history.length === 0) {
      return {
        ok: false,
        suggestion: '',
        error: 'Aún no hay mensajes para sugerir una respuesta',
      };
    }

    const transcript = history
      .map((m) => {
        const who = m.sender === 'user' ? 'Cliente' : 'Equipo';
        return `${who}: ${m.content}`;
      })
      .join('\n');

    const contact = context.contactName?.trim() || 'el cliente';
    const noteTrim = (note ?? '').trim();
    const catalogOrder = noteTrim
      ? looksLikeCatalogOrder(noteTrim)
      : false;

    let action:
      | {
          type: 'open_catalog';
          label: string;
          fechaEntrada?: string;
          fechaSalida?: string;
          personas?: number;
          zona?: string;
        }
      | undefined;

    if (catalogOrder) {
      const hints = extractCatalogHintsFromChat(
        `${noteTrim}\n${transcript}`,
      );
      const bits: string[] = [];
      if (hints.fechaEntrada && hints.fechaSalida) {
        bits.push(`${hints.fechaEntrada} → ${hints.fechaSalida}`);
      }
      if (hints.personas) bits.push(`${hints.personas} personas`);
      if (hints.zona) bits.push(hints.zona);
      action = {
        type: 'open_catalog',
        label: bits.length
          ? `Abrir catálogo (${bits.join(' · ')})`
          : 'Abrir catálogo automático',
        fechaEntrada: hints.fechaEntrada,
        fechaSalida: hints.fechaSalida,
        personas: hints.personas,
        zona: hints.zona,
      };
    }

    const system = catalogOrder
      ? `Eres el asistente interno de un Experto de FincasYa.com (alquiler de fincas, WhatsApp).
El Experto VA A ENVIAR el catalogo de fincas ahora (no es una pregunta al cliente).
Redacta UN mensaje corto de acompanamiento (1-2 frases) que diga que le comparte opciones segun fechas/cupo de la instruccion o el historial.
REGLAS:
- Espanol colombiano, tuteo. Calido y breve.
- NO preguntes si quiere que le mandes fichas: ya se las estan enviando.
- NO inventes precios ni disponibilidad concreta.
- 1 emoji al final maximo.
- Devuelve UNICAMENTE el mensaje, sin comillas ni explicaciones.`
      : `Eres el asistente interno de un Experto de FincasYa.com (alquiler de fincas, atencion por WhatsApp).
Tu trabajo: redactar UN mensaje listo para que el Experto lo revise y envie al cliente.
REGLAS:
- Espanol colombiano, tuteo ("tu", "te"). Calido, breve, profesional (WhatsApp, no correo).
- Si conoces el nombre del cliente, puedes usar "Sr."/"Sra." + nombre; si no, no inventes titulo ni nombre.
- 1 a 3 emojis naturales al FINAL (🏡 🤝 ✨ 📅 😊 🙌), nunca a media frase.
- PROHIBIDO "pet friendly": di "fincas que aceptan mascotas".
- NO inventes precios, disponibilidad, numeros de cuenta, fechas ni promesas que no esten en el historial.
- Si falta un dato critico, pide ese dato con naturalidad.
- Si el Experto te dejo una nota/instruccion, priorizala sin inventar datos.
- NO digas que eres una IA ni "como asistente". Escribe como el Experto humano.
Devuelve UNICAMENTE el mensaje sugerido, sin comillas ni explicaciones.`;

    const userPrompt =
      `Cliente: ${contact}\n\nHistorial reciente:\n${transcript}` +
      (noteTrim
        ? `\n\nInstruccion del Experto: ${noteTrim}`
        : '\n\nInstruccion del Experto: sugiere la mejor siguiente respuesta segun el hilo.');

    try {
      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        temperature: catalogOrder ? 0.35 : 0.5,
      });
      const suggestion = (content ?? '').trim();
      if (!suggestion && !action) {
        return {
          ok: false,
          suggestion: '',
          error: 'La IA no devolvió texto. Intenta de nuevo.',
        };
      }
      return {
        ok: true,
        suggestion:
          suggestion ||
          (action
            ? 'Te comparto algunas opciones de fincas según lo que me pediste. 🏡'
            : ''),
        action,
      };
    } catch (err) {
      console.error('[suggestAdvisorReply] fallo IA', err);
      return {
        ok: false,
        suggestion: '',
        error: err instanceof Error ? err.message : 'No se pudo sugerir',
      };
    }
  },
});

/** Detecta órdenes del tipo “envíale fichas / catálogo / opciones”. */
function looksLikeCatalogOrder(note: string): boolean {
  const t = note
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (
    /\b(ficha|catalogo|catalog)s?\b/.test(t) ||
    /\b(enviar|enviarle|enviarles|manda|mandale|mandales|comparte|pasar|mostrar)\b.{0,50}\b(ficha|catalogo|opcion|finca|villa)s?\b/.test(
      t,
    ) ||
    /\b(ficha|catalogo|opcion)s?\b.{0,40}\b(enviar|enviarle|manda|mandale|comparte)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** Prefill del formulario de catálogo automático con lo último que pidió el cliente. */
export const getCatalogPrefill = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return null;
    const s = conv.lastCatalogSearch;
    const toIso = (ms?: number) => {
      if (typeof ms !== 'number' || ms <= 0) return '';
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(ms));
    };

    let fechaEntrada = toIso(s?.fechaEntrada);
    let fechaSalida = toIso(s?.fechaSalida);
    let personas: number | null =
      typeof s?.minCapacity === 'number' ? s.minCapacity : null;
    let zona = (conv.lastRequestedZone ?? s?.location ?? '').trim();
    let mascotas = s?.hasPets === true;

    // Si faltan datos, intenta leerlos de mensajes recientes del cliente.
    if (!fechaEntrada || !fechaSalida || personas == null || !zona) {
      const recent = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
        .order('desc')
        .take(40);
      const userText = recent
        .filter((m) => m.sender === 'user' && !m.deletedAt)
        .map((m) => m.content)
        .join('\n');
      const hints = extractCatalogHintsFromChat(userText);
      if (!fechaEntrada && hints.fechaEntrada) fechaEntrada = hints.fechaEntrada;
      if (!fechaSalida && hints.fechaSalida) fechaSalida = hints.fechaSalida;
      if (personas == null && hints.personas != null) personas = hints.personas;
      if (!zona && hints.zona) zona = hints.zona;
      if (!mascotas && hints.mascotas) mascotas = true;
    }

    return {
      zona,
      personas,
      mascotas,
      fechaEntrada,
      fechaSalida,
    };
  },
});

/** Arma las fichas web (imagen + caption + enlace) para las fincas seleccionadas. */
export const buildWebFichasForSelection = internalQuery({
  args: {
    conversationId: v.id('conversations'),
    propertyIds: v.array(v.id('properties')),
    /** Temporada elegida a mano (manda sobre las fechas del chat). */
    temporadaGlobalId: v.optional(v.id('globalPricing')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds, temporadaGlobalId },
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

    // Precio por TEMPORADA con las últimas fechas conocidas del chat (igual
    // que las fichas Meta); sin fechas, "Desde $mín".
    const feMs = conversation.lastCatalogSearch?.fechaEntrada;
    const fsMs = conversation.lastCatalogSearch?.fechaSalida;
    const hayFechas =
      typeof feMs === 'number' && typeof fsMs === 'number' && fsMs > feMs;
    const globalPricingCache = createGlobalPricingCache();

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

      const imageUrl = await fetchPrimaryPropertyImageUrl(ctx, p._id);
      if (!imageUrl) continue;

      let season: { nightly: number } | null = null;
      if (temporadaGlobalId) {
        season = {
          nightly: await priceForGlobalRule(ctx.db, p, temporadaGlobalId),
        };
      } else if (hayFechas) {
        season = await resolveSeasonNightly(
          ctx.db,
          p,
          feMs as number,
          fsMs as number,
          globalPricingCache,
        );
      }
      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const priceFrom =
        season && season.nightly > 0
          ? season.nightly
          : prices.length > 0
            ? Math.min(...prices)
            : 0;
      const url = `https://fincasya.com/fincas/${slug}`;

      cards.push({
        propertyId: p._id,
        title: p.title,
        imageUrl,
        url,
        caption: buildWebFichaCaption({
          title: p.title,
          location: p.location,
          capacity: p.capacity,
          priceFrom,
          rating: p.rating ?? null,
          url,
          precioDeTemporada: Boolean(season),
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
    /** Temporada elegida en el selector del modal (opcional). */
    temporadaGlobalId: v.optional(v.id('globalPricing')),
  },
  handler: async (
    ctx,
    { conversationId, propertyIds, temporadaGlobalId },
  ): Promise<{ ok: boolean; sent: number; failed: number; queued?: number; motivo?: string }> => {
    if (propertyIds.length === 0) return { ok: false, sent: 0, failed: 0, motivo: 'Sin selección' };

    const built = await ctx.runQuery(internal.inbox.buildWebFichasForSelection, {
      conversationId,
      temporadaGlobalId,
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
