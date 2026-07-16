/**
 * Gestión de los enlaces finca ↔ catálogo de WhatsApp (portado de v1).
 *
 * La tabla `propertyWhatsAppCatalog` mapea cada finca a su producto en Meta
 * (`productRetailerId`). Estas herramientas permiten enlazar/desenlazar en
 * bloque o individualmente, y soltar enlaces rotos.
 *
 * CLI:
 *   bunx convex run propertyWhatsAppCatalog:bulkLinkActivePropertiesToWhatsAppCatalogs '{"dryRun":true}'
 *   bunx convex run propertyWhatsAppCatalog:bulkLinkActivePropertiesToWhatsAppCatalogs '{"fallbackToDefault":true}'
 *
 * NOTA vs v1: aquí NO se agenda escritura a Meta (v2 no tiene actions de
 * escritura al Graph); el catálogo en Meta se administra en Commerce Manager y
 * se reconcilia con `admin:syncCatalogFromMeta` / `admin:fixCatalogMappingsFromProperties`.
 */
import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';

/**
 * Enlaza una finca a su catálogo de WhatsApp al crearla/actualizarla, para que
 * quede `sendable` sin esperar la reconciliación manual. Elige catálogo por
 * `locationKeyword` y cae al default. Convención fincasya-new:
 * productRetailerId = _id de la finca (= columna `id` del feed CSV).
 * Idempotente: si la finca ya tiene algún enlace, no hace nada.
 */
export async function autoLinkPropertyToCatalog(
  ctx: MutationCtx,
  property: Doc<'properties'>,
): Promise<'linked' | 'already-linked' | 'skipped' | 'no-catalog'> {
  if (property.active === false) return 'skipped';
  if (property.visible === false || property.visibleInWhatsAppCatalog === false) {
    return 'skipped';
  }

  const existing = await ctx.db
    .query('propertyWhatsAppCatalog')
    .withIndex('by_property', (q) => q.eq('propertyId', property._id))
    .first();
  if (existing) return 'already-linked';

  const catalogs = await ctx.db.query('whatsappCatalogs').collect();
  const location = String(property.location ?? '').toLowerCase();
  const target =
    catalogs.find((c) => {
      const kw = (c.locationKeyword ?? '').trim().toLowerCase();
      return kw.length > 0 && location.includes(kw);
    }) ??
    catalogs.find((c) => c.isDefault === true) ??
    null;
  if (!target) return 'no-catalog';

  const now = Date.now();
  await ctx.db.insert('propertyWhatsAppCatalog', {
    propertyId: property._id,
    catalogId: target._id,
    productRetailerId: String(property._id),
    createdAt: now,
    updatedAt: now,
  });
  return 'linked';
}

/** Enlaces de una finca, enriquecidos con nombre e id Meta del catálogo. */
export const listByProperty = query({
  args: { propertyId: v.id('properties') },
  handler: async (ctx, { propertyId }) => {
    const rows = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
      .collect();
    const out = [];
    for (const row of rows) {
      const catalog = await ctx.db.get(row.catalogId);
      out.push({
        ...row,
        catalogName: catalog?.name ?? null,
        whatsappCatalogId: catalog?.whatsappCatalogId ?? null,
      });
    }
    return out;
  },
});

/** Todos los enlaces (diagnóstico). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('propertyWhatsAppCatalog').collect();
  },
});

/** Fincas enlazadas a un catálogo. */
export const listByCatalog = query({
  args: { catalogId: v.id('whatsappCatalogs') },
  handler: async (ctx, { catalogId }) => {
    return await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_catalog', (q) => q.eq('catalogId', catalogId))
      .collect();
  },
});

/** Resuelve la finca desde un product_retailer_id entrante (índice directo). */
export const getPropertyByRetailerId = query({
  args: { productRetailerId: v.string() },
  handler: async (ctx, { productRetailerId }) => {
    const rid = productRetailerId.trim();
    if (!rid) return null;

    let propertyId = (
      await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_retailer', (q) => q.eq('productRetailerId', rid))
        .first()
    )?.propertyId;

    // A veces Meta usa el Convex _id de la propiedad como retailerId.
    if (!propertyId) {
      const asProp = await ctx.db.get(rid as any);
      if (asProp && 'title' in asProp) propertyId = rid as any;
    }
    if (!propertyId) return null;

    const property = await ctx.db.get(propertyId);
    if (!property) return null;

    const img = await ctx.db
      .query('propertyImages')
      .withIndex('by_property', (q) => q.eq('propertyId', propertyId!))
      .first();
    const prices = [
      property.priceBase,
      property.priceBaja,
      property.priceMedia,
      property.priceAlta,
    ].filter((x): x is number => typeof x === 'number' && x > 0);

    return {
      propertyId,
      title: property.title,
      image: img?.url ?? null,
      priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
      priceOriginal: property.priceOriginal ?? null,
      capacity: property.capacity,
      url: property.slug ? `https://fincasya.com/fincas/${property.slug}` : null,
      productRetailerId: rid,
    };
  },
});

/** Upsert de un enlace finca↔catálogo (panel/CLI). */
export const setPropertyInCatalog = mutation({
  args: {
    propertyId: v.id('properties'),
    catalogId: v.id('whatsappCatalogs'),
    productRetailerId: v.string(),
  },
  handler: async (ctx, args) => {
    const retailerId = args.productRetailerId.trim();
    if (!retailerId) throw new Error('productRetailerId vacío');
    const now = Date.now();
    const existing = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_property_and_catalog', (q) =>
        q.eq('propertyId', args.propertyId).eq('catalogId', args.catalogId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        productRetailerId: retailerId,
        updatedAt: now,
      });
      return { ok: true as const, action: 'updated' as const, id: existing._id };
    }
    const id = await ctx.db.insert('propertyWhatsAppCatalog', {
      propertyId: args.propertyId,
      catalogId: args.catalogId,
      productRetailerId: retailerId,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true as const, action: 'created' as const, id };
  },
});

/** Elimina el enlace de una finca con un catálogo. */
export const removePropertyFromCatalog = mutation({
  args: {
    propertyId: v.id('properties'),
    catalogId: v.id('whatsappCatalogs'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_property_and_catalog', (q) =>
        q.eq('propertyId', args.propertyId).eq('catalogId', args.catalogId),
      )
      .unique();
    if (!row) return { ok: false as const, reason: 'not_found' as const };
    await ctx.db.delete(row._id);
    return { ok: true as const };
  },
});

/** Suelta un enlace roto (lo usa la reconciliación contra Meta). */
export const detachBrokenPropertyCatalogLink = internalMutation({
  args: {
    propertyId: v.id('properties'),
    catalogId: v.id('whatsappCatalogs'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_property_and_catalog', (q) =>
        q.eq('propertyId', args.propertyId).eq('catalogId', args.catalogId),
      )
      .unique();
    if (!row) return;
    await ctx.db.delete(row._id);
  },
});

/**
 * Enlaza en bloque todas las fincas activas/visibles a su catálogo según
 * `locationKeyword` (con caída opcional al catálogo default). Idempotente:
 * las ya enlazadas se reportan como `already-linked`. `dryRun` solo reporta.
 */
export const bulkLinkActivePropertiesToWhatsAppCatalogs = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    fallbackToDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, { dryRun, fallbackToDefault }) => {
    const catalogs = await ctx.db.query('whatsappCatalogs').collect();
    const defaultCatalog = catalogs.find((c) => c.isDefault === true) ?? null;
    const keywordCatalogs = catalogs.filter(
      (c) => (c.locationKeyword ?? '').trim().length > 0,
    );

    const properties = await ctx.db.query('properties').collect();
    const summary = {
      totalProperties: properties.length,
      skippedInactive: 0,
      skippedInvisible: 0,
      alreadyLinked: 0,
      newlyLinked: 0,
      linkedToDefault: 0,
      noMatchingCatalog: 0,
    };
    const details: Array<{
      propertyId: string;
      title: string;
      outcome: string;
      catalogName?: string;
    }> = [];
    const now = Date.now();

    for (const prop of properties) {
      if (prop.active === false) {
        summary.skippedInactive++;
        continue;
      }
      if (prop.visible === false || prop.visibleInWhatsAppCatalog === false) {
        summary.skippedInvisible++;
        continue;
      }

      const location = String(prop.location ?? '').toLowerCase();
      let target = keywordCatalogs.find((c) =>
        location.includes(String(c.locationKeyword).toLowerCase().trim()),
      );
      let usedDefault = false;
      if (!target && fallbackToDefault && defaultCatalog) {
        target = defaultCatalog;
        usedDefault = true;
      }
      if (!target) {
        summary.noMatchingCatalog++;
        details.push({
          propertyId: String(prop._id),
          title: prop.title,
          outcome: 'no-matching-catalog',
        });
        continue;
      }

      const existing = await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_property_and_catalog', (q) =>
          q.eq('propertyId', prop._id).eq('catalogId', target._id),
        )
        .unique();
      if (existing) {
        summary.alreadyLinked++;
        continue;
      }

      if (!dryRun) {
        await ctx.db.insert('propertyWhatsAppCatalog', {
          propertyId: prop._id,
          catalogId: target._id,
          productRetailerId: String(prop._id),
          createdAt: now,
          updatedAt: now,
        });
      }
      summary.newlyLinked++;
      if (usedDefault) summary.linkedToDefault++;
      details.push({
        propertyId: String(prop._id),
        title: prop.title,
        outcome: dryRun ? 'would-link' : 'linked',
        catalogName: target.name,
      });
    }

    return { dryRun: Boolean(dryRun), summary, details };
  },
});
