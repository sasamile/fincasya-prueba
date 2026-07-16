/**
 * Empareja el TÍTULO de un evento del Google Calendar con una finca.
 *
 * El equipo escribe títulos libres ("2666 JAIME CASTILLO, MONTEBELLO 04 NOCHES",
 * "CHIMBI OCUPADA", "OLYMPOOCUPADA"), así que esto produce SUGERENCIAS con un
 * nivel de confianza. Los matches de confianza ALTA/MEDIA se auto-importan como
 * bloqueos por cron (googleCalendar.autoImportHighConfidence); los de BAJA y
 * los ambiguos solo entran cuando el operador los confirma en la pantalla de
 * revisión.
 *
 * Trampa real de los datos: el APELLIDO del cliente choca con nombres de finca
 * ("CAROL VANESA ROJAS, TOCAIMA" emparejaba con la finca "CASA ROJAS"). Por eso
 * se parte el título en dos zonas: la del CLIENTE (antes de la primera coma o
 * guion) y la de la FINCA (después). Un match en la zona de la finca es de
 * confianza ALTA; uno que solo aparece en la zona del cliente queda en BAJA
 * para que el operador lo revise.
 */

export type PropertyForMatch = {
  id: string;
  title: string;
  code?: string | null;
  location?: string | null;
};

export type MatchConfidence = 'alta' | 'media' | 'baja' | 'ninguna';

export type MatchSuggestion = {
  propertyId: string | null;
  confidence: MatchConfidence;
  /** Ids candidatos cuando hay empate (el operador elige). */
  alternatives: string[];
  /** Token que disparó el match (para mostrar el porqué). */
  matchedOn: string | null;
};

/** Mayúsculas, sin tildes, sin puntuación. */
export function norm(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras genéricas que NO identifican una finca. */
const GENERIC = new Set([
  'VILLA', 'VILLAS', 'CASA', 'CASAS', 'APTO', 'APARTAMENTO', 'APARTAESTUDIO',
  'FINCA', 'CABANA', 'CABANAS', 'HOME', 'HOUSE', 'LUJO', 'LUXURY', 'QUINTA',
  'PRIVADA', 'PRIVADAS', 'CAMPESTRE', 'ECOTURISTICA', 'CONJUNTO', 'CENTRO',
  'NOCHE', 'NOCHES', 'OCUPADA', 'OCUPADO', 'HASTA', 'COMPLETAR', 'RESERVA',
  'DEBE', 'PAX', 'DIA', 'DIAS', 'UNA', 'DOS', 'TRES', 'DEL', 'LOS', 'LAS',
]);

/** Tokens distintivos de un título de finca (sin municipios ni genéricos). */
function distinctiveTokens(title: string, stop: Set<string>): string[] {
  const out: string[] = [];
  for (const w of norm(title).split(' ')) {
    if (!w || w.length < 4) continue;
    if (stop.has(w) || GENERIC.has(w)) continue;
    if (/^\d+$/.test(w)) continue; // 13, 2960
    if (/^\d+PAX$/.test(w)) continue; // 13PAX
    if (/^[A-Z]{2,3}\d+$/.test(w)) continue; // MG008 (código sin #)
    out.push(w);
  }
  return out;
}

/**
 * Municipios a ignorar: se derivan de las `location` de las fincas (no se
 * hardcodean) — si mañana entra un municipio nuevo, funciona igual.
 */
export function buildStopWords(props: PropertyForMatch[]): Set<string> {
  const stop = new Set<string>();
  for (const p of props) {
    for (const w of norm(p.location ?? '').split(' ')) {
      if (w.length >= 3) stop.add(w);
    }
  }
  return stop;
}

/**
 * Parte el título en zona CLIENTE (antes del separador) y zona FINCA (después).
 * OJO con dos trampas reales de los títulos del equipo:
 *  - Empiezan con guion ("-A0542 CAROL ROJAS, TOCAIMA"): hay que quitar la
 *    puntuación inicial o el corte cae en la posición 0 y TODO queda como zona
 *    de finca (así se colaba el apellido "Rojas" → finca "Casa Rojas").
 *  - La COMA manda sobre el guion: "A0525 LOPEZ -MELGAR NATURAL" usa guion,
 *    pero cuando hay coma esa es la separación buena.
 */
function splitZones(summary: string): { clientZone: string; fincaZone: string } {
  const raw = (summary ?? '').replace(/^[^\p{L}\p{N}]+/u, '');
  const comma = raw.indexOf(',');
  const idx = comma >= 0 ? comma : raw.search(/[\-–—]/);
  if (idx <= 0) return { clientZone: '', fincaZone: norm(raw) };
  return {
    clientZone: norm(raw.slice(0, idx)),
    fincaZone: norm(raw.slice(idx + 1)),
  };
}

/** ¿El token aparece en el texto? Cubre pegado ("OLYMPOOCUPADA" → OLYMPO). */
function containsToken(text: string, token: string): boolean {
  return text.includes(token);
}

/** "jaime andres castillo" → "Jaime Andres Castillo". */
function titleCase(s: string): string {
  return s
    .toLocaleLowerCase('es-CO')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('es-CO') + w.slice(1))
    .join(' ');
}

/**
 * Saca el NOMBRE DEL CLIENTE del título para precargar la reserva:
 *   "2666 JAIME ANDRES CASTILLO, MONTEBELLO 04 NOCHES" → "Jaime Andres Castillo"
 * Vive en la zona del cliente (antes de la coma/guion), después del código de
 * reserva ("2666", "A0525", "V-A0475"). Si el título no tiene esa forma
 * (ej. "CHIMBI OCUPADA"), devuelve null y el operador lo escribe.
 */
export function parseClientNameFromTitle(summary: string): string | null {
  const raw = (summary ?? '').replace(/^[^\p{L}\p{N}]+/u, '');
  const comma = raw.indexOf(',');
  const idx = comma >= 0 ? comma : raw.search(/[\-–—]/);
  if (idx <= 0) return null;
  const words = raw.slice(0, idx).trim().split(/\s+/).filter(Boolean);
  // Descarta los códigos del inicio (cualquier palabra que traiga dígitos).
  while (words.length > 0 && /\d/.test(words[0])) words.shift();
  const name = words.join(' ').trim();
  if (name.length < 4 || words.length < 2) return null; // "OCUPADA", basura
  return titleCase(name);
}

/**
 * Sugiere la finca de un evento. Devuelve confianza y alternativas; el operador
 * siempre puede corregir en la pantalla de revisión.
 */
export function suggestPropertyForEvent(
  summary: string,
  props: PropertyForMatch[],
  stop: Set<string>,
): MatchSuggestion {
  const { clientZone, fincaZone } = splitZones(summary);
  const whole = norm(summary);

  type Hit = { id: string; token: string; inFincaZone: boolean };
  const hits: Hit[] = [];

  for (const p of props) {
    const tokens = new Set([
      ...distinctiveTokens(p.title, stop),
      ...distinctiveTokens(p.code ?? '', stop),
    ]);
    let best: Hit | null = null;
    for (const t of tokens) {
      const inFinca = fincaZone ? containsToken(fincaZone, t) : false;
      const inWhole = containsToken(whole, t);
      if (!inFinca && !inWhole) continue;
      // Gana el token más largo; a igual largo, el que está en la zona de finca.
      if (
        !best ||
        t.length > best.token.length ||
        (t.length === best.token.length && inFinca && !best.inFincaZone)
      ) {
        best = { id: p.id, token: t, inFincaZone: inFinca };
      }
    }
    if (best) hits.push(best);
  }

  if (hits.length === 0) {
    return { propertyId: null, confidence: 'ninguna', alternatives: [], matchedOn: null };
  }

  // Prioridad: los que aparecen en la zona de la FINCA (evita el choque con el
  // apellido del cliente, que vive en la zona del cliente).
  const fincaZoneHits = hits.filter((h) => h.inFincaZone);
  const pool = fincaZoneHits.length > 0 ? fincaZoneHits : hits;

  const maxLen = Math.max(...pool.map((h) => h.token.length));
  const top = pool.filter((h) => h.token.length === maxLen);

  if (top.length > 1) {
    return {
      propertyId: null,
      confidence: 'ninguna',
      alternatives: top.map((h) => h.id),
      matchedOn: top[0].token,
    };
  }

  const winner = top[0];
  // ALTA: está en la zona de la finca. MEDIA: título sin coma (ej "CHIMBI
  // OCUPADA") pero token largo. BAJA: solo aparece donde va el nombre del
  // cliente → probable choque de apellido, hay que revisar.
  let confidence: MatchConfidence;
  if (winner.inFincaZone) confidence = 'alta';
  else if (!clientZone) confidence = 'media';
  else confidence = 'baja';

  return {
    propertyId: winner.id,
    confidence,
    alternatives: [],
    matchedOn: winner.token,
  };
}
