import { describe, expect, test } from 'bun:test';

/** Copia de la lógica exportada en contracts.ts (sin importar Convex). */
function isAutoInboxContractNumber(num: string): boolean {
  return /^INBOX-/i.test(num.trim());
}

function resolveContractDisplayNumber(
  contractNumber: string,
  opts?: {
    bookingReference?: string | null;
    draftContractCode?: string | null;
  },
): string {
  const bookingRef = String(opts?.bookingReference ?? '').trim();
  if (bookingRef) return bookingRef;

  const draftCode = String(opts?.draftContractCode ?? '').trim();
  if (draftCode && !isAutoInboxContractNumber(draftCode)) return draftCode;

  const num = contractNumber.trim();
  if (num && !isAutoInboxContractNumber(num)) return num;

  return 'Sin CR';
}

describe('resolveContractDisplayNumber', () => {
  test('prioriza el CR del booking', () => {
    expect(
      resolveContractDisplayNumber('INBOX-abc', {
        bookingReference: 'CR 2041',
        draftContractCode: 'X',
      }),
    ).toBe('CR 2041');
  });

  test('usa el código tipado del borrador', () => {
    expect(
      resolveContractDisplayNumber('INBOX-abc', {
        draftContractCode: '2960',
      }),
    ).toBe('2960');
  });

  test('oculta claves INBOX-* sin código', () => {
    expect(resolveContractDisplayNumber('INBOX-1784237545384')).toBe('Sin CR');
  });

  test('muestra contractNumber real', () => {
    expect(resolveContractDisplayNumber('A0552')).toBe('A0552');
  });
});
