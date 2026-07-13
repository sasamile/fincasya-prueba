import type { PropertyResponse } from "@/features/fincas/types/fincas.types";
import { formatSaleSquareMeters } from "@/features/fincas/utils/sale-listing";
import { absoluteFincaListingUrl } from "@/lib/utils";

export const MARKETPLACE_WHATSAPP_E164 = "573157773937";

export function buildSaleWhatsAppMessage(finca: PropertyResponse): string {
  const priceLabel =
    finca.salePriceCop != null &&
    Number.isFinite(finca.salePriceCop) &&
    finca.salePriceCop > 0
      ? `$${finca.salePriceCop.toLocaleString("es-CO")} COP`
      : "A consultar con asesor";

  const areaLabel = formatSaleSquareMeters(finca.saleSquareMeters);

  return `Hola FincasYa, me interesa la propiedad *en venta*:

*${finca.title}*
*Ubicación:* ${finca.location}
*Valor publicado:* ${priceLabel}${areaLabel ? `\n*Área:* ${areaLabel}` : ""}
*Código / referencia:* ${finca.code || finca.id}

Quisiera más información y siguiente paso.

${absoluteFincaListingUrl(finca, { modo: "venta" })}`;
}

export function openSaleWhatsApp(finca: PropertyResponse): void {
  const url = `https://wa.me/${MARKETPLACE_WHATSAPP_E164}?text=${encodeURIComponent(
    buildSaleWhatsAppMessage(finca),
  )}`;
  window.open(url, "_blank");
}
