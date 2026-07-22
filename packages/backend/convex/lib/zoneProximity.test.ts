import { describe, expect, test } from 'bun:test';
import {
  departmentSoftZone,
  extractZoneFromText,
  nearbyZoneKeywords,
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

describe('zona sticky — basura del LLM', () => {
  // Caso real (Adriana, 22-jul): el LLM guardó «HILLS» —pedazo del nombre de
  // ANAPOIMA HOME LUXURY HILLS— como zona, y el bot le hablaba al cliente de
  // "la zona HILLS". Una zona solo vale si alguna finca está realmente ahí.
  const inventario = [
    { location: 'Anapoima, Cundinamarca', departamentos: ['Cundinamarca'] },
    { location: 'Villavicencio, Meta', departamentos: ['Meta'] },
    { location: 'Melgar, Tolima', departamentos: ['Tolima'] },
  ];
  const existeEnInventario = (zona: string) => {
    const { keywords } = resolveZoneKeywords(zona);
    return (
      keywords.length > 0 &&
      inventario.some((p) =>
        propertyMatchesZone(p.location, p.departamentos, keywords),
      )
    );
  };

  test('un nombre de finca NO es zona', () => {
    expect(existeEnInventario('HILLS')).toBe(false);
    expect(existeEnInventario('QUEEN LUXURY')).toBe(false);
    expect(existeEnInventario('DOLLY HOUSE')).toBe(false);
  });

  test('las zonas de verdad sí pasan', () => {
    expect(existeEnInventario('Anapoima')).toBe(true);
    expect(existeEnInventario('llanos orientales')).toBe(true);
    expect(existeEnInventario('cerca a Bogotá')).toBe(true);
  });
});

describe('nearbyZoneKeywords — anillo de cercanía', () => {
  // Caso real (Adriana, 22-jul): el cliente pidió Cartagena y Santa Marta y el
  // lote llegó lleno de Melgar, Villavicencio y Anapoima.
  test('quien pide costa completa con costa, nunca con el interior', () => {
    const near = nearbyZoneKeywords('Cartagena');
    expect(near).toContain('santa marta');
    expect(near).toContain('baru');
    expect(near).not.toContain('melgar');
    expect(near).not.toContain('villavicencio');
    expect(near).not.toContain('anapoima');
  });

  test('quien pide Melgar completa con Cundinamarca/Tolima, no con la costa', () => {
    const near = nearbyZoneKeywords('Melgar');
    expect(near).toContain('girardot');
    expect(near).toContain('anapoima');
    expect(near).not.toContain('cartagena');
    expect(near).not.toContain('santa marta');
  });

  test('quien pide Llanos completa con Meta, no con Melgar', () => {
    const near = nearbyZoneKeywords('llanos orientales');
    expect(near).toContain('restrepo');
    expect(near).toContain('acacias');
    expect(near).not.toContain('melgar');
  });

  test('una zona desconocida no inventa vecinos', () => {
    expect(nearbyZoneKeywords('HILLS')).toEqual([]);
  });
});

describe('"cualquier lugar" vs. una zona nombrada', () => {
  // El cliente dijo "es para cualquiera de esas partes, Santa Marta,
  // Cartagena": el bot borró la zona y mandó fincas del interior.
  const BROADEN_RE =
    /^(cualquier|donde sea|no importa|todas? part|toda colombia|indiferente|el que sea)/;
  const esAmpliar = (z: string) =>
    BROADEN_RE.test(z.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')) &&
    extractZoneFromText(z) === null;

  test('la frase que nombra destinos NO borra la zona', () => {
    expect(esAmpliar('cualquiera de esas partes, Santa Marta, Cartagena')).toBe(
      false,
    );
    expect(esAmpliar('cualquier lugar cerca a Bogotá')).toBe(false);
  });

  test('la frase sin destino sí amplía', () => {
    expect(esAmpliar('cualquier lugar')).toBe(true);
    expect(esAmpliar('donde sea')).toBe(true);
    expect(esAmpliar('no importa el lugar')).toBe(true);
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
