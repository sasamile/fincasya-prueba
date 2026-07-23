/** Mínimo de caracteres para sugerencias de nombre en el buscador del home. */
export const SEARCH_SUGGESTION_MIN_CHARS = 3;

/** Texto en minúsculas sin tildes ni eñes, para comparar búsquedas. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Comparación `includes` insensible a mayúsculas y tildes. */
export function normalizedIncludes(haystack: string, query: string): boolean {
  const h = normalizeSearchText(haystack);
  const q = normalizeSearchText(query);
  if (!q) return true;
  return h.includes(q);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Coincidencia como palabra completa (evita que "art" matchee "apartamento"). */
export function containsWholeSearchToken(
  haystack: string,
  token: string,
): boolean {
  if (!token) return false;
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegex(token)}(?:$|[^a-z0-9])`,
    "i",
  );
  return pattern.test(` ${haystack} `);
}

export type PropertySearchFields = {
  title?: string | null;
  location?: string | null;
  code?: string | null;
};

export type PropertySearchField = "title" | "location" | "code";

function propertySearchHaystacks(
  property: PropertySearchFields,
  fields: PropertySearchField[],
): string[] {
  const out: string[] = [];
  if (fields.includes("title")) {
    out.push(normalizeSearchText(property.title ?? ""));
  }
  if (fields.includes("location")) {
    out.push(normalizeSearchText(property.location ?? ""));
  }
  if (fields.includes("code")) {
    out.push(normalizeSearchText(property.code ?? ""));
  }
  return out;
}

function haystackMatchesNormalizedQuery(haystack: string, q: string): boolean {
  if (!haystack || !q) return false;
  if (haystack.includes(q)) return true;
  if (q.length >= SEARCH_SUGGESTION_MIN_CHARS) {
    return haystack.split(/\s+/).some((word) => word.startsWith(q));
  }
  return false;
}

function tokenMatchesHaystack(haystack: string, token: string): boolean {
  if (!haystack || !token) return false;
  if (haystack.includes(token)) return true;
  if (containsWholeSearchToken(haystack, token)) return true;
  if (token.length >= SEARCH_SUGGESTION_MIN_CHARS) {
    return haystack.split(/\s+/).some((word) => word.startsWith(token));
  }
  return false;
}

/** ¿La finca coincide con el término de búsqueda? */
export function propertyMatchesSearchQuery(
  property: PropertySearchFields,
  query: string,
  fields: PropertySearchField[] = ["title", "location", "code"],
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const haystacks = propertySearchHaystacks(property, fields);

  // Frase completa (ej. "restrepo home" tal cual en el título)
  if (haystacks.some((h) => haystackMatchesNormalizedQuery(h, q))) return true;

  const tokens = q.split(/\s+/).filter((w) => w.length >= 2);
  if (tokens.length === 0) return false;

  // AND: todas las palabras deben aparecer (en título, ubicación o código).
  // Antes era OR y "restrepo home" devolvía cualquier finca con "home".
  return tokens.every((token) =>
    haystacks.some((h) => tokenMatchesHaystack(h, token)),
  );
}

/** Coincidencia por prefijo (autocompletado del buscador de nombres). */
export function propertyMatchesNamePrefix(
  property: PropertySearchFields,
  query: string,
  fields: PropertySearchField[] = ["title", "code"],
): boolean {
  const q = normalizeSearchText(query);
  if (q.length < SEARCH_SUGGESTION_MIN_CHARS) return false;
  return propertySearchHaystacks(property, fields).some((h) =>
    haystackMatchesNormalizedQuery(h, q),
  );
}

/** Extrae números de cupo de la consulta (ej. "15", "15 pax", "tocaima 15 personas"). */
export function parseCapacitySearchParts(query: string): {
  capacityTargets: number[];
  textTerms: string[];
} {
  const input = normalizeSearchText(query).replace(/[^a-z0-9\s]/g, " ");

  const capacityTargets: number[] = [];
  let remaining = ` ${input.replace(/\s+/g, " ").trim()} `;

  const labeledPatterns = [
    /\s(\d{1,3})\s*pax\s/gi,
    /\s(\d{1,3})\s*personas?\s/gi,
  ];
  for (const pattern of labeledPatterns) {
    remaining = remaining.replace(pattern, (_match, digits: string) => {
      const n = Number.parseInt(digits, 10);
      if (Number.isFinite(n) && n > 0) capacityTargets.push(n);
      return " ";
    });
  }

  const textTerms: string[] = [];
  for (const word of remaining.trim().split(/\s+/).filter(Boolean)) {
    if (/^\d{1,3}$/.test(word)) {
      const n = Number.parseInt(word, 10);
      if (Number.isFinite(n) && n > 0) capacityTargets.push(n);
      continue;
    }
    if (word.length >= 2) textTerms.push(word);
  }

  return {
    capacityTargets: [...new Set(capacityTargets)],
    textTerms,
  };
}

export function propertyMatchesCapacitySearch(
  property: { capacity?: number | null; eventCapacity?: number | null },
  target: number,
): boolean {
  if ((property.capacity ?? 0) === target) return true;
  if (property.eventCapacity != null && property.eventCapacity === target) {
    return true;
  }
  return false;
}

export function propertyMatchesSearchWithCapacity(
  property: PropertySearchFields & {
    capacity?: number | null;
    eventCapacity?: number | null;
  },
  query: string,
  fields: PropertySearchField[] = ["title", "location", "code"],
): boolean {
  const q = query.trim();
  if (!q) return true;

  const { capacityTargets, textTerms } = parseCapacitySearchParts(q);
  const matchesCapacity =
    capacityTargets.length === 0 ||
    capacityTargets.some(
      (target) =>
        propertyMatchesCapacitySearch(property, target) ||
        propertyMatchesSearchQuery(
          property,
          String(target),
          ["title", "location", "code"],
        ),
    );

  const matchesText =
    textTerms.length === 0 ||
    propertyMatchesSearchQuery(property, textTerms.join(" "), fields);

  return matchesCapacity && matchesText;
}

/** Mayor puntaje = más relevante para ordenar resultados. */
export function propertySearchRelevanceScore(
  property: PropertySearchFields,
  query: string,
  fields: PropertySearchField[] = ["title", "location", "code"],
): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const title = fields.includes("title")
    ? normalizeSearchText(property.title ?? "")
    : "";
  const location = fields.includes("location")
    ? normalizeSearchText(property.location ?? "")
    : "";
  const code = fields.includes("code")
    ? normalizeSearchText(property.code ?? "")
    : "";

  let score = 0;

  if (title === q) score += 1000;
  else if (title.startsWith(q)) score += 500;
  else if (title.includes(q)) {
    score += 200 + Math.max(0, 80 - title.indexOf(q));
  }

  if (q.length >= SEARCH_SUGGESTION_MIN_CHARS) {
    for (const word of title.split(/\s+/)) {
      if (word.startsWith(q)) score += 350;
    }
  }

  const tokens = q.split(/\s+/).filter((w) => w.length >= 2);
  const terms = tokens.length > 0 ? tokens : [q];

  for (const term of terms) {
    if (title.includes(term)) {
      score += 50;
      if (containsWholeSearchToken(title, term)) score += 120;
    }
    if (location.includes(term)) {
      score += 20;
      if (containsWholeSearchToken(location, term)) score += 40;
    }
    if (code.includes(term)) score += 30;
  }

  return score;
}
