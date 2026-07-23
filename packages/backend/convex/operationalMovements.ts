/**
 * Gastos operativos + caja menor para el libro de Reportes.
 *
 * - gasto: egreso del negocio (aparece en EGRESOS).
 * - caja_entrada: fondeo de caja (solo mueve saldo de caja; NO es ingreso).
 * - caja_salida: gasto pagado desde caja (aparece en EGRESOS + baja saldo).
 */
import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authComponent } from './betterAuth/auth';

const ACCOUNTING_ROLES = new Set([
  'admin',
  'assistant',
  'superadmin',
  'contabilidad',
]);

type AuthUser = {
  role?: string | null;
  name?: string | null;
  email?: string | null;
  _id?: string;
};

async function requireAccounting(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthUser> {
  const user = (await authComponent.safeGetAuthUser(ctx)) as AuthUser | null;
  const role = String(user?.role ?? '')
    .trim()
    .toLowerCase();
  if (!user || !ACCOUNTING_ROLES.has(role)) {
    throw new Error('No autorizado');
  }
  return user;
}

/** Mediodía Bogotá para un YYYY-MM-DD (evita drift de zona). */
function fechaToMs(fecha: string): number {
  const ms = Date.parse(`${fecha}T12:00:00-05:00`);
  if (Number.isNaN(ms)) throw new Error('Fecha inválida (usa YYYY-MM-DD)');
  return ms;
}

const KIND = v.union(
  v.literal('gasto'),
  v.literal('caja_entrada'),
  v.literal('caja_salida'),
);

export const GASTO_CATEGORIES = [
  'Aseo / limpieza',
  'Mantenimiento',
  'Transporte',
  'Insumos / mercado',
  'Servicios públicos',
  'Comisiones',
  'Publicidad',
  'Nómina / honorarios',
  'Papelería',
  'Otro',
] as const;

export const listCategories = query({
  args: {},
  handler: async () => [...GASTO_CATEGORIES],
});

/** Saldo actual de caja menor + movimientos del rango (para el panel). */
export const getCajaMenor = query({
  args: {
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      await requireAccounting(ctx);
    } catch {
      return { saldo: 0, rows: [] as Array<Record<string, unknown>> };
    }

    const all = await ctx.db.query('operationalMovements').collect();
    const active = all.filter((m) => !m.deletedAt);

    let saldo = 0;
    for (const m of active) {
      if (m.kind === 'caja_entrada') saldo += m.amount;
      else if (m.kind === 'caja_salida') saldo -= m.amount;
    }

    const start = args.start ?? 0;
    const end = args.end ?? Number.MAX_SAFE_INTEGER;
    const rows = active
      .filter(
        (m) =>
          (m.kind === 'caja_entrada' || m.kind === 'caja_salida') &&
          m.fechaMs >= start &&
          m.fechaMs < end,
      )
      .sort((a, b) => b.fechaMs - a.fechaMs)
      .map((m) => ({
        id: m._id,
        kind: m.kind,
        category: m.category,
        amount: m.amount,
        fecha: m.fecha,
        medio: m.medio ?? '',
        beneficiario: m.beneficiario ?? '',
        notes: m.notes ?? '',
        propertyTitle: m.propertyTitle ?? '',
        createdByName: m.createdByName ?? '',
        createdAt: m.createdAt,
      }));

    return { saldo, rows };
  },
});

/** Gastos del mes (kind = gasto) para listar/editar en el panel. */
export const listGastos = query({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    try {
      await requireAccounting(ctx);
    } catch {
      return [];
    }
    const all = await ctx.db
      .query('operationalMovements')
      .withIndex('by_fecha', (q) =>
        q.gte('fechaMs', args.start).lt('fechaMs', args.end),
      )
      .collect();
    return all
      .filter((m) => !m.deletedAt && m.kind === 'gasto')
      .sort((a, b) => b.fechaMs - a.fechaMs)
      .map((m) => ({
        id: m._id,
        kind: m.kind,
        category: m.category,
        amount: m.amount,
        fecha: m.fecha,
        medio: m.medio ?? '',
        beneficiario: m.beneficiario ?? '',
        notes: m.notes ?? '',
        propertyTitle: m.propertyTitle ?? '',
        createdByName: m.createdByName ?? '',
        createdAt: m.createdAt,
      }));
  },
});

export const create = mutation({
  args: {
    kind: KIND,
    category: v.string(),
    amount: v.number(),
    fecha: v.string(),
    medio: v.optional(v.string()),
    beneficiario: v.optional(v.string()),
    notes: v.optional(v.string()),
    propertyId: v.optional(v.id('properties')),
  },
  handler: async (ctx, args) => {
    const user = await requireAccounting(ctx);
    const amount = Math.round(Number(args.amount) || 0);
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
    const category = args.category.trim();
    if (!category) throw new Error('La categoría es obligatoria');
    const fechaMs = fechaToMs(args.fecha);

    let propertyTitle: string | undefined;
    if (args.propertyId) {
      const p = await ctx.db.get(args.propertyId);
      propertyTitle = p?.title;
    }

    // Caja salida: no permitir dejar saldo negativo.
    if (args.kind === 'caja_salida') {
      const all = await ctx.db.query('operationalMovements').collect();
      let saldo = 0;
      for (const m of all) {
        if (m.deletedAt) continue;
        if (m.kind === 'caja_entrada') saldo += m.amount;
        else if (m.kind === 'caja_salida') saldo -= m.amount;
      }
      if (amount > saldo) {
        throw new Error(
          `Saldo de caja insuficiente (disponible $${saldo.toLocaleString('es-CO')})`,
        );
      }
    }

    const now = Date.now();
    return await ctx.db.insert('operationalMovements', {
      kind: args.kind,
      category,
      amount,
      fecha: args.fecha,
      fechaMs,
      medio: args.medio?.trim() || undefined,
      beneficiario: args.beneficiario?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      propertyId: args.propertyId,
      propertyTitle,
      createdBy: user._id ? String(user._id) : undefined,
      createdByName: user.name || user.email || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id('operationalMovements') },
  handler: async (ctx, { id }) => {
    await requireAccounting(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.deletedAt) throw new Error('Movimiento no encontrado');
    await ctx.db.patch(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  },
});
