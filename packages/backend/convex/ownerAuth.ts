/**
 * Provisioning de login para staff / propietarios.
 * Usa Better Auth (signUpEmail / hash oficial) en el servidor para que NO
 * pise la cookie/sesión del admin que está creando al usuario.
 */
import { v } from 'convex/values';
import { action } from './_generated/server';
import { api } from './_generated/api';
import { hashPassword } from 'better-auth/crypto';
import { authComponent, createAuth } from './betterAuth/auth';

export const provisionUserLogin = action({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: v.string(),
    phone: v.optional(v.string()),
    position: v.optional(v.string()),
    documentId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: string; created: boolean }> => {
    const email = args.email.trim().toLowerCase();
    const password = args.password.trim();
    const name = args.name.trim();
    const role = args.role.trim().toLowerCase();
    if (!email.includes('@')) throw new Error('Correo inválido');
    if (!name) throw new Error('El nombre es obligatorio');
    if (!role) throw new Error('El rol es obligatorio');
    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    const existing = await ctx.runQuery(api.users.getByEmail, { email });

    if (existing) {
      const userId = String(
        (existing as { _id?: string; id?: string })._id ??
          (existing as { id?: string }).id ??
          '',
      );
      if (!userId) throw new Error('Usuario existente sin id');

      await ctx.runMutation(api.users.update, {
        id: userId,
        name,
        role,
        phone: args.phone,
        position: args.position,
        documentId: args.documentId,
      });

      const newPasswordHash = await hashPassword(password);
      const pwd = await ctx.runMutation(api.users.setCredentialPassword, {
        userId,
        email,
        newPasswordHash,
      });
      if (!pwd.success) {
        throw new Error(pwd.message ?? 'No se pudo guardar la contraseña');
      }
      return { userId, created: false };
    }

    // Crear con la API oficial de Better Auth en servidor (sin cookies al browser).
    const { auth } = await authComponent.getAuth(createAuth, ctx);
    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Si ya existía por carrera, cae al flujo update.
      const again = await ctx.runQuery(api.users.getByEmail, { email });
      if (!again) {
        throw new Error(
          message.includes('already') || message.includes('exist')
            ? 'El correo ya está registrado pero no se pudo cargar'
            : `No se pudo crear el acceso: ${message}`,
        );
      }
      const userId = String(
        (again as { _id?: string; id?: string })._id ??
          (again as { id?: string }).id ??
          '',
      );
      await ctx.runMutation(api.users.update, {
        id: userId,
        name,
        role,
        phone: args.phone,
        position: args.position,
        documentId: args.documentId,
      });
      const newPasswordHash = await hashPassword(password);
      await ctx.runMutation(api.users.setCredentialPassword, {
        userId,
        email,
        newPasswordHash,
      });
      return { userId, created: false };
    }

    await ctx.runMutation(api.users.updateByEmail, {
      email,
      name,
      role,
      phone: args.phone,
      position: args.position,
      documentId: args.documentId,
    });

    const created = await ctx.runQuery(api.users.getByEmail, { email });
    const userId = String(
      (created as { _id?: string; id?: string } | null)?._id ??
        (created as { id?: string } | null)?.id ??
        '',
    );
    if (!userId) {
      throw new Error('Usuario creado pero no se pudo leer de la base');
    }
    return { userId, created: true };
  },
});
