import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';

/**
 * Configuración de notificaciones por correo.
 *
 * Modelo simple pedido por el negocio: UNA sola lista de "correos de
 * administrador" (`adminEmails`) que recibe TODAS las alertas de la plataforma
 * (soporte de pago, nuevas reservas, pagos de links de venta, habeas data…).
 * Editable rápido desde /admin/notifications.
 *
 * Resolución del destinatario: `adminEmails` guardado → si vacío, la clave
 * antigua `paymentReceiptEmails` (compat) → si vacío, el env ADMIN_EMAIL → si
 * vacío, un correo por defecto.
 */

const FALLBACK_EMAIL = 'comercial@fincasya.com';

function normalizeEmails(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const email = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Correos por defecto desde el env (ADMIN_EMAIL admite varios separados por coma). */
function envAdminEmails(): string[] {
  return normalizeEmails((process.env.ADMIN_EMAIL ?? '').split(','));
}

/** Núcleo compartido: lee la fila y resuelve la lista efectiva. */
async function resolve(
  ctx: { db: { query: (t: 'notificationSettings') => any } },
): Promise<{ adminEmails: string[]; isDefault: boolean; updatedAt: number | null }> {
  const row = await ctx.db
    .query('notificationSettings')
    .withIndex('by_scope', (q: any) => q.eq('scope', 'global'))
    .first();
  const payload = (row?.payload ?? {}) as Record<string, unknown>;
  const stored = normalizeEmails(payload.adminEmails);
  const legacy = normalizeEmails(payload.paymentReceiptEmails);

  const chosen = stored.length
    ? stored
    : legacy.length
      ? legacy
      : envAdminEmails().length
        ? envAdminEmails()
        : [FALLBACK_EMAIL];

  return {
    adminEmails: chosen,
    isDefault: stored.length === 0,
    updatedAt: row?.updatedAt ?? null,
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const r = await resolve(ctx as any);
    return {
      adminEmails: r.adminEmails,
      // Compat con código/páginas que aún esperan esta clave.
      paymentReceiptEmails: r.adminEmails,
      isDefault: r.isDefault,
      updatedAt: r.updatedAt,
    };
  },
});

/** Para actions: devuelve solo el array de destinatarios resueltos. */
export const resolveAdminEmails = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const r = await resolve(ctx as any);
    return r.adminEmails;
  },
});

async function saveAdminEmails(ctx: any, emails: string[]) {
  const clean = normalizeEmails(emails);
  const row = await ctx.db
    .query('notificationSettings')
    .withIndex('by_scope', (q: any) => q.eq('scope', 'global'))
    .first();
  const now = Date.now();
  if (row) {
    const payload = { ...(row.payload ?? {}), adminEmails: clean };
    await ctx.db.patch(row._id, { payload, updatedAt: now });
  } else {
    await ctx.db.insert('notificationSettings', {
      scope: 'global',
      payload: { adminEmails: clean },
      updatedAt: now,
    });
  }
  return { ok: true, adminEmails: clean };
}

export const setAdminEmails = mutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, args) => saveAdminEmails(ctx, args.emails),
});

/** Alias legacy: la página vieja llamaba setPaymentReceiptEmails. */
export const setPaymentReceiptEmails = mutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, args) => saveAdminEmails(ctx, args.emails),
});
