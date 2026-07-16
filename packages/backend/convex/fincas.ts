/**
 * Funciones del dominio fincas portadas de fincasya-new `convex/fincas.ts`.
 * Se extraen por partes según las necesita el panel admin (este archivo crece
 * con cada página portada; el original tiene ~78K).
 *
 * Actual: orden de pestañas del home (tabOrders) para /admin/reorder.
 */
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/** Orden guardado de todas las pestañas. */
export const getTabOrders = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('tabOrders').collect();
  },
});

/** Obtener el orden de una pestaña específica. */
export const getTabOrder = query({
  args: { tabId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tabOrders')
      .withIndex('by_tab', (q) => q.eq('tabId', args.tabId))
      .unique();
  },
});

// ─── Pricing helpers (portados de fincasya-new) ───

async function getActivePricingRules(ctx: any, propertyId: any) {
  const pricingRules = await ctx.db
    .query('propertyPricing')
    .withIndex('by_property', (q: any) => q.eq('propertyId', propertyId))
    .collect();

  const activeRules = [];
  for (const rule of pricingRules) {
    let globalData = null;
    if (rule.globalRuleId) {
      globalData = await ctx.db.get(rule.globalRuleId);
    }
    const isActive = globalData?.activa !== false && (rule.activa ?? true);
    if (isActive) {
      activeRules.push({
        ...rule,
        fechaDesde: globalData?.fechaDesde || rule.fechaDesde,
        fechaHasta: globalData?.fechaHasta || rule.fechaHasta,
        fechas: globalData?.fechas || rule.fechas,
      });
    }
  }
  return activeRules.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function getPriceForDate(dateStr: string, basePrice: number, activeRules: any[]) {
  const parts = dateStr.split('-');
  if (parts.length < 3)
    return { price: basePrice, ruleName: 'Estándar', ruleId: null };
  const mmdd = `${parts[1]}-${parts[2]}`;
  for (const rule of activeRules) {
    if (rule.fechas?.includes(mmdd)) {
      return {
        price: rule.valorUnico ?? basePrice,
        ruleName: rule.nombre || 'Especial',
        ruleId: rule._id,
      };
    }
    if (rule.fechaDesde && rule.fechaHasta) {
      if (rule.fechaDesde <= rule.fechaHasta) {
        if (mmdd >= rule.fechaDesde && mmdd <= rule.fechaHasta) {
          return {
            price: rule.valorUnico ?? basePrice,
            ruleName: rule.nombre || 'Especial',
            ruleId: rule._id,
          };
        }
      } else if (mmdd >= rule.fechaDesde || mmdd <= rule.fechaHasta) {
        return {
          price: rule.valorUnico ?? basePrice,
          ruleName: rule.nombre || 'Especial',
          ruleId: rule._id,
        };
      }
    }
  }
  return { price: basePrice, ruleName: 'Estándar', ruleId: null };
}

/** Calcular precio total de una estadía (admin / contratos / reservas). */
export const calculateStayPrice = query({
  args: {
    propertyId: v.id('properties'),
    fechaEntrada: v.string(),
    fechaSalida: v.string(),
    numeroPersonas: v.optional(v.number()),
    numeroMascotas: v.optional(v.number()),
    incluirServicio: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) return { total: 0, nights: [] };

    const activeRules = await getActivePricingRules(ctx, args.propertyId);
    const start = new Date(args.fechaEntrada + 'T12:00:00');
    const end = new Date(args.fechaSalida + 'T12:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return { total: 0, nights: [] };
    }

    let dominantRule: { price: number; ruleName: string; ruleId: unknown } | null =
      null;
    const tempCurrent = new Date(start);
    while (tempCurrent < end) {
      const dateStr = tempCurrent.toISOString().split('T')[0];
      const { price, ruleName, ruleId } = getPriceForDate(
        dateStr,
        property.priceBase,
        activeRules,
      );
      if (ruleName !== 'Estándar' && !dominantRule) {
        dominantRule = { price, ruleName, ruleId };
      }
      tempCurrent.setDate(tempCurrent.getDate() + 1);
    }

    const finalNightlyPrice = dominantRule ? dominantRule.price : property.priceBase;
    const finalRuleName = dominantRule ? dominantRule.ruleName : 'Estándar';
    const nights: Array<{ date: string; price: number; ruleName: string }> = [];
    let total = 0;
    const current = new Date(start);
    while (current < end) {
      const dateStr = current.toISOString().split('T')[0];
      nights.push({ date: dateStr, price: finalNightlyPrice, ruleName: finalRuleName });
      total += finalNightlyPrice;
      current.setDate(current.getDate() + 1);
    }

    // Regla de mascotas (2026-07): la PRIMERA paga solo el depósito normal
    // ($100.000 reembolsable); desde la SEGUNDA se cobra ingreso de $30.000
    // por cada una + un cargo único de aseo de $70.000.
    const numeroMascotas = args.numeroMascotas ?? 0;
    const petRefundable = Math.min(numeroMascotas, 1) * 100000;
    const petServiceFee = Math.max(0, numeroMascotas - 1) * 30000;
    const petCleaningFee = numeroMascotas >= 2 ? 70000 : 0;
    const petTotal = petRefundable + petServiceFee + petCleaningFee;
    const serviceStaffFee = args.incluirServicio
      ? (property.serviceStaffPrice || 0) * Math.max(1, nights.length)
      : 0;
    const damageDeposit = Math.max(
      0,
      Number(property.depositoDanosReembolsable ?? 0) || 0,
    );
    const wristbandFee = Math.max(0, Number(property.manillaCondominio ?? 0) || 0);

    return {
      total: total + petTotal + serviceStaffFee + damageDeposit + wristbandFee,
      subtotal: total,
      nightsCount: nights.length,
      nights,
      basePrice: property.priceBase,
      appliedRule: finalRuleName,
      pets: {
        count: numeroMascotas,
        refundable: petRefundable,
        serviceFee: petServiceFee,
        cleaningFee: petCleaningFee,
        total: petTotal,
      },
      serviceStaff: {
        available: !!property.serviceStaffAvailable,
        price: property.serviceStaffPrice || 0,
        included: !!args.incluirServicio,
        fee: args.incluirServicio ? property.serviceStaffPrice || 0 : 0,
      },
      damageDeposit,
      wristbandFee,
    };
  },
});

/** Actualizar o crear el orden de una pestaña. */
export const updateTabOrder = mutation({
  args: {
    tabId: v.string(),
    propertyIds: v.array(v.id('properties')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tabOrders')
      .withIndex('by_tab', (q) => q.eq('tabId', args.tabId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        propertyIds: args.propertyIds,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert('tabOrders', {
        tabId: args.tabId,
        propertyIds: args.propertyIds,
        updatedAt: Date.now(),
      });
      return id;
    }
  },
});
