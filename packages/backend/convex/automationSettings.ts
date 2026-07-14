import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import {
  formatScheduleLabel,
  mergeSchedules,
  type MessageSchedule,
} from './lib/automationSchedules';

/**
 * Kill-switch + horarios de mensajes automáticos (panel Automatizaciones).
 */

const scheduleValidator = v.object({
  key: v.string(),
  hourCO: v.number(),
  anchor: v.union(
    v.literal('checkin'),
    v.literal('checkout'),
    v.literal('weekday'),
  ),
  offsetDays: v.number(),
  weekday: v.optional(v.number()),
});

function buildResponse(
  row: {
    scheduledMessagingEnabled?: boolean;
    scheduledMessagesDisabled?: string[];
    schedules?: MessageSchedule[];
    updatedAt?: number;
  } | null,
) {
  const schedulesMap = mergeSchedules(
    Array.isArray(row?.schedules) ? row!.schedules : undefined,
  );
  const schedules = Object.values(schedulesMap);
  return {
    scheduledMessagingEnabled: row?.scheduledMessagingEnabled === true,
    scheduledMessagesDisabled: row?.scheduledMessagesDisabled ?? [],
    schedules,
    scheduleLabels: Object.fromEntries(
      schedules.map((s) => [s.key, formatScheduleLabel(s)]),
    ),
    updatedAt: row?.updatedAt ?? null,
  };
}

async function loadRow(ctx: { db: any }) {
  return await ctx.db
    .query('automationSettings')
    .withIndex('by_scope', (q: any) => q.eq('scope', 'global'))
    .unique();
}

export const get = query({
  args: {},
  handler: async (ctx) => buildResponse(await loadRow(ctx)),
});

export const getInternal = internalQuery({
  args: {},
  handler: async (ctx) => buildResponse(await loadRow(ctx)),
});

export const setScheduledMessagingEnabled = mutation({
  args: {
    enabled: v.boolean(),
    updatedByUserId: v.optional(v.string()),
  },
  handler: async (ctx, { enabled, updatedByUserId }) => {
    const now = Date.now();
    const existing = await loadRow(ctx);
    if (existing) {
      await ctx.db.patch(existing._id, {
        scheduledMessagingEnabled: enabled,
        updatedAt: now,
        updatedByUserId,
      });
    } else {
      await ctx.db.insert('automationSettings', {
        scope: 'global',
        scheduledMessagingEnabled: enabled,
        scheduledMessagesDisabled: [],
        schedules: [],
        updatedAt: now,
        updatedByUserId,
      });
    }
    return buildResponse(await loadRow(ctx));
  },
});

export const setScheduledMessageTypeDisabled = mutation({
  args: {
    key: v.string(),
    disabled: v.boolean(),
    updatedByUserId: v.optional(v.string()),
  },
  handler: async (ctx, { key, disabled, updatedByUserId }) => {
    const trimmed = key.trim();
    if (!trimmed) throw new Error('Clave de mensaje inválida.');

    const now = Date.now();
    const existing = await loadRow(ctx);
    const current = new Set(
      (existing?.scheduledMessagesDisabled ?? []) as string[],
    );
    if (disabled) current.add(trimmed);
    else current.delete(trimmed);
    const list = Array.from(current);

    if (existing) {
      await ctx.db.patch(existing._id, {
        scheduledMessagesDisabled: list,
        updatedAt: now,
        updatedByUserId,
      });
    } else {
      await ctx.db.insert('automationSettings', {
        scope: 'global',
        scheduledMessagingEnabled: false,
        scheduledMessagesDisabled: list,
        schedules: [],
        updatedAt: now,
        updatedByUserId,
      });
    }
    return buildResponse(await loadRow(ctx));
  },
});

/** Actualiza el horario de un tipo (hora CO + días / día de semana). */
export const setMessageSchedule = mutation({
  args: {
    schedule: scheduleValidator,
    updatedByUserId: v.optional(v.string()),
  },
  handler: async (ctx, { schedule, updatedByUserId }) => {
    const now = Date.now();
    const existing = await loadRow(ctx);
    const merged = mergeSchedules(
      Array.isArray(existing?.schedules)
        ? (existing.schedules as MessageSchedule[])
        : undefined,
    );
    const next = mergeSchedules([
      ...Object.values(merged),
      schedule as MessageSchedule,
    ]);
    const list = Object.values(next);

    if (existing) {
      await ctx.db.patch(existing._id, {
        schedules: list,
        updatedAt: now,
        updatedByUserId,
      });
    } else {
      await ctx.db.insert('automationSettings', {
        scope: 'global',
        scheduledMessagingEnabled: false,
        scheduledMessagesDisabled: [],
        schedules: list,
        updatedAt: now,
        updatedByUserId,
      });
    }
    return buildResponse(await loadRow(ctx));
  },
});
