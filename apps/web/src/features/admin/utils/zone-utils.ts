/**
 * Genera un nombre único para una zona duplicada.
 * "Habitación 1" -> "Habitación 1 (copia)", y si ya existe -> "(copia 2)", etc.
 * Evita anidar "(copia) (copia)" al quitar un sufijo de copia previo del nombre base.
 */
export function makeDuplicateZoneName(base: string, existing: string[]): string {
  const root = base.replace(/\s*\(copia(?:\s+\d+)?\)\s*$/i, "").trim();
  const taken = new Set(existing.map((z) => z.trim().toLowerCase()));
  let candidate = `${root} (copia)`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${root} (copia ${n})`;
    n++;
  }
  return candidate;
}
