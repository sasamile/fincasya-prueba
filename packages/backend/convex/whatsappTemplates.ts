/**
 * Plantillas de WhatsApp (YCloud): listar las de la cuenta, crear nuevas y
 * enviarlas a una conversación. Se usan desde el botón "+" del inbox.
 *
 * API YCloud:
 *  - GET  /v2/whatsapp/templates?filter.wabaId=…       (listar)
 *  - POST /v2/whatsapp/templates                        (crear → revisión Meta)
 *  - POST /v2/whatsapp/messages/sendDirectly type=template (enviar)
 *  - GET  /v2/whatsapp/phoneNumbers                     (resolver wabaId)
 */
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

const ADVISOR_SENDER_ID = 'panel-Experto';

/** Normaliza a dígitos; celulares locales CO (10 dígitos que empiezan en 3) → 57… */
function normalizeOutboundPhone(raw: string | undefined | null): string {
  const cleaned = String(raw ?? '').replace(/[^\d]/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 10 && cleaned.startsWith('3')) return `57${cleaned}`;
  return cleaned;
}

function requireYcloudEnv() {
  const apiKey = process.env.YCLOUD_API_KEY;
  const wabaNumber = process.env.YCLOUD_WABA_NUMBER;
  if (!apiKey || !wabaNumber) {
    throw new Error('Configura YCLOUD_API_KEY y YCLOUD_WABA_NUMBER en Convex');
  }
  return { apiKey, wabaNumber };
}

async function ycloudFetch(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const { apiKey } = requireYcloudEnv();
  const res = await fetch(`https://api.ycloud.com/v2${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message?: unknown }).message)
        : text.slice(0, 300);
    throw new Error(`YCloud ${res.status}: ${detail}`);
  }
  return parsed;
}

/** wabaId de la cuenta: env YCLOUD_WABA_ID o resuelto desde el número. */
async function resolveWabaId(): Promise<string> {
  const fromEnv = process.env.YCLOUD_WABA_ID;
  if (fromEnv) return fromEnv;
  const { wabaNumber } = requireYcloudEnv();
  const page = (await ycloudFetch('/whatsapp/phoneNumbers?limit=20')) as {
    items?: Array<{ wabaId?: string; phoneNumber?: string }>;
  };
  const digits = (s: string) => s.replace(/\D+/g, '');
  const ours = (page.items ?? []).find(
    (p) => p.phoneNumber && digits(p.phoneNumber) === digits(wabaNumber),
  );
  const wabaId = ours?.wabaId ?? page.items?.[0]?.wabaId;
  if (!wabaId) {
    throw new Error('No se pudo resolver el wabaId de la cuenta YCloud');
  }
  return wabaId;
}

type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type?: string; text?: string }>;
};

type YcloudTemplate = {
  wabaId?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  qualityRating?: string;
  reason?: string;
  components?: TemplateComponent[];
  updateTime?: string;
};

export type TemplateSummary = {
  name: string;
  language: string;
  category: string;
  status: string;
  qualityRating: string | null;
  reason: string | null;
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  buttons: string[];
  /** Número de variables {{n}} del cuerpo. */
  variablesCount: number;
};

function countBodyVariables(body: string): number {
  let max = 0;
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

function summarize(t: YcloudTemplate): TemplateSummary | null {
  if (!t.name || !t.language) return null;
  const comps = t.components ?? [];
  const header = comps.find((c) => (c.type ?? '').toUpperCase() === 'HEADER');
  const body = comps.find((c) => (c.type ?? '').toUpperCase() === 'BODY');
  const footer = comps.find((c) => (c.type ?? '').toUpperCase() === 'FOOTER');
  const buttons = comps.find((c) => (c.type ?? '').toUpperCase() === 'BUTTONS');
  const bodyText = body?.text ?? '';
  return {
    name: t.name,
    language: t.language,
    category: t.category ?? 'UTILITY',
    status: t.status ?? 'UNKNOWN',
    qualityRating: t.qualityRating ?? null,
    reason: t.reason ?? null,
    headerText: header?.format === 'TEXT' ? (header.text ?? null) : null,
    bodyText,
    footerText: footer?.text ?? null,
    buttons: (buttons?.buttons ?? [])
      .map((b) => b.text ?? '')
      .filter(Boolean),
    variablesCount: countBodyVariables(bodyText),
  };
}

/** Trae las plantillas de la cuenta YCloud (todas las páginas razonables). */
export const listTemplates = action({
  args: {},
  handler: async (): Promise<{ items: TemplateSummary[] }> => {
    const wabaId = await resolveWabaId();
    const page = (await ycloudFetch(
      `/whatsapp/templates?filter.wabaId=${encodeURIComponent(wabaId)}&limit=100`,
    )) as { items?: YcloudTemplate[] };
    const items = (page.items ?? [])
      .map(summarize)
      .filter((t): t is TemplateSummary => t !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { items };
  },
});

/** Crea una plantilla (queda en revisión de Meta hasta ser aprobada). */
export const createTemplate = action({
  args: {
    name: v.string(),
    category: v.union(v.literal('MARKETING'), v.literal('UTILITY')),
    language: v.optional(v.string()),
    bodyText: v.string(),
    footerText: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    { name, category, language, bodyText, footerText },
  ): Promise<{ ok: boolean; status: string; name: string }> => {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    if (!normalized) throw new Error('Nombre de plantilla inválido');
    const body = bodyText.trim();
    if (!body) throw new Error('El cuerpo de la plantilla es obligatorio');
    const wabaId = await resolveWabaId();
    const components: Array<Record<string, unknown>> = [
      { type: 'BODY', text: body },
    ];
    const footer = footerText?.trim();
    if (footer) components.push({ type: 'FOOTER', text: footer });
    const created = (await ycloudFetch('/whatsapp/templates', {
      method: 'POST',
      body: {
        wabaId,
        name: normalized,
        language: language?.trim() || 'es',
        category,
        components,
      },
    })) as YcloudTemplate;
    return {
      ok: true,
      status: created.status ?? 'PENDING',
      name: created.name ?? normalized,
    };
  },
});

/** Teléfono del contacto de una conversación (para el envío). */
export const getConversationContact = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<{ phone: string } | null> => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact?.phone) return null;
    return { phone: contact.phone };
  },
});

/** Registra la plantilla enviada como mensaje del Experto y detiene el bot. */
export const recordTemplateMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    wamid: v.optional(v.string()),
    templateName: v.string(),
  },
  handler: async (ctx, { conversationId, content, wamid, templateName }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return;
    const now = Date.now();
    await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content,
      type: 'text',
      wamid,
      sentByUserId: ADVISOR_SENDER_ID,
      metadata: { source: 'whatsapp_template', templateName },
      createdAt: now,
    });
    // El Experto toma el control: el agente IA deja de responder este chat.
    await ctx.db.patch(conversationId, {
      status: 'human',
      lastMessageAt: now,
      aiManualOverride: false,
    });
  },
});

/** Envía una plantilla aprobada a la conversación seleccionada. */
export const sendTemplate = action({
  args: {
    conversationId: v.id('conversations'),
    name: v.string(),
    language: v.string(),
    /** Valores para las variables {{1}}, {{2}}… del cuerpo, en orden. */
    bodyParams: v.optional(v.array(v.string())),
    /** Texto ya renderizado (para la burbuja del panel). */
    renderedText: v.string(),
  },
  handler: async (
    ctx,
    { conversationId, name, language, bodyParams, renderedText },
  ): Promise<{ ok: boolean }> => {
    const target = await ctx.runQuery(
      internal.whatsappTemplates.getConversationContact,
      { conversationId },
    );
    if (!target) throw new Error('La conversación no tiene teléfono');
    const { wabaNumber } = requireYcloudEnv();
    const params = (bodyParams ?? []).map((p) => p.trim());
    const payload: Record<string, unknown> = {
      from: wabaNumber,
      to: target.phone,
      type: 'template',
      template: {
        name,
        language: { code: language },
        ...(params.length > 0
          ? {
              components: [
                {
                  type: 'body',
                  parameters: params.map((text) => ({ type: 'text', text })),
                },
              ],
            }
          : {}),
      },
    };
    const sent = (await ycloudFetch('/whatsapp/messages/sendDirectly', {
      method: 'POST',
      body: payload,
    })) as { wamid?: string; whatsappMessage?: { wamid?: string } };
    const wamid = sent.wamid ?? sent.whatsappMessage?.wamid;
    await ctx.runMutation(internal.whatsappTemplates.recordTemplateMessage, {
      conversationId,
      content: renderedText,
      wamid,
      templateName: name,
    });
    return { ok: true };
  },
});

/**
 * Busca o crea contacto + conversación WhatsApp para un teléfono.
 * Sirve para iniciar un chat nuevo enviando una plantilla cuando el número
 * aún no tiene conversación en el inbox.
 */
export const ensureConversationByPhone = mutation({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { phone, name }) => {
    const normalized = normalizeOutboundPhone(phone);
    if (normalized.length < 10) {
      throw new Error('Número de teléfono inválido');
    }
    const last10 = normalized.slice(-10);
    const now = Date.now();

    const exact = await ctx.db
      .query('contacts')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .first();

    let contact = exact;
    if (!contact) {
      // Variantes comunes: local 10 dígitos y con indicativo 57.
      for (const candidate of [last10, `57${last10}`]) {
        if (candidate === normalized) continue;
        const hit = await ctx.db
          .query('contacts')
          .withIndex('by_phone', (q) => q.eq('phone', candidate))
          .first();
        if (hit) {
          contact = hit;
          break;
        }
      }
    }

    let createdContact = false;
    if (!contact) {
      const contactId = await ctx.db.insert('contacts', {
        phone: normalized,
        name: name?.trim() || normalized,
        createdAt: now,
      });
      contact = await ctx.db.get(contactId);
      createdContact = true;
    } else if (name?.trim() && (!contact.name || contact.name === contact.phone)) {
      await ctx.db.patch(contact._id, { name: name.trim(), updatedAt: now });
      contact = (await ctx.db.get(contact._id))!;
    }
    if (!contact) throw new Error('No se pudo crear el contacto');

    // Preferir teléfono E.164 si el viejo no lo estaba.
    if (contact.phone !== normalized && normalizeOutboundPhone(contact.phone) === normalized) {
      await ctx.db.patch(contact._id, { phone: normalized, updatedAt: now });
    }

    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_contact', (q) => q.eq('contactId', contact!._id))
      .collect();
    const existing =
      conversations
        .filter((c) => !c.deletedAt && c.channel !== 'web')
        .sort(
          (a, b) =>
            (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt),
        )[0] ?? null;

    if (existing) {
      return {
        conversationId: existing._id,
        phone: contact.phone,
        name: contact.name,
        created: false as const,
        createdContact,
      };
    }

    const conversationId = await ctx.db.insert('conversations', {
      contactId: contact._id,
      channel: 'whatsapp',
      status: 'human',
      operationalState: 'pending_data',
      aiManualOverride: false,
      createdAt: now,
      lastMessageAt: now,
    });

    return {
      conversationId,
      phone: contact.phone,
      name: contact.name,
      created: true as const,
      createdContact,
    };
  },
});
