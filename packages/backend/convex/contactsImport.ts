/**
 * Importación del DIRECTORIO TELEFÓNICO desde un .vcf (contactos del celular
 * del equipo, 26k+). Diseñado para NO dañar nada:
 *
 *  - Los nombres van a la tabla `phonebook` (aparte de `contacts`), así el
 *    CRM no se inunda con miles de contactos personales ni se rompen las
 *    consultas que recorren `contacts` completa.
 *  - Los contactos que YA existen se actualizan con el nombre del vcf
 *    (`applyPhonebookToContacts`, paginado).
 *  - Los que no existen NO se crean aquí: cuando ese número escriba por
 *    primera vez, `inbound.ts` crea el contacto ya con el nombre del
 *    directorio (en vez del nombre del perfil de WhatsApp).
 *
 * Match por últimos 10 dígitos (celular colombiano).
 */
import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { authComponent } from './betterAuth/auth';

const ADMIN_ROLES = new Set(['admin', 'assistant', 'superadmin', 'contabilidad']);

async function requireAdmin(
  ctx: Parameters<typeof authComponent.safeGetAuthUser>[0],
) {
  const user = (await authComponent.safeGetAuthUser(ctx)) as {
    role?: string | null;
  } | null;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) throw new Error('No autorizado');
}

/** Últimos 10 dígitos (celular colombiano), ignorando indicativo y separadores. */
function phoneKey(raw: string): string {
  return String(raw ?? '').replace(/\D+/g, '').slice(-10);
}

/**
 * Guarda un lote de {nombre, teléfono} en el directorio (upsert por
 * phoneKey). El front sube el .vcf completo en lotes de hasta 1000.
 */
export const upsertPhonebook = mutation({
  args: {
    items: v.array(v.object({ name: v.string(), phone: v.string() })),
  },
  handler: async (ctx, { items }) => {
    await requireAdmin(ctx);
    if (items.length > 1000) throw new Error('Máximo 1000 contactos por lote');

    let nuevos = 0;
    let actualizados = 0;
    let ignorados = 0;
    const now = Date.now();

    for (const item of items) {
      const name = item.name.trim().replace(/\s+/g, ' ');
      const key = phoneKey(item.phone);
      if (!name || key.length !== 10) {
        ignorados++;
        continue;
      }
      const existing = await ctx.db
        .query('phonebook')
        .withIndex('by_phone_key', (q) => q.eq('phoneKey', key))
        .first();
      if (existing) {
        if (existing.name !== name) {
          await ctx.db.patch(existing._id, { name, updatedAt: now });
          actualizados++;
        }
      } else {
        await ctx.db.insert('phonebook', { phoneKey: key, name, updatedAt: now });
        nuevos++;
      }
    }
    return { nuevos, actualizados, ignorados };
  },
});

/**
 * Aplica el directorio a los contactos EXISTENTES, por páginas (el front
 * repite la llamada con el cursor hasta `isDone`). Respeta el enriquecimiento
 * del CRM: si el contacto tiene `dealLabel`, queda `<vcf> · <dealLabel>`.
 */
export const applyPhonebookToContacts = mutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    await requireAdmin(ctx);

    const page = await ctx.db
      .query('contacts')
      .paginate({ numItems: 500, cursor: cursor ?? null });

    let actualizados = 0;
    const now = Date.now();

    for (const contact of page.page) {
      const key = phoneKey(contact.phone);
      if (key.length !== 10) continue;
      const entry = await ctx.db
        .query('phonebook')
        .withIndex('by_phone_key', (q) => q.eq('phoneKey', key))
        .first();
      if (!entry) continue;

      const vcfName = entry.name;
      const dealLabel = contact.dealLabel?.trim();
      const newName = dealLabel ? `${vcfName} · ${dealLabel}` : vcfName;
      if (contact.name === newName && contact.baseName === vcfName) continue;

      await ctx.db.patch(contact._id, {
        name: newName,
        baseName: vcfName,
        updatedAt: now,
      });
      actualizados++;
    }

    return {
      actualizados,
      isDone: page.isDone,
      cursor: page.continueCursor,
      procesados: page.page.length,
    };
  },
});
