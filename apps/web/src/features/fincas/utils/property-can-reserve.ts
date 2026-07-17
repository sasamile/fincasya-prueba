/**
 * ¿La ficha admite reserva en la web (Propiedad Empresa)?
 * `reservable === false` → solo WhatsApp. `undefined`/`true` → sí.
 */
export function canReserveOnWebsite(finca: {
  reservable?: boolean;
  visibleInWhatsAppCatalog?: boolean;
}): boolean {
  if (finca.visibleInWhatsAppCatalog === false) return false;
  return finca.reservable !== false;
}

/** Propiedad Empresa explícita (toggle ON en admin). */
export function isCompanyProperty(finca: {
  reservable?: boolean;
  visibleInWhatsAppCatalog?: boolean;
}): boolean {
  return canReserveOnWebsite(finca) && Boolean(finca.reservable);
}
