/**
 * Canales sociales via Meta Graph API (Facebook Pages + Instagram Business).
 *
 * Flujo OAuth (Facebook Login):
 *   1. generateAuthUrl  -> el front redirige el navegador al diálogo de Meta.
 *   2. Meta redirige a /api/admin/meta-callback?code=... (server-side).
 *   3. exchangeCodeAndConnect intercambia el code por un user token de larga
 *      duración, lista las Páginas del usuario y guarda una conexión por Página
 *      (con su Page Access Token y la cuenta de Instagram vinculada).
 *
 * Lecturas/escrituras de contenido (publicaciones, comentarios, respuestas) se
 * hacen desde actions usando el Page Access Token guardado — NUNCA se expone al
 * cliente. El App Secret vive solo en Convex (META_APP_SECRET).
 */
import { v } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { api, internal } from './_generated/api';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Permisos que pedimos en el diálogo de OAuth. */
// Permisos de Facebook Pages (caso de uso "Administrar todos los aspectos de
// tu página"). Los de Instagram (instagram_basic, instagram_manage_comments)
// se agregan cuando se habilite el caso de uso de IG con login de Facebook.
const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_manage_metadata',
  'pages_read_user_content',
];
const INSTAGRAM_SCOPES = ['instagram_basic', 'instagram_manage_comments'];
// Activa Instagram poniendo META_ENABLE_INSTAGRAM=1 en Convex una vez el caso
// de uso de IG con login de Facebook esté habilitado en la app.
const SCOPES =
  process.env.META_ENABLE_INSTAGRAM === '1'
    ? [...FACEBOOK_SCOPES, ...INSTAGRAM_SCOPES]
    : FACEBOOK_SCOPES;

// ============ TIPOS ============

type ConnectResult = {
  ok: boolean;
  connected: number;
  pages: { pageId: string; pageName: string; igUsername?: string }[];
  error?: string;
};

type GraphPost = {
  id: string;
  message?: string;
  createdTime?: string;
  imageUrl?: string;
  permalink?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  mediaType?: string;
};

type GraphComment = {
  id: string;
  text?: string;
  fromId?: string;
  fromName?: string;
  createdTime?: string;
  likeCount?: number;
  replyCount?: number;
  parentId?: string;
};

// ============ QUERIES ============

/** Lista pública de conexiones (SIN tokens). Segura para el cliente. */
export const listConnections = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('metaChannelConnections').collect();
    return rows
      .filter((r) => r.connected)
      .map((r) => ({
        _id: r._id,
        pageId: r.pageId,
        pageName: r.pageName,
        category: r.category,
        pictureUrl: r.pictureUrl,
        igUserId: r.igUserId,
        igUsername: r.igUsername,
        igPictureUrl: r.igPictureUrl,
        webhookSubscribed: r.webhookSubscribed ?? false,
        connectedByName: r.connectedByName,
        lastError: r.lastError,
        updatedAt: r.updatedAt,
      }));
  },
});

/** Feed reciente del webhook (comentarios/menciones entrantes). */
export const recentEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('metaWebhookEvents')
      .withIndex('by_receivedAt')
      .order('desc')
      .take(args.limit ?? 30);
    return rows.map((r) => ({
      _id: r._id,
      provider: r.provider,
      pageId: r.pageId,
      field: r.field,
      verb: r.verb,
      commentId: r.commentId,
      fromName: r.fromName,
      text: r.text,
      permalink: r.permalink,
      receivedAt: r.receivedAt,
    }));
  },
});

/** Interno: conexión con token para actions/webhook. NO exponer. */
export const getConnectionByPageId = internalQuery({
  args: { pageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
  },
});

/** Interno: token de la Página que posee una cuenta de Instagram dada. */
export const getConnectionByIgId = internalQuery({
  args: { igUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_ig', (q) => q.eq('igUserId', args.igUserId))
      .first();
  },
});

export const getAnyConnectedPageIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('metaChannelConnections').collect();
    return rows.filter((r) => r.connected).map((r) => r.pageId);
  },
});

// ============ MUTATIONS ============

export const upsertConnection = mutation({
  args: {
    pageId: v.string(),
    pageName: v.string(),
    pageAccessToken: v.string(),
    category: v.optional(v.string()),
    pictureUrl: v.optional(v.string()),
    igUserId: v.optional(v.string()),
    igUsername: v.optional(v.string()),
    igPictureUrl: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    connectedByUserId: v.optional(v.string()),
    connectedByName: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    const payload = {
      ...args,
      connected: true,
      lastError: undefined,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert('metaChannelConnections', {
      ...payload,
      webhookSubscribed: false,
      createdAt: now,
    });
  },
});

export const setWebhookSubscribed = mutation({
  args: { pageId: v.string(), subscribed: v.boolean() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    if (row) {
      await ctx.db.patch(row._id, {
        webhookSubscribed: args.subscribed,
        updatedAt: Date.now(),
      });
    }
  },
});

export const disconnect = mutation({
  args: { pageId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      connected: false,
      pageAccessToken: '',
      webhookSubscribed: false,
      updatedAt: Date.now(),
    });
    return row._id;
  },
});

/** Registra un evento entrante del webhook (llamado desde http.ts). */
export const recordWebhookEvent = internalMutation({
  args: {
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    pageId: v.optional(v.string()),
    objectId: v.optional(v.string()),
    field: v.optional(v.string()),
    verb: v.optional(v.string()),
    commentId: v.optional(v.string()),
    parentId: v.optional(v.string()),
    fromId: v.optional(v.string()),
    fromName: v.optional(v.string()),
    text: v.optional(v.string()),
    permalink: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('metaWebhookEvents', {
      ...args,
      handled: false,
      receivedAt: Date.now(),
    });
  },
});

// ============ ACTIONS: OAUTH ============

/** URL del diálogo de autorización de Meta. El front redirige aquí. */
export const generateAuthUrl = action({
  args: { redirectUri: v.string(), state: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const appId = process.env.META_APP_ID;
    if (!appId) throw new Error('META_APP_ID no configurado en Convex');
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: args.redirectUri,
      response_type: 'code',
      state: args.state ?? 'fincasya',
    });
    // Facebook Login for Business: los permisos vienen de la "configuración"
    // (config_id), no del parámetro scope. Si no hay config_id, se usa el flujo
    // clásico con scope.
    const configId = process.env.META_LOGIN_CONFIG_ID;
    if (configId) {
      params.set('config_id', configId);
    } else {
      params.set('scope', SCOPES.join(','));
    }
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  },
});

/**
 * Intercambia el code por tokens y guarda una conexión por Página.
 * Suscribe cada Página al webhook de la app automáticamente.
 */
export const exchangeCodeAndConnect = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
    connectedByUserId: v.optional(v.string()),
    connectedByName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ConnectResult> => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('Faltan META_APP_ID o META_APP_SECRET en Convex');
    }

    // 1. code -> user token de corta duración
    const shortRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: args.redirectUri,
          code: args.code,
        }).toString(),
    );
    const shortData = await shortRes.json();
    if (!shortRes.ok || !shortData.access_token) {
      throw new Error(
        `Meta OAuth error: ${shortData?.error?.message || JSON.stringify(shortData)}`,
      );
    }

    // 2. user token corto -> user token de larga duración (~60 días)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortData.access_token,
        }).toString(),
    );
    const longData = await longRes.json();
    const userToken: string = longData.access_token || shortData.access_token;
    const tokenExpiresAt = longData.expires_in
      ? Date.now() + longData.expires_in * 1000
      : undefined;

    // 3. Listar Páginas del usuario (con su Page Access Token e IG vinculado).
    // /me/accounts solo devuelve páginas donde el usuario es Admin directo.
    // En apps Business (FLoB), las páginas gestionadas solo vía Business Manager
    // no aparecen ahí. Usamos /debug_token para obtener los page_ids autorizados
    // desde granular_scopes y luego los consultamos directamente.
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({
          fields:
            'id,name,access_token,category,picture{url},instagram_business_account{id,username,profile_picture_url}',
          limit: '100',
          access_token: userToken,
        }).toString(),
    );
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) {
      throw new Error(
        `Meta /me/accounts error: ${pagesData?.error?.message || JSON.stringify(pagesData)}`,
      );
    }

    let pages: any[] = pagesData.data ?? [];

    // Fallback FLoB: si /me/accounts está vacío, obtener page IDs desde
    // debug_token.granular_scopes y consultar cada página directamente.
    if (pages.length === 0) {
      const appToken = `${appId}|${appSecret}`;
      const debugRes = await fetch(
        `${GRAPH}/debug_token?` +
          new URLSearchParams({
            input_token: userToken,
            access_token: appToken,
          }).toString(),
      );
      const debugData = await debugRes.json();
      const granularScopes: { scope: string; target_ids?: string[] }[] =
        debugData?.data?.granular_scopes ?? [];
      const pageIdsFromScopes = new Set<string>();
      for (const gs of granularScopes) {
        if (gs.scope === 'pages_show_list' && gs.target_ids) {
          gs.target_ids.forEach((id) => pageIdsFromScopes.add(id));
        }
      }
      const pageField =
        'id,name,access_token,category,picture{url},instagram_business_account{id,username,profile_picture_url}';
      const directPages = await Promise.all(
        [...pageIdsFromScopes].map(async (pageId) => {
          const r = await fetch(
            `${GRAPH}/${pageId}?` +
              new URLSearchParams({ fields: pageField, access_token: userToken }).toString(),
          );
          return r.ok ? r.json() : null;
        }),
      );
      pages = directPages.filter(Boolean).filter((p: any) => p.access_token);
    }
    const saved: { pageId: string; pageName: string; igUsername?: string }[] = [];

    for (const page of pages) {
      if (!page.access_token) continue;
      await ctx.runMutation(api.metaChannels.upsertConnection, {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        category: page.category,
        pictureUrl: page.picture?.data?.url,
        igUserId: page.instagram_business_account?.id,
        igUsername: page.instagram_business_account?.username,
        igPictureUrl: page.instagram_business_account?.profile_picture_url,
        scopes: SCOPES,
        connectedByUserId: args.connectedByUserId,
        connectedByName: args.connectedByName,
        tokenExpiresAt,
      });
      // Suscribir la Página al webhook de la app (best-effort).
      try {
        await ctx.runAction(internal.metaChannels.subscribePageWebhook, {
          pageId: page.id,
          pageAccessToken: page.access_token,
        });
      } catch (e) {
        console.error('[meta] subscribe webhook falló', page.id, e);
      }
      saved.push({
        pageId: page.id,
        pageName: page.name,
        igUsername: page.instagram_business_account?.username,
      });
    }

    return { ok: true, connected: saved.length, pages: saved };
  },
});

/** Suscribe una Página a los campos del webhook de la app. */
export const subscribePageWebhook = internalAction({
  args: { pageId: v.string(), pageAccessToken: v.string() },
  handler: async (ctx, args) => {
    const res = await fetch(
      `${GRAPH}/${args.pageId}/subscribed_apps?` +
        new URLSearchParams({
          subscribed_fields: 'feed,mention,messages,messaging_postbacks',
          access_token: args.pageAccessToken,
        }).toString(),
      { method: 'POST' },
    );
    const data = await res.json();
    const ok = res.ok && data.success !== false;
    await ctx.runMutation(api.metaChannels.setWebhookSubscribed, {
      pageId: args.pageId,
      subscribed: ok,
    });
    return { ok, data };
  },
});

// ============ ACTIONS: CONTENIDO ============

/** Publicaciones de una Página (Facebook) o de su cuenta de Instagram. */
export const listPosts = action({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ posts: GraphPost[]; error?: string }> => {
    const conn = await ctx.runQuery(
      internal.metaChannels.getConnectionByPageId,
      { pageId: args.pageId },
    );
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { posts: [], error: 'Página no conectada' };
    }
    const token = conn.pageAccessToken;
    const limit = String(args.limit ?? 25);

    if (args.provider === 'instagram') {
      if (!conn.igUserId) return { posts: [], error: 'Sin Instagram vinculado' };
      const res = await fetch(
        `${GRAPH}/${conn.igUserId}/media?` +
          new URLSearchParams({
            fields:
              'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
            limit,
            access_token: token,
          }).toString(),
      );
      const data = await res.json();
      if (!res.ok) return { posts: [], error: data?.error?.message };
      const posts: GraphPost[] = (data.data ?? []).map((m: any) => ({
        id: m.id,
        message: m.caption,
        createdTime: m.timestamp,
        imageUrl: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
        permalink: m.permalink,
        likeCount: m.like_count,
        commentCount: m.comments_count,
        mediaType: m.media_type,
      }));
      return { posts };
    }

    // Facebook
    const res = await fetch(
      `${GRAPH}/${args.pageId}/posts?` +
        new URLSearchParams({
          fields:
            'id,message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)',
          limit,
          access_token: token,
        }).toString(),
    );
    const data = await res.json();
    if (!res.ok) return { posts: [], error: data?.error?.message };
    const posts: GraphPost[] = (data.data ?? []).map((p: any) => ({
      id: p.id,
      message: p.message,
      createdTime: p.created_time,
      imageUrl: p.full_picture,
      permalink: p.permalink_url,
      likeCount: p.likes?.summary?.total_count,
      commentCount: p.comments?.summary?.total_count,
      shareCount: p.shares?.count,
    }));
    return { posts };
  },
});

/** Comentarios de una publicación (post de FB o media de IG). */
export const listComments = action({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    objectId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ comments: GraphComment[]; error?: string }> => {
    const conn = await ctx.runQuery(
      internal.metaChannels.getConnectionByPageId,
      { pageId: args.pageId },
    );
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { comments: [], error: 'Página no conectada' };
    }
    const token = conn.pageAccessToken;
    const limit = String(args.limit ?? 50);

    if (args.provider === 'instagram') {
      const res = await fetch(
        `${GRAPH}/${args.objectId}/comments?` +
          new URLSearchParams({
            fields: 'id,text,username,timestamp,like_count,replies',
            limit,
            access_token: token,
          }).toString(),
      );
      const data = await res.json();
      if (!res.ok) return { comments: [], error: data?.error?.message };
      const comments: GraphComment[] = (data.data ?? []).map((c: any) => ({
        id: c.id,
        text: c.text,
        fromName: c.username,
        createdTime: c.timestamp,
        likeCount: c.like_count,
        replyCount: c.replies?.data?.length,
      }));
      return { comments };
    }

    const res = await fetch(
      `${GRAPH}/${args.objectId}/comments?` +
        new URLSearchParams({
          fields:
            'id,message,from,created_time,like_count,comment_count,parent',
          order: 'reverse_chronological',
          limit,
          access_token: token,
        }).toString(),
    );
    const data = await res.json();
    if (!res.ok) return { comments: [], error: data?.error?.message };
    const comments: GraphComment[] = (data.data ?? []).map((c: any) => ({
      id: c.id,
      text: c.message,
      fromId: c.from?.id,
      fromName: c.from?.name,
      createdTime: c.created_time,
      likeCount: c.like_count,
      replyCount: c.comment_count,
      parentId: c.parent?.id,
    }));
    return { comments };
  },
});

/** Responde a un comentario (FB o IG). */
export const replyToComment = action({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    commentId: v.string(),
    message: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; id?: string; error?: string }> => {
    const text = args.message.trim();
    if (!text) return { ok: false, error: 'Mensaje vacío' };
    const conn = await ctx.runQuery(
      internal.metaChannels.getConnectionByPageId,
      { pageId: args.pageId },
    );
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { ok: false, error: 'Página no conectada' };
    }
    const token = conn.pageAccessToken;

    // IG: /{comment-id}/replies ; FB: /{comment-id}/comments
    const edge = args.provider === 'instagram' ? 'replies' : 'comments';
    const res = await fetch(`${GRAPH}/${args.commentId}/${edge}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message: text, access_token: token }).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || 'Error al responder' };
    }
    return { ok: true, id: data.id };
  },
});
