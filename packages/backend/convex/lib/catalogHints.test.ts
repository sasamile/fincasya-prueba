import { test, expect } from 'bun:test';
import { extractCatalogHintsFromChat } from './catalogHints';

test('parsea "16 al 19 d agosto" + personas', () => {
  const h = extractCatalogHintsFromChat(
    '16 al 19 d agosto\n13 personas\nQuinta tramontini\nAdriana Martinez',
  );
  expect(h.fechaEntrada?.endsWith('-08-16')).toBe(true);
  expect(h.fechaSalida?.endsWith('-08-19')).toBe(true);
  expect(h.personas).toBe(13);
});

test('parsea "del 16 al 19 de agosto"', () => {
  const h = extractCatalogHintsFromChat('Del 16 al 19 de agosto para 20 personas');
  expect(h.fechaEntrada?.endsWith('-08-16')).toBe(true);
  expect(h.fechaSalida?.endsWith('-08-19')).toBe(true);
  expect(h.personas).toBe(20);
});

test('parsea rango cruzando año', () => {
  const h = extractCatalogHintsFromChat('Del 30 de diciembre al 2 de enero');
  expect(h.fechaEntrada?.endsWith('-12-30')).toBe(true);
  expect(h.fechaSalida?.endsWith('-01-02')).toBe(true);
  // Salida debe ser año siguiente a la entrada
  const yIn = Number(h.fechaEntrada!.slice(0, 4));
  const yOut = Number(h.fechaSalida!.slice(0, 4));
  expect(yOut).toBe(yIn + 1);
});

test('parsea ISO y dd/mm/yyyy', () => {
  expect(
    extractCatalogHintsFromChat('2026-08-16 y salimos 2026-08-19'),
  ).toMatchObject({
    fechaEntrada: '2026-08-16',
    fechaSalida: '2026-08-19',
  });
  expect(
    extractCatalogHintsFromChat('Entrada 16/08/2026 salida 19/08/2026'),
  ).toMatchObject({
    fechaEntrada: '2026-08-16',
    fechaSalida: '2026-08-19',
  });
});
