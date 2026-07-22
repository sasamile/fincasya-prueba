import { describe, expect, test } from 'bun:test';
import {
  capacityCeilForCupo,
  capacityCeilRelaxedForCupo,
  capacityPreferMaxForCupo,
} from './capacityCeil';

describe('piso del techo — grupos pequeños', () => {
  // Caso real (Adriana, 22-jul): familia de 4 pidió Villavicencio, donde casi
  // todo es de 10 pax en adelante. Con techo 7 la zona quedaba en cero y el
  // lote se llenaba con 3 fincas de otras zonas.
  test('un grupo de 4 alcanza fincas de 10 pax', () => {
    expect(capacityCeilForCupo(4)).toBe(10);
    expect(capacityCeilRelaxedForCupo(4)).toBe(12);
  });

  test('grupos de 2 a 6 nunca bajan del piso', () => {
    for (const cupo of [2, 3, 4, 5, 6]) {
      expect(capacityCeilForCupo(cupo)).toBeGreaterThanOrEqual(10);
      expect(capacityCeilRelaxedForCupo(cupo)).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('techo por fórmula — grupos medianos y grandes', () => {
  test('el piso no afloja el techo de los grupos grandes', () => {
    // 12 → +4 ; 16 → +5 ; 20 → +6 : la fórmula manda, no el piso.
    expect(capacityCeilForCupo(12)).toBe(16);
    expect(capacityCeilForCupo(16)).toBe(21);
    expect(capacityCeilForCupo(20)).toBe(26);
  });

  test('sigue habiendo techo: a 20 personas no se le ofrece una de 40', () => {
    expect(capacityCeilRelaxedForCupo(20)).toBeLessThan(40);
  });
});

describe('banda preferida', () => {
  test('prioriza lo ajustado al grupo', () => {
    expect(capacityPreferMaxForCupo(12)).toBe(15);
    expect(capacityPreferMaxForCupo(4)).toBe(6);
  });
});
