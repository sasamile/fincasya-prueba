import { describe, expect, test } from 'bun:test';
import {
  decideReceiptVerdict,
  RECEIPT_PROBABILITY_MIN,
} from './receiptAi';

describe('decideReceiptVerdict', () => {
  test('rechaza si no es comprobante', () => {
    const v = decideReceiptVerdict({
      isReceipt: false,
      receiptProbability: 0.9,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('not_a_receipt');
  });

  test('rechaza si la probabilidad es baja', () => {
    const v = decideReceiptVerdict({
      isReceipt: true,
      receiptProbability: RECEIPT_PROBABILITY_MIN - 0.1,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('not_a_receipt');
  });

  test('acepta un comprobante claro con monto', () => {
    const v = decideReceiptVerdict({
      isReceipt: true,
      receiptProbability: 0.95,
      amount: 1_000_000,
      bankName: 'Bancolombia',
    });
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(false);
  });

  test('acepta con revisión si no hay monto', () => {
    const v = decideReceiptVerdict({
      isReceipt: true,
      receiptProbability: 0.85,
    });
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });
});
