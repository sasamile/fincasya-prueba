import { describe, expect, test } from 'bun:test';
import {
  decideSignedContractVerdict,
  CONTRACT_PROBABILITY_MIN,
} from './signedContractAi';

describe('decideSignedContractVerdict', () => {
  test('rechaza si no es contrato', () => {
    const v = decideSignedContractVerdict({
      isContract: false,
      hasClientSignature: true,
      contractProbability: 0.95,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('not_a_contract');
  });

  test('rechaza si la probabilidad es baja', () => {
    const v = decideSignedContractVerdict({
      isContract: true,
      hasClientSignature: true,
      contractProbability: CONTRACT_PROBABILITY_MIN - 0.1,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('not_a_contract');
  });

  test('rechaza si falta la firma del cliente', () => {
    const v = decideSignedContractVerdict({
      isContract: true,
      hasClientSignature: false,
      contractProbability: 0.95,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('missing_signature');
  });

  test('acepta contrato firmado claro', () => {
    const v = decideSignedContractVerdict({
      isContract: true,
      hasClientSignature: true,
      contractProbability: 0.95,
    });
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(false);
  });

  test('acepta con revisión si la confianza es media', () => {
    const v = decideSignedContractVerdict({
      isContract: true,
      hasClientSignature: true,
      contractProbability: 0.8,
    });
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });
});
