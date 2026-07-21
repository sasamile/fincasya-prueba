// Regla de mascotas unificada 21-jul-2026 (ver pet-fees.ts).
import { computePetFees, PET_DEPOSIT_PER_PET } from "./pet-fees";

/** Aseo final según cláusula TERCERA del contrato (no el depositoAseo de la ficha). */
export const CONFIRMATION_STANDARD_CLEANING_COP = 100_000;

/** Depósito reembolsable por mascota ($100.000 CADA UNA; ver pet-fees). */
export { PET_DEPOSIT_PER_PET as CONFIRMATION_PET_REFUNDABLE_COP };

/**
 * Limpieza general de la confirmación: aseo final + aseo por mascotas (2+)
 * EN UNA SOLA LÍNEA (regla Vane 21-jul: el aseo de mascotas va incluido en el
 * aseo final de la CR, no aparte). Acepta overrides del contrato editado.
 */
export function resolveConfirmationCleaningFee(
  petCount?: number,
  overrides?: { baseCleaningFee?: number; petCleaningFee?: number },
): {
  cleaningFee: number;
  petCleaningFee: number;
} {
  const n = Math.max(0, Math.floor(petCount ?? 0));
  const base =
    overrides?.baseCleaningFee != null && overrides.baseCleaningFee > 0
      ? overrides.baseCleaningFee
      : CONFIRMATION_STANDARD_CLEANING_COP;
  const petCleaningFee =
    overrides?.petCleaningFee != null && overrides.petCleaningFee >= 0
      ? overrides.petCleaningFee
      : computePetFees(n).cleaningFee;
  return {
    cleaningFee: base + petCleaningFee,
    petCleaningFee,
  };
}

export type ConfirmationFinancialInput = {
  /** Valor total del contrato (precioTotal). */
  precioTotal: number;
  /** Subtotal alojamiento: finca (+ personal servicio), sin mascotas ni depósitos. */
  subtotal?: number;
  /** Tarifa ingreso mascotas 2ª+ (costoMascotas). */
  petSurcharge?: number;
  /** Aseo final del contrato (SIN aseo de mascotas). 0 → default $100.000. */
  cleaningFee: number;
  /** Depósito por daños (reembolsable), sin mascotas. */
  damageDeposit: number;
  petCount?: number;
  /** Depósito mascotas del contrato ($100.000 c/u; override editable). */
  depositoMascotas?: number;
  /** Aseo por mascotas del contrato (override editable; suma a limpieza). */
  petCleaningFee?: number;
};

export type ConfirmationFinancialResult = {
  rentAmount: number;
  cleaningFee: number;
  refundableDeposit: number;
  totalAmount: number;
  petCleaningFee: number;
};

/**
 * Valor TOTAL = precio del contrato (precioTotal, ej. 3.700.000).
 * Valor Alquiler = subtotal de la finca solamente (sin mascotas, depósitos ni abonos).
 * Limpieza y depósito reembolsable van en filas aparte (se pagan al ingreso).
 */
export function computeConfirmationFinancials(
  input: ConfirmationFinancialInput,
): ConfirmationFinancialResult {
  const totalAmount =
    input.precioTotal > 0 ? input.precioTotal : Math.max(0, input.subtotal ?? 0);

  const petCount = Math.max(0, Math.floor(input.petCount ?? 0));
  const petSurcharge = Math.max(0, input.petSurcharge ?? 0);
  const subtotal = Math.max(0, input.subtotal ?? 0);

  let rentAmount = subtotal;
  if (rentAmount <= 0 && totalAmount > 0) {
    const pets = computePetFees(petCount);
    rentAmount = Math.max(0, totalAmount - petSurcharge - pets.serviceFee);
  }
  if (rentAmount > totalAmount && totalAmount > 0) {
    rentAmount = totalAmount;
  }

  let petRefundable = Math.max(0, input.depositoMascotas ?? 0);
  if (petRefundable <= 0 && petCount > 0) {
    petRefundable = computePetFees(petCount).deposit;
  }

  /** Fianza + depósito mascotas en una sola línea (ej. 300k + 3×100k = 600k). */
  const refundableDeposit = Math.max(0, input.damageDeposit) + petRefundable;
  // El CR toma los valores del CONTRATO (editables) y solo calcula el default
  // cuando no llegaron — así CR y contrato nunca se contradicen (Vane 21-jul).
  const { cleaningFee, petCleaningFee } = resolveConfirmationCleaningFee(petCount, {
    baseCleaningFee: input.cleaningFee,
    petCleaningFee: input.petCleaningFee,
  });

  return { rentAmount, cleaningFee, refundableDeposit, totalAmount, petCleaningFee };
}
