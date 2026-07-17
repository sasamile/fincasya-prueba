/**
 * Cercanía por zona: resuelve una frase de zona del cliente a un conjunto de
 * palabras clave (municipios/departamentos) para filtrar el catálogo. Ej.:
 *   "cerca a Bogotá" → municipios de escapada cercanos (Anapoima, Girardot,
 *                      Melgar, La Mesa, Tocaima…).
 *   "Villavicencio"  → también el departamento del Meta.
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

/** Sinónimos/expansiones por región (se evalúan en orden). */
const ZONE_ALIASES: Array<{ match: RegExp; keywords: string[]; label: string }> = [
  { match: /(cerca|cercan|alrededor|afuera|salir de).*bogot/, keywords: NEAR_BOGOTA, label: 'cerca de Bogotá' },
  { match: /bogot/, keywords: NEAR_BOGOTA, label: 'cerca de Bogotá' },
  { match: /\bllanos?\b/, keywords: ['villavicencio', 'restrepo', 'acacias', 'cumaral', 'meta'], label: 'Meta / Llanos' },
  { match: /villavicencio/, keywords: ['villavicencio', 'meta'], label: 'Villavicencio (Meta)' },
  { match: /eje cafetero|quindio|pereira|armenia|quimbaya/, keywords: ['quindio', 'quimbaya', 'eje cafetero', 'pereira', 'armenia'], label: 'Eje Cafetero' },
];

/** Municipio → departamento (para expandir la búsqueda a la zona). */
const MUNICIPALITY_TO_DEPT: Record<string, string> = {
  villavicencio: 'meta', restrepo: 'meta', acacias: 'meta', cumaral: 'meta',
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
