import { describe, expect, test } from 'bun:test';
import {
  REGLAS_NOCHES,
  TEMPORADA_CORRIDA,
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

  test('si duerme el 31 de dic es Fin de año aunque entre el 25–27', () => {
    // Caso real: cliente pidió 27 dic → 3 ene (7 noches) y el bot lo rechazó
    // como si fuera Navidad (máx. 4 noches).
    expect(classifyTemporadaEspecial('2026-12-27', '2027-01-03')).toBe(
      'Fin de año',
    );
    expect(classifyTemporadaEspecial('2026-12-26', '2027-01-02')).toBe(
      'Fin de año',
    );
    expect(classifyTemporadaEspecial('2026-12-31', '2027-01-06')).toBe(
      'Fin de año',
    );
  });

  test('si duerme Navidad Y la noche del 31 es el CORRIDO (sin tope)', () => {
    // Caso real (Adriana): 23 dic → 3 ene son 11 noches corridas y el bot las
    // rechazó por "máximo 8 de Fin de año".
    expect(classifyTemporadaEspecial('2026-12-23', '2027-01-03')).toBe(
      TEMPORADA_CORRIDA,
    );
    expect(classifyTemporadaEspecial('2026-12-24', '2027-01-02')).toBe(
      TEMPORADA_CORRIDA,
    );
    // Entrar el 26 o el 27 ya no duerme Navidad: es Fin de año puro.
    expect(classifyTemporadaEspecial('2026-12-26', '2027-01-02')).toBe(
      'Fin de año',
    );
  });

  test('el corrido no tiene máximo de noches', () => {
    const corrido = REGLAS_NOCHES[TEMPORADA_CORRIDA];
    expect(corrido.min).toBe(6);
    expect(corrido.max).toBeUndefined();
    // 11 noches (23 dic → 3 ene) cumplen.
    expect(
      11 >= corrido.min && (corrido.max === undefined || 11 <= corrido.max),
    ).toBe(true);
  });

  test('sigue siendo Navidad si sale antes del 1 de enero', () => {
    expect(classifyTemporadaEspecial('2026-12-24', '2026-12-27')).toBe(
      'Navidad',
    );
    expect(classifyTemporadaEspecial('2026-12-27', '2026-12-31')).toBe(
      'Navidad',
    );
  });
});

describe('REGLAS_NOCHES', () => {
  test('Navidad 3–4; Fin de año 6–8', () => {
    expect(REGLAS_NOCHES.Navidad).toEqual({ min: 3, max: 4 });
    expect(REGLAS_NOCHES['Fin de año']).toEqual({ min: 6, max: 8 });
  });

  test('27 dic → 3 ene (7 noches) cumple la regla de Fin de año', () => {
    const fda = REGLAS_NOCHES['Fin de año'];
    expect(7 >= fda.min && 7 <= (fda.max ?? 99)).toBe(true);
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

  test('el corrido avisa que va sin máximo y con precio de asesor', () => {
    const n = ciclosOficialesNota(TEMPORADA_CORRIDA);
    expect(n).toContain('SIN máximo');
    expect(n).toContain('23 dic → 3 ene');
    expect(n).toContain('asesor');
  });

  test('Fin de año lista ciclos con 6 noches', () => {
    const n = ciclosOficialesNota('Fin de año');
    expect(n).toContain('mínimo 6');
    expect(n).toContain('27 de dic al 3 de ene');
    expect(n).toContain('28 de dic al 3 de ene');
    expect(n).toContain('30 de dic al 6 de ene');
  });
});
