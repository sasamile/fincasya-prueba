/**
 * Queries para los selectores de cliente del panel admin (modal de reserva
 * manual): buscar contactos del CRM y "clientes conocidos" (con reserva previa).
 * Separado de la lógica de contactos del bot para no interferir.
 */
import { v } from 'convex/values';
import { query } from './_generated/server';

/** Normaliza texto para búsqueda (sin acentos, minúsculas). */
function norm(s: string | undefined | null): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function digits(s: string | undefined | null): string {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Busca contactos del CRM por nombre, cédula o teléfono.
 * Reemplaza `GET /api/contacts?search=&limit=`.
 */
export const search = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const term = norm(args.search);
    const termDigits = digits(args.search);
    const limit = args.limit ?? 10;
    if (term.length < 2 && termDigits.length < 2) return [];

    const all = await ctx.db.query('contacts').collect();
    const matches = all.filter((c) => {
      const name = norm(c.name);
      const ced = digits(c.cedula);
      const phone = digits(c.phone);
      return (
        (term.length >= 2 && name.includes(term)) ||
        (termDigits.length >= 2 &&
          (ced.includes(termDigits) || phone.includes(termDigits)))
      );
    });

    return matches
      .sort((a, b) => (b.lastReservationAt ?? 0) - (a.lastReservationAt ?? 0))
      .slice(0, limit)
      .map((c) => ({
        id: String(c._id),
        name: c.name,
        phone: c.phone,
        cedula: c.cedula ?? '',
        email: c.email ?? '',
        city: c.city ?? '',
        address: c.address ?? '',
        crmType: c.crmType ?? 'lead',
        lastReservationAt: c.lastReservationAt ?? null,
      }));
  },
});

/**
 * "Clientes conocidos": personas con al menos una reserva pagada/confirmada.
 * Alimenta el badge de "cliente verificado" en el selector de huésped del modal.
 * Reemplaza `GET /api/bookings/payment-receipts/verified-guests`.
 *
 * Nota: FincasYaWeb agrega también check-in y sale-links; aquí se deriva de
 * `bookings` (fuente principal). La forma coincide con `VerifiedGuestHistory`.
 */
export const verifiedGuests = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const term = norm(args.search);
    const termDigits = digits(args.search);
    const limit = args.limit ?? 10;
    if (term.length < 2 && termDigits.length < 2) return [];

    const bookings = await ctx.db.query('bookings').collect();
    const paidStatuses = new Set(['PAID', 'PARTIAL', 'CONFIRMED', 'COMPLETED']);

    // Dedup por identidad (cédula o teléfono), quedándose con la más reciente.
    const byKey = new Map<
      string,
      {
        id: string;
        nombre: string;
        cedula: string;
        celular: string;
        correo: string;
        city: string;
        reference: string;
        propertyId: string | null;
        source: 'payment';
        lastVerifiedAt: number;
        lastVerifiedAmount: number;
      }
    >();

    for (const b of bookings) {
      if (!paidStatuses.has(b.paymentStatus)) continue;
      const ced = digits(b.cedula);
      const tel = digits(b.celular);
      const key = ced.length >= 6 ? `ced:${ced}` : tel.length >= 10 ? `tel:${tel.slice(-10)}` : '';
      if (!key) continue;

      const nameMatch = term.length >= 2 && norm(b.nombreCompleto).includes(term);
      const digitMatch =
        termDigits.length >= 2 && (ced.includes(termDigits) || tel.includes(termDigits));
      if (!nameMatch && !digitMatch) continue;

      const when = b.updatedAt ?? b._creationTime;
      const existing = byKey.get(key);
      if (!existing || when > existing.lastVerifiedAt) {
        byKey.set(key, {
          id: String(b._id),
          nombre: b.nombreCompleto,
          cedula: b.cedula ?? '',
          celular: b.celular ?? '',
          correo: b.correo ?? '',
          city: b.address ?? '',
          reference: b.reference ?? '',
          propertyId: b.propertyId ? String(b.propertyId) : null,
          source: 'payment',
          lastVerifiedAt: when,
          lastVerifiedAmount: b.precioTotal ?? 0,
        });
      }
    }

    // Resuelve el título de la finca para cada resultado.
    const results = [...byKey.values()]
      .sort((a, b) => b.lastVerifiedAt - a.lastVerifiedAt)
      .slice(0, limit);

    return await Promise.all(
      results.map(async (r) => {
        let propertyTitle = '';
        if (r.propertyId) {
          const propId = ctx.db.normalizeId('properties', r.propertyId);
          if (propId) {
            const prop = await ctx.db.get(propId);
            propertyTitle = prop?.title ?? '';
          }
        }
        return {
          id: r.id,
          nombre: r.nombre,
          cedula: r.cedula,
          celular: r.celular,
          correo: r.correo,
          city: r.city,
          reference: r.reference,
          propertyTitle,
          source: r.source,
          sourceLabel: 'Pago verificado',
          lastVerifiedAt: r.lastVerifiedAt,
          lastVerifiedAmount: r.lastVerifiedAmount,
        };
      }),
    );
  },
});
