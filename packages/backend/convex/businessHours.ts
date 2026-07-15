/**
 * Comportamiento FUERA DE HORARIO (editable desde /admin/horarios).
 *  - Cliente CON historial + fuera de horario → solo el mensaje `returningMsg`
 *    (no se corre el flujo del bot).
 *  - Cliente NUEVO + fuera de horario → el bot atiende normal y al final se
 *    envía el cierre `newClosingMsg`.
 * La detección (con festivos y zona Bogotá) vive en `lib/businessHours.ts`.
 */
import { v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import { authComponent } from './betterAuth/auth';
import { sendWhatsappText } from './lib/ycloud';
import { formalSalutationName } from './lib/copys';
import {
  DEFAULT_NEW_CLOSING_MSG,
  DEFAULT_RETURNING_MSG,
  DEFAULT_SCHEDULE,
  formatScheduleText,
  isOutOfHours,
  type Schedule,
} from './lib/businessHours';

const ADMIN_ROLES = new Set(['admin', 'assistant', 'superadmin', 'contabilidad']);

async function requireAdmin(
  ctx: Parameters<typeof authComponent.safeGetAuthUser>[0],
) {
  const user = (await authComponent.safeGetAuthUser(ctx)) as
    | { _id: string; name?: string | null; email?: string | null; role?: string | null }
    | null;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) return null;
  return user;
}

function normSchedule(raw: unknown): Schedule {
  const s = (raw ?? {}) as Partial<Schedule>;
  return {
    weekday: s.weekday ?? DEFAULT_SCHEDULE.weekday,
    saturday: s.saturday ?? DEFAULT_SCHEDULE.saturday,
    sunday: s.sunday ?? DEFAULT_SCHEDULE.sunday,
    holiday: s.holiday ?? DEFAULT_SCHEDULE.holiday,
  };
}

/** Renderiza el mensaje de "con historial": {nombre} → "Sr./Sra. Nombre". */
function renderReturning(template: string, contactName?: string | null): string {
  const formal = formalSalutationName(contactName ?? undefined) ?? '';
  let out = String(template ?? '').replace(/\{nombre\}/gi, formal);
  // Sin nombre: "Hola , " → "Hola, "
  out = out.replace(/Hola\s*,/g, 'Hola,');
  return out.trim();
}

// ---------------------------------------------------------------------------
// Ajustes (panel)
// ---------------------------------------------------------------------------

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('businessHoursSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    return {
      enabled: row?.enabled ?? false,
      returningMsg: (row?.returningMsg?.trim() || DEFAULT_RETURNING_MSG),
      newClosingMsg: (row?.newClosingMsg?.trim() || DEFAULT_NEW_CLOSING_MSG),
      schedule: normSchedule(row?.schedule),
      updatedAt: row?.updatedAt ?? null,
      updatedByUserId: row?.updatedByUserId ?? null,
      isConfigured: !!row,
    };
  },
});

export const getSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('businessHoursSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    return {
      enabled: row?.enabled ?? false,
      returningMsg: (row?.returningMsg?.trim() || DEFAULT_RETURNING_MSG),
      newClosingMsg: (row?.newClosingMsg?.trim() || DEFAULT_NEW_CLOSING_MSG),
      schedule: normSchedule(row?.schedule),
    };
  },
});

export const setSettings = mutation({
  args: {
    enabled: v.boolean(),
    returningMsg: v.string(),
    newClosingMsg: v.string(),
    schedule: v.any(),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (!me) throw new Error('No autorizado');
    const now = Date.now();
    const updatedByUserId = me.name?.trim() || me.email?.trim() || me._id;
    const patch = {
      enabled: args.enabled,
      returningMsg: args.returningMsg.trim() || DEFAULT_RETURNING_MSG,
      newClosingMsg: args.newClosingMsg.trim() || DEFAULT_NEW_CLOSING_MSG,
      schedule: normSchedule(args.schedule),
      updatedAt: now,
      updatedByUserId,
    };
    const existing = await ctx.db
      .query('businessHoursSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert('businessHoursSettings', {
      scope: 'global',
      ...patch,
    });
  },
});

// ---------------------------------------------------------------------------
// Envío de mensajes fuera de horario
// ---------------------------------------------------------------------------

/** Guarda el mensaje de fuera de horario y marca el flag para no repetir. */
export const recordOutOfHoursMsg = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    wamid: v.optional(v.string()),
    flag: v.union(v.literal('returning'), v.literal('closing')),
  },
  handler: async (ctx, { conversationId, content, wamid, flag }): Promise<void> => {
    const now = Date.now();
    await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content,
      type: 'text',
      wamid,
      whatsappStatus: wamid ? 'sent' : undefined,
      metadata: { source: 'out_of_hours' },
      createdAt: now,
    });
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      ...(flag === 'returning'
        ? { outOfHoursReturningSent: true }
        : { outOfHoursClosingSent: true }),
    });
  },
});

/**
 * ¿Se debe enviar el mensaje de fuera de horario? Dedup por flag + no enviar si
 * ya lo tomó un humano (status human o mensaje de Experto).
 */
export const outOfHoursPrecheck = internalQuery({
  args: {
    conversationId: v.id('conversations'),
    flag: v.union(v.literal('returning'), v.literal('closing')),
  },
  handler: async (ctx, { conversationId, flag }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return { ok: false as const };
    const yaEnviado =
      flag === 'returning'
        ? conv.outOfHoursReturningSent === true
        : conv.outOfHoursClosingSent === true;
    if (yaEnviado) return { ok: false as const };
    // El cierre del cliente NUEVO no sale si un humano ya tomó la conversación.
    if (flag === 'closing' && conv.status !== 'ai') return { ok: false as const };
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', conversationId),
      )
      .collect();
    if (
      flag === 'closing' &&
      msgs.some((m) => m.sender === 'assistant' && m.sentByUserId && !m.deletedAt)
    ) {
      return { ok: false as const };
    }
    const contact = await ctx.db.get(conv.contactId);
    if (!contact?.phone) return { ok: false as const };
    return {
      ok: true as const,
      to: contact.phone,
      contactName: contact.name ?? contact.baseName ?? '',
    };
  },
});

/** Cliente CON historial fuera de horario: solo el saludo (no atiende). */
export const sendOutOfHoursReturning = internalAction({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<void> => {
    const check = await ctx.runQuery(internal.businessHours.outOfHoursPrecheck, {
      conversationId,
      flag: 'returning',
    });
    if (!check.ok) return;
    const s = await ctx.runQuery(internal.businessHours.getSettingsInternal, {});
    if (!s.enabled) return;
    const text = `${renderReturning(s.returningMsg, check.contactName)}\n\n${formatScheduleText(
      s.schedule,
    )}`;
    let wamid: string | undefined;
    try {
      const sent = await sendWhatsappText({ to: check.to, text });
      wamid = sent.wamid;
    } catch (err) {
      console.error('[businessHours] fallo el envio (returning)', err);
    }
    await ctx.runMutation(internal.businessHours.recordOutOfHoursMsg, {
      conversationId,
      content: text,
      wamid,
      flag: 'returning',
    });
  },
});

/** Cliente NUEVO fuera de horario: cierre al final de la atención. */
export const sendOutOfHoursClosing = internalAction({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<void> => {
    const check = await ctx.runQuery(internal.businessHours.outOfHoursPrecheck, {
      conversationId,
      flag: 'closing',
    });
    if (!check.ok) return;
    const s = await ctx.runQuery(internal.businessHours.getSettingsInternal, {});
    if (!s.enabled) return;
    // Si ya volvimos al horario de atención, no enviar el cierre.
    if (!isOutOfHours(Date.now(), s.schedule)) return;
    const text = `${s.newClosingMsg}\n\n${formatScheduleText(s.schedule)}`;
    let wamid: string | undefined;
    try {
      const sent = await sendWhatsappText({ to: check.to, text });
      wamid = sent.wamid;
    } catch (err) {
      console.error('[businessHours] fallo el envio (closing)', err);
    }
    await ctx.runMutation(internal.businessHours.recordOutOfHoursMsg, {
      conversationId,
      content: text,
      wamid,
      flag: 'closing',
    });
  },
});
