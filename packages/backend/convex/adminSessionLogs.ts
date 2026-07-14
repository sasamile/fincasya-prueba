import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Registra un inicio de sesión en el panel.
 *
 * Idempotente por `sessionToken`: si ya existe una fila para esa sesión de
 * Better Auth, la devuelve sin duplicar (varios callers en el login —
 * AdminLoginForm + layout — convergen a una sola fila; la atomicidad de las
 * mutations de Convex evita la condición de carrera del dedup del cliente).
 *
 * Cada login trae un token nuevo → una fila nueva e independiente. Al entrar se
 * cierran las sesiones abiertas anteriores del usuario (marca su salida), de
 * modo que si cerraste el navegador sin desloguear, esa sesión queda cerrada al
 * volver a entrar y solo la actual figura "En línea".
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
    const now = Date.now();

    // Idempotencia: ya existe registro para esta sesión → no duplicar.
    if (args.sessionToken) {
      const existing = await ctx.db
        .query("adminSessionLogs")
        .withIndex("by_sessionToken", (q) =>
          q.eq("sessionToken", args.sessionToken),
        )
        .first();
      if (existing) return existing._id;
    }

    // Cierra las sesiones abiertas anteriores del usuario (salida = ahora).
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

    return ctx.db.insert("adminSessionLogs", {
      userId: args.userId,
      userEmail: args.userEmail,
      userName: args.userName,
      role: args.role,
      loginAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      sessionToken: args.sessionToken,
    });
  },
});

/**
 * Registra el cierre de sesión. Cierra la fila de ESA sesión (por token) o, si
 * no se pasa token, la sesión abierta más reciente del usuario.
 */
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
      if (row) return null; // ya estaba cerrada
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

    return rows.map((row) => ({
      ...row,
      durationMs:
        row.logoutAt != null ? row.logoutAt - row.loginAt : Date.now() - row.loginAt,
      isActive: row.logoutAt == null,
    }));
  },
});
