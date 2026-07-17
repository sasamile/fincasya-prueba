import { describe, expect, test } from 'bun:test';
import {
  codeMatchesPrefix,
  suggestNextForPrefix,
} from './contractCodeSuggest';

describe('suggestNextForPrefix', () => {
  test('CR12345678 → CR12345679', () => {
    expect(
      suggestNextForPrefix(['CR12345678', 'CR12345670'], 'CR'),
    ).toBe('CR12345679');
  });

  test('acepta guiones y espacios', () => {
    expect(suggestNextForPrefix(['CR-2961', 'CR 2950'], 'CR')).toBe('CR2962');
  });

  test('sin historial empieza en 1', () => {
    expect(suggestNextForPrefix([], 'CRA')).toBe('CRA1');
  });

  test('ignora otros prefijos', () => {
    expect(suggestNextForPrefix(['CRA10', 'CR5'], 'CR')).toBe('CR6');
  });
});

describe('codeMatchesPrefix', () => {
  test('CR no incluye CRA', () => {
    expect(codeMatchesPrefix('CR2961', 'CR')).toBe(true);
    expect(codeMatchesPrefix('CR-2961', 'CR')).toBe(true);
    expect(codeMatchesPrefix('CRA10', 'CR')).toBe(false);
  });
});
