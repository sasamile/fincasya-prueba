/**
 * Importación de NOMBRES desde un .vcf (contactos del teléfono del equipo).
 *
 * Flujo: el admin exporta sus contactos del celular como .vcf y lo sube en
 * /admin/customers. El front parsea el archivo y manda pares {nombre, telefono};
 * aquí buscamos cada número en `contacts` (match por últimos 10 dígitos, como
 * celular colombiano) y le ponemos el nombre TAL CUAL lo guarda el equipo.
 *
 * Reglas:
 *  - Solo ACTUALIZA contactos existentes — jamás crea nuevos.
 *  - Respeta el enriquecimiento del CRM: si el contacto tiene `dealLabel`,
 *    el nombre queda `<vcf> · <dealLabel>` y `baseName = <vcf>` (mismo patrón
 *    de contacts.setLeadDealLabel).
 */
import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { authComponent } from './betterAuth/auth';

const ADMIN_ROLES = new Set(['admin', 'assistant', 'superadmin', 'contabilidad']);

/** Últimos 10 dígitos (celular colombiano), ignorando indicativo y separadores. */
function phoneKey(raw: string): string {
  return String(raw ?? '').replace(/\D+/g, '').slice(-10);
}

export const applyVcfNames = mutation({
  args: {
    items: v.array(v.object({ name: v.string(), phone: v.string() })),
  },
  handler: async (ctx, { items }) => {
    const user = (await authComponent.safeGetAuthUser(ctx)) as {
      role?: string | null;
    } | null;
    const role = String(user?.role ?? '').trim().toLowerCase();
    if (!user || !ADMIN_ROLES.has(role)) throw new Error('No autorizado');
    if (items.length > 500) throw new Error('Máximo 500 contactos por lote');

    let actualizados = 0;
    let sinCambio = 0;
    let noEncontrados = 0;
    const now = Date.now();

    for (const item of items) {
      const vcfName = item.name.trim().replace(/\s+/g, ' ');
      const key = phoneKey(item.phone);
      if (!vcfName || key.length !== 10) {
        noEncontrados++;
        continue;
      }
      // El webhook guarda el phone como dígitos con indicativo ('573001234567');
      // probamos las variantes comunes contra el índice by_phone.
      const rawDigits = item.phone.replace(/\D+/g, '');
      const candidates = [
        `57${key}`,
        key,
        `+57${key}`,
        ...(rawDigits.length >= 10 ? [rawDigits] : []),
      ];
      let contact = null;
      for (const cand of [...new Set(candidates)]) {
        contact = await ctx.db
          .query('contacts')
          .withIndex('by_phone', (q) => q.eq('phone', cand))
          .first();
        if (contact) break;
      }
      if (!contact) {
        noEncontrados++;
        continue;
      }

      const dealLabel = contact.dealLabel?.trim();
      const newName = dealLabel ? `${vcfName} · ${dealLabel}` : vcfName;
      if (contact.name === newName && contact.baseName === vcfName) {
        sinCambio++;
        continue;
      }
      await ctx.db.patch(contact._id, {
        name: newName,
        baseName: vcfName,
        updatedAt: now,
      });
      actualizados++;
    }

    return { actualizados, sinCambio, noEncontrados };
  },
});
