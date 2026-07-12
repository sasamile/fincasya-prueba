/**
 * Normaliza lo que el usuario pega desde el PDF o escribe a mano.
 * Ej: "CONTRATO N° FY-2005" → "FY-2005"
 */
export function normalizeContractLookupQuery(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";

  // "Contrato: FY-2005"
  s = s.replace(/^contrato\s*:\s*/i, "").trim();

  // "CONTRATO N° …" / "Contrato Nº …" / grado Unicode
  s = s.replace(/^contrato\s+n[°º\u00b0oO0.]\s*/i, "").trim();
  s = s.replace(/^n[°º\u00b0oO0.]\s*/i, "").trim();

  // Si pegó una línea larga, intentar extraer código tipo FY-2005 o DIR-FINCA-…
  const codeLike = s.match(
    /\b([A-Za-z]{2,12}-\d{2,}(?:-\d+){0,4}|[A-Za-z]{2,12}-\d{4,}(?:-\w+){0,3})\b/,
  );
  if (codeLike && (s.length > 28 || /reunidos|arriendo|contrato/i.test(s))) {
    return codeLike[1].trim();
  }

  return s.trim() || raw.trim();
}
