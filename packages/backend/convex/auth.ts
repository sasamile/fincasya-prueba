/**
 * Auth del panel de operadores (/inbox), montada sobre Better Auth + Convex
 * (sin backend Nest). Solo dos roles: "admin" y "operador" — ambos pueden
 * entrar al inbox; no hay cuentas de cliente todavía.
 */
import { query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { authComponent } from './betterAuth/auth';
import { components } from './_generated/api';

/** Usuario autenticado actual (o null si no hay sesión). Para el panel /inbox. */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.safeGetAuthUser(ctx);
  },
});

/**
 * Asigna el rol de un usuario por email (solo uso interno/CLI). Se usa para
 * el bootstrap del primer admin, ya que recién creado con signUpEmail el
 * usuario cae con el rol por defecto ("operador").
 *
 * Nota: los datos de Better Auth (tabla `user`) viven en el storage aislado
 * del componente, no en `ctx.db` de esta app — por eso se llama a
 * `components.betterAuth.adapter.*` en vez de `ctx.db.query('user')`.
 *
 * Si el rol pasa a `superadmin`, se borran sus filas del historial de
 * accesos (los logs viejos guardaban el rol anterior y seguirían visibles).
 */
export const setUserRoleByEmail = internalMutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal('admin'),
      v.literal('operador'),
      v.literal('superadmin'),
    ),
  },
  handler: async (
    ctx,
    { email, role },
  ): Promise<{
    ok: true;
    userId: string;
    role: string;
    purgedSessionLogs: number;
  }> => {
    const user: { _id: string } | null = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      {
        model: 'user',
        where: [{ field: 'email', operator: 'eq', value: email }],
      },
    );
    if (!user) throw new Error(`No existe un usuario con email ${email}`);
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: 'email', operator: 'eq', value: email }],
        update: { role },
      },
    });

    let purgedSessionLogs = 0;
    if (role === 'superadmin') {
      const logs = await ctx.db
        .query('adminSessionLogs')
        .withIndex('by_user_loginAt', (q) => q.eq('userId', user._id))
        .collect();
      for (const log of logs) {
        await ctx.db.delete(log._id);
        purgedSessionLogs += 1;
      }
    }

    return { ok: true, userId: user._id, role, purgedSessionLogs };
  },
});
