import { test, expect, describe } from 'bun:test';
import {
  decideCedulaVerdict,
  normalizeCedulaNumber,
  type CedulaAiCheck,
} from './cedulaAi';

const check = (over: Partial<CedulaAiCheck> = {}): CedulaAiCheck => ({
  cedulaProbability: 0.95,
  number: '1020304050',
  name: 'JUAN PEREZ',
  ...over,
});

describe('normalizeCedulaNumber', () => {
  test('quita puntos, guiones y espacios', () => {
    expect(normalizeCedulaNumber('1.020.304.050')).toBe('1020304050');
    expect(normalizeCedulaNumber(' 79 456 123 ')).toBe('79456123');
  });

  test('acepta número', () => {
    expect(normalizeCedulaNumber(52123456)).toBe('52123456');
  });

  test('rechaza longitudes imposibles para una cédula', () => {
    expect(normalizeCedulaNumber('12345')).toBeUndefined();
    expect(normalizeCedulaNumber('123456789012')).toBeUndefined();
  });

  test('rechaza basura', () => {
    expect(normalizeCedulaNumber('')).toBeUndefined();
    expect(normalizeCedulaNumber('abc')).toBeUndefined();
    expect(normalizeCedulaNumber(null)).toBeUndefined();
  });
});

describe('decideCedulaVerdict — bloquea', () => {
  test('cuando la IA está segura de que no es un documento', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0, number: undefined, name: undefined }),
      '1020304050',
    );
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('not_a_document');
  });

  test('un comprobante de pago (probabilidad 0) NO pasa', () => {
    // Regresión: con el diseño anterior este caso real se colaba, porque
    // "confianza 0" se leía como "la IA dudó" en vez de "seguro que no".
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0, number: undefined, name: undefined }),
      '1020304050',
    );
    expect(v.allow).toBe(false);
  });

  test('cuando el número del documento no coincide con el escrito', () => {
    const v = decideCedulaVerdict(check({ number: '1020304050' }), '9999999999');
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('number_mismatch');
  });

  test('el mismo número con formato distinto NO es mismatch', () => {
    const v = decideCedulaVerdict(
      check({ number: '1020304050' }),
      '1.020.304.050',
    );
    expect(v.allow).toBe(true);
    expect(v.reason).toBeUndefined();
  });
});

describe('decideCedulaVerdict — deja pasar (no frenar ventas reales)', () => {
  test('documento válido y número coincidente pasa sin revisión', () => {
    const v = decideCedulaVerdict(check(), '1020304050');
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(false);
  });

  test('caso ambiguo (0.5): pasa pero marcado', () => {
    const v = decideCedulaVerdict(check({ cedulaProbability: 0.5 }), '1020304050');
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });

  test('es documento pero no se pudo leer el número: pasa marcado', () => {
    const v = decideCedulaVerdict(check({ number: undefined }), '1020304050');
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });

  test('foto borrosa reconocida como documento: pasa marcado', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0.6, number: undefined, note: 'borrosa' }),
      '1020304050',
    );
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });

  test('el cliente escribió mal su cédula pero el documento es válido: pasa marcado', () => {
    // No bloquea por typedCedula ilegible; solo por contradicción real.
    const v = decideCedulaVerdict(check(), 'abc');
    expect(v.allow).toBe(true);
  });

  test('justo en el umbral de bloqueo (0.2) todavía bloquea', () => {
    const v = decideCedulaVerdict(check({ cedulaProbability: 0.2 }), '1020304050');
    expect(v.allow).toBe(false);
  });

  test('apenas por encima del umbral (0.21) pasa marcado', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0.21 }),
      '1020304050',
    );
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });
});
