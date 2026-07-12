/**
 * Normalización de ubicación de fincas (municipio/ciudad).
 * El campo `location` puede venir como "Acacías", "Acacias, Meta", etc.
 */

export const CANONICAL_PROPERTY_LOCATIONS = [
  "Acacías",
  "Anapoima",
  "Apulo",
  "Armenia",
  "Barranquilla",
  "Bogotá",
  "Carmen de Apicalá",
  "Cartagena",
  "Cumaral",
  "Girardot",
  "Granada",
  "Guataquí",
  "Manizales",
  "Melgar",
  "Nilo",
  "Nocaima",
  "Pereira",
  "Restrepo",
  "Ricaurte",
  "San Martín",
  "Santa Marta",
  "Tenjo",
  "Tocaima",
  "Villavicencio",
  "Villeta",
  "Viotá",
] as const;

/** Filtro agrupado del admin (no es un municipio único). */
export const ADMIN_PLAYA_REGION_VALUE = "__playa__";

const LOCATION_ALIASES: Record<string, string> = {
  acacias: "Acacías",
  acacia: "Acacías",
  anapoima: "Anapoima",
  apulo: "Apulo",
  armenia: "Armenia",
  barranquilla: "Barranquilla",
  bogota: "Bogotá",
  "carmen de apicala": "Carmen de Apicalá",
  cartagena: "Cartagena",
  cumaral: "Cumaral",
  girardot: "Girardot",
  granada: "Granada",
  guataqui: "Guataquí",
  manizales: "Manizales",
  melgar: "Melgar",
  nilo: "Nilo",
  nocaima: "Nocaima",
  pereira: "Pereira",
  restrepo: "Restrepo",
  ricaurte: "Ricaurte",
  "san martin": "San Martín",
  "santa marta": "Santa Marta",
  tenjo: "Tenjo",
  tocaima: "Tocaima",
  villavicencio: "Villavicencio",
  villeta: "Villeta",
  viota: "Viotá",
};

const PLAYA_LOCATION_KEYS = new Set([
  "santa marta",
  "cartagena",
  "barranquilla",
  "san andres",
  "taganga",
  "rodadero",
]);

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Primera parte antes de coma: "Acacías, Meta" → "Acacías". */
export function extractPropertyCity(location: string | undefined | null): string {
  return (location ?? "").split(",")[0]?.trim() ?? "";
}

export function normalizeLocationKey(location: string | undefined | null): string {
  return stripAccents(extractPropertyCity(location).toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Nombre canónico para mostrar y filtrar. */
export function canonicalLocationDisplay(
  location: string | undefined | null,
): string {
  const key = normalizeLocationKey(location);
  if (!key) return "";
  return LOCATION_ALIASES[key] ?? titleCaseWords(extractPropertyCity(location));
}

export function propertyMatchesAdminRegion(
  propertyLocation: string | undefined | null,
  regionValue: string,
): boolean {
  if (regionValue === "all") return true;

  if (regionValue === ADMIN_PLAYA_REGION_VALUE) {
    const key = normalizeLocationKey(propertyLocation);
    return PLAYA_LOCATION_KEYS.has(key);
  }

  return (
    normalizeLocationKey(propertyLocation) === normalizeLocationKey(regionValue)
  );
}

export interface AdminRegionOption {
  value: string;
  label: string;
}

export function buildAdminRegionOptions(
  properties: { location?: string | null }[],
): AdminRegionOption[] {
  const seen = new Set<string>();
  const options: AdminRegionOption[] = [
    { value: "all", label: "Todas las regiones" },
  ];

  for (const city of CANONICAL_PROPERTY_LOCATIONS) {
    const key = normalizeLocationKey(city);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: city, label: city });
  }

  for (const property of properties) {
    const display = canonicalLocationDisplay(property.location);
    const key = normalizeLocationKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push({ value: display, label: display });
  }

  options.push({
    value: ADMIN_PLAYA_REGION_VALUE,
    label: "Destinos de Playa",
  });

  const [allOption, ...rest] = options;
  rest.sort((a, b) => {
    if (a.value === ADMIN_PLAYA_REGION_VALUE) return 1;
    if (b.value === ADMIN_PLAYA_REGION_VALUE) return -1;
    return a.label.localeCompare(b.label, "es");
  });

  return [allOption, ...rest];
}
