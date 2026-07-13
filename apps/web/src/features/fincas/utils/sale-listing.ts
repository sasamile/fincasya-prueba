import type { PropertyResponse } from "@/features/fincas/types/fincas.types";

export function saleListingDescription(finca: PropertyResponse): string {
  const sale = finca.saleDescription?.trim();
  if (sale) return sale;
  return finca.description?.trim() ?? "";
}

export function formatSaleSquareMeters(
  value: number | undefined | null,
): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const n = Math.floor(value);
  return `${n.toLocaleString("es-CO")} m²`;
}
