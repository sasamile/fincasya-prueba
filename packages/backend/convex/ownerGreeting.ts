/**
 * Saludo automático al propietario, editable y con aprobación desde el panel
 * (/admin/saludo-propietario).
 *
 * - `enabled`: el administrador aprueba que el mensaje se envíe (si está en
 *   false, al propietario se le detecta y escala igual, pero NO se le manda el
 *   saludo por WhatsApp).
 * - `content`: plantilla con el placeholder `{nombre}` (se reemplaza por
 *   "Sr./Sra. Nombre" según el propietario; si no hay nombre, se limpia).
 *
 * El inbound (`inbound.ts`) lee estos ajustes al detectar un propietario.
 */
import { v } from 'convex/values';
import { mutation, query, internalQuery } from './_generated/server';
import { authComponent } from './betterAuth/auth';

/** Plantilla por defecto (comportamiento actual del equipo). */
export const DEFAULT_OWNER_GREETING =
  '¡Hola, {nombre}! 🏡✨ Te saluda el equipo de FincasYa.com. En un momento uno de nuestros Expertos se comunica contigo para atenderte personalmente 🤝';

function normalizeContent(content: string | undefined | null): string {
  return String(content ?? '').trim();
}

const ADMIN_ROLES = new Set(['admin', 'assistant', 'superadmin', 'contabilidad']);

async function requireAdmin(ctx: Parameters<typeof authComponent.safeGetAuthUser>[0]) {
  const user = (await authComponent.safeGetAuthUser(ctx)) as
    | { _id: string; name?: string | null; email?: string | null; role?: string | null }
    | null;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) return null;
  return user;
}

/** Estado actual para el panel. */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('ownerGreetingSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    return {
      // Sin fila: por defecto ENCENDIDO con la plantilla estándar (así se
      // conserva el comportamiento actual mientras el admin no lo cambie).
      enabled: row?.enabled ?? true,
      content: normalizeContent(row?.content) || DEFAULT_OWNER_GREETING,
      isDefault: !row,
      defaultContent: DEFAULT_OWNER_GREETING,
      updatedAt: row?.updatedAt ?? null,
      updatedByUserId: row?.updatedByUserId ?? null,
    };
  },
});

/** Ajustes para el inbound (detección de propietario). */
export const getSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('ownerGreetingSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();
    return {
      enabled: row?.enabled ?? true,
      content: normalizeContent(row?.content) || DEFAULT_OWNER_GREETING,
    };
  },
});

export const upsert = mutation({
  args: {
    enabled: v.boolean(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (!me) throw new Error('No autorizado');

    const content = normalizeContent(args.content);
    if (args.enabled && content.length === 0) {
      throw new Error(
        'El mensaje del saludo es obligatorio cuando está aprobado (encendido).',
      );
    }

    const now = Date.now();
    const updatedByUserId = me.name?.trim() || me.email?.trim() || me._id;
    const existing = await ctx.db
      .query('ownerGreetingSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        content,
        updatedAt: now,
        updatedByUserId,
      });
      return existing._id;
    }
    return await ctx.db.insert('ownerGreetingSettings', {
      scope: 'global',
      enabled: args.enabled,
      content,
      updatedAt: now,
      updatedByUserId,
    });
  },
});
