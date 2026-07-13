import type { PropertyResponse } from "@/features/fincas/types/fincas.types";
import { slugify } from "@/lib/utils";

export type PropertyListingMode = "rental" | "sale";

type ListingModeInput = Pick<
  PropertyResponse,
  "marketplaceForSale" | "reservable" | "slug" | "title"
>;

/** Finca solo marketplace (no arriendo en web). */
export function isSaleOnlyProperty(finca: ListingModeInput): boolean {
  return finca.marketplaceForSale === true && finca.reservable === false;
}

/** Finca en venta y también reservable (dos experiencias en la misma URL). */
export function isDualListingProperty(finca: ListingModeInput): boolean {
  return finca.marketplaceForSale === true && finca.reservable !== false;
}

export function resolvePropertyListingMode(
  finca: ListingModeInput,
  modoParam: string | null | undefined,
): PropertyListingMode {
  if (!finca.marketplaceForSale) return "rental";
  if (isSaleOnlyProperty(finca)) return "sale";
  return modoParam === "venta" ? "sale" : "rental";
}

export function fincaDetailPath(
  finca: ListingModeInput,
  mode: PropertyListingMode = "rental",
): string {
  const segment = finca.slug || slugify(finca.title);
  const base = `/fincas/${segment}`;
  return mode === "sale" ? `${base}?modo=venta` : base;
}
