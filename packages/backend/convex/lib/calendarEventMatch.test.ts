import { test, expect } from 'bun:test';
import {
  buildStopWords,
  candidatePropertiesForEvent,
  parseClientNameFromTitle,
  suggestPropertyForEvent,
  type PropertyForMatch,
} from './calendarEventMatch';

/** Fincas reales (recortadas) que cubren las trampas de los títulos del equipo. */
const PROPS: PropertyForMatch[] = [
  { id: 'p_rojas', title: 'CASA ROJAS', code: null, location: 'Tocaima' },
  { id: 'p_hills', title: 'ANAPOIMA HOME LUXURY HILLS 13PAX AN#003', code: 'AN#003', location: 'Anapoima' },
  { id: 'p_montebello', title: 'CARMEN DE APICALÁ QUINTA MONTEBELLO 20PAX CA#12', code: 'CA#12', location: 'Carmen de Apicalá' },
  { id: 'p_natural', title: 'MELGAR NATURAL HOUSE 11PAX MG#011', code: 'MG#011', location: 'Melgar' },
  { id: 'p_black', title: 'VILLAVICENCIO BLACK LUXURY HOME 13PAX VC#01', code: 'VC#01', location: 'Villavicencio' },
  { id: 'p_olympo', title: 'CASA OLYMPO 12PAX VC#030', code: 'VC#030', location: 'Villavicencio' },
  { id: 'p_prem1', title: 'RESTREPO LUXURY PREMIUM 20PAX RT#020', code: 'RT#020', location: 'Restrepo' },
  { id: 'p_prem2', title: 'RESTREPO HOME PREMIUM 14PAX RT#021', code: 'RT#021', location: 'Restrepo' },
];

const stop = buildStopWords(PROPS);
const suggest = (s: string) => suggestPropertyForEvent(s, PROPS, stop);

test('el apellido del cliente NO se toma como finca (queda en baja para revisar)', () => {
  // Trampa real: "Rojas" es apellido, la finca real está en Tocaima.
  // El guion inicial hacía que todo el título contara como zona de finca.
  const r = suggest('-A0542 CAROL VANESA ROJAS, TOCAIMA UNA NOCHE');
  expect(r.confidence).toBe('baja');
});

test('la finca después de la coma se detecta con confianza alta', () => {
  const r = suggest('2666 JAIME ANDRES CASTILLO, MONTEBELLO 04 NOCHES');
  expect(r.propertyId).toBe('p_montebello');
  expect(r.confidence).toBe('alta');
});

test('apellido en zona cliente + finca real en zona finca → gana la finca', () => {
  const r = suggest('2664 LINA YULIANA ROJAS,HILLS DOS NOCHES');
  expect(r.propertyId).toBe('p_hills');
  expect(r.confidence).toBe('alta');
});

test('separador guion cuando no hay coma', () => {
  const r = suggest('A0525 CATHERIN LOPEZ -MELGAR NATURAL DOS NOCHES');
  expect(r.propertyId).toBe('p_natural');
});

test('nombre pegado sin espacio (OLYMPOOCUPADA)', () => {
  const r = suggest('OLYMPOOCUPADA');
  expect(r.propertyId).toBe('p_olympo');
});

test('nombre parcial de la finca (BLACK LUX → Black Luxury Home)', () => {
  const r = suggest('2650 EDWIN GABRIEL VARGAS, BLACK LUX DOS NOCHES');
  expect(r.propertyId).toBe('p_black');
});

test('ambiguo entre dos fincas → no sugiere, deja alternativas', () => {
  const r = suggest('2653 NICOL ANDREA TRIVIÑO, PREMIUM DOS NOCHES');
  expect(r.propertyId).toBeNull();
  expect(r.confidence).toBe('ninguna');
  expect(r.alternatives.sort()).toEqual(['p_prem1', 'p_prem2']);
});

test('evento que no es una reserva → sin sugerencia', () => {
  expect(suggest('Cita laboratorios 8 AM').propertyId).toBeNull();
  expect(suggest('Inicio del uso del sistema TECNOLÓGICO').propertyId).toBeNull();
});

test('solo el municipio, sin nombre de finca → sin sugerencia', () => {
  // "TOCAIMA OCUPADA": el municipio no identifica CUÁL finca es.
  expect(suggest('TOCAIMA OCUPADA').propertyId).toBeNull();
});

test('nombre del cliente: quita el código de reserva y corta en la coma', () => {
  expect(parseClientNameFromTitle('2666 JAIME ANDRES CASTILLO, MONTEBELLO 04 NOCHES')).toBe(
    'Jaime Andres Castillo',
  );
  expect(parseClientNameFromTitle('A0525 CATHERIN LOPEZ -MELGAR NATURAL DOS NOCHES')).toBe(
    'Catherin Lopez',
  );
  // Guion inicial + código: "-A0542 CAROL VANESA ROJAS, TOCAIMA UNA NOCHE"
  expect(parseClientNameFromTitle('-A0542 CAROL VANESA ROJAS, TOCAIMA UNA NOCHE')).toBe(
    'Carol Vanesa Rojas',
  );
  expect(parseClientNameFromTitle('V-A0475 ANDRES FABIAN GOMEZ, NAPOLES DOS NOCHES')).toBe(
    'Andres Fabian Gomez',
  );
});

test('nombre del cliente: títulos sin cliente → null (lo escribe el operador)', () => {
  expect(parseClientNameFromTitle('CHIMBI OCUPADA')).toBeNull();
  expect(parseClientNameFromTitle('TOCAIMA OCUPADA')).toBeNull();
  expect(parseClientNameFromTitle('Cita laboratorios 8 AM')).toBeNull();
});

// ── candidatePropertiesForEvent (retención para el bot) ──

const candidates = (s: string) => candidatePropertiesForEvent(s, PROPS, stop);

test('municipio solo ("TOCAIMA OCUPADA") → retiene TODAS las fincas de ese municipio', () => {
  expect(candidates('TOCAIMA OCUPADA')).toEqual(['p_rojas']);
});

test('empate de nombre → retiene todas las alternativas', () => {
  const c = candidates('2653 NICOL ANDREA TRIVIÑO, PREMIUM DOS NOCHES');
  expect(c).toContain('p_prem1');
  expect(c).toContain('p_prem2');
});

test('match de confianza baja (apellido ≈ finca) → se retiene por si acaso', () => {
  const c = candidates('-A0542 CAROL VANESA ROJAS, TOCAIMA UNA NOCHE');
  expect(c).toContain('p_rojas');
});

test('título sin pista utilizable → sin candidatas (no se puede retener nada)', () => {
  expect(candidates('2583 JEYSON HERNANDEZ, LA DIANA 02 NOCHES')).toEqual([]);
  expect(candidates('Cita laboratorios 8 AM')).toEqual([]);
});
