/**
 * Tipo de finca para la landing (forma de `api.landing.listProperties`).
 * Mantiene los nombres de `PropertyResponse` de FincasYaWeb para que las
 * libs portadas (búsqueda, filtros, tabs) funcionen sin cambios.
 */
export type PropertyResponse = {
  id: string;
  title: string;
  description: string;
  location: string;
  capacity: number;
  rating: number | null;
  reviewsCount: number;
  priceBase: number;
  priceOriginal: number | null;
  code: string | null;
  slug: string | null;
  images: string[];
  isFavorite: boolean;
  catalogFilterTags: string[] | null;
  allowsEventsContent: boolean;
  features: {
    name: string;
    iconUrl?: string | null;
    emoji?: string | null;
    iconId?: string;
  }[];
  /** Hasta 4 iconos de la card (featuredIcons del admin, con iconUrl del catálogo). */
  cardIcons?: {
    name: string;
    iconUrl?: string | null;
    emoji?: string | null;
  }[];
  // Opcionales usados por libs portadas (legacy matching / cards)
  eventCapacity?: number | null;
  seasonPrices?: { base?: number };
  isNew?: boolean;
  salePriceCop?: number | null;
  featuredIcons?: string[];
};
