import { describe, expect, test } from 'bun:test';
import { seCruzan } from './dateOverlap';

/** Fecha "YYYY-MM-DD" → ms (UTC), para leer los casos como los lee el equipo. */
const d = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe('cruce de fechas de una finca', () => {
  test('las MISMAS fechas se cruzan (el caso que reventó)', () => {
    // Santiago, 23-jul: se creó un segundo link de venta para la misma finca y
    // las mismas fechas; al entregar la confirmación falló por fechas ocupadas.
    expect(seCruzan(d('2026-08-07'), d('2026-08-09'), d('2026-08-07'), d('2026-08-09'))).toBe(true);
  });

  test('una estadía que arranca dentro de otra se cruza', () => {
    expect(seCruzan(d('2026-08-08'), d('2026-08-12'), d('2026-08-07'), d('2026-08-09'))).toBe(true);
  });

  test('una estadía que envuelve a otra se cruza', () => {
    expect(seCruzan(d('2026-08-01'), d('2026-08-20'), d('2026-08-07'), d('2026-08-09'))).toBe(true);
  });

  test('la salida de una PUEDE ser la entrada de la otra', () => {
    // Ese día la finca se desocupa y se vuelve a ocupar: NO es choque.
    expect(seCruzan(d('2026-08-09'), d('2026-08-12'), d('2026-08-07'), d('2026-08-09'))).toBe(false);
    expect(seCruzan(d('2026-08-05'), d('2026-08-07'), d('2026-08-07'), d('2026-08-09'))).toBe(false);
  });

  test('estadías separadas no se cruzan', () => {
    expect(seCruzan(d('2026-09-01'), d('2026-09-05'), d('2026-08-07'), d('2026-08-09'))).toBe(false);
  });

  test('es simétrico: el orden de los rangos no cambia el veredicto', () => {
    const a = [d('2026-08-08'), d('2026-08-12')] as const;
    const b = [d('2026-08-07'), d('2026-08-09')] as const;
    expect(seCruzan(...a, ...b)).toBe(seCruzan(...b, ...a));
  });
});
