import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import {
  ACTIONS,
  MODULES,
  ROLE_FALLBACK_PERMISSIONS,
  ROLES,
  mergeRoleAndOverrides,
} from './lib/permissionModules';
import { isFullAdminRole } from './lib/roles';

/** Reemplaza GET /api/roles — matriz completa de roles/módulos/acciones. */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const permissions = await ctx.db.query('rolePermissions').collect();
    const grouped: Record<string, Record<string, string[]>> = {};

    for (const role of ROLES) {
      grouped[role.value] = {};
    }
    for (const perm of permissions) {
      if (!grouped[perm.role]) grouped[perm.role] = {};
      grouped[perm.role][perm.module] = perm.permissions;
    }
    for (const role of ROLES) {
      for (const mod of MODULES) {
        if (!grouped[role.value][mod.value]) {
          grouped[role.value][mod.value] = [];
        }
      }
    }

    return {
      roles: [...ROLES],
      modules: MODULES.map((m) => ({
        value: m.value,
        label: m.label,
        group: m.group,
      })),
      actions: [...ACTIONS],
      permissions: grouped,
    };
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('rolePermissions').collect();
  },
});

export const getByRole = query({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('rolePermissions')
      .withIndex('by_role', (q) => q.eq('role', args.role))
      .collect();
  },
});

/** Permisos efectivos = rol (+ fallback) ± overrides del usuario. */
export const getEffectiveForUser = query({
  args: {
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    if (isFullAdminRole(args.role)) {
      return {
        fullAccess: true as const,
        permissions: {} as Record<string, string[]>,
      };
    }

    const roleRows = await ctx.db
      .query('rolePermissions')
      .withIndex('by_role', (q) => q.eq('role', args.role))
      .collect();

    const roleGrouped: Record<string, string[]> = {};
    for (const row of roleRows) {
      roleGrouped[row.module] = row.permissions;
    }

    const hasAny = Object.values(roleGrouped).some((p) => p.length > 0);
    const base = hasAny
      ? roleGrouped
      : (ROLE_FALLBACK_PERMISSIONS[args.role] ?? roleGrouped);

    const overrides = await ctx.db
      .query('userPermissionOverrides')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect();

    return {
      fullAccess: false as const,
      permissions: mergeRoleAndOverrides(
        base,
        overrides.map((o) => ({
          module: o.module,
          grants: o.grants,
          denies: o.denies,
        })),
      ),
    };
  },
});

export const upsert = mutation({
  args: {
    role: v.string(),
    module: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('rolePermissions')
      .withIndex('by_role_module', (q) =>
        q.eq('role', args.role).eq('module', args.module),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        isCustom: true,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert('rolePermissions', {
      role: args.role,
      module: args.module,
      permissions: args.permissions,
      isCustom: false,
      updatedAt: Date.now(),
    });
  },
});

export const initializeRole = mutation({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    for (const mod of MODULES) {
      const existing = await ctx.db
        .query('rolePermissions')
        .withIndex('by_role_module', (q) =>
          q.eq('role', args.role).eq('module', mod.value),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('rolePermissions', {
          role: args.role,
          module: mod.value,
          permissions: [],
          isCustom: false,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

/** Crea filas vacías para módulos nuevos en todos los roles conocidos. */
export const ensureAllModules = mutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (const role of ROLES) {
      for (const mod of MODULES) {
        const existing = await ctx.db
          .query('rolePermissions')
          .withIndex('by_role_module', (q) =>
            q.eq('role', role.value).eq('module', mod.value),
          )
          .first();
        if (!existing) {
          await ctx.db.insert('rolePermissions', {
            role: role.value,
            module: mod.value,
            permissions: [],
            isCustom: false,
            updatedAt: Date.now(),
          });
          created += 1;
        }
      }
    }
    return { created };
  },
});
