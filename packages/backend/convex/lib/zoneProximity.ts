/**
 * Cercanía por zona: resuelve una frase de zona del cliente a un conjunto de
 * palabras clave (municipios/departamentos) para filtrar el catálogo. Ej.:
 *   "cerca a Bogotá" → municipios de escapada cercanos (Anapoima, Girardot,
 *                      Melgar, La Mesa, Tocaima…).
 *   "Villavicencio" / "llanos" / "villavo" → Meta (NO Melgar).
 *   "melgar"         → también Tolima.
 */

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}

/** Municipios de escapada de fin de semana cerca de Bogotá (Cundinamarca + Tolima cercano). */
const NEAR_BOGOTA = [
  'anapoima', 'girardot', 'melgar', 'la mesa', 'tocaima', 'villeta', 'nilo',
  'ricaurte', 'apulo', 'flandes', 'carmen de apicala', 'anolaima', 'cundinamarca',
];

/** Meta / Llanos — NUNCA mezclar con Melgar/Cundinamarca. */
const META_LLANOS = [
  'villavicencio',
  'restrepo',
  'acacias',
  'cumaral',
  'meta',
  'villavo',
];

/** Sinónimos/expansiones por región (se evalúan en orden). */
const ZONE_ALIASES: Array<{ match: RegExp; keywords: string[]; label: string }> = [
  { match: /(cerca|cercan|alrededor|afuera|salir de).*bogot/, keywords: NEAR_BOGOTA, label: 'cerca de Bogotá' },
  { match: /bogot/, keywords: NEAR_BOGOTA, label: 'cerca de Bogotá' },
  // Llanos / Villavo: "llanos orientales", "villavo", "meta" — NUNCA Melgar.
  {
    match: /\bllanos?\b|\bvillavo\b|\bmeta\b/,
    keywords: META_LLANOS,
    label: 'Meta / Llanos',
  },
  { match: /villavicencio/, keywords: ['villavicencio', 'meta', 'villavo'], label: 'Villavicencio (Meta)' },
  { match: /eje cafetero|quindio|pereira|armenia|quimbaya/, keywords: ['quindio', 'quimbaya', 'eje cafetero', 'pereira', 'armenia'], label: 'Eje Cafetero' },
];

/** Frases detectables en texto libre del cliente (orden: más específicas primero). */
const ZONE_PHRASES: Array<{ match: RegExp; zona: string }> = [
  { match: /\bllanos?\s+orientales?\b|\bllanos?\b|\bvillavo\b/, zona: 'Llanos / Meta' },
  { match: /villavicencio/, zona: 'Villavicencio' },
  { match: /\bdepartamento\s+(?:del?\s+)?meta\b|\ben\s+(?:el\s+)?meta\b/, zona: 'Meta' },
  { match: /cerca\s+(?:a|de)\s+bogot/, zona: 'cerca a Bogotá' },
  { match: /eje\s+cafetero/, zona: 'Eje Cafetero' },
  { match: /\bmelgar\b/, zona: 'Melgar' },
  { match: /\bgirardot\b/, zona: 'Girardot' },
  { match: /\banapoima\b/, zona: 'Anapoima' },
  { match: /\btocaima\b/, zona: 'Tocaima' },
  { match: /\bvilleta\b/, zona: 'Villeta' },
  { match: /\bricaurte\b/, zona: 'Ricaurte' },
  { match: /\bapulo\b/, zona: 'Apulo' },
  { match: /\bnilo\b/, zona: 'Nilo' },
  { match: /carmen\s+de\s+apicala/, zona: 'Carmen de Apicalá' },
  { match: /\bflandes\b/, zona: 'Flandes' },
  { match: /\bla\s+mesa\b/, zona: 'La Mesa' },
  { match: /\bla\s+vega\b/, zona: 'La Vega' },
  { match: /\brestrepo\b/, zona: 'Restrepo' },
  { match: /\bacacias\b/, zona: 'Acacias' },
  { match: /\bcumaral\b/, zona: 'Cumaral' },
  { match: /santa\s+marta/, zona: 'Santa Marta' },
  { match: /cartagena/, zona: 'Cartagena' },
  { match: /\bcosta\b|\bplaya\b/, zona: 'costa' },
];

/** Municipio → departamento (para expandir la búsqueda a la zona). */
const MUNICIPALITY_TO_DEPT: Record<string, string> = {
  villavicencio: 'meta', restrepo: 'meta', acacias: 'meta', cumaral: 'meta',
  villavo: 'meta',
  anapoima: 'cundinamarca', girardot: 'cundinamarca', 'la mesa': 'cundinamarca',
  tocaima: 'cundinamarca', villeta: 'cundinamarca', nilo: 'cundinamarca',
  ricaurte: 'cundinamarca', anolaima: 'cundinamarca', tenjo: 'cundinamarca',
  viota: 'cundinamarca', apulo: 'cundinamarca', 'la vega': 'cundinamarca',
  melgar: 'tolima', flandes: 'tolima', 'carmen de apicala': 'tolima',
  'santa marta': 'magdalena', cartagena: 'bolivar', quimbaya: 'quindio',
};

export type ZoneResolution = { keywords: string[]; label: string };

/**
 * Parte una frase de zona con VARIOS lugares en sus municipios:
 * "la Vega o Villeta" → ['la vega', 'villeta']. Cubre "o", "y", "u", comas y
 * barras. Con un solo lugar devuelve [esa zona normalizada].
 */
export function splitZoneParts(zonaRaw: string): string[] {
  return norm(zonaRaw)
    .split(/\s+o\s+|\s+u\s+|\s+y\s+|,|\//)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveSingleZone(zNorm: string): ZoneResolution {
  for (const alias of ZONE_ALIASES) {
    if (alias.match.test(zNorm)) {
      return { keywords: [...new Set(alias.keywords.map(norm))], label: alias.label };
    }
  }
  // Municipio conocido → incluir también su departamento.
  const keywords = new Set<string>([zNorm]);
  const dept = MUNICIPALITY_TO_DEPT[zNorm];
  if (dept) keywords.add(dept);
  return { keywords: [...keywords], label: zNorm };
}

export function resolveZoneKeywords(zonaRaw: string): ZoneResolution {
  const parts = splitZoneParts(zonaRaw);
  if (parts.length === 0) return { keywords: [], label: '' };
  // "la Vega o Villeta": se unen las keywords de CADA municipio — antes se
  // buscaba la frase completa como si fuera un solo pueblo y no coincidía con
  // nada (queja real: había 4 fincas en Villeta y no salió ninguna).
  const keywords = new Set<string>();
  const labels: string[] = [];
  for (const p of parts) {
    const r = resolveSingleZone(p);
    for (const k of r.keywords) keywords.add(k);
    labels.push(r.label);
  }
  return { keywords: [...keywords], label: labels.join(' / ') || zonaRaw.trim() };
}

/**
 * Extrae la zona pedida del texto libre del cliente (ej. "finca en los llanos
 * orientales"). Usado para sticky de zona aunque el LLM omita el parámetro.
 */
export function extractZoneFromText(text: string): string | null {
  const z = norm(text);
  if (!z) return null;
  for (const phrase of ZONE_PHRASES) {
    if (phrase.match.test(z)) return phrase.zona;
  }
  return null;
}

/**
 * REGIONES para la ampliación "lugares CERCANOS" (Adriana, 22-jul): cuando el
 * cliente pide un destino y no alcanzan las fincas de ahí, el lote se completa
 * con la MISMA región — jamás con el otro extremo del país. Quien pide
 * Cartagena ve Santa Marta / Barú, no Melgar ni Villavicencio.
 */
const REGIONES: ReadonlyArray<readonly string[]> = [
  // Costa Caribe
  [
    'santa marta', 'cartagena', 'rosario', 'baru', 'tierra bomba', 'covenas',
    'tolu', 'magdalena', 'bolivar', 'atlantico', 'sucre', 'cordoba', 'guajira',
  ],
  // Cundinamarca + Tolima cercano (escapada desde Bogotá)
  NEAR_BOGOTA,
  // Meta / Llanos
  META_LLANOS,
  // Eje Cafetero
  ['quindio', 'quimbaya', 'eje cafetero', 'pereira', 'armenia', 'risaralda'],
];

/**
 * Palabras clave de la REGIÓN a la que pertenece la zona pedida (incluye la
 * zona misma). Sirve para completar el lote con destinos vecinos sin salirse
 * de la región. Devuelve [] si la zona no cae en ninguna región conocida.
 */
export function nearbyZoneKeywords(zonaRaw: string): string[] {
  const propias = resolveZoneKeywords(zonaRaw).keywords;
  if (propias.length === 0) return [];
  const region = REGIONES.find((r) =>
    propias.some((k) => r.some((m) => m.includes(k) || k.includes(m))),
  );
  return region ? [...region] : [];
}

/** Soft-ampliación: departamento de la zona (Meta, Tolima…) sin abrir a todo el país. */
export function departmentSoftZone(zonaRaw: string): string | null {
  const kw = resolveZoneKeywords(zonaRaw).keywords;
  if (kw.includes('meta') || kw.includes('villavicencio') || kw.includes('villavo')) {
    return 'Meta';
  }
  if (kw.includes('tolima') || kw.includes('melgar')) return 'Tolima';
  if (kw.includes('cundinamarca') || kw.some((k) => NEAR_BOGOTA.includes(k))) {
    return 'Cundinamarca';
  }
  if (kw.includes('quindio') || kw.includes('eje cafetero')) return 'Eje Cafetero';
  return null;
}

/** Normaliza texto de zona/ubicación (minúsculas, sin tildes). Para comparar. */
export function normZoneText(s: string): string {
  return norm(s);
}

/** ¿La finca coincide con alguna de las palabras clave de zona? */
export function propertyMatchesZone(
  location: string,
  departamentos: string[] | undefined,
  keywords: string[],
): boolean {
  if (keywords.length === 0) return true;
  const loc = norm(location);
  const depts = (departamentos ?? []).map(norm);
  return keywords.some((k) => loc.includes(k) || depts.some((d) => d.includes(k)));
}

// ---------------------------------------------------------------------------
// COSTA — regla comercial: los destinos de costa (Santa Marta, Cartagena,
// Islas del Rosario…) SOLO se envían si el turista los pide explícitamente.
// Jamás se mezclan en las favoritas sin zona ni en ampliaciones de búsqueda.
// ---------------------------------------------------------------------------

/** Frases del cliente que SÍ son una petición explícita de costa. */
const COAST_REQUEST_KEYWORDS = [
  'santa marta', 'cartagena', 'rosario', 'baru', 'isla', 'costa', 'playa',
  'caribe', 'covenas', 'tolu', 'magdalena', 'bolivar', 'tierra bomba',
];

/** Ubicaciones/departamentos de finca que cuentan como costa. */
const COASTAL_LOCATION_KEYWORDS = [
  'santa marta', 'cartagena', 'rosario', 'baru', 'tierra bomba', 'covenas', 'tolu',
];
const COASTAL_DEPARTMENTS = [
  'magdalena', 'bolivar', 'atlantico', 'sucre', 'cordoba', 'guajira',
];

/** ¿La zona pedida por el cliente ES costa (petición explícita)? */
export function zoneRequestsCoast(zonaRaw?: string | null): boolean {
  const z = norm(zonaRaw ?? '');
  if (!z) return false;
  return COAST_REQUEST_KEYWORDS.some((k) => z.includes(k));
}

/** ¿La finca está en la costa? (por municipio o departamento). */
export function isCoastalProperty(
  location: string,
  departamentos?: string[],
): boolean {
  const loc = norm(location);
  const depts = (departamentos ?? []).map(norm);
  return (
    COASTAL_LOCATION_KEYWORDS.some((k) => loc.includes(k)) ||
    COASTAL_DEPARTMENTS.some((d) => depts.some((x) => x.includes(d)))
  );
}
