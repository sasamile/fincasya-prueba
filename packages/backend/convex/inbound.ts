/**
 * Persistencia de mensajes entrantes: contacto -> conversacion -> mensaje,
 * con dedup por evento YCloud, y agenda el turno del agente.
 */
import { internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import {
  countEligibilitySignals,
  ineligibilityLabel,
  isConversationEligibleForAi,
} from './lib/agentEligibility';
import { isAppAutoReply } from './lib/appAutoReply';
import { DEFAULT_OWNER_GREETING } from './ownerGreeting';
import { isOutOfHours } from './lib/businessHours';

const AGENT_DEBOUNCE_MS = 7000;
const SETTINGS_KEY = 'default';

/**
 * EMERGENCIA — red de seguridad determinística (portada de v1, calibrada con
 * casos reales). NO dependemos del criterio del LLM para algo crítico; corre
 * ANTES del agente, 24/7. OJO: "ladron" SUELTO falseaba con nombres de finca
 * ("¿está la finca el ladrón?"), por eso exige verbo de acción antes.
 */
const EMERGENCY_RE =
  /\b(emergencia|accidente|me\s+robaron|nos\s+robaron|(?:hay|entr[oó]|vimos|vinieron|estan?\s+entrando)\s+(?:un\s+|unos\s+|varios\s+|los\s+)?ladr[oó]n\w*|asalto|atraco|herid[oa]|sangr\w+|ambulancia|polic[ií]a|incendio|fuego|se\s+est[aá]\s+quemando|me\s+desmay\w*|infarto|convuls\w+|amenaza|amenazan|me\s+amenaz\w*|ayuda\s+urgente|necesito\s+ayuda\s+ya|secuestr\w+|me\s+atacaron)\b/;

const EMERGENCY_HANDOFF_TEXT =
  'Recibí tu mensaje y ya alertamos a nuestro equipo de operaciones para atenderte de inmediato 🚨\n\nSi es una emergencia *médica o de seguridad*, por favor llama también al *123* (línea única nacional). Un experto te contacta por aquí en minutos.';

/** Clave de teléfono para comparar propietario vs contacto: últimos 10 dígitos
 *  (celular colombiano), ignorando indicativo/país y separadores. */
function ownerPhoneKey(raw?: string | null): string {
  return (raw ?? '').replace(/\D+/g, '').slice(-10);
}

/**
 * Busca contacto por variantes de teléfono (exacto, últimos 10, 57…).
 * El eco SMB a veces trae `to` sin indicativo y el contacto está como 57…
 * (o al revés); un match exacto creaba otro chat y el mensaje “desaparecía”.
 */
async function findContactByPhoneVariants(
  ctx: MutationCtx,
  phone: string,
) {
  const digits = phone.replace(/\D+/g, '');
  if (!digits) return null;
  const suffix = digits.length >= 7 ? digits.slice(-10) : digits;
  const candidates = [digits, suffix, `57${suffix}`, `+57${suffix}`];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    const hit = await ctx.db
      .query('contacts')
      .withIndex('by_phone', (q) => q.eq('phone', candidate))
      .first();
    if (hit) return hit;
  }
  return null;
}

/** Nombre del directorio telefónico (.vcf importado) para un teléfono, si existe. */
async function phonebookName(
  ctx: MutationCtx,
  phone: string,
): Promise<string | null> {
  const key = ownerPhoneKey(phone);
  if (key.length !== 10) return null;
  const row = await ctx.db
    .query('phonebook')
    .withIndex('by_phone_key', (q) => q.eq('phoneKey', key))
    .first();
  const name = row?.name?.trim();  return name && name.length > 0 ? name : null;
}

/** ¿El nombre del contacto es solo el número (placeholder sin nombre real)? */
function isPhonePlaceholderName(name: string, phone: string): boolean {
  const n = (name ?? '').trim();
  return n === phone || /^\+?\d[\d\s-]*$/.test(n);
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

/** Normaliza el tratamiento registrado ("Sr", "señora"...) a Sr./Sra. (abreviado). */
function normalizeTratamiento(raw?: string): string {
  const t = (raw ?? '').trim().toLowerCase().replace(/\./g, '');
  if (t === 'sr' || t === 'señor' || t === 'senor') return 'Sr.';
  if (t === 'sra' || t === 'señora' || t === 'senora') return 'Sra.';
  return '';
}

/** Renderiza el saludo del propietario a partir de la plantilla configurable
 *  del panel, sustituyendo {nombre} por "Sr./Sra. Nombre" (o nada si no hay). */
function renderOwnerGreeting(
  template: string,
  name?: string,
  tratamiento?: string,
): string {
  const n = titleCase((name ?? '').trim());
  const t = normalizeTratamiento(tratamiento);
  const nombreMostrado = n ? `${t ? `${t} ` : ''}${n}` : '';
  let out = String(template ?? '').replace(/\{nombre\}/gi, nombreMostrado);
  // Sin nombre: limpia "¡Hola, !" -> "¡Hola!".
  out = out.replace(/¡Hola,\s*!/g, '¡Hola!').replace(/\bHola,\s*!/g, 'Hola!');
  return out.trim();
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

/**
 * Migración one-shot: los mensajes de ausencia capturados ANTES de detectar
 * auto-replies quedaron como Experto ('ycloud_smb_echo' + sentByUserId) y
 * siguen bloqueando el welcome/la elegibilidad en esas conversaciones.
 * Los re-marca como automáticos. Correr con:
 *   bunx convex run inbound:fixAutoReplyEchoes
 */
export const fixAutoReplyEchoes = internalMutation({
  args: {},
  handler: async (ctx) => {
    // El echo de coexistencia existe desde el 13-jul-2026 ~22:45 (Bogotá).
    const since = Date.parse('2026-07-14T03:00:00Z');
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_creation_time', (q) => q.gte('_creationTime', since))
      .collect();
    let fixed = 0;
    for (const m of recent) {
      const source = (m.metadata as { source?: string } | null)?.source;
      if (source !== 'ycloud_smb_echo') continue;
      if (!isAppAutoReply(m.content)) continue;
      await ctx.db.patch(m._id, {
        sentByUserId: undefined,
        metadata: { source: 'ycloud_smb_echo_auto' },
      });
      fixed++;
    }
    return { revisados: recent.length, corregidos: fixed };
  },
});

/**
 * Mensaje enviado por el EQUIPO desde la app de WhatsApp Business
 * (coexistencia YCloud: evento whatsapp.smb.message.echoes). Se guarda como
 * mensaje de Experto para que el panel lo muestre, y el bot SE DETIENE en ese
 * chat — apenas un humano escribe (web o app), el bot para.
 * EXCEPCIÓN: las respuestas automáticas de la app (mensaje de ausencia) no
 * detienen el bot — las manda la app sola, no una persona.
 */
export const ingestAdvisorAppMessage = internalMutation({
  args: {
    eventId: v.string(),
    /** Teléfono del CLIENTE (campo `to` del echo). */
    phone: v.string(),
    content: v.string(),
    msgType: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('audio'),
      v.literal('video'),
      v.literal('document'),
      v.literal('product'),
    ),
    mediaUrl: v.optional(v.string()),
    /** retailerId de ficha Meta si el eco trae interactive/product. */
    productRetailerId: v.optional(v.string()),
    wamid: v.optional(v.string()),
    /** wamid del mensaje citado (Responder desde la app). */
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

    // Si el wamid ya existe, el mensaje salió por el panel/API (o ya se
    // procesó): no duplicar la burbuja.
    if (args.wamid) {
      const existing = await ctx.db
        .query('messages')
        .withIndex('by_wamid', (q) => q.eq('wamid', args.wamid))
        .first();
      if (existing) return { duplicate: true };
    }

    const now = Date.now();
    let contact = await findContactByPhoneVariants(ctx, args.phone);
    if (!contact) {
      // El directorio del .vcf manda: si el equipo tiene guardado este número,
      // el contacto nace con ese nombre (y no con el número pelado).
      const dirName = await phonebookName(ctx, args.phone);
      const contactId = await ctx.db.insert('contacts', {
        phone: args.phone,
        name: dirName ?? args.phone,
        ...(dirName ? { baseName: dirName } : {}),
        createdAt: now,
      });
      contact = await ctx.db.get(contactId);
    }
    if (!contact) return { duplicate: false };

    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_contact', (q) => q.eq('contactId', contact._id))
      .collect();
    const sorted = conversations.sort(
      (a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt),
    );
    let conversation = sorted.find((c) => !c.deletedAt && c.status !== 'resolved');
    if (!conversation) {
      // El equipo abrió la conversación desde el teléfono: nace en humano.
      const conversationId = await ctx.db.insert('conversations', {
        contactId: contact._id,
        channel: 'whatsapp',
        status: 'human',
        operationalState: 'pending_data',
        aiManualOverride: false,
        createdAt: now,
        lastMessageAt: now,
      });
      const created = await ctx.db.get(conversationId);
      if (!created) return { duplicate: false };
      conversation = created;
    }

    // Respuesta automática de la app (mensaje de ausencia): se guarda SIN
    // sentByUserId (no cuenta como Experto para la elegibilidad) y NO detiene
    // el bot.
    const autoReply = args.msgType === 'text' && isAppAutoReply(args.content);

    const retailerId = args.productRetailerId?.trim() || undefined;
    const advisorMessageId = await ctx.db.insert('messages', {
      conversationId: conversation._id,
      sender: 'assistant',
      content: args.content,
      type: args.msgType,
      mediaUrl: args.mediaUrl,
      wamid: args.wamid,
      replyToWamid: args.replyToWamid,
      sentByUserId: autoReply ? undefined : 'whatsapp-app',
      whatsappStatus: 'sent',
      metadata: {
        source: autoReply
          ? 'ycloud_smb_echo_auto'
          : args.msgType === 'product'
            ? 'ycloud_smb_echo_catalog'
            : 'ycloud_smb_echo',
        ...(retailerId ? { productRetailerId: retailerId } : {}),
      },
      createdAt: now,
    });

    // Nota de voz del Experto desde el teléfono → transcribir para que el RAG
    // aprenda también de las respuestas por audio (no dispara turno del agente).
    if (args.msgType === 'audio' && args.mediaUrl) {
      await ctx.scheduler.runAfter(0, internal.media.autoTranscribeAudio, {
        messageId: advisorMessageId,
      });
    }

    // Un humano del equipo escribió desde el teléfono: el bot se detiene.
    // (Las respuestas automáticas de la app NO cuentan como humano.)
    if (
      !autoReply &&
      (conversation.status === 'ai' || conversation.aiManualOverride === true)
    ) {
      await ctx.db.patch(conversation._id, {
        status: 'human',
        aiManualOverride: false,
        lastMessageAt: now,
      });
    } else {
      await ctx.db.patch(conversation._id, { lastMessageAt: now });
    }
    return { duplicate: false, autoReply };
  },
});

/**
 * Resuelve el `product_retailer_id` (finca escogida en el catálogo de WhatsApp)
 * al nombre de la finca, para que al ingresar el pick el agente sepa CUÁL es.
 */
export const resolveCatalogPick = internalQuery({
  args: { retailerId: v.string() },
  handler: async (ctx, { retailerId }) => {
    const mapping = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_retailer', (q) => q.eq('productRetailerId', retailerId))
      .first();
    if (!mapping) return null;
    const prop = await ctx.db.get(mapping.propertyId);
    if (!prop) return null;
    return { propertyId: mapping.propertyId, title: prop.title ?? '' };
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
      v.literal('product'),
    ),
    mediaUrl: v.optional(v.string()),
    wamid: v.optional(v.string()),
    replyToWamid: v.optional(v.string()),
    /** Pick de catálogo Meta: id del producto elegido. */
    productRetailerId: v.optional(v.string()),
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
      // El directorio del .vcf manda sobre el nombre del perfil de WhatsApp:
      // si el equipo tiene guardado este número, el contacto nace con SU nombre.
      const dirName = await phonebookName(ctx, args.phone);
      const contactId = await ctx.db.insert('contacts', {
        phone: args.phone,
        name: dirName || args.customerName || args.phone,
        ...(dirName ? { baseName: dirName } : {}),
        createdAt: now,
      });
      contact = await ctx.db.get(contactId);
    } else if (
      isPhonePlaceholderName(contact.name, contact.phone) &&
      !contact.dealLabel
    ) {
      // Contacto viejo que quedó con el número como nombre: si el directorio
      // lo tiene, se mejora de una vez.
      const dirName = await phonebookName(ctx, args.phone);
      if (dirName) {
        await ctx.db.patch(contact._id, {
          name: dirName,
          baseName: dirName,
          updatedAt: now,
        });
        contact = { ...contact, name: dirName, baseName: dirName };
      }
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
    let isNewConversation = false;

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
      isNewConversation = true;
    }

    // Pick de catálogo entrante: a veces llega como TEXTO con el product_retailer_id
    // en el cuerpo (no como evento 'order'). Resolvemos la finca y guardamos su
    // NOMBRE para que el operador Y el agente sepan cuál escogió el cliente
    // (se conserva el product_retailer_id para que la ficha del inbox lo detecte).
    let pickContent = args.content;
    let pickRetailerId = args.productRetailerId;
    const ridMatch = args.content.match(/product_retailer_id:\s*([^\s)\n]+)/i);
    if (ridMatch) {
      const rid = ridMatch[1].trim();
      pickRetailerId = pickRetailerId ?? rid;
      const mapping = await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_retailer', (q) => q.eq('productRetailerId', rid))
        .first();
      const prop = mapping ? await ctx.db.get(mapping.propertyId) : null;
      const title = prop?.title?.trim();
      if (title && !args.content.includes(title)) {
        pickContent = `🏡 El cliente seleccionó del catálogo: ${title} (product_retailer_id: ${rid})`;
      }
    }

    const messageId = await ctx.db.insert('messages', {
      conversationId: conversation._id,
      sender: 'user',
      content: pickContent,
      type: args.msgType,
      mediaUrl: args.mediaUrl,
      wamid: args.wamid,
      replyToWamid: args.replyToWamid,
      metadata: {
        source: 'ycloud_inbound_webhook',
        ...(pickRetailerId ? { productRetailerId: pickRetailerId } : {}),
      },
      createdAt: now,
    });
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      inboxUnreadCount: (conversation.inboxUnreadCount ?? 0) + 1,
      ...(conversation.archived ? { archived: false } : {}),
    });

    // Nota de voz del cliente cuando ya lo atiende un HUMANO (status !== 'ai'):
    // el bot no corre, así que processInboundMedia no la transcribe. La
    // transcribimos aquí para que el RAG también aprenda del par voz→respuesta.
    if (
      args.msgType === 'audio' &&
      args.mediaUrl &&
      conversation.status !== 'ai'
    ) {
      await ctx.scheduler.runAfter(0, internal.media.autoTranscribeAudio, {
        messageId,
      });
    }

    // EMERGENCIA (regex determinística, 24/7): escala DURO a humano con
    // prioridad urgente sin pasar por el agente. La respuesta al cliente y el
    // tag solo se mandan la primera vez (mensajes seguidos de la misma
    // emergencia no hacen spam), pero la alerta al panel se registra siempre.
    if (args.msgType === 'text' && EMERGENCY_RE.test(args.content.toLowerCase())) {
      const prevTags = conversation.tags ?? [];
      const alreadyFlagged = prevTags.includes('emergencia');
      await ctx.db.patch(conversation._id, {
        status: 'human',
        priority: 'urgent',
        operationalState: 'requires_advisor',
        aiManualOverride: false,
        ...(alreadyFlagged ? {} : { tags: [...prevTags, 'emergencia'] }),
      });
      await ctx.db.insert('messages', {
        conversationId: conversation._id,
        sender: 'system',
        content:
          '🚨🚨🚨 EMERGENCIA detectada en el mensaje del cliente. PRIORIDAD CRÍTICA — contactar de inmediato. La IA quedó en pausa.',
        type: 'text',
        createdAt: now + 1,
        metadata: { kind: 'inbox_escalation_alert', escalationReason: 'emergency' },
      });
      // Solo respondemos al cliente si la IA global está encendida; con la IA
      // apagada el bot no le escribe a nadie (la alerta interna sí queda arriba).
      if (!alreadyFlagged && globalAiEnabled) {
        await ctx.scheduler.runAfter(0, internal.agent.sendHandoffText, {
          conversationId: conversation._id,
          to: args.phone,
          text: EMERGENCY_HANDOFF_TEXT,
        });
      }
      return { duplicate: false, emergency: true };
    }

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
      // Saludo configurable desde el panel (/admin/saludo-propietario): el admin
      // edita el texto y aprueba (enciende/apaga) si se envía. Sin fila: ON por
      // defecto con la plantilla estándar (comportamiento actual).
      const greetingRow = await ctx.db
        .query('ownerGreetingSettings')
        .withIndex('by_scope', (q) => q.eq('scope', 'global'))
        .unique();
      const greetingApproved = greetingRow?.enabled ?? true;
      const greetingTemplate =
        (greetingRow?.content?.trim() || '') || DEFAULT_OWNER_GREETING;
      // ¿Un Experto humano YA intervino en esta conversación? Si sí, NO se manda
      // el saludo automático (el experto ya lo está atendiendo — no hablar
      // encima). La detección/escalado interno se mantiene igual.
      const priorMsgs = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) =>
          q.eq('conversationId', conversation._id),
        )
        .collect();
      const humanIntervino =
        conversation.status === 'human' ||
        priorMsgs.some(
          (m) => m.sender === 'assistant' && m.sentByUserId && !m.deletedAt,
        );
      // Con la IA apagada el bot no le escribe a nadie; solo sale si el admin lo
      // aprobó Y no hay un humano ya atendiendo esta conversación.
      if (globalAiEnabled && greetingApproved && !humanIntervino) {
        await ctx.scheduler.runAfter(0, internal.agent.sendOwnerGreeting, {
          conversationId: conversation._id,
          to: args.phone,
          text: renderOwnerGreeting(
            greetingTemplate,
            contact.ownerName,
            contact.ownerTratamiento,
          ),
        });
      }
      return { duplicate: false, owner: true };
    }

    // FUERA DE HORARIO (config /admin/horarios): distinto según cliente NUEVO
    // vs CON HISTORIAL. Se calcula con festivos y zona Bogotá.
    const bhRow = await ctx.db
      .query('businessHoursSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    const fueraDeHorario =
      (bhRow?.enabled ?? false) && isOutOfHours(now, bhRow?.schedule ?? null);
    // "Con historial" = ya interactuó antes (otra conversación) o es cliente.
    const esRecurrente =
      conversations.some((c) => c._id !== conversation._id) ||
      contact.crmType === 'client' ||
      !!contact.lastReservationAt;

    // CON HISTORIAL + fuera de horario → SOLO el saludo, el bot NO atiende.
    if (fueraDeHorario && esRecurrente) {
      if (conversation.outOfHoursReturningSent !== true) {
        await ctx.scheduler.runAfter(
          0,
          internal.businessHours.sendOutOfHoursReturning,
          { conversationId: conversation._id },
        );
      }
      return { duplicate: false, outOfHours: 'returning' };
    }

    // Mensaje temporal del panel: una sola vez al ABRIR conversación nueva.
    // Con la IA apagada, tampoco sale (el bot no le escribe a nadie).
    if (isNewConversation && globalAiEnabled) {
      await ctx.scheduler.runAfter(
        0,
        internal.whatsappTemporalMessage.sendIfActive,
        {
          conversationId: conversation._id,
          to: args.phone,
        },
      );
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

      // NUEVO + fuera de horario: tras la atención del bot, enviar el cierre
      // (una sola vez). No en el PRIMER mensaje (la bienvenida) para no
      // contradecir. El precheck evita duplicados y respeta si un humano toma.
      if (
        fueraDeHorario &&
        !esRecurrente &&
        !isNewConversation &&
        conversation.outOfHoursClosingSent !== true
      ) {
        await ctx.scheduler.runAfter(
          AGENT_DEBOUNCE_MS + 12000,
          internal.businessHours.sendOutOfHoursClosing,
          { conversationId: conversation._id },
        );
      }
    }
    return { duplicate: false };
  },
});
