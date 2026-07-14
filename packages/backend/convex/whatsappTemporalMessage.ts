import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { sendWhatsappText } from "./lib/ycloud";

type TemporalMessage = {
  enabled: boolean;
  content: string;
  validUntil?: number;
};

function emptyToUndefined(n: number | null | undefined): number | undefined {
  if (n == null) return undefined;
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function normalizeContent(content: string): string {
  return String(content ?? "").trim();
}

function resolveActive(row: {
  enabled?: boolean;
  content?: string;
  validUntil?: number;
  updatedAt?: number;
  updatedByUserId?: string;
} | null) {
  const now = Date.now();
  const enabled = Boolean(row?.enabled);
  const content = normalizeContent(row?.content ?? "");
  const validUntil = row?.validUntil;

  const withinValidity =
    !enabled
      ? false
      : validUntil == null || !Number.isFinite(validUntil)
        ? true
        : now <= validUntil;

  const active = withinValidity && content.length > 0;

  return {
    active,
    enabled,
    content,
    validUntil: validUntil == null ? null : validUntil,
    updatedAt: row?.updatedAt ?? null,
    updatedByUserId: row?.updatedByUserId ?? null,
  };
}

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("whatsappTemporalMessage")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .unique();
    return resolveActive(row);
  },
});

/** Para actions del inbound: ¿hay mensaje temporal activo? */
export const getActiveInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("whatsappTemporalMessage")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .unique();
    return resolveActive(row);
  },
});

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("whatsappTemporalMessage")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .unique();

    return {
      enabled: Boolean(row?.enabled),
      content: normalizeContent(row?.content ?? ""),
      validUntil: row?.validUntil == null ? null : row?.validUntil,
      updatedAt: row?.updatedAt ?? null,
      updatedByUserId: row?.updatedByUserId ?? null,
    };
  },
});

export const upsert = mutation({
  args: {
    enabled: v.boolean(),
    content: v.string(),
    validUntil: v.optional(v.number()),
    updatedByUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const content = normalizeContent(args.content);
    if (args.enabled && content.length === 0) {
      throw new Error(
        "El contenido del mensaje temporal es obligatorio cuando está habilitado.",
      );
    }

    const validUntil = emptyToUndefined(args.validUntil);

    const existing = await ctx.db
      .query("whatsappTemporalMessage")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        content,
        ...(validUntil !== undefined
          ? { validUntil }
          : { validUntil: undefined }),
        updatedAt: now,
        updatedByUserId: args.updatedByUserId,
      });
      return existing._id;
    }

    const doc: TemporalMessage & {
      scope: "global";
      updatedAt: number;
      updatedByUserId?: string;
    } = {
      scope: "global",
      enabled: args.enabled,
      content,
      ...(validUntil !== undefined ? { validUntil } : {}),
      updatedAt: now,
      updatedByUserId: args.updatedByUserId,
    };

    return await ctx.db.insert("whatsappTemporalMessage", doc as any);
  },
});

/** Persiste el mensaje temporal en el inbox (sin sentByUserId → no cuenta como Experto). */
export const recordSent = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    wamid: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, content, wamid }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return;
    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId,
      sender: "assistant",
      content,
      type: "text",
      wamid,
      whatsappStatus: wamid ? "sent" : undefined,
      // Sin sentByUserId: no detiene al bot ni cuenta como humano.
      metadata: { source: "whatsapp_temporal" },
      createdAt: now,
    });
    await ctx.db.patch(conversationId, { lastMessageAt: now });
  },
});

/**
 * Si el mensaje temporal está activo, lo envía por WhatsApp al iniciar una
 * conversación nueva. No lanza: un fallo de YCloud no debe tumbar el inbound.
 */
export const sendIfActive = internalAction({
  args: {
    conversationId: v.id("conversations"),
    to: v.string(),
  },
  handler: async (ctx, { conversationId, to }): Promise<{ sent: boolean }> => {
    const settings = await ctx.runQuery(
      internal.whatsappTemporalMessage.getActiveInternal,
      {},
    );
    if (!settings.active || !settings.content) {
      return { sent: false };
    }

    let wamid: string | undefined;
    try {
      const sent = await sendWhatsappText({ to, text: settings.content });
      wamid = sent.wamid;
    } catch (err) {
      console.error("[whatsappTemporalMessage] fallo el envío", err);
      // Igual lo dejamos en el inbox para que el equipo vea qué se intentó.
    }

    await ctx.runMutation(internal.whatsappTemporalMessage.recordSent, {
      conversationId,
      content: settings.content,
      wamid,
    });
    return { sent: true };
  },
});
