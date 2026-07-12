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
  viota: 'cundinamarca', apulo: 'cundinamarca',
  melgar: 'tolima', flandes: 'tolima', 'carmen de apicala': 'tolima',
  'santa marta': 'magdalena', cartagena: 'bolivar', quimbaya: 'quindio',
};

export type ZoneResolution = { keywords: string[]; label: string };

export function resolveZoneKeywords(zonaRaw: string): ZoneResolution {
  const z = norm(zonaRaw);
  if (!z) return { keywords: [], label: '' };
  for (const alias of ZONE_ALIASES) {
    if (alias.match.test(z)) {
      return { keywords: [...new Set(alias.keywords.map(norm))], label: alias.label };
    }
  }
  // Municipio conocido → incluir también su departamento.
  const keywords = new Set<string>([z]);
  const dept = MUNICIPALITY_TO_DEPT[z];
  if (dept) keywords.add(dept);
  return { keywords: [...keywords], label: zonaRaw.trim() };
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
