/**
 * WIDGET DE CHAT WEB (landing pública) — mismo agente que WhatsApp, pero por el
 * canal 'web'. El contacto usa un teléfono sintético "web:<sessionId>", los
 * envíos por YCloud se omiten (ver isWebPhone en lib/ycloud) y las fichas se
 * guardan como "fichas web" que el widget pinta como tarjetas.
 *
 * KILL-SWITCH: todo está detrás de `webChatSettings.enabled` (default APAGADO).
 * Mientras esté en false, sendMessage rechaza y el widget muestra el
 * placeholder — o sea, la lógica queda LISTA pero sin exponerse al público.
 */
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { authComponent } from './betterAuth/auth';

const AGENT_DEBOUNCE_MS = 1500; // web: respuesta más ágil que WhatsApp (7s)

function webPhone(sessionId: string): string {
  return `web:${sessionId.trim()}`;
}

// ============ ESTADO / KILL-SWITCH ============

export const getStatus = query({
  args: {},
  handler: async (ctx): Promise<{ enabled: boolean }> => {
    const row = await ctx.db
      .query('webChatSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    return { enabled: row?.enabled ?? false };
  },
});

const ADMIN_ROLES = new Set(['admin', 'assistant', 'superadmin']);

export const setEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const user = (await authComponent.safeGetAuthUser(ctx)) as
      | { _id: string; name?: string | null; email?: string | null; role?: string | null }
      | null;
    const role = String(user?.role ?? '').trim().toLowerCase();
    if (!user || !ADMIN_ROLES.has(role)) throw new Error('No autorizado');
    const now = Date.now();
    const by = user.name?.trim() || user.email?.trim() || user._id;
    const existing = await ctx.db
      .query('webChatSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: now, updatedByUserId: by });
      return existing._id;
    }
    return await ctx.db.insert('webChatSettings', {
      scope: 'global',
      enabled,
      updatedAt: now,
      updatedByUserId: by,
    });
  },
});

// ============ MENSAJES DEL WIDGET ============

export type WebChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  type: string;
  /** Ficha web (cuando type === 'product'): imagen/título/precio de la finca. */
  ficha: {
    title: string;
    image: string | null;
    bodyText: string;
    retailerId: string;
  } | null;
  createdAt: number;
};

async function findWebContact(ctx: QueryCtx, sessionId: string) {
  const sid = sessionId.trim();
  if (sid.length < 8) return null;
  return await ctx.db
    .query('contacts')
    .withIndex('by_phone', (q) => q.eq('phone', webPhone(sid)))
    .first();
}

async function findWebConversation(
  ctx: QueryCtx,
  contactId: Id<'contacts'>,
): Promise<Doc<'conversations'> | null> {
  const convs = await ctx.db
    .query('conversations')
    .withIndex('by_contact', (q) => q.eq('contactId', contactId))
    .collect();
  const active = convs
    .filter((c) => c.channel === 'web' && !c.deletedAt && c.status !== 'resolved')
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
  return active[0] ?? null;
}

/** Historial del widget (reactivo). El widget se suscribe a esta query. */
export const listMessages = query({
  args: { sessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (
    ctx,
    { sessionId, limit },
  ): Promise<{ conversationId: string | null; status: string | null; messages: WebChatMessage[] }> => {
    const contact = await findWebContact(ctx, sessionId);
    if (!contact) return { conversationId: null, status: null, messages: [] };
    const conversation = await findWebConversation(ctx, contact._id);
    if (!conversation) return { conversationId: null, status: null, messages: [] };

    const take = Math.min(Math.max(limit ?? 100, 1), 200);
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversation._id))
      .order('desc')
      .take(take * 2);

    const messages: WebChatMessage[] = recent
      .filter(
        (m) =>
          (m.sender === 'user' || m.sender === 'assistant') &&
          !m.deletedAt &&
          (m.content?.trim() || m.type === 'product' || m.type === 'audio'),
      )
      .slice(0, take)
      .reverse()
      .map((m) => {
        const meta = (m.metadata ?? null) as { webFicha?: WebChatMessage['ficha'] } | null;
        return {
          id: String(m._id),
          sender: m.sender as 'user' | 'assistant',
          content: m.content,
          type: m.type ?? 'text',
          ficha: meta?.webFicha ?? null,
          createdAt: m.createdAt,
        };
      });

    return {
      conversationId: String(conversation._id),
      status: conversation.status,
      messages,
    };
  },
});

/** Envía un mensaje del visitante y dispara el turno del agente (canal web). */
export const sendMessage = mutation({
  args: {
    sessionId: v.string(),
    text: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, text, name }) => {
    const enabled = await ctx.db
      .query('webChatSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    if (!(enabled?.enabled ?? false)) {
      throw new Error('El chat web no está habilitado.');
    }
    const sid = sessionId.trim();
    if (sid.length < 8) throw new Error('sessionId inválido.');
    const body = text.trim();
    if (!body) throw new Error('Mensaje vacío.');
    if (body.length > 2000) throw new Error('Mensaje demasiado largo.');

    const now = Date.now();
    const phone = webPhone(sid);
    const displayName = (name ?? '').trim() || 'Visitante web';

    // Contacto (uno por sesión).
    let contact = await ctx.db
      .query('contacts')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();
    if (!contact) {
      const contactId = await ctx.db.insert('contacts', {
        phone,
        name: displayName,
        ...(name?.trim() ? { baseName: name.trim() } : {}),
        createdAt: now,
      });
      contact = await ctx.db.get(contactId);
    } else if (name?.trim() && !contact.baseName) {
      await ctx.db.patch(contact._id, { name: name.trim(), baseName: name.trim() });
    }
    if (!contact) throw new Error('No se pudo crear el contacto.');

    // Conversación web activa (o nueva). Respeta el kill-switch global de IA.
    const settingsRow = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    const globalAiEnabled = settingsRow?.globalAiEnabled ?? false;

    let conversation = await findWebConversation(ctx, contact._id);
    if (!conversation) {
      const conversationId = await ctx.db.insert('conversations', {
        contactId: contact._id,
        channel: 'web',
        status: globalAiEnabled ? 'ai' : 'human',
        operationalState: 'pending_data',
        aiManualOverride: false,
        createdAt: now,
        lastMessageAt: now,
      });
      conversation = await ctx.db.get(conversationId);
    }
    if (!conversation) throw new Error('No se pudo crear la conversación.');

    const messageId = await ctx.db.insert('messages', {
      conversationId: conversation._id,
      sender: 'user',
      content: body,
      type: 'text',
      metadata: { source: 'web_widget' },
      createdAt: now,
    });
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      inboxUnreadCount: (conversation.inboxUnreadCount ?? 0) + 1,
      ...(conversation.archived ? { archived: false } : {}),
    });

    // Solo dispara el agente si la conversación está en modo IA.
    if (conversation.status === 'ai') {
      await ctx.scheduler.runAfter(AGENT_DEBOUNCE_MS, internal.agent.runAgentTurn, {
        conversationId: conversation._id,
        triggerMessageId: messageId,
      });
    }

    return { ok: true, conversationId: String(conversation._id) };
  },
});
