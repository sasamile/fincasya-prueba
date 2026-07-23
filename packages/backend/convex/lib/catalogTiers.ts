/**
 * ORDEN del lote de catálogo: qué finca sale primero.
 *
 * Vive aparte de agent.ts porque es la regla que más veces se ha roto y así se
 * puede probar sola. El número es la prioridad (0 sale primero):
 *
 *   0 · finca de la SEMANA en la zona pedida — selección manual del equipo
 *   1 · FAVORITA de la zona pedida
 *   2 · resto de la zona pedida
 *   3 · FAVORITA de un destino vecino (misma región)
 *   4 · resto de destinos vecinos
 *   5 · finca de la SEMANA de un destino vecino — cierra el lote
 *
 * Historia de las dos reglas que codifica:
 * - Vane, 21-jul: las fincas de la semana las escoge el equipo, van de primeras.
 * - Vane, 22-jul: dentro de la zona se mezclaba lo favorito con lo que no lo
 *   era, y al cliente le llegó una finca que el equipo no promociona ANTES que
 *   las favoritas. Lo favorito manda en cada escalón.
 */

export const TIER_SEMANA_EN_ZONA = 0;
export const TIER_FAVORITA_EN_ZONA = 1;
export const TIER_RESTO_EN_ZONA = 2;
export const TIER_FAVORITA_VECINA = 3;
export const TIER_RESTO_VECINA = 4;
export const TIER_SEMANA_VECINA = 5;

/** A partir de este tier, la finca YA NO es de la zona que pidió el cliente. */
export const PRIMER_TIER_VECINO = TIER_FAVORITA_VECINA;

export type CatalogTierInput = {
  /** Finca de la semana (impulso manual del equipo). */
  esPick: boolean;
  /** Coincide con la zona que pidió el cliente. */
  enZona: boolean;
  esFavorita: boolean;
  /** El cliente pidió una zona concreta. */
  zonaGiven: boolean;
};

export function catalogTier(input: CatalogTierInput): number {
  const { esPick, enZona, esFavorita, zonaGiven } = input;
  // Sin zona pedida, todo cuenta como "en zona": no hay vecinos que distinguir.
  const dentro = !zonaGiven || enZona;
  if (esPick) return dentro ? TIER_SEMANA_EN_ZONA : TIER_SEMANA_VECINA;
  if (dentro) return esFavorita ? TIER_FAVORITA_EN_ZONA : TIER_RESTO_EN_ZONA;
  return esFavorita ? TIER_FAVORITA_VECINA : TIER_RESTO_VECINA;
}

/**
 * Cuántas fichas lleva el PRIMER envío (Santiago, 23-jul: "no solo 3, máximo 8
 * entre favoritas del lugar, cercanas a ese lugar y las otras").
 *
 * NINGÚN tier se excluye del primer lote: la regla de Vane ("primero las
 * favoritas") se cumple por el ORDEN de los tiers, no dejando fincas fuera.
 * Antes el primer lote era solo-favoritas y a un grupo de 4 le llegaron 2
 * fichas (Adriana, 22-jul); ahora se llena hasta 8 en orden de tier —
 * favoritas de la zona → resto de la zona → favoritas vecinas → resto — y lo
 * que sobra queda para el envío de "más opciones".
 */
export const MAX_FICHAS_PRIMER_LOTE = 8;
