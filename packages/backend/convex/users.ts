import { v } from 'convex/values';
import { query, mutation, action } from './_generated/server';
import { components, api } from './_generated/api';
// Import the standalone hashing utility from Better Auth
import { hashPassword } from 'better-auth/crypto';
import { isSuperAdminRole } from './lib/roles';

/**
 * Reset a user's password using Better Auth's own standalone hasher.
 * This runs as an action because it uses the crypto API.
 */
export const resetPassword = action({
  args: {
    userId: v.string(),
    newPassword: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: true }> => {
    const newPasswordHash = await hashPassword(args.newPassword);
    const result: { success: boolean; message?: string } =
      await ctx.runMutation(api.users.setCredentialPassword, {
        userId: args.userId,
        email: args.email,
        newPasswordHash,
      });
    if (!result.success) {
      throw new Error(result.message ?? 'No se pudo actualizar la contraseña');
    }
    return { success: true };
  },
});

/**
 * List all users via the betterAuth component adapter
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'user',
      paginationOpts: {
        cursor: args.cursor ?? null,
        numItems: args.limit ?? 100,
      },
    });
    // Superadmins (devs) no aparecen en el listado del panel.
    return (result.page as Array<{ role?: string | null }>).filter(
      (u) => !isSuperAdminRole(u.role),
    );
  },
});

/**
 * Get user by _id string via the betterAuth component adapter
 */
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', value: args.id }],
    });
  },
});

/** Busca usuario Better Auth por email (case-insensitive vía valor exacto guardado). */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email) return null;
    const exact = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'email', value: email }],
    });
    if (exact) return exact;
    // Reintento con el valor tal cual (por si se guardó con mayúsculas).
    return await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'email', value: args.email.trim() }],
    });
  },
});

/**
 * Update user details and role by _id string
 * NOTE: updateOne takes an `input` wrapper
 */
export const update = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // Rol flexible: la app maneja 9 roles y pueden crecer (ver betterAuth/schema).
    role: v.optional(v.union(v.null(), v.string())),
    banned: v.optional(v.boolean()),
    phone: v.optional(v.union(v.null(), v.string())),
    position: v.optional(v.union(v.null(), v.string())),
    documentId: v.optional(v.union(v.null(), v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    if (isSuperAdminRole(updates.role)) {
      throw new Error('No se puede asignar el rol superadmin desde el panel');
    }

    if (updates.email !== undefined) {
      const email = updates.email.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        throw new Error('Correo inválido');
      }
      const taken = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: 'email', value: email }],
      });
      const takenId = String(
        (taken as { _id?: string; id?: string } | null)?._id ??
          (taken as { id?: string } | null)?.id ??
          '',
      );
      if (taken && takenId && takenId !== id) {
        throw new Error('Ya existe otro usuario con ese correo');
      }
      updates.email = email;

      // Credential account suele usar el correo como accountId.
      const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'account',
        where: [
          { field: 'userId', value: id },
          { field: 'providerId', value: 'credential' },
        ],
      });
      if (account) {
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: 'account',
            update: { accountId: email },
            where: [
              { field: 'userId', value: id },
              { field: 'providerId', value: 'credential' },
            ],
          },
        });
      }
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(
        ([k, v]) => !(k === 'role' && v === null) && v !== undefined,
      ),
    );
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        update: cleanUpdates,
        where: [{ field: '_id', value: id }],
      },
    });
    return id;
  },
});

/**
 * Update user details by email (used right after better-auth sign-up/email)
 * NOTE: updateOne takes an `input` wrapper
 */
export const updateByEmail = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    // Rol flexible: la app maneja 9 roles y pueden crecer (ver betterAuth/schema).
    role: v.optional(v.union(v.null(), v.string())),
    banned: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    position: v.optional(v.union(v.null(), v.string())),
    documentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email, ...updates } = args;
    if (isSuperAdminRole(updates.role)) {
      throw new Error('No se puede asignar el rol superadmin desde el panel');
    }
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'email', value: email.trim().toLowerCase() }],
    });
    if (!user) {
      throw new Error(`User not found with email ${email}`);
    }

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        update: updates as Record<string, unknown>,
        where: [{ field: 'email', value: email.trim().toLowerCase() }],
      },
    });

    return user;
  },
});

/**
 * Upsert de contraseña credential (hash ya generado con better-auth/crypto).
 * Si no hay cuenta credential, la crea — evita "cuenta sin password" silenciosa.
 */
export const setCredentialPassword = mutation({
  args: {
    userId: v.string(),
    newPasswordHash: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string }> => {
    const credential = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'account',
      where: [
        { field: 'userId', value: args.userId },
        { field: 'providerId', value: 'credential' },
      ],
    });

    if (credential) {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'account',
          update: { password: args.newPasswordHash, updatedAt: Date.now() },
          where: [
            { field: 'userId', value: args.userId },
            { field: 'providerId', value: 'credential' },
          ],
        },
      });
      return { success: true as const, message: 'updated' };
    }

    let email = args.email?.trim().toLowerCase();
    if (!email) {
      const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: '_id', value: args.userId }],
      });
      email = String((user as { email?: string } | null)?.email ?? '')
        .trim()
        .toLowerCase();
    }
    if (!email) {
      return {
        success: false as const,
        message: 'No hay correo para crear la cuenta de contraseña',
      };
    }

    const now = Date.now();
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'account',
        data: {
          accountId: email,
          providerId: 'credential',
          userId: args.userId,
          password: args.newPasswordHash,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    return { success: true as const, message: 'created' };
  },
});

/**
 * Remove a user by _id string
 * NOTE: deleteOne takes an `input` wrapper
 */
export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: args.id }],
      },
    });
    return { success: true };
  },
});

/**
 * List only users with the 'propietario' role
 */
export const listPropietarios = query({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'user',
      paginationOpts: {
        cursor: null,
        numItems: 1000,
      },
    });
    return result.page.filter((u: any) => u.role === 'propietario');
  },
});
