export type SaleLinkDocumentPreviewType =
  | "signed-contract"
  | "cedula-photo"
  | "payment-proof";

/** Proxy admin para previsualizar documentos del link (comprobante, contrato, cédula). */
export function saleLinkDocumentPreviewSrc(
  token: string,
  type: SaleLinkDocumentPreviewType,
): string {
  return `/api/sale-links/${encodeURIComponent(token)}/document-file?type=${type}`;
}

/** URL directa de S3 cuando ya la tienes (p. ej. abrir en pestaña nueva). */
export function saleLinkDocumentDirectUrl(
  url?: string | null,
): string | null {
  const trimmed = url?.trim();
  return trimmed || null;
}
