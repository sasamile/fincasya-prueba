/**
 * Utilidades administrativas (CLI / dashboard).
 *
 * Sincronizar catálogo Meta:
 *   cd packages/backend && bunx convex run admin:syncCatalogFromMeta
 *   bunx convex run admin:syncCatalogFromMeta '{"dryRun": true}'
 */
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  fetchAllCatalogProducts,
  isInvalidCatalogMapping,
  isMetaGraphProductId,
  metaInternalIdToRetailer,
  normalizeRetailerId,
  resolveWhatsAppRetailerId,
  type MetaCatalogProduct,
} from './lib/metaCatalog';

/** Activa/desactiva un exemplar por su clave (sourceConversationId). */
export const setExemplarEnabled = internalMutation({
  args: { key: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, enabled }) => {
    const doc = await ctx.db
      .query('exemplars')
      .withIndex('by_source_conversation', (q) => q.eq('sourceConversationId', key))
      .first();
    if (!doc) throw new Error(`No existe exemplar con clave ${key}`);
    await ctx.db.patch(doc._id, { enabled, updatedAt: Date.now() });
    return { key, enabled };
  },
});

/**
 * Estadía mínima POR FINCA (CLI):
 *   bunx convex run admin:setPropertyMinNights \
 *     '{"code": "AN#003", "minNoches": 2, "minNochesFestivo": 3}'
 * Pasar 0 borra el mínimo. Busca por código de finca (o título parcial).
 */
export const setPropertyMinNights = internalMutation({
  args: {
    code: v.string(),
    minNoches: v.optional(v.number()),
    minNochesFestivo: v.optional(v.number()),
  },
  handler: async (ctx, { code, minNoches, minNochesFestivo }) => {
    const q = code.trim().toUpperCase();
    const all = await ctx.db.query('properties').collect();
    const prop =
      all.find((p) => (p.code ?? '').trim().toUpperCase() === q) ??
      all.find((p) => p.title.toUpperCase().includes(q));
    if (!prop) throw new Error(`No hay finca con código/título "${code}"`);
    await ctx.db.patch(prop._id, {
      minNoches: minNoches && minNoches > 0 ? minNoches : undefined,
      minNochesFestivo:
        minNochesFestivo && minNochesFestivo > 0 ? minNochesFestivo : undefined,
    });
    return {
      finca: prop.title,
      minNoches: minNoches ?? null,
      minNochesFestivo: minNochesFestivo ?? null,
    };
  },
});

/** Cambia el ID de catalogo Meta del catalogo default (para probar/corregir). */
export const setCatalogMetaId = internalMutation({
  args: { whatsappCatalogId: v.string() },
  handler: async (ctx, { whatsappCatalogId }) => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) throw new Error('No hay catalogo en whatsappCatalogs');
    const previo = catalog.whatsappCatalogId;
    await ctx.db.patch(catalog._id, { whatsappCatalogId, updatedAt: Date.now() });
    return { previo, nuevo: whatsappCatalogId };
  },
});

export const getDefaultCatalog = internalQuery({
  args: {},
  handler: async (ctx) => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) return null;
    return {
      catalogId: catalog._id,
      whatsappCatalogId: catalog.whatsappCatalogId,
      name: catalog.name,
    };
  },
});

type SyncApplyResult = {
  dryRun: boolean;
  catalogMetaId: string;
  metaRetailerCount: number;
  mappingsBefore: number;
  mappingsFixed: Array<{
    from: string;
    to: string;
    propertyId: Id<'properties'>;
  }>;
  orphansRemoved: Array<{ productRetailerId: string; propertyId: Id<'properties'> }>;
  mappingsCreated: Array<{
    productRetailerId: string;
    propertyId: Id<'properties'>;
    propertyTitle: string;
    propertyCode: string | null;
  }>;
  unmappedMetaRetailerIds: string[];
  sendableAfter: number;
  mismatchedRetailerIdCountBefore: number;
};

const metaProductValidator = v.object({
  id: v.string(),
  retailer_id: v.optional(v.string()),
  name: v.optional(v.string()),
});

/** Diagnóstico rápido de mapeos (sin llamar a Meta). */
export const auditCatalogMappings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) return { error: 'No hay catálogo' as const };

    const mappings = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_catalog', (q) => q.eq('catalogId', catalog._id))
      .collect();

    const mismatched = mappings.filter(
      (m) => normalizeRetailerId(m.productRetailerId) !== normalizeRetailerId(String(m.propertyId)),
    );

    return {
      whatsappCatalogId: catalog.whatsappCatalogId,
      catalogName: catalog.name,
      totalMappings: mappings.length,
      mismatchedRetailerIdCount: mismatched.length,
      mismatchedSamples: mismatched.slice(0, 8).map((m) => ({
        productRetailerId: m.productRetailerId,
        expectedRetailerId: String(m.propertyId),
        propertyId: m.propertyId,
      })),
      invalidCount: mappings.filter((m) =>
        isInvalidCatalogMapping(m.productRetailerId, String(m.propertyId)),
      ).length,
    };
  },
});

/** Reconcilia propertyWhatsAppCatalog con productos del catálogo Meta. */
export const applyCatalogSync = internalMutation({
  args: {
    catalogId: v.id('whatsappCatalogs'),
    metaProducts: v.array(metaProductValidator),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { catalogId, metaProducts, dryRun }): Promise<SyncApplyResult> => {
    const catalog = await ctx.db.get(catalogId);
    if (!catalog) throw new Error('Catálogo no encontrado');

    const metaSet = new Set<string>();
    const metaIdToRetailer = metaInternalIdToRetailer(metaProducts);
    for (const p of metaProducts) {
      const rid = resolveWhatsAppRetailerId(p);
      if (rid) metaSet.add(rid);
    }

    const now = Date.now();

    const mappings = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_catalog', (q) => q.eq('catalogId', catalogId))
      .collect();

    const mismatchedRetailerIdCountBefore = mappings.filter(
      (m) => normalizeRetailerId(m.productRetailerId) !== normalizeRetailerId(String(m.propertyId)),
    ).length;

    const mappingsFixed: SyncApplyResult['mappingsFixed'] = [];

    // 1) Alinear productRetailerId con _id de finca (= columna `id` del feed CSV).
    for (const m of mappings) {
      const correct = normalizeRetailerId(String(m.propertyId));
      const current = normalizeRetailerId(m.productRetailerId);
      if (current === correct) continue;

      const prop = await ctx.db.get(m.propertyId);
      if (!prop) continue;

      mappingsFixed.push({ from: current, to: correct, propertyId: m.propertyId });
      if (!dryRun) {
        await ctx.db.patch(m._id, { productRetailerId: correct, updatedAt: now });
      }
    }

    // Releer estado lógico tras fixes (en dryRun simular en memoria).
    const fixedByPropertyId = new Map(
      mappingsFixed.map((f) => [String(f.propertyId), f.to]),
    );
    const effectiveRetailerByMapping = new Map(
      mappings.map((m) => {
        const fromPropertyFix = fixedByPropertyId.get(String(m.propertyId));
        if (fromPropertyFix) return [String(m._id), fromPropertyFix] as const;
        const current = normalizeRetailerId(m.productRetailerId);
        if (isMetaGraphProductId(current)) {
          const fixed = metaIdToRetailer.get(current);
          return [String(m._id), fixed ?? current] as const;
        }
        return [String(m._id), current] as const;
      }),
    );

    const orphans = mappings.filter((m) => {
      const effective = effectiveRetailerByMapping.get(String(m._id)) ?? m.productRetailerId;
      return !metaSet.has(normalizeRetailerId(effective));
    });

    const mappedRetailerIds = new Set<string>();
    for (const m of mappings) {
      const effective = effectiveRetailerByMapping.get(String(m._id)) ?? m.productRetailerId;
      mappedRetailerIds.add(normalizeRetailerId(effective));
    }

    const unmappedMetaIds = [...metaSet].filter((id) => !mappedRetailerIds.has(id));

    const properties = await ctx.db.query('properties').collect();
    const codeToProperty = new Map<string, (typeof properties)[number]>();
    const titleToProperty = new Map<string, (typeof properties)[number]>();
    for (const p of properties) {
      if (p.code) codeToProperty.set(normalizeRetailerId(p.code), p);
      if (p.title) titleToProperty.set(normalizeRetailerId(p.title), p);
    }

    const mappedPropertyIds = new Set(mappings.map((m) => String(m.propertyId)));
    const mappingsCreated: SyncApplyResult['mappingsCreated'] = [];

    for (const retailerId of unmappedMetaIds) {
      const propById = properties.find((p) => normalizeRetailerId(String(p._id)) === retailerId);
      const prop = propById ?? codeToProperty.get(retailerId) ?? titleToProperty.get(retailerId);
      if (!prop || mappedPropertyIds.has(String(prop._id))) continue;
      mappingsCreated.push({
        productRetailerId: String(prop._id),
        propertyId: prop._id,
        propertyTitle: prop.title,
        propertyCode: prop.code ?? null,
      });
      if (!dryRun) {
        await ctx.db.insert('propertyWhatsAppCatalog', {
          propertyId: prop._id,
          catalogId,
          productRetailerId: String(prop._id),
          createdAt: now,
          updatedAt: now,
        });
        mappedPropertyIds.add(String(prop._id));
      }
    }

    const orphansRemoved: SyncApplyResult['orphansRemoved'] = orphans.map((m) => ({
      productRetailerId: m.productRetailerId,
      propertyId: m.propertyId,
    }));

    if (!dryRun) {
      for (const orphan of orphans) {
        await ctx.db.delete(orphan._id);
      }
    }

    const linkedRetailerIds = new Set<string>();
    for (const m of mappings) {
      if (orphans.some((o) => o._id === m._id)) continue;
      const effective = effectiveRetailerByMapping.get(String(m._id)) ?? m.productRetailerId;
      if (metaSet.has(normalizeRetailerId(effective))) {
        linkedRetailerIds.add(normalizeRetailerId(effective));
      }
    }
    for (const c of mappingsCreated) linkedRetailerIds.add(c.productRetailerId);

    const stillUnmappedMeta = [...metaSet].filter((id) => !linkedRetailerIds.has(id));

    const sendableAfter = mappings.length - orphans.length + mappingsCreated.length;

    return {
      dryRun: dryRun === true,
      catalogMetaId: catalog.whatsappCatalogId,
      metaRetailerCount: metaSet.size,
      mappingsBefore: mappings.length,
      mappingsFixed,
      orphansRemoved,
      mappingsCreated,
      unmappedMetaRetailerIds: stillUnmappedMeta,
      sendableAfter: Math.max(0, sendableAfter),
      mismatchedRetailerIdCountBefore,
    };
  },
});

/**
 * Alinea productRetailerId con el _id de la finca (igual que columna `id` del feed CSV).
 * Convención fincasya-new: retailer_id en Meta = property._id.
 */
export const fixCatalogMappingsFromProperties = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) throw new Error('No hay catálogo');

    const mappings = await ctx.db
      .query('propertyWhatsAppCatalog')
      .withIndex('by_catalog', (q) => q.eq('catalogId', catalog._id))
      .collect();

    const now = Date.now();
    const samples: Array<{ from: string; to: string; title: string }> = [];
    let fixed = 0;

    for (const m of mappings) {
      const prop = await ctx.db.get(m.propertyId);
      if (!prop) {
        if (!dryRun) await ctx.db.delete(m._id);
        fixed++;
        samples.push({
          from: m.productRetailerId,
          to: '(eliminado — finca no existe)',
          title: String(m.propertyId),
        });
        continue;
      }
      const to = normalizeRetailerId(String(m.propertyId));
      if (normalizeRetailerId(m.productRetailerId) === to) continue;
      samples.push({ from: m.productRetailerId, to, title: prop.title });
      if (!dryRun) {
        await ctx.db.patch(m._id, { productRetailerId: to, updatedAt: now });
      }
      fixed++;
    }

    return {
      dryRun: dryRun === true,
      whatsappCatalogId: catalog.whatsappCatalogId,
      totalMappings: mappings.length,
      fixed,
      samples: samples.slice(0, 12),
    };
  },
});

/**
 * Descarga productos del catálogo Meta y reconcilia la base local:
 * - Elimina mapeos huérfanos (ficha en DB pero no en Meta).
 * - Crea mapeos nuevos cuando retailer_id coincide con property.code.
 * - El modal solo ofrece fincas con mapeo válido (sendable).
 */
export const syncCatalogFromMeta = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }): Promise<
    SyncApplyResult & {
      metaProductsFetched: number;
      metaWithoutRetailerId: number;
      auditBefore: {
        whatsappCatalogId: string;
        catalogName: string;
        totalMappings: number;
        mismatchedRetailerIdCount: number;
        mismatchedSamples: Array<{
          productRetailerId: string;
          expectedRetailerId: string;
          propertyId: Id<'properties'>;
        }>;
      };
    }
  > => {
    const auditBefore = await ctx.runQuery(internal.admin.auditCatalogMappings, {});
    if ('error' in auditBefore) {
      throw new Error(auditBefore.error);
    }

    const catalog = await ctx.runQuery(internal.admin.getDefaultCatalog, {});
    if (!catalog) {
      throw new Error('No hay catálogo default en whatsappCatalogs');
    }

    const products = await fetchAllCatalogProducts(catalog.whatsappCatalogId);
    const withoutRetailer = products.filter((p) => !resolveWhatsAppRetailerId(p));

    const metaProducts: MetaCatalogProduct[] = products.map((p) => ({
      id: p.id,
      retailer_id: p.retailer_id,
      name: p.name,
    }));

    const result = await ctx.runMutation(internal.admin.applyCatalogSync, {
      catalogId: catalog.catalogId,
      metaProducts,
      dryRun,
    });

    return {
      ...result,
      metaProductsFetched: products.length,
      metaWithoutRetailerId: withoutRetailer.length,
      auditBefore,
    };
  },
});
