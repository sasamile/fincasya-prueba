/**
 * Queries públicas de la landing (misma data que consumía el front de
 * FincasYaWeb vía Nest, pero directo desde Convex).
 */
import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Id } from './_generated/dataModel';

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

    // Features + iconografía (SVG/emoji). Los iconitos de la card salen de
    // `featuredIcons` (hasta 4, elegidos en admin vía CardIconPicker).
    const [allFeatures, allIcons] = await Promise.all([
      ctx.db.query('propertyFeatures').collect(),
      ctx.db.query('iconography').collect(),
    ]);
    const iconsById = new Map(
      allIcons.map((icon) => [
        String(icon._id),
        {
          name: icon.name ?? '',
          iconUrl: icon.iconUrl ?? null,
          emoji: icon.emoji ?? null,
        },
      ]),
    );

    const resolveIcon = (rawId: string | undefined) => {
      if (!rawId) return undefined;
      const direct = iconsById.get(rawId);
      if (direct) return direct;
      const normalized = ctx.db.normalizeId('iconography', rawId);
      return normalized ? iconsById.get(String(normalized)) : undefined;
    };

    const featuresByProperty = new Map<
      string,
      { name: string; iconId?: string; iconUrl: string | null; emoji: string | null }[]
    >();
    for (const f of allFeatures) {
      const key = String(f.propertyId);
      if (!featuresByProperty.has(key)) featuresByProperty.set(key, []);
      const icon = resolveIcon(f.iconId);
      featuresByProperty.get(key)!.push({
        name: f.name,
        iconId: f.iconId,
        iconUrl: icon?.iconUrl ?? null,
        emoji: icon?.emoji ?? null,
      });
    }

    return visible.map((p) => {
      const imgs = (imagesByProperty.get(String(p._id)) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((i) => i.url);
      const features = featuresByProperty.get(String(p._id)) ?? [];

      // Iconos de la card: los 4 featured del admin (con iconUrl del catálogo).
      const cardIcons = (p.featuredIcons ?? [])
        .slice(0, 4)
        .map((id) => {
          const icon = resolveIcon(String(id));
          if (!icon) return null;
          const featureName = features.find((f) => f.iconId === String(id))?.name;
          return {
            name: featureName || icon.name || 'Amenidad',
            iconUrl: icon.iconUrl,
            emoji: icon.emoji,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

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
        marketplaceForSale: p.marketplaceForSale ?? false,
        salePriceCop: p.salePriceCop ?? null,
        features,
        cardIcons,
      };
    });
  },
});

/** Finca individual para /fincas/[slug] (detalle público). */
export const getPropertyBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const property = await ctx.db
      .query('properties')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first();
    if (!property || property.visible === false) return null;

    const images = (
      await ctx.db
        .query('propertyImages')
        .withIndex('by_property', (q) => q.eq('propertyId', property._id))
        .collect()
    )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((i) => i.url);

    const features = await ctx.db
      .query('propertyFeatures')
      .withIndex('by_property', (q) => q.eq('propertyId', property._id))
      .collect();

    // Resuelve el icono (SVG en S3 / emoji) de cada feature vía la tabla
    // `iconography`. `iconId` se guarda como texto; solo buscamos los presentes.
    const iconIds = [...new Set(features.map((f) => f.iconId).filter(Boolean))];
    const iconsById = new Map<string, { iconUrl: string | null; emoji: string | null }>();
    await Promise.all(
      iconIds.map(async (id) => {
        const icon = await ctx.db.get(id as Id<'iconography'>);
        if (icon) iconsById.set(id!, { iconUrl: icon.iconUrl ?? null, emoji: icon.emoji ?? null });
      }),
    );

    return {
      id: String(property._id),
      title: property.title,
      description: property.description,
      location: property.location,
      capacity: property.capacity,
      rating: property.rating ?? null,
      reviewsCount: property.reviewsCount ?? 0,
      priceBase: property.priceBase,
      priceOriginal: property.priceOriginal ?? null,
      code: property.code ?? null,
      slug: property.slug ?? null,
      images,
      isFavorite: property.isFavorite ?? false,
      video: property.video ?? null,
      lat: property.lat,
      lng: property.lng,
      zoneOrder: property.zoneOrder ?? [],
      marketplaceForSale: property.marketplaceForSale ?? false,
      salePriceCop: property.salePriceCop ?? null,
      saleSquareMeters: property.saleSquareMeters ?? null,
      saleDescription: property.saleDescription ?? null,
      /** Propiedad Empresa: reserva web (fechas → Bold → contrato). */
      reservable: property.reservable !== false,
      visibleInWhatsAppCatalog: property.visibleInWhatsAppCatalog !== false,
      allowsPets: property.allowsPets !== false,
      allowsEventsContent: property.allowsEventsContent !== false,
      familyOnly: property.familyOnly === true,
      serviceStaffAvailable: property.serviceStaffAvailable === true,
      serviceStaffMandatory: property.serviceStaffMandatory === true,
      serviceStaffPrice: property.serviceStaffPrice ?? 0,
      depositoDanosReembolsable: property.depositoDanosReembolsable ?? 0,
      depositoAseo: property.depositoAseo ?? 0,
      manillaCondominio: property.manillaCondominio ?? 0,
      features: features.map((f) => {
        const icon = f.iconId ? iconsById.get(f.iconId) : undefined;
        return {
          name: f.name,
          zone: f.zone ?? null,
          quantity: f.quantity ?? null,
          iconUrl: icon?.iconUrl ?? null,
          emoji: icon?.emoji ?? null,
        };
      }),
    };
  },
});

/** Fincas publicadas en /marketplace (modo venta). */
export const listMarketplaceProperties = query({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query('properties').collect();
    const forSale = properties.filter(
      (p) => p.visible !== false && p.marketplaceForSale === true,
    );

    const allImages = await ctx.db.query('propertyImages').collect();
    const imagesByProperty = new Map<string, { url: string; order: number }[]>();
    for (const img of allImages) {
      const key = String(img.propertyId);
      if (!imagesByProperty.has(key)) imagesByProperty.set(key, []);
      imagesByProperty.get(key)!.push({ url: img.url, order: img.order ?? 0 });
    }

    return forSale.map((p) => {
      const imgs = (imagesByProperty.get(String(p._id)) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((i) => i.url);
      return {
        id: String(p._id),
        title: p.title,
        description: p.saleDescription ?? p.description,
        location: p.location,
        capacity: p.capacity,
        rating: p.rating ?? null,
        reviewsCount: p.reviewsCount ?? 0,
        priceBase: p.salePriceCop ?? p.priceBase,
        priceOriginal: p.priceOriginal ?? null,
        code: p.code ?? null,
        slug: p.slug ?? null,
        images: imgs,
        saleSquareMeters: p.saleSquareMeters ?? null,
        marketplaceForSale: true,
      };
    });
  },
});
