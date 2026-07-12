import {
  CANONICAL_PROPERTY_LOCATIONS,
  canonicalLocationDisplay,
  normalizeLocationKey,
} from "./property-locations";
import {
  normalizeSearchText,
  propertyMatchesNamePrefix,
  propertySearchRelevanceScore,
  SEARCH_SUGGESTION_MIN_CHARS,
  type PropertySearchFields,
} from "./property-search";

function uniqueSorted(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeLocationKey(trimmed) || trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.sort((a, b) => a.localeCompare(b, "es"));
}

export function buildPropertyTitleSuggestions(
  properties: PropertySearchFields[],
  query: string,
  limit = 8,
): string[] {
  const q = query.trim();
  if (q.length < SEARCH_SUGGESTION_MIN_CHARS) return [];

  const scored = new Map<string, number>();
  for (const property of properties) {
    const title = (property.title ?? "").trim();
    if (!title) continue;
    if (!propertyMatchesNamePrefix(property, q, ["title", "code"])) continue;
    const score = propertySearchRelevanceScore(property, q, ["title", "code"]);
    const prev = scored.get(title) ?? 0;
    if (score > prev) scored.set(title, score);
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit)
    .map(([title]) => title);
}

export function buildDestinationSuggestions(
  properties: PropertySearchFields[],
  query: string,
  limit = 8,
): string[] {
  const q = query.trim();
  if (!q) return [];

  const normalizedQuery = normalizeSearchText(q);
  const pool = uniqueSorted([
    ...CANONICAL_PROPERTY_LOCATIONS,
    ...properties.map((p) => canonicalLocationDisplay(p.location)),
  ]);

  const matches = pool.filter((city) => {
    const normalizedCity = normalizeSearchText(city);
    if (normalizedCity.includes(normalizedQuery)) return true;
    const tokens = normalizedQuery.split(/\s+/).filter((w) => w.length >= 2);
    return tokens.some((token) => normalizedCity.includes(token));
  });

  return matches
    .sort((a, b) => {
      const aNorm = normalizeSearchText(a);
      const bNorm = normalizeSearchText(b);
      const aStarts = aNorm.startsWith(normalizedQuery) ? 1 : 0;
      const bStarts = bNorm.startsWith(normalizedQuery) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return a.localeCompare(b, "es");
    })
    .slice(0, limit);
}
