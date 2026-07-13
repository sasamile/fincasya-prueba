import type { PropertyResponse } from "@/features/landing/types";

/** IDs de pestañas del home (RegionFilter), excepto "todas" y "favoritas". */
export const CATALOG_GEO_TAB_IDS = [
  "cerca-bogota",
  "melgar",
  "villavicencio",
  "anapoima",
  "villeta",
  "playa",
  "eje-cafetero",
] as const;

export const CATALOG_COMMERCIAL_TAB_IDS = ["luxury", "eventos"] as const;

export type CatalogGeoTabId = (typeof CATALOG_GEO_TAB_IDS)[number];
export type CatalogCommercialTabId = (typeof CATALOG_COMMERCIAL_TAB_IDS)[number];

export const REGION_KEYWORD_MAP: Record<CatalogGeoTabId, string[]> = {
  "cerca-bogota": [
    "viotá",
    "cundinamarca",
    "tocaima",
    "tenjo",
    "girardot",
    "nocaima",
  ],
  melgar: ["melgar"],
  villavicencio: ["villavicencio"],
  anapoima: ["anapoima"],
  villeta: ["villeta"],
  playa: ["santa marta", "cartagena"],
  "eje-cafetero": [
    "pereira",
    "manizales",
    "armenia",
    "quindío",
    "risaralda",
    "caldas",
    "filandia",
    "salento",
    "quimbaya",
    "montenegro",
    "la tebaida",
    "pueblo tapao",
    "guadual",
  ],
};

export function legacyLuxuryMatch(f: PropertyResponse): boolean {
  return (
    (f.title || "").toLowerCase().includes("luxury") ||
    (f.description || "").toLowerCase().includes("lujo") ||
    (f.seasonPrices?.base || 0) >= 3_000_000
  );
}

export function legacyEventosMatch(f: PropertyResponse): boolean {
  const searchText =
    `${f.title || ""} ${f.description || ""} ${f.location || ""}`.toLowerCase();
  return (
    searchText.includes("evento") ||
    searchText.includes("boda") ||
    searchText.includes("matrimonio") ||
    searchText.includes("fiesta") ||
    searchText.includes("reunión")
  );
}

export function legacyGeoMatch(f: PropertyResponse, tabId: CatalogGeoTabId): boolean {
  const targets = REGION_KEYWORD_MAP[tabId] || [];
  const location = (f.location || "").toLowerCase();
  return targets.some((t) => location.includes(t));
}

/** `catalogFilterTags` ausente → modo legacy (comportamiento anterior). */
export function catalogTagsMode(f: PropertyResponse): "legacy" | "explicit" {
  return f.catalogFilterTags != null ? "explicit" : "legacy";
}

export function propertyMatchesLuxuryTab(f: PropertyResponse): boolean {
  if (catalogTagsMode(f) === "explicit") {
    return f.catalogFilterTags!.includes("luxury");
  }
  return legacyLuxuryMatch(f);
}

export function propertyMatchesEventosTab(f: PropertyResponse): boolean {
  if (f.allowsEventsContent) return true;
  if (catalogTagsMode(f) === "explicit") {
    return f.catalogFilterTags!.includes("eventos");
  }
  return legacyEventosMatch(f);
}

export function propertyMatchesGeoTab(
  f: PropertyResponse,
  tabId: CatalogGeoTabId,
): boolean {
  const tags = f.catalogFilterTags;
  if (tags != null) {
    const geoPicked = CATALOG_GEO_TAB_IDS.some((id) => tags.includes(id));
    if (geoPicked) return tags.includes(tabId);
  }
  return legacyGeoMatch(f, tabId);
}

/** Etiquetas mostradas en admin / home para IDs conocidos. */
export const CATALOG_TAG_LABELS: Record<string, string> = {
  luxury: "Luxury",
  eventos: "Eventos",
  "cerca-bogota": "Cerca a Bogotá",
  melgar: "Melgar",
  villavicencio: "Villavicencio",
  anapoima: "Anapoima",
  villeta: "Villeta",
  playa: "Destinos de Playa",
  "eje-cafetero": "Eje Cafetero",
};

export function humanizeCatalogTagId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatCatalogTabLabel(tabId: string): string {
  if (tabId === "todas") return "Todas";
  if (tabId === "favoritas") return "Favoritas";
  return CATALOG_TAG_LABELS[tabId] ?? humanizeCatalogTagId(tabId);
}

/** Orden de pestañas del listado público (incluye especiales). */
export const HOME_CATALOG_TAB_ORDER: readonly string[] = [
  "todas",
  "favoritas",
  "luxury",
  ...CATALOG_GEO_TAB_IDS,
  "eventos",
] as const;

export const HOME_TAB_ROWS: { id: string; label: string }[] =
  HOME_CATALOG_TAB_ORDER.map((id) => ({
    id,
    label: formatCatalogTabLabel(id),
  }));

/**
 * Inserta pestañas dinámicas justo antes de "Eventos" para que se vean sin ir al final del scroll.
 */
export function mergeHomeTabRowsWithDynamic(
  dynamic: { id: string; label: string }[],
): { id: string; label: string }[] {
  const base = HOME_TAB_ROWS.map((r) => ({ ...r }));
  const seen = new Set(base.map((r) => r.id));
  const extra = dynamic.filter((d) => !seen.has(d.id));
  const eventosIdx = base.findIndex((r) => r.id === "eventos");
  if (eventosIdx === -1) return [...base, ...extra];
  return [...base.slice(0, eventosIdx), ...extra, ...base.slice(eventosIdx)];
}

export function isBuiltInCatalogTagId(id: string): boolean {
  return (
    id === "luxury" ||
    id === "eventos" ||
    (CATALOG_GEO_TAB_IDS as readonly string[]).includes(id)
  );
}

/**
 * ¿La finca corresponde a la pestaña `tabId`?
 * Incluye luxury, eventos, geo (legacy o explícito) y etiquetas custom guardadas en `catalogFilterTags`.
 */
export function propertyMatchesCatalogTab(
  f: PropertyResponse,
  tabId: string,
): boolean {
  if (tabId === "luxury") return propertyMatchesLuxuryTab(f);
  if (tabId === "eventos") return propertyMatchesEventosTab(f);
  if ((CATALOG_GEO_TAB_IDS as readonly string[]).includes(tabId)) {
    return propertyMatchesGeoTab(f, tabId as CatalogGeoTabId);
  }
  return f.catalogFilterTags?.includes(tabId) ?? false;
}
