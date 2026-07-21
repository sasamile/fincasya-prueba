import { describe, expect, test } from 'bun:test';
import {
  REGLAS_NOCHES,
  classifyTemporadaEspecial,
  ciclosOficialesNota,
} from './seasonNights';

describe('classifyTemporadaEspecial', () => {
  test('24–27 dic es Navidad, no Fin de año', () => {
    expect(classifyTemporadaEspecial('2026-12-24')).toBe('Navidad');
    expect(classifyTemporadaEspecial('2026-12-22')).toBe('Navidad');
    expect(classifyTemporadaEspecial('2026-12-27')).toBe('Navidad');
  });

  test('28–30 dic es Fin de año', () => {
    expect(classifyTemporadaEspecial('2026-12-28')).toBe('Fin de año');
    expect(classifyTemporadaEspecial('2026-12-30')).toBe('Fin de año');
  });

  test('enero no es Fin de año por entrada', () => {
    expect(classifyTemporadaEspecial('2027-01-02')).toBeNull();
    expect(classifyTemporadaEspecial('2027-01-05')).toBeNull();
  });
});

describe('REGLAS_NOCHES', () => {
  test('Navidad 3–4; Fin de año 6–7', () => {
    expect(REGLAS_NOCHES.Navidad).toEqual({ min: 3, max: 4 });
    expect(REGLAS_NOCHES['Fin de año']).toEqual({ min: 6, max: 7 });
  });

  test('3 noches en Navidad cumplen; en Fin de año no', () => {
    const navi = REGLAS_NOCHES.Navidad;
    const fda = REGLAS_NOCHES['Fin de año'];
    expect(3 >= navi.min && 3 <= (navi.max ?? 99)).toBe(true);
    expect(3 >= fda.min).toBe(false);
  });
});

describe('ciclosOficialesNota', () => {
  test('Navidad menciona 3 a 4 y prohíbe 6', () => {
    const n = ciclosOficialesNota('Navidad');
    expect(n).toContain('3 a 4');
    expect(n).toContain('PROHIBIDO exigir 6');
    expect(n).toContain('24 de dic al 27 de dic');
  });

  test('Fin de año lista ciclos con 6 noches', () => {
    const n = ciclosOficialesNota('Fin de año');
    expect(n).toContain('mínimo 6');
    expect(n).toContain('28 de dic al 3 de ene');
    expect(n).toContain('30 de dic al 6 de ene');
  });
});
