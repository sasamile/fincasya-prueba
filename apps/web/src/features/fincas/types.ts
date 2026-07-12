/** Forma de `api.landing.getPropertyBySlug` (detalle de finca). */
export type PropertyDetail = {
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
  video: string | null;
  lat: number;
  lng: number;
  zoneOrder: string[];
  features: { name: string; zone: string | null; quantity: number | null }[];
};
