import { describe, expect, test } from 'bun:test';
import {
  buildSoldOutWeekendMessage,
  stayOverlapsSoldOutWeekend,
} from './copys';

describe('stayOverlapsSoldOutWeekend', () => {
  test('bloquea 18→20 julio', () => {
    expect(stayOverlapsSoldOutWeekend('2026-07-18', '2026-07-20')).toBe(true);
  });

  test('bloquea stay que cruza las noches', () => {
    expect(stayOverlapsSoldOutWeekend('2026-07-17', '2026-07-20')).toBe(true);
    expect(stayOverlapsSoldOutWeekend('2026-07-19', '2026-07-21')).toBe(true);
  });

  test('no bloquea llegada el 20 ni fechas de otro mes', () => {
    expect(stayOverlapsSoldOutWeekend('2026-07-20', '2026-07-22')).toBe(false);
    expect(stayOverlapsSoldOutWeekend('2026-07-11', '2026-07-13')).toBe(false);
    expect(stayOverlapsSoldOutWeekend('2025-07-18', '2025-07-20')).toBe(false);
  });

  test('mensaje menciona el rango', () => {
    expect(buildSoldOutWeekendMessage()).toContain('18 al 20 de julio');
    expect(buildSoldOutWeekendMessage()).toContain('✅');
    expect(buildSoldOutWeekendMessage()).toContain('🏡');
  });
});