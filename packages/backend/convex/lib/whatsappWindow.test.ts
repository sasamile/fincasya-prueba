import { describe, expect, test } from 'bun:test';
import { dentroDeVentana24h, VENTANA_24H_MS } from './whatsappWindow';

const AHORA = Date.parse('2026-07-23T18:00:00Z');
const hace = (ms: number) => AHORA - ms;
const HORA = 60 * 60 * 1000;

describe('ventana de 24h de WhatsApp', () => {
  test('si el cliente escribió hace un rato, va texto libre', () => {
    expect(dentroDeVentana24h(hace(2 * HORA), AHORA)).toBe(true);
  });

  test('a 23 horas todavía alcanza', () => {
    expect(dentroDeVentana24h(hace(23 * HORA), AHORA)).toBe(true);
  });

  test('pasadas las 24 horas toca plantilla', () => {
    expect(dentroDeVentana24h(hace(25 * HORA), AHORA)).toBe(false);
  });

  test('justo en el borde de 24h ya está fuera', () => {
    expect(dentroDeVentana24h(hace(VENTANA_24H_MS), AHORA)).toBe(false);
  });

  test('un cliente que nunca escribió no tiene ventana', () => {
    // Caso real del flujo nuevo: le mandamos contrato y link, pagó por el
    // portal y jamás respondió por WhatsApp → la confirmación va por plantilla.
    expect(dentroDeVentana24h(undefined, AHORA)).toBe(false);
    expect(dentroDeVentana24h(null, AHORA)).toBe(false);
    expect(dentroDeVentana24h(0, AHORA)).toBe(false);
  });

  test('un timestamp futuro (reloj desfasado) no rompe: cuenta como dentro', () => {
    expect(dentroDeVentana24h(AHORA + HORA, AHORA)).toBe(true);
  });
});
