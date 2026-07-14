/**
 * Desglose económico de una reserva (líneas: alquiler, limpieza, depósito, etc.).
 *
 * Extraído de `paymentPortal.ts` para poder reutilizarlo tanto en el portal de
 * pago del cliente como al armar los ítems de una factura de Siigo. El depósito
 * reembolsable se marca con `highlight: true` (no es ingreso): quien factura lo
 * excluye con `isRefundableDepositRow`.
 */
import type { Doc } from '../_generated/dataModel';
import { economicAdjustmentBreakdownRows } from './economicAdjustments';

export type BreakdownRow = { label: string; amount: number; highlight?: boolean };

export function computeBreakdown(booking: Doc<'bookings'>): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    { label: 'Valor alquiler', amount: Number(booking.subtotal) || 0 },
    { label: 'Limpieza general', amount: Number(booking.depositoAseo) || 0 },
    {
      label: 'Valor depósito reembolsable',
      amount: Number(booking.depositoGarantia) || 0,
      highlight: true,
    },
    {
      label: 'Recargo por mascotas',
      amount: Number(booking.costoMascotas) || 0,
    },
    {
      label: 'Personal de servicio',
      amount: Number(booking.costoPersonalServicio) || 0,
    },
    {
      label: 'Descuento',
      amount: -(Number(booking.discountAmount) || 0),
    },
  ].filter((row) => row.amount !== 0);

  const adjustmentRows = economicAdjustmentBreakdownRows(
    booking.economicAdjustments,
  );
  if (adjustmentRows.length > 0) {
    rows.push(...adjustmentRows);
  }

  const sum = rows.reduce((acc, row) => acc + row.amount, 0);
  const diff = (Number(booking.precioTotal) || 0) - sum;
  const hasDeposit = rows.some((row) =>
    row.label.toLowerCase().includes('depósito reembolsable'),
  );

  if (diff !== 0 && adjustmentRows.length === 0) {
    if (!hasDeposit && diff > 0) {
      rows.push({
        label: 'Valor depósito reembolsable',
        amount: diff,
        highlight: true,
      });
    } else {
      rows.push({ label: 'Otros ajustes', amount: diff });
    }
  }

  return rows;
}

/**
 * Una fila corresponde al depósito reembolsable (garantía) — NO es ingreso y
 * por tanto NUNCA entra en una factura fiscal.
 */
export function isRefundableDepositRow(row: BreakdownRow): boolean {
  return (
    row.highlight === true ||
    /dep[oó]sito reembolsable/i.test(row.label)
  );
}
