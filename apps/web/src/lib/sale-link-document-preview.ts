export type SaleLinkDocumentPreviewType =
  | "signed-contract"
  | "cedula-photo"
  | "payment-proof";

/** Proxy en Nest (producción); la ruta /api/admin/sale-link-documents no existe en el backend. */
export function saleLinkDocumentPreviewSrc(
  token: string,
  type: SaleLinkDocumentPreviewType,
): string {
  return `/api/sale-links/${encodeURIComponent(token)}/document-file?type=${type}`;
}
