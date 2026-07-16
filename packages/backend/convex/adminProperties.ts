/**
 * CRUD de propiedades para el panel admin (/admin/properties).
 * Port del API REST de fincasya-new (Nest `/api/fincas/*`) a Convex: el front
 * (apps/web `features/fincas/queries/fincas.queries.ts`) expone hooks con la
 * misma firma que FincasYaWeb y delega aquí.
 *
 * Archivos (imágenes, video, PDFs del propietario) van a Convex storage:
 * el cliente sube con `generateUploadUrl` y pasa el `storageId`; aquí se
 * resuelve a URL pública y se guarda como string (compatible con las URLs
 * S3 ya migradas).
 */
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id, Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { autoLinkPropertyToCatalog } from './propertyWhatsAppCatalog';

// ─── Coerción de literales (category/type son unions estrictos en el schema) ───

const CATEGORY_VALUES = [
  'ECONOMICA',
  'ESTANDAR',
  'PREMIUM',
  'LUJO',
  'ECOTURISMO',
  'CON_PISCINA',
  'CERCA_BOGOTA',
  'GRUPOS_GRANDES',
  'VIP',
] as const;
type PropertyCategory = (typeof CATEGORY_VALUES)[number];

const TYPE_VALUES = [
  'FINCA',
  'CASA_CAMPESTRE',
  'VILLA',
  'HACIENDA',
  'QUINTA',
  'APARTAMENTO',
  'CASA',
  'CASA_PRIVADA',
  'CASA_EN_CONJUNTO_CERRADO',
  'VILLA_PRIVADA',
  'CONDOMINIO',
  'CASA_BOUTIQUE',
  'YATE',
  'ISLA',
  'GLAMPING',
] as const;
type PropertyType = (typeof TYPE_VALUES)[number];

function coerceCategory(raw: string | undefined): PropertyCategory | undefined {
  if (raw == null) return undefined;
  const u = String(raw).trim().toUpperCase().replace(/\s+/g, '_');
  return (CATEGORY_VALUES as readonly string[]).includes(u)
    ? (u as PropertyCategory)
    : undefined;
}

function coerceType(raw: string | undefined): PropertyType | undefined {
  if (raw == null) return undefined;
  const u = String(raw).trim().toUpperCase().replace(/\s+/g, '_');
  return (TYPE_VALUES as readonly string[]).includes(u)
    ? (u as PropertyType)
    : undefined;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// ─── Validadores compartidos ───

/** Feature tal como la envía el front (PropertyFeature de fincas.types). */
const featureInput = v.object({
  name: v.string(),
  iconId: v.optional(v.union(v.string(), v.null())),
  // El front puede mandar iconUrl/emoji resueltos; se ignoran al persistir.
  iconUrl: v.optional(v.union(v.string(), v.null())),
  emoji: v.optional(v.union(v.string(), v.null())),
  quantity: v.optional(v.union(v.number(), v.null())),
  zone: v.optional(v.union(v.string(), v.null())),
  zoneTemplateSourceId: v.optional(v.union(v.string(), v.null())),
});

/** PricingRule del front (reglas de temporada por finca). */
const pricingRuleInput = v.object({
  id: v.optional(v.string()),
  globalRuleId: v.optional(v.union(v.string(), v.null())),
  nombre: v.string(),
  fechaDesde: v.optional(v.union(v.string(), v.null())),
  fechaHasta: v.optional(v.union(v.string(), v.null())),
  fechas: v.optional(v.union(v.array(v.string()), v.null())),
  valorUnico: v.optional(v.union(v.number(), v.null())),
  activa: v.optional(v.boolean()),
  reglas: v.optional(v.any()),
  subReglasCapacidad: v.optional(
    v.union(
      v.array(
        v.object({
          capacidadMin: v.number(),
          capacidadMax: v.number(),
          valorUnico: v.optional(v.number()),
        }),
      ),
      v.null(),
    ),
  ),
});

/** Campos editables de la finca (UpdatePropertyPayload del front, sin archivos). */
const propertyPatchFields = {
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  departamentos: v.optional(v.array(v.string())),
  capacity: v.optional(v.number()),
  eventCapacity: v.optional(v.number()),
  eventPackagePrice: v.optional(v.number()),
  code: v.optional(v.string()),
  slug: v.optional(v.string()),
  type: v.optional(v.string()),
  category: v.optional(v.string()),
  priceBase: v.optional(v.number()),
  priceBaja: v.optional(v.number()),
  priceMedia: v.optional(v.number()),
  priceAlta: v.optional(v.number()),
  priceOriginal: v.optional(v.number()),
  rating: v.optional(v.number()),
  isFavorite: v.optional(v.boolean()),
  pricing: v.optional(v.array(pricingRuleInput)),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  features: v.optional(v.array(featureInput)),
  video: v.optional(v.string()),
  visible: v.optional(v.boolean()),
  active: v.optional(v.boolean()),
  reservable: v.optional(v.boolean()),
  visibleInWhatsAppCatalog: v.optional(v.boolean()),
  marketplaceForSale: v.optional(v.boolean()),
  salePriceCop: v.optional(v.number()),
  saleSquareMeters: v.optional(v.number()),
  saleDescription: v.optional(v.string()),
  featuredIcons: v.optional(v.array(v.string())),
  contractTemplateUrl: v.optional(v.string()),
  zoneOrder: v.optional(v.array(v.string())),
  allowsPets: v.optional(v.boolean()),
  requiresGuestList: v.optional(v.boolean()),
  allowsEventsContent: v.optional(v.boolean()),
  familyOnly: v.optional(v.boolean()),
  serviceStaffAvailable: v.optional(v.boolean()),
  serviceStaffMandatory: v.optional(v.boolean()),
  serviceStaffPrice: v.optional(v.number()),
  depositoDanosReembolsable: v.optional(v.number()),
  depositoAseo: v.optional(v.number()),
  manillaCondominio: v.optional(v.number()),
  catalogFilterTags: v.optional(v.array(v.string())),
  propietarioNombre: v.optional(v.string()),
  propietarioTratamiento: v.optional(v.string()),
  propietarioTelefono: v.optional(v.string()),
  propietarioCedula: v.optional(v.string()),
  propietarioCorreo: v.optional(v.string()),
};

// ─── Helpers de escritura ───

/** Convierte el patch del front en campos persistibles del documento. */
function buildDocPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const passthrough = [
    'title',
    'description',
    'location',
    'departamentos',
    'capacity',
    'eventCapacity',
    'eventPackagePrice',
    'code',
    'slug',
    'priceBase',
    'priceBaja',
    'priceMedia',
    'priceAlta',
    'priceOriginal',
    'rating',
    'isFavorite',
    'lat',
    'lng',
    'video',
    'visible',
    'active',
    'reservable',
    'visibleInWhatsAppCatalog',
    'marketplaceForSale',
    'salePriceCop',
    'saleSquareMeters',
    'saleDescription',
    'contractTemplateUrl',
    'zoneOrder',
    'allowsPets',
    'requiresGuestList',
    'allowsEventsContent',
    'familyOnly',
    'serviceStaffAvailable',
    'serviceStaffMandatory',
    'serviceStaffPrice',
    'depositoDanosReembolsable',
    'depositoAseo',
    'manillaCondominio',
    'catalogFilterTags',
    'propietarioNombre',
    'propietarioTratamiento',
    'propietarioTelefono',
    'propietarioCedula',
    'propietarioCorreo',
  ] as const;
  for (const key of passthrough) {
    if (patch[key] !== undefined) out[key] = patch[key];
  }
  const category = coerceCategory(patch.category as string | undefined);
  if (category) out.category = category;
  const type = coerceType(patch.type as string | undefined);
  if (type) out.type = type;
  return out;
}

/** featuredIcons llegan como strings; solo persistimos ids válidos de iconography. */
function normalizeFeaturedIcons(
  ctx: MutationCtx,
  raw: unknown,
): Id<'iconography'>[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids: Id<'iconography'>[] = [];
  for (const s of raw) {
    if (typeof s !== 'string') continue;
    const id = ctx.db.normalizeId('iconography', s);
    if (id) ids.push(id);
  }
  return ids;
}

/** Reemplaza el set completo de features de la finca (semántica del PUT del Nest). */
async function replaceFeatures(
  ctx: MutationCtx,
  propertyId: Id<'properties'>,
  features: Array<Record<string, unknown>>,
) {
  const existing = await ctx.db
    .query('propertyFeatures')
    .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
    .collect();
  for (const f of existing) await ctx.db.delete(f._id);
  for (const f of features) {
    const name = typeof f.name === 'string' ? f.name.trim() : '';
    if (!name) continue;
    const quantityRaw = Number(f.quantity);
    await ctx.db.insert('propertyFeatures', {
      propertyId,
      name,
      iconId: typeof f.iconId === 'string' && f.iconId ? f.iconId : undefined,
      quantity:
        Number.isFinite(quantityRaw) && quantityRaw >= 1
          ? Math.floor(quantityRaw)
          : undefined,
      zone: typeof f.zone === 'string' && f.zone ? f.zone : undefined,
      zoneTemplateSourceId:
        typeof f.zoneTemplateSourceId === 'string' && f.zoneTemplateSourceId
          ? f.zoneTemplateSourceId
          : undefined,
    });
  }
}

/** Reemplaza las reglas de precio por temporada de la finca. */
async function replacePricing(
  ctx: MutationCtx,
  propertyId: Id<'properties'>,
  rules: Array<Record<string, unknown>>,
) {
  const existing = await ctx.db
    .query('propertyPricing')
    .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
    .collect();
  for (const r of existing) await ctx.db.delete(r._id);
  const now = Date.now();
  let order = 0;
  for (const r of rules) {
    const nombre = typeof r.nombre === 'string' ? r.nombre.trim() : '';
    if (!nombre) continue;
    const globalRuleId =
      typeof r.globalRuleId === 'string' && r.globalRuleId
        ? (ctx.db.normalizeId('globalPricing', r.globalRuleId) ?? undefined)
        : undefined;
    const subReglas = Array.isArray(r.subReglasCapacidad)
      ? (r.subReglasCapacidad as Array<Record<string, unknown>>)
          .filter(
            (s) =>
              Number.isFinite(Number(s.capacidadMin)) &&
              Number.isFinite(Number(s.capacidadMax)),
          )
          .map((s) => ({
            capacidadMin: Number(s.capacidadMin),
            capacidadMax: Number(s.capacidadMax),
            valorUnico: Number.isFinite(Number(s.valorUnico))
              ? Number(s.valorUnico)
              : 0,
          }))
      : undefined;
    await ctx.db.insert('propertyPricing', {
      propertyId,
      globalRuleId,
      nombre,
      fechaDesde: typeof r.fechaDesde === 'string' ? r.fechaDesde : undefined,
      fechaHasta: typeof r.fechaHasta === 'string' ? r.fechaHasta : undefined,
      fechas: Array.isArray(r.fechas)
        ? (r.fechas as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
      valorUnico: Number.isFinite(Number(r.valorUnico))
        ? Number(r.valorUnico)
        : undefined,
      activa: r.activa !== false,
      reglas:
        r.reglas == null
          ? undefined
          : typeof r.reglas === 'string'
            ? r.reglas
            : JSON.stringify(r.reglas),
      order: order++,
      subReglasCapacidad: subReglas,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ─── Helpers de lectura (joins) ───

async function joinProperty(ctx: QueryCtx, property: Doc<'properties'>) {
  const [imagesRaw, featuresRaw, pricingRaw] = await Promise.all([
    ctx.db
      .query('propertyImages')
      .withIndex('by_property', (q) => q.eq('propertyId', property._id))
      .collect(),
    ctx.db
      .query('propertyFeatures')
      .withIndex('by_property', (q) => q.eq('propertyId', property._id))
      .collect(),
    ctx.db
      .query('propertyPricing')
      .withIndex('by_property', (q) => q.eq('propertyId', property._id))
      .collect(),
  ]);

  const sortedImages = imagesRaw.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Resuelve iconUrl/emoji de cada feature desde iconography.
  const iconIds = [...new Set(featuresRaw.map((f) => f.iconId).filter(Boolean))];
  const iconsById = new Map<string, { iconUrl: string | null; emoji: string | null }>();
  await Promise.all(
    iconIds.map(async (raw) => {
      const id = ctx.db.normalizeId('iconography', raw!);
      if (!id) return;
      const icon = await ctx.db.get(id);
      if (icon)
        iconsById.set(raw!, {
          iconUrl: icon.iconUrl ?? null,
          emoji: icon.emoji ?? null,
        });
    }),
  );

  return {
    ...property,
    images: sortedImages.map((i) => i.url),
    imageItems: sortedImages.map((i) => ({ id: String(i._id), url: i.url })),
    features: featuresRaw.map((f) => ({
      name: f.name,
      iconId: f.iconId ?? undefined,
      iconUrl: f.iconId ? (iconsById.get(f.iconId)?.iconUrl ?? null) : null,
      emoji: f.iconId ? (iconsById.get(f.iconId)?.emoji ?? null) : null,
      quantity: f.quantity ?? undefined,
      zone: f.zone ?? undefined,
      zoneTemplateSourceId: f.zoneTemplateSourceId ?? undefined,
    })),
    pricing: pricingRaw
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((r) => ({
        id: String(r._id),
        globalRuleId: r.globalRuleId ? String(r.globalRuleId) : undefined,
        nombre: r.nombre,
        fechaDesde: r.fechaDesde,
        fechaHasta: r.fechaHasta,
        fechas: r.fechas,
        valorUnico: r.valorUnico ?? 0,
        activa: r.activa !== false,
        reglas: r.reglas,
        subReglasCapacidad: r.subReglasCapacidad,
      })),
  };
}

// ─── Queries ───

/** Todas las fincas (incluidas ocultas/inactivas) para la tabla del admin. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query('properties').collect();

    const [allImages, allFeatures] = await Promise.all([
      ctx.db.query('propertyImages').collect(),
      ctx.db.query('propertyFeatures').collect(),
    ]);

    const imagesByProperty = new Map<string, { url: string; order: number }[]>();
    for (const img of allImages) {
      const key = String(img.propertyId);
      if (!imagesByProperty.has(key)) imagesByProperty.set(key, []);
      imagesByProperty.get(key)!.push({ url: img.url, order: img.order ?? 0 });
    }
    const featuresByProperty = new Map<
      string,
      { name: string; iconId?: string; quantity?: number; zone?: string }[]
    >();
    for (const f of allFeatures) {
      const key = String(f.propertyId);
      if (!featuresByProperty.has(key)) featuresByProperty.set(key, []);
      featuresByProperty.get(key)!.push({
        name: f.name,
        iconId: f.iconId ?? undefined,
        quantity: f.quantity ?? undefined,
        zone: f.zone ?? undefined,
      });
    }

    return properties.map((p) => ({
      ...p,
      images: (imagesByProperty.get(String(p._id)) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((i) => i.url),
      features: featuresByProperty.get(String(p._id)) ?? [],
    }));
  },
});

/** Finca individual con imágenes, features (icono resuelto) y pricing. */
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const propertyId = ctx.db.normalizeId('properties', id);
    if (!propertyId) return null;
    const property = await ctx.db.get(propertyId);
    if (!property) return null;
    return await joinProperty(ctx, property);
  },
});

/** Catálogo global de iconografía (para pickers de features). */
export const listIconography = query({
  args: {},
  handler: async (ctx) => {
    const icons = await ctx.db.query('iconography').collect();
    return icons
      .map((i) => ({
        _id: String(i._id),
        name: i.name ?? '',
        emoji: i.emoji ?? undefined,
        iconUrl: i.iconUrl ?? undefined,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },
});

/** Reglas globales de temporada (para el tab de precios). */
export const listGlobalPricingRules = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query('globalPricing').collect();
    return rules.map((r) => ({
      _id: String(r._id),
      nombre: r.nombre,
      fechaDesde: r.fechaDesde,
      fechaHasta: r.fechaHasta,
      fechas: r.fechas,
      activa: r.activa !== false,
      createdAt: r.createdAt ?? r._creationTime,
      updatedAt: r.updatedAt ?? r._creationTime,
    }));
  },
});

/** Plantillas de zona por categoría, con sus features (bloque de importación). */
export const listAllZoneTemplates = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query('propertyCategoryZoneTemplates').collect();
    const allFeatures = await ctx.db.query('propertyCategoryZoneFeatures').collect();
    const byTemplate = new Map<string, typeof allFeatures>();
    for (const f of allFeatures) {
      const key = String(f.zoneTemplateId);
      if (!byTemplate.has(key)) byTemplate.set(key, []);
      byTemplate.get(key)!.push(f);
    }
    return templates
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => ({
        _id: String(t._id),
        propertyCategory: t.propertyCategory,
        name: t.name,
        order: t.order,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        features: (byTemplate.get(String(t._id)) ?? [])
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((f) => ({
            _id: String(f._id),
            zoneTemplateId: String(f.zoneTemplateId),
            iconographyId: String(f.iconographyId),
            alias: f.alias,
            quantity: f.quantity,
            order: f.order,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })),
      }));
  },
});

/** Datos del propietario de la finca (o null si no existen aún). */
export const getOwnerInfo = query({
  args: { propertyId: v.string() },
  handler: async (ctx, { propertyId }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) return null;
    const info = await ctx.db
      .query('propertyOwnerInfo')
      .withIndex('by_property', (q) => q.eq('propertyId', id))
      .first();
    if (!info) return null;
    return { ...info, propertyId: String(info.propertyId) };
  },
});

/** Reservas de la finca (historial del tab Reservas). */
export const listBookingsByProperty = query({
  args: { propertyId: v.string() },
  handler: async (ctx, { propertyId }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) return { bookings: [] };
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_property', (q) => q.eq('propertyId', id))
      .collect();
    return {
      bookings: bookings.sort((a, b) => b.fechaEntrada - a.fechaEntrada),
    };
  },
});

// ─── Mutations ───

/** Crea una finca. Devuelve el documento con joins (shape del GET). */
export const create = mutation({
  args: { patch: v.object(propertyPatchFields) },
  handler: async (ctx, { patch }) => {
    const now = Date.now();
    const docPatch = buildDocPatch(patch as Record<string, unknown>);

    const title = typeof docPatch.title === 'string' ? docPatch.title.trim() : '';
    if (!title) throw new Error('El título es obligatorio');

    const code = typeof docPatch.code === 'string' ? docPatch.code : undefined;
    const slug =
      typeof docPatch.slug === 'string' && docPatch.slug
        ? docPatch.slug
        : slugify([title, code].filter(Boolean).join(' '));

    const featuredIcons = normalizeFeaturedIcons(ctx, patch.featuredIcons);

    const propertyId = await ctx.db.insert('properties', {
      ...docPatch,
      title,
      description:
        typeof docPatch.description === 'string' ? docPatch.description : '',
      location: typeof docPatch.location === 'string' ? docPatch.location : '',
      capacity: Number(docPatch.capacity) || 0,
      lat: Number(docPatch.lat) || 0,
      lng: Number(docPatch.lng) || 0,
      priceBase: Number(docPatch.priceBase) || 0,
      priceBaja: Number(docPatch.priceBaja) || 0,
      priceMedia: Number(docPatch.priceMedia) || 0,
      priceAlta: Number(docPatch.priceAlta) || 0,
      category:
        coerceCategory(patch.category as string | undefined) ?? 'ESTANDAR',
      type: coerceType(patch.type as string | undefined) ?? 'FINCA',
      slug,
      featuredIcons,
      createdAt: now,
      updatedAt: now,
    } as never);

    if (Array.isArray(patch.features)) {
      await replaceFeatures(
        ctx,
        propertyId,
        patch.features as Array<Record<string, unknown>>,
      );
    }
    if (Array.isArray(patch.pricing)) {
      await replacePricing(
        ctx,
        propertyId,
        patch.pricing as Array<Record<string, unknown>>,
      );
    }

    const property = await ctx.db.get(propertyId);
    // Sin este enlace la finca sale "sin ficha Meta" en el modal de catálogo
    // hasta que alguien corra la reconciliación a mano.
    await autoLinkPropertyToCatalog(ctx, property!);
    return await joinProperty(ctx, property!);
  },
});

/** Actualiza una finca (solo los campos presentes en el patch). */
export const update = mutation({
  args: { id: v.string(), patch: v.object(propertyPatchFields) },
  handler: async (ctx, { id, patch }) => {
    const propertyId = ctx.db.normalizeId('properties', id);
    if (!propertyId) throw new Error('Finca no encontrada');
    const existing = await ctx.db.get(propertyId);
    if (!existing) throw new Error('Finca no encontrada');

    const docPatch = buildDocPatch(patch as Record<string, unknown>);
    const featuredIcons = normalizeFeaturedIcons(ctx, patch.featuredIcons);
    if (featuredIcons !== undefined) docPatch.featuredIcons = featuredIcons;
    docPatch.updatedAt = Date.now();

    await ctx.db.patch(propertyId, docPatch as never);

    if (Array.isArray(patch.features)) {
      await replaceFeatures(
        ctx,
        propertyId,
        patch.features as Array<Record<string, unknown>>,
      );
    }
    if (Array.isArray(patch.pricing)) {
      await replacePricing(
        ctx,
        propertyId,
        patch.pricing as Array<Record<string, unknown>>,
      );
    }

    const property = await ctx.db.get(propertyId);
    // Cura fincas viejas sin enlace de catálogo al editarlas desde el panel.
    await autoLinkPropertyToCatalog(ctx, property!);
    return await joinProperty(ctx, property!);
  },
});

/** Elimina la finca y sus documentos asociados. */
export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const propertyId = ctx.db.normalizeId('properties', id);
    if (!propertyId) throw new Error('Finca no encontrada');

    const [images, features, pricing, ownerInfos, catalogLinks] =
      await Promise.all([
      ctx.db
        .query('propertyImages')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .collect(),
      ctx.db
        .query('propertyFeatures')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .collect(),
      ctx.db
        .query('propertyPricing')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .collect(),
      ctx.db
        .query('propertyOwnerInfo')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .collect(),
      ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .collect(),
    ]);
    for (const d of [
      ...images,
      ...features,
      ...pricing,
      ...ownerInfos,
      ...catalogLinks,
    ]) {
      await ctx.db.delete(d._id);
    }
    await ctx.db.delete(propertyId);
    return null;
  },
});

/** Añade una imagen (ya subida a S3 vía /api/admin/upload) a la galería. */
export const addImage = mutation({
  args: { propertyId: v.string(), url: v.string() },
  handler: async (ctx, { propertyId, url }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) throw new Error('Finca no encontrada');

    const existing = await ctx.db
      .query('propertyImages')
      .withIndex('by_property', (q) => q.eq('propertyId', id))
      .collect();
    const maxOrder = existing.reduce((m, i) => Math.max(m, i.order ?? 0), -1);
    const imageId = await ctx.db.insert('propertyImages', {
      propertyId: id,
      url,
      order: maxOrder + 1,
    });
    return { id: String(imageId), url };
  },
});

/** Elimina una imagen de la galería. */
export const deleteImage = mutation({
  args: { imageId: v.string() },
  handler: async (ctx, { imageId }) => {
    const id = ctx.db.normalizeId('propertyImages', imageId);
    if (!id) throw new Error('Imagen no encontrada');
    await ctx.db.delete(id);
    return null;
  },
});

/** Reordena la galería según los pares {id, order}. */
export const reorderImages = mutation({
  args: {
    propertyId: v.string(),
    imageOrders: v.array(v.object({ id: v.string(), order: v.number() })),
  },
  handler: async (ctx, { imageOrders }) => {
    for (const { id, order } of imageOrders) {
      const imageId = ctx.db.normalizeId('propertyImages', id);
      if (!imageId) continue;
      await ctx.db.patch(imageId, { order });
    }
    return null;
  },
});

/** Asocia el video (ya subido a S3 vía /api/admin/upload) a la finca. */
export const setVideo = mutation({
  args: { propertyId: v.string(), url: v.string() },
  handler: async (ctx, { propertyId, url }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) throw new Error('Finca no encontrada');
    await ctx.db.patch(id, { video: url, updatedAt: Date.now() });
    return { url };
  },
});

/** Quita el video de la finca. */
export const clearVideo = mutation({
  args: { propertyId: v.string() },
  handler: async (ctx, { propertyId }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) throw new Error('Finca no encontrada');
    await ctx.db.patch(id, { video: undefined, updatedAt: Date.now() });
    return null;
  },
});

/** Añade una feature suelta (fuera del guardado completo del formulario). */
export const linkFeature = mutation({
  args: {
    propertyId: v.string(),
    name: v.string(),
    featureId: v.optional(v.string()),
  },
  handler: async (ctx, { propertyId, name, featureId }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) throw new Error('Finca no encontrada');
    await ctx.db.insert('propertyFeatures', {
      propertyId: id,
      name: name.trim(),
      iconId: featureId || undefined,
    });
    return null;
  },
});

/** Quita una feature por nombre (+iconId si se pasa). */
export const unlinkFeature = mutation({
  args: {
    propertyId: v.string(),
    name: v.string(),
    featureId: v.optional(v.string()),
  },
  handler: async (ctx, { propertyId, name, featureId }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) throw new Error('Finca no encontrada');
    const features = await ctx.db
      .query('propertyFeatures')
      .withIndex('by_property', (q) => q.eq('propertyId', id))
      .collect();
    const target = features.find(
      (f) =>
        f.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        (featureId ? f.iconId === featureId : true),
    );
    if (target) await ctx.db.delete(target._id);
    return null;
  },
});

/** Upsert de los datos del propietario (formulario /owner). */
export const updateOwnerInfo = mutation({
  args: {
    propertyId: v.string(),
    patch: v.object({
      ownerUserId: v.optional(v.string()),
      rutNumber: v.optional(v.string()),
      bankName: v.optional(v.string()),
      accountNumber: v.optional(v.string()),
      bankAccounts: v.optional(
        v.array(
          v.object({
            id: v.string(),
            bankName: v.string(),
            accountNumber: v.string(),
            accountType: v.optional(v.string()),
            accountHolderName: v.optional(v.string()),
            brebKey: v.optional(v.boolean()),
          }),
        ),
      ),
      rntNumber: v.optional(v.string()),
      propietarioNombre: v.optional(v.string()),
      propietarioTratamiento: v.optional(v.string()),
      propietarioTelefono: v.optional(v.string()),
      propietarioCedula: v.optional(v.string()),
      propietarioCorreo: v.optional(v.string()),
      checkinUbicacionUrl: v.optional(v.string()),
      checkinWazeUrl: v.optional(v.string()),
      checkinIndicacionesLlegada: v.optional(v.string()),
      checkinRecomendaciones: v.optional(v.string()),
      checkinUbicacionImageUrl: v.optional(v.string()),
      checkinUbicacionImageUrls: v.optional(v.array(v.string())),
      bankCertificationUrl: v.optional(v.string()),
      idCopyUrl: v.optional(v.string()),
      rntPdfUrl: v.optional(v.string()),
      chamberOfCommerceUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { propertyId, patch }) => {
    const id = ctx.db.normalizeId('properties', propertyId);
    if (!id) throw new Error('Finca no encontrada');
    const now = Date.now();

    const existing = await ctx.db
      .query('propertyOwnerInfo')
      .withIndex('by_property', (q) => q.eq('propertyId', id))
      .first();

    // Los datos del propietario también viven denormalizados en properties
    // (los usa el bot y los contratos) — se sincronizan en el mismo guardado.
    const propietarioSync: Record<string, string> = {};
    for (const key of [
      'propietarioNombre',
      'propietarioTratamiento',
      'propietarioTelefono',
      'propietarioCedula',
      'propietarioCorreo',
    ] as const) {
      if (typeof patch[key] === 'string') propietarioSync[key] = patch[key]!;
    }
    if (Object.keys(propietarioSync).length > 0) {
      await ctx.db.patch(id, { ...propietarioSync, updatedAt: now } as never);
    }

    if (existing) {
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      await ctx.db.patch(existing._id, { ...clean, updatedAt: now } as never);
      return String(existing._id);
    }

    const infoId = await ctx.db.insert('propertyOwnerInfo', {
      propertyId: id,
      ownerUserId: patch.ownerUserId ?? '',
      rutNumber: patch.rutNumber ?? '',
      bankName: patch.bankName ?? '',
      accountNumber: patch.accountNumber ?? '',
      rntNumber: patch.rntNumber ?? '',
      bankAccounts: patch.bankAccounts,
      propietarioNombre: patch.propietarioNombre,
      propietarioTratamiento: patch.propietarioTratamiento,
      propietarioTelefono: patch.propietarioTelefono,
      propietarioCedula: patch.propietarioCedula,
      propietarioCorreo: patch.propietarioCorreo,
      checkinUbicacionUrl: patch.checkinUbicacionUrl,
      checkinWazeUrl: patch.checkinWazeUrl,
      checkinIndicacionesLlegada: patch.checkinIndicacionesLlegada,
      checkinRecomendaciones: patch.checkinRecomendaciones,
      checkinUbicacionImageUrl: patch.checkinUbicacionImageUrl,
      checkinUbicacionImageUrls: patch.checkinUbicacionImageUrls,
      bankCertificationUrl: patch.bankCertificationUrl,
      idCopyUrl: patch.idCopyUrl,
      rntPdfUrl: patch.rntPdfUrl,
      chamberOfCommerceUrl: patch.chamberOfCommerceUrl,
      createdAt: now,
      updatedAt: now,
    });
    return String(infoId);
  },
});
