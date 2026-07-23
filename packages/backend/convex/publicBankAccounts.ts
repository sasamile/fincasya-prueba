/**
 * CUENTAS BANCARIAS PÚBLICAS (Adriana, 22-jul).
 *
 * Una página pública por TITULAR (`/cuentas/hernan-aguilera`) donde el cliente
 * ve a qué cuentas puede consignar. Las cuentas salen de las mismas que ya
 * están cargadas en los ajustes de contrato — no se duplica nada: si el equipo
 * agrega una cuenta allá, la página aparece o se actualiza sola.
 *
 * OJO: es público sin sesión. Se exponen SOLO datos que el cliente necesita
 * para consignar (banco, tipo, número, titular). Nunca la cédula del titular
 * ni nada interno.
 */
import { v } from 'convex/values';
import { query } from './_generated/server';

const GLOBAL_SCOPE = 'global' as const;

type CuentaRaw = {
  id?: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  ownerName?: string;
  imageUrl?: string | null;
  activo?: boolean;
};

/** Slug estable a partir del nombre del titular: "Hernán Aguilera" → hernan-aguilera. */
export function slugTitular(nombre: string): string {
  return (nombre ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Todos los titulares con cuentas, para listar/enlazar. */
export const listHolders = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', GLOBAL_SCOPE))
      .unique();
    const payload = (row?.payload ?? {}) as { bankAccounts?: CuentaRaw[] };
    const cuentas = Array.isArray(payload.bankAccounts)
      ? payload.bankAccounts
      : [];

    const porTitular = new Map<
      string,
      { slug: string; nombre: string; cuentas: number }
    >();
    for (const c of cuentas) {
      const nombre = (c.ownerName ?? '').trim();
      if (!nombre) continue;
      const slug = slugTitular(nombre);
      if (!slug) continue;
      const actual = porTitular.get(slug);
      if (actual) actual.cuentas += 1;
      else porTitular.set(slug, { slug, nombre, cuentas: 1 });
    }
    return [...porTitular.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
  },
});

/** Cuentas de UN titular, por su slug. Null si no existe. */
export const getHolder = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const buscado = slugTitular(slug);
    if (!buscado) return null;

    const row = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', GLOBAL_SCOPE))
      .unique();
    const payload = (row?.payload ?? {}) as { bankAccounts?: CuentaRaw[] };
    const cuentas = Array.isArray(payload.bankAccounts)
      ? payload.bankAccounts
      : [];

    const delTitular = cuentas.filter(
      (c) => slugTitular((c.ownerName ?? '').trim()) === buscado,
    );
    if (delTitular.length === 0) return null;

    return {
      slug: buscado,
      nombre: (delTitular[0]?.ownerName ?? '').trim(),
      cuentas: delTitular.map((c) => ({
        id: c.id ?? '',
        banco: (c.bankName ?? '').trim(),
        tipo: (c.accountType ?? '').trim(),
        numero: (c.accountNumber ?? '').trim(),
        // La cédula del titular NO se expone: es dato interno.
      })),
    };
  },
});
