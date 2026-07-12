import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'asesor_limitado', label: 'Asesor Limitado' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'propietario', label: 'Propietario' },
  { value: 'client', label: 'Cliente' },
] as const;

const MODULES = [
  { value: 'fincas', label: 'Fincas' },
  { value: 'bookings', label: 'Reservas' },
  { value: 'payments', label: 'Pagos' },
  { value: 'users', label: 'Usuarios' },
  { value: 'inbox', label: 'Bandeja de entrada' },
  { value: 'contacts', label: 'Contactos' },
  { value: 'reviews', label: 'Reseñas' },
  { value: 'catalogs', label: 'Catálogos' },
  { value: 'knowledge', label: 'Base de conocimiento' },
  { value: 'reports', label: 'Reportes' },
  { value: 'owner_info', label: 'Info. propietario' },
] as const;

const ACTIONS = [
  { value: 'read', label: 'Ver' },
  { value: 'create', label: 'Crear' },
  { value: 'update', label: 'Editar' },
  { value: 'delete', label: 'Eliminar' },
] as const;

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
      modules: [...MODULES],
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
    } else {
      return await ctx.db.insert('rolePermissions', {
        role: args.role,
        module: args.module,
        permissions: args.permissions,
        isCustom: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const initializeRole = mutation({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const modules = [
      'fincas', 'bookings', 'payments', 'users', 'inbox',
      'contacts', 'reviews', 'catalogs', 'knowledge', 'reports', 'owner_info',
    ];

    for (const module of modules) {
      const existing = await ctx.db
        .query('rolePermissions')
        .withIndex('by_role_module', (q) =>
          q.eq('role', args.role).eq('module', module),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('rolePermissions', {
          role: args.role,
          module,
          permissions: [],
          isCustom: false,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});