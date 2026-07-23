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
 * Mínimo de fichas que debe llevar el primer envío. Si las favoritas
 * disponibles no llegan a esto, se completa con el resto (Adriana, 22-jul: a
 * un grupo de 4 le llegaron SOLO 2 opciones porque no había más favoritas
 * chicas). Mejor un lote decente que dos fichas sueltas.
 */
export const MIN_FICHAS_PRIMER_LOTE = 6;

/**
 * ¿Este tier entra en el PRIMER envío de catálogo?
 *
 * Vane: "primero las favoritas y si piden más se le envía la otra". El primer
 * lote privilegia fincas de la semana y favoritas — pero solo se restringe a
 * ellas si alcanzan para llenar un lote decente.
 */
export function entraEnPrimerLote(
  tier: number,
  favoritasDisponibles: number,
): boolean {
  if (favoritasDisponibles < MIN_FICHAS_PRIMER_LOTE) return true;
  return (
    tier === TIER_SEMANA_EN_ZONA ||
    tier === TIER_FAVORITA_EN_ZONA ||
    tier === TIER_FAVORITA_VECINA ||
    tier === TIER_SEMANA_VECINA
  );
}
