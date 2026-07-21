import { describe, expect, test } from 'bun:test';
import {
  departmentSoftZone,
  extractZoneFromText,
  propertyMatchesZone,
  resolveZoneKeywords,
} from './zoneProximity';

describe('resolveZoneKeywords — Llanos', () => {
  test('"llanos orientales" → Meta, no Melgar', () => {
    const r = resolveZoneKeywords('los llanos orientales');
    expect(r.keywords).toContain('villavicencio');
    expect(r.keywords).toContain('meta');
    expect(r.keywords).not.toContain('melgar');
    expect(r.label).toContain('Llanos');
  });

  test('"villavo" y "Villavicencio" resuelven a Meta', () => {
    expect(resolveZoneKeywords('villavo').keywords).toContain('meta');
    expect(resolveZoneKeywords('Villavicencio').keywords).toContain('villavicencio');
  });
});

describe('propertyMatchesZone', () => {
  test('finca en Villavicencio coincide con llanos; Melgar no', () => {
    const kw = resolveZoneKeywords('llanos orientales').keywords;
    expect(
      propertyMatchesZone('Villavicencio, Meta', ['Meta'], kw),
    ).toBe(true);
    expect(propertyMatchesZone('Melgar, Tolima', ['Tolima'], kw)).toBe(false);
  });
});

describe('extractZoneFromText', () => {
  test('detecta llanos en mensaje real', () => {
    expect(
      extractZoneFromText(
        'Buenas tardes, estoy interesada en una finca por los llanos orientales',
      ),
    ).toBe('Llanos / Meta');
  });
});

describe('departmentSoftZone', () => {
  test('llanos → Meta (no abrir a todo el país)', () => {
    expect(departmentSoftZone('llanos orientales')).toBe('Meta');
  });
});
