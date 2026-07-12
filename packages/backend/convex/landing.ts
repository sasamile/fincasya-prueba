/**
 * Queries públicas de la landing (misma data que consumía el front de
 * FincasYaWeb vía Nest, pero directo desde Convex).
 */
import { query } from './_generated/server';

/** Fincas visibles para el catálogo público del home (cards + filtros). */
export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query('properties').collect();
    const visible = properties.filter((p) => p.visible !== false);

    // Imágenes por finca (ordenadas), una sola pasada.
    const allImages = await ctx.db.query('propertyImages').collect();
    const imagesByProperty = new Map<string, { url: string; order: number }[]>();
    for (const img of allImages) {
      const key = String(img.propertyId);
      if (!imagesByProperty.has(key)) imagesByProperty.set(key, []);
      imagesByProperty.get(key)!.push({ url: img.url, order: img.order ?? 0 });
    }

    // Features por finca (para los iconitos de la card).
    const allFeatures = await ctx.db.query('propertyFeatures').collect();
    const featuresByProperty = new Map<string, { name: string }[]>();
    for (const f of allFeatures) {
      const key = String(f.propertyId);
      if (!featuresByProperty.has(key)) featuresByProperty.set(key, []);
      featuresByProperty.get(key)!.push({ name: f.name });
    }

    return visible.map((p) => {
      const imgs = (imagesByProperty.get(String(p._id)) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((i) => i.url);
      return {
        id: String(p._id),
        title: p.title,
        description: p.description,
        location: p.location,
        capacity: p.capacity,
        rating: p.rating ?? null,
        reviewsCount: p.reviewsCount ?? 0,
        priceBase: p.priceBase,
        priceOriginal: p.priceOriginal ?? null,
        code: p.code ?? null,
        slug: p.slug ?? null,
        images: imgs,
        isFavorite: p.isFavorite ?? false,
        catalogFilterTags: p.catalogFilterTags ?? null,
        allowsEventsContent: p.allowsEventsContent ?? false,
        features: featuresByProperty.get(String(p._id)) ?? [],
      };
    });
  },
});
