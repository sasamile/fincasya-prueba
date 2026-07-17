/** Compacta código: CR-2961 / CR 2961 → CR2961 */
export function compactContractCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_/]+/g, '');
}

/** Siguiente código estilo CR12345678 a partir de los ya usados con ese prefijo. */
export function suggestNextForPrefix(
  existingCodes: string[],
  prefixRaw: string,
): string | null {
  const prefix = prefixRaw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!prefix) return null;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  let maxNum = 0;
  let found = false;
  for (const raw of existingCodes) {
    const compact = compactContractCode(raw);
    const m = compact.match(re);
    if (m) {
      found = true;
      maxNum = Math.max(maxNum, parseInt(m[1]!, 10) || 0);
    }
  }
  if (!found && maxNum === 0) return `${prefix}1`;
  return `${prefix}${maxNum + 1}`;
}

/** Prefijo exacto + dígitos: CR123 sí, CRA123 no cuando prefijo=CR. */
export function codeMatchesPrefix(code: string, prefix: string): boolean {
  if (!prefix) return true;
  const compact = compactContractCode(code);
  return new RegExp(`^${prefix}\\d+$`, 'i').test(compact);
}

export function highestCodeForPrefix(
  codes: string[],
  prefix: string,
): string | null {
  if (!prefix) return null;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  let maxNum = -1;
  let best: string | null = null;
  for (const raw of codes) {
    const compact = compactContractCode(raw);
    const m = compact.match(re);
    if (!m) continue;
    const n = parseInt(m[1]!, 10) || 0;
    if (n > maxNum) {
      maxNum = n;
      best = compact;
    }
  }
  return best;
}
