import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ACTIONS, MODULES } from './lib/permissionModules';

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('userPermissionOverrides')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect();

    const byModule: Record<string, { grants: string[]; denies: string[] }> = {};
    for (const mod of MODULES) {
      byModule[mod.value] = { grants: [], denies: [] };
    }
    for (const row of rows) {
      byModule[row.module] = {
        grants: row.grants,
        denies: row.denies,
      };
    }

    return {
      modules: MODULES.map((m) => ({
        value: m.value,
        label: m.label,
        group: m.group,
      })),
      actions: [...ACTIONS],
      overrides: byModule,
    };
  },
});

export const setModuleOverride = mutation({
  args: {
    userId: v.string(),
    module: v.string(),
    grants: v.array(v.string()),
    denies: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const grants = [...new Set(args.grants)].filter(Boolean);
    const denies = [...new Set(args.denies)]
      .filter(Boolean)
      .filter((a) => !grants.includes(a));

    const existing = await ctx.db
      .query('userPermissionOverrides')
      .withIndex('by_user_module', (q) =>
        q.eq('userId', args.userId).eq('module', args.module),
      )
      .first();

    if (grants.length === 0 && denies.length === 0) {
      if (existing) await ctx.db.delete(existing._id);
      return { ok: true as const, cleared: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        grants,
        denies,
        updatedAt: Date.now(),
      });
      return { ok: true as const, id: existing._id };
    }

    const id = await ctx.db.insert('userPermissionOverrides', {
      userId: args.userId,
      module: args.module,
      grants,
      denies,
      updatedAt: Date.now(),
    });
    return { ok: true as const, id };
  },
});

export const replaceOverrides = mutation({
  args: {
    userId: v.string(),
    overrides: v.array(
      v.object({
        module: v.string(),
        grants: v.array(v.string()),
        denies: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('userPermissionOverrides')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    let saved = 0;
    for (const item of args.overrides) {
      const grants = [...new Set(item.grants)].filter(Boolean);
      const denies = [...new Set(item.denies)]
        .filter(Boolean)
        .filter((a) => !grants.includes(a));
      if (grants.length === 0 && denies.length === 0) continue;
      await ctx.db.insert('userPermissionOverrides', {
        userId: args.userId,
        module: item.module,
        grants,
        denies,
        updatedAt: Date.now(),
      });
      saved += 1;
    }
    return { ok: true as const, saved };
  },
});
