import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { authComponent } from "./betterAuth/auth";
import {
  canManageStaffSessions,
  isSuperAdminRole,
} from "./lib/roles";
import { parseUserAgent } from "./lib/parseUserAgent";
import type { Id } from "./_generated/dataModel";

/**
 * Registra un inicio de sesión en el panel.
 *
 * Idempotente por `sessionToken`. `superadmin` no se registra.
 */
export const recordLogin = mutation({
  args: {
    userId: v.string(),
    userEmail: v.string(),
    userName: v.optional(v.string()),
    role: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userRow = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: args.userId }],
    })) as { role?: string | null } | null;
    const effectiveRole = userRow?.role ?? args.role;

    if (isSuperAdminRole(effectiveRole)) {
      return null;
    }

    const now = Date.now();

    if (args.sessionToken) {
      const existing = await ctx.db
        .query("adminSessionLogs")
        .withIndex("by_sessionToken", (q) =>
          q.eq("sessionToken", args.sessionToken),
        )
        .first();
      if (existing) return existing._id;
    }

    let ipAddress = args.ipAddress;
    let userAgent = args.userAgent;
    if (args.sessionToken && (!ipAddress || !userAgent)) {
      const baSession = (await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: "session",
          where: [{ field: "token", value: args.sessionToken }],
        },
      )) as {
        ipAddress?: string | null;
        userAgent?: string | null;
      } | null;
      if (baSession) {
        ipAddress = ipAddress || baSession.ipAddress || undefined;
        userAgent = userAgent || baSession.userAgent || undefined;
      }
    }

    const openPrev = await ctx.db
      .query("adminSessionLogs")
      .withIndex("by_user_loginAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
    for (const s of openPrev) {
      if (s.logoutAt == null) {
        await ctx.db.patch(s._id, { logoutAt: now });
      }
    }

    const id = await ctx.db.insert("adminSessionLogs", {
      userId: args.userId,
      userEmail: args.userEmail,
      userName: args.userName,
      role: effectiveRole,
      loginAt: now,
      ipAddress,
      userAgent,
      sessionToken: args.sessionToken,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyAdminSessionLogin, {
      userName: args.userName,
      userEmail: args.userEmail,
      role: effectiveRole,
      loginAt: now,
    });

    return id;
  },
});

export const recordLogout = mutation({
  args: {
    userId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logoutAt = Date.now();

    if (args.sessionToken) {
      const row = await ctx.db
        .query("adminSessionLogs")
        .withIndex("by_sessionToken", (q) =>
          q.eq("sessionToken", args.sessionToken),
        )
        .first();
      if (row && row.logoutAt == null) {
        await ctx.db.patch(row._id, { logoutAt });
        return { id: row._id, logoutAt, loginAt: row.loginAt };
      }
      if (row) return null;
    }

    const sessions = await ctx.db
      .query("adminSessionLogs")
      .withIndex("by_user_loginAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    const open = sessions.find((s) => s.logoutAt == null);
    if (!open) return null;

    await ctx.db.patch(open._id, { logoutAt });
    return { id: open._id, logoutAt, loginAt: open.loginAt };
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    const rows = args.userId
      ? await ctx.db
          .query("adminSessionLogs")
          .withIndex("by_user_loginAt", (q) => q.eq("userId", args.userId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("adminSessionLogs")
          .withIndex("by_loginAt")
          .order("desc")
          .take(limit);

    const usersResult = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "user",
        paginationOpts: { cursor: null, numItems: 1000 },
      },
    );
    const superadminIds = new Set(
      (usersResult.page as Array<{ _id: string; role?: string | null }>)
        .filter((u) => isSuperAdminRole(u.role))
        .map((u) => String(u._id)),
    );

    const me = (await authComponent.safeGetAuthUser(ctx)) as {
      _id?: string;
      userId?: string;
    } | null;
    const myId = String(me?._id ?? me?.userId ?? "");

    let mySessionToken: string | null = null;
    if (myId) {
      try {
        const mySessions = await ctx.runQuery(
          components.betterAuth.adapter.findMany,
          {
            model: "session",
            where: [{ field: "userId", value: myId }],
            paginationOpts: { cursor: null, numItems: 5 },
          },
        );
        const newest = (
          mySessions.page as Array<{ token?: string; updatedAt?: number }>
        ).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
        mySessionToken = newest?.token ?? null;
      } catch {
        /* no crítico */
      }
    }

    return rows
      .filter(
        (row) =>
          !isSuperAdminRole(row.role) && !superadminIds.has(row.userId),
      )
      .map((row) => {
        const device = parseUserAgent(row.userAgent);
        return {
          ...row,
          durationMs:
            row.logoutAt != null
              ? row.logoutAt - row.loginAt
              : Date.now() - row.loginAt,
          isActive: row.logoutAt == null,
          deviceLabel: device.label,
          browser: device.browser,
          os: device.os,
          deviceKind: device.device,
          isCurrentSession:
            Boolean(row.sessionToken) &&
            Boolean(mySessionToken) &&
            row.sessionToken === mySessionToken,
        };
      });
  },
});

/**
 * Cierra sesiones concretas del historial (por id de log).
 * Borra la sesión de Better Auth asociada (si hay token) y marca salida.
 */
export const revokeSelectedSessions = mutation({
  args: {
    logIds: v.array(v.id("adminSessionLogs")),
  },
  handler: async (ctx, { logIds }) => {
    const me = (await authComponent.safeGetAuthUser(ctx)) as {
      _id?: string;
      userId?: string;
      role?: string | null;
    } | null;
    if (!me) throw new Error("No autenticado");
    if (!canManageStaffSessions(me.role)) {
      throw new Error("Sin permiso para cerrar sesiones del personal");
    }

    const myId = String(me._id ?? me.userId ?? "");
    const uniqueIds = [...new Set(logIds)].slice(0, 100);

    const myBa = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "session",
      where: [{ field: "userId", value: myId }],
      paginationOpts: { cursor: null, numItems: 50 },
    });
    const myTokens = new Set(
      (myBa.page as Array<{ token?: string }>)
        .map((s) => s.token)
        .filter(Boolean) as string[],
    );

    const now = Date.now();
    let sessionsDeleted = 0;
    let logsClosed = 0;
    let skippedOwn = 0;
    let skippedInactive = 0;

    for (const logId of uniqueIds) {
      const log = await ctx.db.get(logId as Id<"adminSessionLogs">);
      if (!log) continue;
      if (isSuperAdminRole(log.role)) continue;

      if (log.logoutAt != null) {
        skippedInactive += 1;
        continue;
      }

      if (log.sessionToken && myTokens.has(log.sessionToken)) {
        skippedOwn += 1;
        continue;
      }
      if (!log.sessionToken && log.userId === myId) {
        skippedOwn += 1;
        continue;
      }

      if (log.sessionToken) {
        const baSession = (await ctx.runQuery(
          components.betterAuth.adapter.findOne,
          {
            model: "session",
            where: [{ field: "token", value: log.sessionToken }],
          },
        )) as { _id: string } | null;
        if (baSession?._id) {
          await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
            input: {
              model: "session",
              where: [{ field: "_id", value: baSession._id }],
            },
          });
          sessionsDeleted += 1;
        }
      }

      await ctx.db.patch(log._id, { logoutAt: now });
      logsClosed += 1;
    }

    return { sessionsDeleted, logsClosed, skippedOwn, skippedInactive };
  },
});

/** Cierra todas las sesiones del personal excepto la tuya y superadmins. */
export const revokeAllStaffSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const me = (await authComponent.safeGetAuthUser(ctx)) as {
      _id?: string;
      userId?: string;
      role?: string | null;
    } | null;
    if (!me) throw new Error("No autenticado");
    if (!canManageStaffSessions(me.role)) {
      throw new Error("Sin permiso para cerrar sesiones del personal");
    }

    const myId = String(me._id ?? me.userId ?? "");
    const usersResult = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "user",
        paginationOpts: { cursor: null, numItems: 1000 },
      },
    );

    const now = Date.now();
    let usersRevoked = 0;
    let sessionsDeleted = 0;
    let logsClosed = 0;

    for (const user of usersResult.page as Array<{
      _id: string;
      role?: string | null;
    }>) {
      const userId = String(user._id);
      if (!userId || userId === myId) continue;
      if (isSuperAdminRole(user.role)) continue;

      const sessions = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        {
          model: "session",
          where: [{ field: "userId", value: userId }],
          paginationOpts: { cursor: null, numItems: 200 },
        },
      );
      const sessionRows = sessions.page as Array<{ _id: string }>;
      if (sessionRows.length > 0) {
        for (const session of sessionRows) {
          await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
            input: {
              model: "session",
              where: [{ field: "_id", value: session._id }],
            },
          });
          sessionsDeleted += 1;
        }
        usersRevoked += 1;
      }

      const openLogs = await ctx.db
        .query("adminSessionLogs")
        .withIndex("by_user_loginAt", (q) => q.eq("userId", userId))
        .order("desc")
        .take(50);
      for (const log of openLogs) {
        if (log.logoutAt == null) {
          await ctx.db.patch(log._id, { logoutAt: now });
          logsClosed += 1;
        }
      }
    }

    return { usersRevoked, sessionsDeleted, logsClosed };
  },
});
