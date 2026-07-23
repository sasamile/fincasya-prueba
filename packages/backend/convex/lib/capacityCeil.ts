/**
 * Techos de capacidad del catálogo: hasta qué tan grande puede ser una finca
 * para un grupo, y qué tamaño se considera "ajustado".
 *
 * Dos reglas del equipo conviven aquí:
 * - Vane (21-jul): jamás ofrecerle casas enormes a un grupo chico — el techo
 *   por fórmula se cierra alrededor del cupo.
 * - Adriana (22-jul): "las de 10 sirven para los grupos más pequeños; de 0 a
 *   10, o 0 a 12, funcionan". Sin este piso, un grupo de 4 tenía techo 7 y en
 *   Villavicencio (casi todo de 10 pax en adelante) la zona quedaba en CERO,
 *   así que el lote se llenaba con fincas de otras zonas.
 */

/** Ninguna de las dos pasadas baja de aquí, por chico que sea el grupo. */
const PISO_TECHO = 10;
const PISO_TECHO_RELAJADO = 12;

/**
 * Desde este cupo el grupo cuenta como GRANDE: si aun con el techo relajado
 * el lote queda corto, el techo se ABRE del todo (solo manda el piso de cupo).
 * Para 29 personas una finca de 55/60 pax no es "absurda" — y el inventario de
 * casas tan grandes es mínimo. Caso real (Hernán, 23-jul): 29 personas + perro
 * en Melgar → el techo dejó UNA sola ficha (Viotá 36) y la MELGAR 55/60PAX,
 * favorita y pet friendly, quedó por fuera.
 */
export const CUPO_GRUPO_GRANDE = 20;

function techoPorFormula(cupo: number): number {
  if (cupo <= 6) return cupo + 3;
  if (cupo <= 12) return cupo + 4;
  if (cupo <= 16) return cupo + 5;
  if (cupo <= 25) return cupo + 6;
  return cupo + 8;
}

function techoRelajadoPorFormula(cupo: number): number {
  if (cupo <= 6) return cupo + 5;
  if (cupo <= 12) return cupo + 7;
  if (cupo <= 16) return cupo + 8;
  if (cupo <= 25) return Math.ceil(cupo * 1.45);
  return Math.ceil(cupo * 1.35);
}

/**
 * Techo de capacidad a recomendar (pasada estricta).
 * cupo ≤6 → +3 · ≤12 → +4 · ≤16 → +5 · ≤25 → +6 · >25 → +8, nunca bajo 10.
 */
export function capacityCeilForCupo(cupo: number): number {
  return Math.max(PISO_TECHO, techoPorFormula(cupo));
}

/** Techo RELAJADO (pasada intermedia cuando la estricta da pocas). */
export function capacityCeilRelaxedForCupo(cupo: number): number {
  return Math.max(PISO_TECHO_RELAJADO, techoRelajadoPorFormula(cupo));
}

/**
 * Banda PREFERIDA dentro del techo: la mayoría del lote debe caer aquí
 * (opciones "ajustadas" al grupo). Ej. 12 personas → prefer ≤15.
 */
export function capacityPreferMaxForCupo(cupo: number): number {
  if (cupo <= 6) return cupo + 2;
  if (cupo <= 12) return cupo + 3;
  if (cupo <= 16) return cupo + 4;
  if (cupo <= 25) return cupo + 5;
  return cupo + 8;
}
