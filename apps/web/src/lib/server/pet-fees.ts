/**
 * Política comercial de mascotas (COP) — regla unificada (Vane, 21-jul-2026):
 *   - Depósito reembolsable: $100.000 POR CADA mascota (3 → $300.000).
 *   - Tarifa de ingreso: $30.000 por mascota DESDE LA 2ª (3 → $60.000).
 *   - Aseo por mascotas: $70.000 único cuando hay 2 o más (en la CR va
 *     INCLUIDO en el aseo final, no como línea aparte).
 * Debe ser IDÉNTICA a src/lib/pet-fees.ts y a la regla del backend
 * (packages/backend/convex/fincas.ts getStayPrice).
 */
export const PET_DEPOSIT_PER_PET = 100_000;
export const PET_ENTRY_FEE_FROM_SECOND = 30_000;
export const PET_CLEANING_FROM_SECOND = 70_000;

export function computePetFees(petCount: number) {
  const n = Math.max(0, Math.floor(Number(petCount) || 0));
  const deposit = n * PET_DEPOSIT_PER_PET;
  const serviceFee = Math.max(0, n - 1) * PET_ENTRY_FEE_FROM_SECOND;
  const cleaningFee = n >= 2 ? PET_CLEANING_FROM_SECOND : 0;
  return {
    count: n,
    deposit,
    serviceFee,
    cleaningFee,
    total: deposit + serviceFee + cleaningFee,
  };
}
