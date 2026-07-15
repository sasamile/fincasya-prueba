/**
 * Overrides editables del copy de plantillas WhatsApp oficiales (Meta).
 * Defaults en templateCatalog.ts; aquí solo body/footer desde Automatizaciones.
 */
import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { authComponent } from "./betterAuth/auth";
import {
  ALL_TEMPLATE_KEYS,
  assertBodyPlaceholders,
  applyTemplateOverride,
  getTemplateDef,
  type CheckinTemplateKey,
  type TemplateDef,
  type TemplateOverrideFields,
} from "./lib/ycloud/templateCatalog";

const ADMIN_ROLES = new Set([
  "admin",
  "assistant",
  "superadmin",
  "contabilidad",
]);

async function requireAdmin(
  ctx: Parameters<typeof authComponent.safeGetAuthUser>[0],
) {
  const user = (await authComponent.safeGetAuthUser(ctx)) as
    | {
        _id: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
      }
    | null;
  const role = String(user?.role ?? "")
    .trim()
    .toLowerCase();
  if (!user || !ADMIN_ROLES.has(role)) return null;
  return user;
}

/** Mapa key → campos override (para merge en queries). */
export async function loadOverrideMap(ctx: {
  db: {
    query: (table: "whatsappTemplateOverrides") => {
      collect: () => Promise<
        Array<{ key: string; bodyText: string; footer?: string | null }>
      >;
    };
  };
}): Promise<Map<string, TemplateOverrideFields>> {
  const rows = await ctx.db.query("whatsappTemplateOverrides").collect();
  const map = new Map<string, TemplateOverrideFields>();
  for (const row of rows) {
    map.set(row.key, { bodyText: row.bodyText, footer: row.footer });
  }
  return map;
}

export function resolveWithOverrideMap(
  base: TemplateDef,
  map: Map<string, TemplateOverrideFields>,
): { def: TemplateDef; isCustomized: boolean } {
  const override = map.get(base.key);
  return {
    def: applyTemplateOverride(base, override),
    isCustomized: Boolean(override),
  };
}

/** Def resuelta (catálogo + override) para actions de envío/registro. */
export const getResolvedInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }): Promise<TemplateDef | null> => {
    const base = getTemplateDef(key);
    if (!base) return null;
    const row = await ctx.db
      .query("whatsappTemplateOverrides")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    return applyTemplateOverride(
      base,
      row ? { bodyText: row.bodyText, footer: row.footer } : null,
    );
  },
});

/** Defs de check-in resueltas (para registerCheckinTemplates). */
export const listResolvedCheckinInternal = internalQuery({
  args: {
    onlyKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<TemplateDef[]> => {
    const keys = (
      args.onlyKeys && args.onlyKeys.length > 0
        ? args.onlyKeys
        : ALL_TEMPLATE_KEYS
    ).filter((k): k is CheckinTemplateKey => Boolean(getTemplateDef(k)));
    const map = await loadOverrideMap(ctx);
    return keys.flatMap((key) => {
      const base = getTemplateDef(key);
      if (!base) return [];
      return [resolveWithOverrideMap(base, map).def];
    });
  },
});

/** Guarda el copy editable. Conserva exactamente {{1}}…{{n}} del catálogo. */
export const upsert = mutation({
  args: {
    key: v.string(),
    bodyText: v.string(),
    footer: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (!me) throw new Error("No autorizado");

    const base = getTemplateDef(args.key);
    if (!base) throw new Error(`Plantilla desconocida: ${args.key}`);
    if (!(ALL_TEMPLATE_KEYS as string[]).includes(args.key)) {
      throw new Error(
        "Solo se pueden editar plantillas del flujo de Automatizaciones.",
      );
    }

    const bodyText = args.bodyText.trim();
    if (!bodyText) throw new Error("El cuerpo de la plantilla es obligatorio");
    assertBodyPlaceholders(bodyText, base.paramKeys.length);

    const existing = await ctx.db
      .query("whatsappTemplateOverrides")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    const footerToStore: string | null =
      args.footer !== undefined
        ? args.footer === null
          ? null
          : String(args.footer).trim() || null
        : existing
          ? (existing.footer ?? null)
          : (base.footer ?? null);

    const isDefault =
      bodyText === base.bodyText &&
      (footerToStore ?? undefined) === (base.footer ?? undefined);

    if (isDefault) {
      if (existing) await ctx.db.delete(existing._id);
      return { ok: true as const, isCustomized: false };
    }

    const now = Date.now();
    const updatedByUserId = me.name?.trim() || me.email?.trim() || me._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        bodyText,
        footer: footerToStore,
        updatedAt: now,
        updatedByUserId,
      });
    } else {
      await ctx.db.insert("whatsappTemplateOverrides", {
        key: args.key,
        bodyText,
        footer: footerToStore,
        updatedAt: now,
        updatedByUserId,
      });
    }
    return { ok: true as const, isCustomized: true };
  },
});
