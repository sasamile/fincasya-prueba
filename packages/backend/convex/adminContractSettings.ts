import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { normalizeContractCode } from './lib/saleLinkReference';

const GLOBAL_SCOPE = 'global' as const;

type ContractSellerRow = {
  id: string;
  nombre: string;
  iniciales: string;
  lastNumber: number;
  activo?: boolean;
};

function normalizeSellers(raw: unknown): ContractSellerRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ContractSellerRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? '').trim();
    const nombre = String(o.nombre ?? '').trim();
    const iniciales = String(o.iniciales ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (!id || !nombre || !iniciales) continue;
    const lastNumber = Math.max(0, Math.floor(Number(o.lastNumber) || 0));
    out.push({
      id,
      nombre,
      iniciales,
      lastNumber,
      activo: o.activo !== false,
    });
  }
  return out;
}

function formatCode(iniciales: string, n: number): string {
  const prefix = iniciales.replace(/[^A-Z]/gi, '').toUpperCase();
  return `${prefix}${n}`;
}

function parseCodeNumber(
  code: string,
  iniciales: string,
): number | null {
  const prefix = iniciales.replace(/[^A-Z]/gi, '').toUpperCase();
  const raw = code.trim().toUpperCase().replace(/\s+/g, '');
  if (!prefix || !raw.startsWith(prefix)) return null;
  const rest = raw.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return null;
  return Math.max(0, Math.floor(Number(rest) || 0));
}

function codeLookupKeys(code: string): string[] {
  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();
  const noSpace = upper.replace(/\s+/g, '');
  const normalized = normalizeContractCode(trimmed);
  return [...new Set([trimmed, upper, noSpace, normalized].filter(Boolean))];
}

async function isContractCodeTaken(
  ctx: QueryCtx | MutationCtx,
  code: string,
): Promise<boolean> {
  for (const key of codeLookupKeys(code)) {
    const contract = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) => q.eq('contractNumber', key))
      .first();
    if (contract) return true;

    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_contract_code', (q) => q.eq('contractCode', key))
      .first();
    if (link) return true;

    const booking = await ctx.db
      .query('bookings')
      .withIndex('by_reference', (q) => q.eq('reference', key))
      .first();
    if (booking) return true;
  }
  return false;
}

async function loadSellers(ctx: QueryCtx | MutationCtx) {
  const row = await ctx.db
    .query('adminContractSettings')
    .withIndex('by_scope', (q) => q.eq('scope', GLOBAL_SCOPE))
    .unique();
  if (!row || !row.payload || typeof row.payload !== 'object') {
    return { row: null, payload: null as Record<string, unknown> | null, sellers: [] as ContractSellerRow[] };
  }
  const payload = { ...(row.payload as Record<string, unknown>) };
  return { row, payload, sellers: normalizeSellers(payload.contractSellers) };
}

/** Snapshot global del contrato (admin, cláusulas, propietario por finca). Usado al generar .docx. */
export const getGlobalPayload = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', GLOBAL_SCOPE))
      .unique();
    return row?.payload ?? null;
  },
});

export const getForAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', GLOBAL_SCOPE))
      .unique();
    return row;
  },
});

export const replaceForAdmin = mutation({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, { payload }) => {
    if (payload == null || typeof payload !== 'object') {
      throw new Error('payload inválido');
    }
    const now = Date.now();
    const existing = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', GLOBAL_SCOPE))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { payload, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('adminContractSettings', {
      scope: GLOBAL_SCOPE,
      payload,
      updatedAt: now,
    });
  },
});

/**
 * Sugiere el siguiente código libre SIN consumir el contador.
 * Salta números que ya existan en contracts / saleLinks / bookings.
 */
export const peekNextContractCode = query({
  args: { sellerId: v.string() },
  handler: async (ctx, { sellerId }) => {
    const id = sellerId.trim();
    const { sellers } = await loadSellers(ctx);
    const seller = sellers.find((s) => s.id === id);
    if (!seller || seller.activo === false) {
      return null;
    }

    let n = seller.lastNumber + 1;
    for (let i = 0; i < 500; i++) {
      const code = formatCode(seller.iniciales, n);
      const taken = await isContractCodeTaken(ctx, code);
      if (!taken) {
        return {
          code,
          number: n,
          lastNumber: seller.lastNumber,
          iniciales: seller.iniciales,
          nombre: seller.nombre,
          sellerId: seller.id,
        };
      }
      n += 1;
    }
    return null;
  },
});

/**
 * Solo sugiere (no consume). Preferir peekNextContractCode desde el cliente.
 * Mantenido por compatibilidad.
 */
export const allocateContractCode = mutation({
  args: { sellerId: v.string() },
  handler: async (ctx, { sellerId }) => {
    const id = sellerId.trim();
    if (!id) throw new Error('sellerId vacío');

    const { sellers } = await loadSellers(ctx);
    const seller = sellers.find((s) => s.id === id);
    if (!seller) throw new Error('Vendedor no encontrado');
    if (seller.activo === false) throw new Error('Vendedor inactivo');

    let n = seller.lastNumber + 1;
    let code = formatCode(seller.iniciales, n);
    for (let i = 0; i < 500; i++) {
      code = formatCode(seller.iniciales, n);
      if (!(await isContractCodeTaken(ctx, code))) break;
      n += 1;
    }

    return {
      code,
      lastNumber: seller.lastNumber,
      suggestedNumber: n,
      iniciales: seller.iniciales,
      nombre: seller.nombre,
      sellerId: seller.id,
    };
  },
});

/**
 * Cuando un código se usa de verdad (contrato/link/reserva), sube el
 * contador del vendedor si el número es mayor al lastNumber actual.
 */
export const commitContractCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await commitContractCodeImpl(ctx, code);
  },
});

export const commitContractCodeInternal = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await commitContractCodeImpl(ctx, code);
  },
});

async function commitContractCodeImpl(
  ctx: MutationCtx,
  rawCode: string,
): Promise<{ ok: boolean; sellerId?: string; lastNumber?: number }> {
  const code = rawCode.trim();
  if (!code) return { ok: false };

  const { row, payload, sellers } = await loadSellers(ctx);
  if (!row || !payload || sellers.length === 0) return { ok: false };

  // Preferir el prefijo más largo que coincida (CRA antes que CR).
  const sorted = [...sellers].sort(
    (a, b) => b.iniciales.length - a.iniciales.length,
  );
  let matched: ContractSellerRow | null = null;
  let usedNumber: number | null = null;
  for (const s of sorted) {
    const n = parseCodeNumber(code, s.iniciales);
    if (n != null && n > 0) {
      matched = s;
      usedNumber = n;
      break;
    }
  }
  if (!matched || usedNumber == null) return { ok: false };
  if (usedNumber <= matched.lastNumber) {
    return { ok: true, sellerId: matched.id, lastNumber: matched.lastNumber };
  }

  const nextSellers = sellers.map((s) =>
    s.id === matched!.id ? { ...s, lastNumber: usedNumber! } : s,
  );
  payload.contractSellers = nextSellers;
  await ctx.db.patch(row._id, { payload, updatedAt: Date.now() });
  return { ok: true, sellerId: matched.id, lastNumber: usedNumber };
}
