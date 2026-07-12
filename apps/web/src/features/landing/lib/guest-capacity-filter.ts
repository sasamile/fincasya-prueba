import type { PropertyResponse } from "../types";

/**
 * Techo estricto en el buscador web: evita fincas muy grandes para el grupo.
 * (El catálogo WhatsApp usa un margen mayor vía `capacityCeilForCupo` en el bot.)
 */
export function capacityMaxStrictForWebSearch(cupo: number): number {
  if (!Number.isFinite(cupo) || cupo <= 0) return cupo;
  if (cupo <= 6) return cupo + 2;
  if (cupo <= 12) return cupo + 3;
  if (cupo <= 20) return cupo + 5;
  return cupo + 8;
}

/** Si no hay fincas en rango estricto, ampliamos un poco (misma idea que el bot). */
export function capacityMaxRelaxedForWebSearch(cupo: number): number {
  if (!Number.isFinite(cupo) || cupo <= 0) return cupo;
  if (cupo <= 6) return cupo + 6;
  if (cupo <= 15) return cupo + 10;
  if (cupo <= 25) return Math.ceil(cupo * 1.7);
  return Math.ceil(cupo * 1.5);
}

export function filterPropertiesByGuests(
  properties: PropertyResponse[],
  guestsCount: number,
): PropertyResponse[] {
  if (!Number.isFinite(guestsCount) || guestsCount <= 0) return properties;

  const strictMax = capacityMaxStrictForWebSearch(guestsCount);
  const fits = (maxCap: number) =>
    properties.filter(
      (f) =>
        (f.capacity ?? 0) >= guestsCount && (f.capacity ?? 0) <= maxCap,
    );

  let result = fits(strictMax);
  if (result.length === 0) {
    const relaxedMax = capacityMaxRelaxedForWebSearch(guestsCount);
    result = fits(relaxedMax);
  }
  if (result.length === 0) {
    result = properties.filter((f) => (f.capacity ?? 0) >= guestsCount);
  }

  return [...result].sort(
    (a, b) =>
      Math.abs((a.capacity ?? 0) - guestsCount) -
      Math.abs((b.capacity ?? 0) - guestsCount),
  );
}
