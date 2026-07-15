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
    const row = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_retailer', (q) =>
        q.eq('productRetailerId', productRetailerId.trim()),
      )
      .first();
    if (!row) return null;
    const property = await ctx.db.get(row.propertyId);
    if (!property) return null;
    return { propertyId: row.propertyId, title: property.title, row };
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
