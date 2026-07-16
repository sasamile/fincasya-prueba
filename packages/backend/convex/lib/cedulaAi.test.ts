import { test, expect, describe } from 'bun:test';
import {
  decideCedulaVerdict,
  normalizeCedulaNumber,
  namesLikelyMatch,
  verdictFromInspectError,
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

describe('namesLikelyMatch', () => {
  test('mismo nombre con tildes', () => {
    expect(namesLikelyMatch('José Pérez', 'JOSE PEREZ')).toBe(true);
  });

  test('nombres claramente distintos', () => {
    expect(namesLikelyMatch('Maria Lopez', 'JUAN PEREZ')).toBe(false);
  });

  test('sin datos', () => {
    expect(namesLikelyMatch('', 'JUAN')).toBeUndefined();
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

  test('caso ambiguo (0.5) NO pasa', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0.5 }),
      '1020304050',
    );
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('unreadable');
  });

  test('documento sin número legible NO pasa', () => {
    const v = decideCedulaVerdict(
      check({ number: undefined }),
      '1020304050',
    );
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('unreadable');
  });

  test('nombre claramente distinto NO pasa', () => {
    const v = decideCedulaVerdict(check(), {
      typedCedula: '1020304050',
      typedName: 'Maria Fernanda Lopez',
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('name_mismatch');
  });

  test('justo en el umbral de bloqueo (0.2) todavía bloquea', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0.2 }),
      '1020304050',
    );
    expect(v.allow).toBe(false);
  });

  test('apenas por encima del umbral débil (0.21) también bloquea (exige ≥0.8)', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0.21 }),
      '1020304050',
    );
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('unreadable');
  });
});

describe('decideCedulaVerdict — deja pasar', () => {
  test('documento válido y número coincidente pasa', () => {
    const v = decideCedulaVerdict(check(), {
      typedCedula: '1020304050',
      typedName: 'Juan Perez',
    });
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(false);
  });

  test('documento claro sin cédula tipada aún: pasa (el portal exige tiparla)', () => {
    const v = decideCedulaVerdict(check(), '');
    expect(v.allow).toBe(true);
    expect(v.needsReview).toBe(true);
  });

  test('foto clara reconocida como documento con número: pasa', () => {
    const v = decideCedulaVerdict(
      check({ cedulaProbability: 0.9, note: 'ligera sombra' }),
      '1020304050',
    );
    expect(v.allow).toBe(true);
  });
});

describe('verdictFromInspectError', () => {
  test('PDF bloquea (antes dejaba pasar y colaban listas de invitados)', () => {
    const v = verdictFromInspectError('pdf_not_supported');
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('pdf_not_allowed');
  });

  test('IA caída NO deja pasar (hay que poder validar)', () => {
    const v = verdictFromInspectError('Vision 500: boom');
    expect(v.allow).toBe(false);
    expect(v.reason).toBe('ai_unavailable');
  });
});
