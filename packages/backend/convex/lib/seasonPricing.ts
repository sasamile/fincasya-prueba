/**
 * PRECIO POR TEMPORADA para las fichas del bot (Vane, 21-jul-2026).
 *
 * Resuelve el precio POR NOCHE de una finca para unas fechas concretas usando
 * las MISMAS reglas de /admin/pricing-rules que usan contratos y cotizador
 * (propertyPricing + globalPricing): regla dominante = la primera noche de la
 * estadía que caiga en una temporada no estándar (igual que
 * fincas.calculateStayPrice, para que ficha y contrato digan lo mismo).
 *
 * Además honra las sub-reglas de PRECIO POR CAPACIDAD de la regla (si la
 * finca cae en un rango, ese valor manda sobre el valorUnico).
 */
import type { DatabaseReader } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

type SeasonRule = {
  nombre: string;
  fechaDesde?: string;
  fechaHasta?: string;
  fechas?: string[];
  valorUnico?: number;
  subReglasCapacidad?: Array<{
    capacidadMin: number;
    capacidadMax: number;
    valorUnico: number;
  }>;
  order?: number;
};

/**
 * Reglas activas de una finca, con fechas heredadas de la regla global.
 * `globalCache` evita re-leer el mismo doc global por cada finca del lote.
 */
export async function getActiveSeasonRules(
  db: DatabaseReader,
  propertyId: Id<'properties'>,
  globalCache: Map<string, Doc<'globalPricing'> | null>,
): Promise<SeasonRule[]> {
  const rows = await db
    .query('propertyPricing')
    .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
    .collect();

  const active: SeasonRule[] = [];
  for (const rule of rows) {
    let globalData: Doc<'globalPricing'> | null = null;
    if (rule.globalRuleId) {
      const key = String(rule.globalRuleId);
      if (!globalCache.has(key)) {
        globalCache.set(key, await db.get(rule.globalRuleId));
      }
      globalData = globalCache.get(key) ?? null;
    }
    const isActive = globalData?.activa !== false && (rule.activa ?? true);
    if (!isActive) continue;
    active.push({
      nombre: rule.nombre,
      fechaDesde: globalData?.fechaDesde || rule.fechaDesde,
      fechaHasta: globalData?.fechaHasta || rule.fechaHasta,
      fechas: globalData?.fechas || rule.fechas,
      valorUnico: rule.valorUnico,
      subReglasCapacidad: rule.subReglasCapacidad,
      order: rule.order,
    });
  }
  return active.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/** ¿La regla cubre este MM-DD? (lista de fechas o rango, con vuelta de año). */
function ruleMatchesMmdd(rule: SeasonRule, mmdd: string): boolean {
  if (rule.fechas?.includes(mmdd)) return true;
  if (rule.fechaDesde && rule.fechaHasta) {
    if (rule.fechaDesde <= rule.fechaHasta) {
      return mmdd >= rule.fechaDesde && mmdd <= rule.fechaHasta;
    }
    // Rango que cruza el año (ej. 12-15 → 01-15).
    return mmdd >= rule.fechaDesde || mmdd <= rule.fechaHasta;
  }
  return false;
}

/** Precio de la regla para una finca (sub-regla por capacidad > valorUnico). */
function rulePriceForCapacity(
  rule: SeasonRule,
  capacity: number,
): number | null {
  const sub = (rule.subReglasCapacidad ?? []).find(
    (s) => capacity >= s.capacidadMin && capacity <= s.capacidadMax,
  );
  if (sub && sub.valorUnico > 0) return sub.valorUnico;
  if (typeof rule.valorUnico === 'number' && rule.valorUnico > 0) {
    return rule.valorUnico;
  }
  return null;
}

/** Caché de reglas globales para un lote de fichas (evita gets repetidos). */
export function createGlobalPricingCache(): Map<
  string,
  Doc<'globalPricing'> | null
> {
  return new Map();
}

export type SeasonNightly = {
  /** Precio por noche que se muestra al cliente. */
  nightly: number;
  /** Nombre de la temporada ('Estándar' si ninguna regla aplica). */
  ruleName: string;
};

/**
 * Precio por noche para la estadía [feMs, fsMs) — regla dominante = primera
 * noche con temporada. Devuelve null si no hay ni regla ni priceBase.
 */
export async function resolveSeasonNightly(
  db: DatabaseReader,
  property: Doc<'properties'>,
  feMs: number,
  fsMs: number,
  globalCache: Map<string, Doc<'globalPricing'> | null>,
): Promise<SeasonNightly | null> {
  const rules = await getActiveSeasonRules(db, property._id, globalCache);
  const MAX_NIGHTS = 60; // candado anti rangos absurdos
  let noches = 0;
  for (let t = feMs; t < fsMs && noches < MAX_NIGHTS; t += 86_400_000, noches++) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const mmdd = iso.slice(5); // 'MM-DD'
    for (const rule of rules) {
      if (!ruleMatchesMmdd(rule, mmdd)) continue;
      const price = rulePriceForCapacity(rule, property.capacity);
      if (price !== null) {
        return { nightly: price, ruleName: rule.nombre || 'Especial' };
      }
      // Regla sin precio configurado → cae al base con nombre de la regla.
      if (property.priceBase > 0) {
        return { nightly: property.priceBase, ruleName: rule.nombre || 'Especial' };
      }
    }
  }
  if (property.priceBase > 0) {
    return { nightly: property.priceBase, ruleName: 'Estándar' };
  }
  return null;
}
