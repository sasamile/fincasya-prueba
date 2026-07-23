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
import type { Doc } from './_generated/dataModel';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Permisos mínimos de Pages para CRM: leer/gestionar comentarios y metadata.
// pages_manage_posts e Instagram/Messaging se habilitan vía META_ENABLE_* una
// vez que estén aprobados en App Review.
const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_manage_metadata',
  'pages_read_user_content',
];
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_manage_comments',
];
const MESSAGING_SCOPES = ['pages_messaging', 'instagram_manage_messages'];
const SCOPES = [
  ...FACEBOOK_SCOPES,
  ...(process.env.META_ENABLE_INSTAGRAM === '1' ? INSTAGRAM_SCOPES : []),
  ...(process.env.META_ENABLE_MESSAGING === '1' ? MESSAGING_SCOPES : []),
];

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
  insights?: {
    views?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saved?: number;
    totalInteractions?: number;
    impressions?: number;
    engagedUsers?: number;
    insightsAvailable?: boolean;
    insightsError?: string;
  };
};

function insightMetricValue(metric: {
  values?: { value?: number }[];
  total_value?: { value?: number };
}): number | undefined {
  const raw = metric.values?.[0]?.value ?? metric.total_value?.value;
  return typeof raw === 'number' ? raw : undefined;
}

async function fetchInstagramMediaInsights(
  mediaId: string,
  mediaType: string | undefined,
  token: string,
): Promise<GraphPost['insights']> {
  const metrics =
    mediaType === 'REELS' || mediaType === 'VIDEO'
      ? 'views,reach,likes,comments,shares,saved,total_interactions'
      : 'views,reach,likes,comments,shares,saved,total_interactions';
  const res = await fetch(
    `${GRAPH}/${mediaId}/insights?` +
      new URLSearchParams({ metric: metrics, access_token: token }).toString(),
  );
  const data = await res.json();
  if (!res.ok) {
    return {
      insightsAvailable: false,
      insightsError: data?.error?.message || 'Sin permisos de insights',
    };
  }
  const map: Record<string, number | undefined> = {};
  for (const row of data.data ?? []) {
    map[row.name] = insightMetricValue(row);
  }
  return {
    insightsAvailable: true,
    views: map.views,
    reach: map.reach,
    likes: map.likes,
    comments: map.comments,
    shares: map.shares,
    saved: map.saved,
    totalInteractions: map.total_interactions,
  };
}

async function fetchFacebookPostInsights(
  postId: string,
  token: string,
): Promise<GraphPost['insights']> {
  const res = await fetch(
    `${GRAPH}/${postId}/insights?` +
      new URLSearchParams({
        metric: 'post_impressions,post_impressions_unique,post_engaged_users',
        access_token: token,
      }).toString(),
  );
  const data = await res.json();
  if (!res.ok) {
    return {
      insightsAvailable: false,
      insightsError: data?.error?.message || 'Sin permisos de insights',
    };
  }
  const map: Record<string, number | undefined> = {};
  for (const row of data.data ?? []) {
    map[row.name] = insightMetricValue(row);
  }
  return {
    insightsAvailable: true,
    impressions: map.post_impressions,
    reach: map.post_impressions_unique,
    engagedUsers: map.post_engaged_users,
  };
}

async function enrichPostsWithInsights(
  posts: GraphPost[],
  provider: 'facebook' | 'instagram',
  token: string,
): Promise<GraphPost[]> {
  const enriched = await Promise.all(
    posts.map(async (post) => {
      try {
        const insights =
          provider === 'instagram'
            ? await fetchInstagramMediaInsights(post.id, post.mediaType, token)
            : await fetchFacebookPostInsights(post.id, token);
        return { ...post, insights };
      } catch {
        return {
          ...post,
          insights: {
            insightsAvailable: false,
            insightsError: 'No se pudieron cargar métricas',
          },
        };
      }
    }),
  );
  return enriched;
}

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

type MetaAvatarPlatform = 'messenger' | 'instagram' | 'facebook';

/** Foto de perfil fresca desde Graph (las URLs guardadas en BD caducan). */
async function fetchParticipantPictureUrl(
  participantId: string,
  platform: MetaAvatarPlatform,
  token: string,
): Promise<string | undefined> {
  if (platform === 'instagram') {
    const res = await fetch(
      `${GRAPH}/${participantId}?` +
        new URLSearchParams({
          fields: 'profile_pic',
          access_token: token,
        }).toString(),
    );
    const data = (await res.json()) as { profile_pic?: string; error?: { message?: string } };
    if (!res.ok) return undefined;
    return data.profile_pic || undefined;
  }

  const pictureRes = await fetch(
    `${GRAPH}/${participantId}/picture?` +
      new URLSearchParams({
        redirect: '0',
        type: 'large',
        access_token: token,
      }).toString(),
  );
  const pictureData = (await pictureRes.json()) as {
    data?: { url?: string; is_silhouette?: boolean };
    error?: { message?: string };
  };
  if (pictureRes.ok && pictureData.data?.url && !pictureData.data.is_silhouette) {
    return pictureData.data.url;
  }

  const profileRes = await fetch(
    `${GRAPH}/${participantId}?` +
      new URLSearchParams({
        fields: 'profile_pic,picture',
        access_token: token,
      }).toString(),
  );
  const profileData = (await profileRes.json()) as {
    profile_pic?: string;
    picture?: { data?: { url?: string } };
    error?: { message?: string };
  };
  if (!profileRes.ok) return undefined;
  return profileData.profile_pic || profileData.picture?.data?.url || undefined;
}

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
        autoReplyComments: (() => {
          if (!r.autoReplyComments) return false;
          const mode = r.autoReplyMode ?? 'template';
          if (mode === 'bot') {
            return Boolean(r.autoReplyInstructions?.trim());
          }
          const tpls = r.commentTemplates ?? [];
          if (tpls.length === 0 || !r.autoReplyTemplateId) return false;
          return tpls.some((t) => t.id === r.autoReplyTemplateId);
        })(),
        autoReplyMessage: r.autoReplyMessage,
        autoReplyTemplateId: r.autoReplyTemplateId,
        autoReplyInstructions: r.autoReplyInstructions,
        autoReplyMode: r.autoReplyMode ?? 'template',
        commentTemplates: r.commentTemplates ?? [],
        dmTemplates: r.dmTemplates ?? [],
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

/**
 * Vincula manualmente una cuenta de Instagram Business a una conexión de Página.
 * Útil cuando el IG está en Business Manager pero no es `instagram_business_account`
 * directo de la Página (caso Zyntek: @zyntek.sas, ID 17841414954304996).
 */
export const linkInstagramAccount = mutation({
  args: {
    pageId: v.string(),
    igUserId: v.string(),
    igUsername: v.optional(v.string()),
    igPictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    if (!row) throw new Error('Página no encontrada');
    await ctx.db.patch(row._id, {
      igUserId: args.igUserId,
      igUsername: args.igUsername,
      igPictureUrl: args.igPictureUrl,
      updatedAt: Date.now(),
    });
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
    const eventId = await ctx.db.insert('metaWebhookEvents', {
      ...args,
      handled: false,
      receivedAt: Date.now(),
    });

    const isNewComment =
      args.commentId &&
      args.pageId &&
      (args.field === 'comments' || args.field === 'feed') &&
      (args.verb === 'add' || args.verb === undefined);

    if (isNewComment && args.fromId && args.text?.trim()) {
      await ctx.scheduler.runAfter(0, internal.metaChannels.maybeAutoReplyComment, {
        pageId: args.pageId!,
        provider: args.provider,
        commentId: args.commentId!,
        fromId: args.fromId,
        text: args.text,
      });
    }

    return eventId;
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

    const PAGE_FIELDS =
      'id,name,access_token,category,picture{url},instagram_business_account{id,username,profile_picture_url}';

    // 3. Listar Páginas — tres niveles de fallback para cubrir todos los tipos de app Meta.
    // Nivel A: /me/accounts — funciona con Facebook Login clásico (admin directo).
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({ fields: PAGE_FIELDS, limit: '100', access_token: userToken }).toString(),
    );
    const pagesData = await pagesRes.json();
    let pages: any[] = pagesRes.ok ? (pagesData.data ?? []) : [];
    if (!pagesRes.ok) {
      console.warn('[meta] /me/accounts falló (error', pagesData?.error?.code, ')— intentando fallbacks');
    }

    if (pages.length === 0) {
      // Nivel B: /me?fields=accounts — alternativa para algunos tipos de app.
      const meRes = await fetch(
        `${GRAPH}/me?` +
          new URLSearchParams({
            fields: `accounts{${PAGE_FIELDS}}`,
            access_token: userToken,
          }).toString(),
      );
      const meData = await meRes.json();
      pages = meData?.accounts?.data ?? [];
      if (pages.length > 0) console.log('[meta] páginas obtenidas vía /me?fields=accounts:', pages.length);
    }

    if (pages.length === 0) {
      // Nivel C: debug_token.granular_scopes — funciona con tokens FLoB/Business.
      const appToken = `${appId}|${appSecret}`;
      const debugRes = await fetch(
        `${GRAPH}/debug_token?` +
          new URLSearchParams({ input_token: userToken, access_token: appToken }).toString(),
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
      if (pageIdsFromScopes.size > 0) {
        const directPages = await Promise.all(
          [...pageIdsFromScopes].map(async (pageId) => {
            const r = await fetch(
              `${GRAPH}/${pageId}?` +
                new URLSearchParams({ fields: PAGE_FIELDS, access_token: userToken }).toString(),
            );
            return r.ok ? r.json() : null;
          }),
        );
        pages = directPages.filter(Boolean).filter((p: any) => p.access_token);
        if (pages.length > 0) console.log('[meta] páginas obtenidas vía debug_token:', pages.length);
      } else {
        console.warn('[meta] debug_token no devolvió page_ids. granularScopes:', JSON.stringify(granularScopes));
        throw new Error(
          'No se encontraron páginas de Facebook asociadas a esta cuenta. ' +
          'Asegúrate de ser Administrador de la Página en Facebook.',
        );
      }
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

    // Registrar la suscripción de la app (object=page + object=instagram) para
    // que los DMs de Messenger e Instagram lleguen por webhook en tiempo real.
    // Es global e idempotente; se auto-repara en cada (re)conexión.
    if (saved.length > 0) {
      try {
        await ctx.runAction(api.metaChannels.registerAppWebhook, {});
      } catch (e) {
        console.error('[meta] registerAppWebhook en connect falló', e);
      }
    }

    return { ok: true, connected: saved.length, pages: saved };
  },
});

/**
 * Reintenta la suscripción al webhook para una Página ya conectada.
 * El admin lo llama desde la UI cuando el webhook estaba pendiente.
 */

/**
 * Refresca los datos de una Página (foto, Instagram vinculado) usando el
 * Page Access Token ya guardado. Útil cuando se vincula un Instagram Business
 * Account a la página DESPUÉS de la primera conexión OAuth.
 */
export const refreshPageData = action({
  args: { pageId: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; igUsername?: string }> => {
    const conn: {
      pageAccessToken: string;
      connected: boolean;
    } | null = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      throw new Error('Página no conectada');
    }
    const res = await fetch(
      `${GRAPH}/${args.pageId}?` +
        new URLSearchParams({
          fields:
            'id,name,category,picture{url},instagram_business_account{id,username,profile_picture_url}',
          access_token: conn.pageAccessToken,
        }).toString(),
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Error al consultar la página');
    }
    const ig = data?.instagram_business_account;
    await ctx.runMutation(api.metaChannels.upsertConnection, {
      pageId: data.id,
      pageName: data.name,
      pageAccessToken: conn.pageAccessToken,
      category: data.category,
      pictureUrl: data.picture?.data?.url,
      igUserId: ig?.id,
      igUsername: ig?.username,
      igPictureUrl: ig?.profile_picture_url,
    });
    return { ok: true, igUsername: ig?.username };
  },
});

/**
 * Registra la URL del webhook de la app con Meta via Graph API.
 * Necesita hacerse UNA VEZ antes de que las páginas puedan suscribirse.
 * POST /{app-id}/subscriptions con el App Access Token.
 */
export const registerAppWebhook = action({
  args: {},
  handler: async (_ctx, _args): Promise<{ ok: boolean; error?: string }> => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!appId || !appSecret || !verifyToken) {
      throw new Error('Faltan META_APP_ID, META_APP_SECRET o META_WEBHOOK_VERIFY_TOKEN');
    }
    const callbackUrl = `https://modest-husky-871.convex.site/meta/webhook`;
    const appToken = `${appId}|${appSecret}`;

    const res = await fetch(`${GRAPH}/${appId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        object: 'page',
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields: 'feed,mention,messages,messaging_postbacks',
        access_token: appToken,
      }).toString(),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      const err = data?.error?.message || JSON.stringify(data);
      console.error('[meta] registerAppWebhook falló:', err);
      return { ok: false, error: err };
    }

    // object=instagram: entrega los DMs de Instagram en tiempo real. Sin esta
    // suscripción los DMs de IG solo llegan por el poll de syncDmInbox (lento).
    const igRes = await fetch(`${GRAPH}/${appId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        object: 'instagram',
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields: 'messages,messaging_postbacks,comments,mentions',
        access_token: appToken,
      }).toString(),
    });
    const igData = await igRes.json();
    if (!igRes.ok || igData.success === false) {
      console.warn(
        '[meta] registerAppWebhook instagram (best-effort):',
        igData?.error?.message ?? JSON.stringify(igData),
      );
    } else {
      console.log('[meta] webhook instagram registrado OK');
    }

    console.log('[meta] webhook app registrado OK:', JSON.stringify(data));
    return { ok: true };
  },
});

export const retryWebhookSubscription = action({
  args: { pageId: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; data?: unknown; error?: string }> => {
    const conn: { connected: boolean; pageAccessToken: string } | null =
      await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
        pageId: args.pageId,
      });
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      throw new Error('Página no conectada');
    }
    // 1. Registrar el webhook de la app con Meta (idempotente).
    const reg: { ok: boolean; error?: string } =
      await ctx.runAction(api.metaChannels.registerAppWebhook, {});
    if (!reg.ok) {
      return { ok: false, error: reg.error };
    }
    // 2. Suscribir la página al webhook.
    const result: { ok: boolean; data?: unknown; error?: string } =
      await ctx.runAction(internal.metaChannels.subscribePageWebhook, {
        pageId: args.pageId,
        pageAccessToken: conn.pageAccessToken,
      });
    return result;
  },
});

/** Suscribe una Página a los campos del webhook de la app. */
export const subscribePageWebhook = internalAction({
  args: { pageId: v.string(), pageAccessToken: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> => {
    const conn: { igUserId?: string } | null = await ctx.runQuery(
      internal.metaChannels.getConnectionByPageId,
      { pageId: args.pageId },
    );
    const messagingEnabled =
      process.env.META_ENABLE_MESSAGING === '1' || !!conn?.igUserId;
    const subscribedFields: string = messagingEnabled
      ? 'feed,mention,messages,messaging_postbacks'
      : 'feed,mention';
    const res = await fetch(
      `${GRAPH}/${args.pageId}/subscribed_apps?` +
        new URLSearchParams({
          subscribed_fields: subscribedFields,
          access_token: args.pageAccessToken,
        }).toString(),
      { method: 'POST' },
    );
    const data = await res.json();
    const ok = res.ok && data.success !== false;
    if (!ok) {
      console.error('[meta] subscribed_apps falló', args.pageId, JSON.stringify(data));
    }
    await ctx.runMutation(api.metaChannels.setWebhookSubscribed, {
      pageId: args.pageId,
      subscribed: ok,
    });
    const errorMsg: string | undefined = ok
      ? undefined
      : (data?.error?.message ?? JSON.stringify(data));
    return { ok, data, error: errorMsg };
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
      return { posts: await enrichPostsWithInsights(posts, 'instagram', token) };
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
    return { posts: await enrichPostsWithInsights(posts, 'facebook', token) };
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
            fields:
              'id,text,username,timestamp,from{id,username},like_count,replies.summary(true)',
            limit,
            access_token: token,
          }).toString(),
      );
      const data = await res.json();
      if (!res.ok) return { comments: [], error: data?.error?.message };
      const comments: GraphComment[] = (data.data ?? []).map((c: any) => ({
        id: c.id,
        text: c.text,
        fromId: c.from?.id,
        fromName: c.username ?? c.from?.username,
        createdTime: c.timestamp,
        likeCount: c.like_count,
        replyCount: c.replies?.summary?.total_count ?? c.replies?.data?.length,
      }));
      return { comments };
    }

    const res = await fetch(
      `${GRAPH}/${args.objectId}/comments?` +
        new URLSearchParams({
          fields:
            'id,message,from{id,name,picture},created_time,like_count,comment_count,parent',
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

/** Crea una publicación en Facebook o Instagram. */
export const createPost = action({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    message: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; postId?: string; error?: string }> => {
    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, { pageId: args.pageId });
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { ok: false, error: 'Página no conectada' };
    }
    const token = conn.pageAccessToken;
    const text = args.message.trim();

    if (args.provider === 'facebook') {
      if (args.videoUrl) {
        const res = await fetch(`${GRAPH}/${args.pageId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            file_url: args.videoUrl,
            description: text,
            access_token: token,
          }).toString(),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data?.error?.message || 'Error al publicar video' };
        return { ok: true, postId: data.id };
      }
      if (args.imageUrl) {
        const res = await fetch(`${GRAPH}/${args.pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ caption: text, url: args.imageUrl, published: 'true', access_token: token }).toString(),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data?.error?.message || 'Error al publicar foto' };
        return { ok: true, postId: data.post_id || data.id };
      }
      const res = await fetch(`${GRAPH}/${args.pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message: text, access_token: token }).toString(),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data?.error?.message || 'Error al publicar' };
      return { ok: true, postId: data.id };
    }

    // Instagram: requiere imagen o video
    if (!conn.igUserId) return { ok: false, error: 'Sin cuenta de Instagram vinculada' };
    if (!args.imageUrl && !args.videoUrl) {
      return { ok: false, error: 'Instagram requiere una imagen o video para publicar' };
    }

    const igMediaParams: Record<string, string> = {
      caption: text,
      access_token: token,
    };
    if (args.videoUrl) {
      igMediaParams.video_url = args.videoUrl;
      igMediaParams.media_type = 'VIDEO';
    } else if (args.imageUrl) {
      igMediaParams.image_url = args.imageUrl;
    }

    const mediaRes = await fetch(`${GRAPH}/${conn.igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(igMediaParams).toString(),
    });
    const mediaData = await mediaRes.json();
    if (!mediaRes.ok) return { ok: false, error: mediaData?.error?.message || 'Error al crear media' };
    const publishRes = await fetch(`${GRAPH}/${conn.igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: mediaData.id, access_token: token }).toString(),
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok) return { ok: false, error: publishData?.error?.message || 'Error al publicar' };
    return { ok: true, postId: publishData.id };
  },
});

/** Responde a un comentario (FB o IG). */
export const replyToComment = action({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    commentId: v.string(),
    message: v.string(),
    auto: v.optional(v.boolean()),
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

    await ctx.runMutation(internal.metaChannels.recordCommentReply, {
      pageId: args.pageId,
      provider: args.provider,
      commentId: args.commentId,
      replyText: text,
      auto: args.auto ?? false,
    });

    return { ok: true, id: data.id };
  },
});

type GraphCommentReply = {
  id: string;
  text?: string;
  fromId?: string;
  fromName?: string;
  createdTime?: string;
  isPageAuthor?: boolean;
  fromOurRecord?: boolean;
  auto?: boolean;
};

/** Respuestas anidadas de un comentario (como en Instagram/Facebook). */
export const listCommentReplies = action({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    commentId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ replies: GraphCommentReply[]; error?: string }> => {
    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { replies: [], error: 'Página no conectada' };
    }
    const token = conn.pageAccessToken;
    const limit = String(args.limit ?? 25);
    const replies: GraphCommentReply[] = [];

    if (args.provider === 'instagram') {
      const res = await fetch(
        `${GRAPH}/${args.commentId}/replies?` +
          new URLSearchParams({
            fields: 'id,text,username,timestamp',
            limit,
            access_token: token,
          }).toString(),
      );
      const data = await res.json();
      if (!res.ok) return { replies: [], error: data?.error?.message };
      for (const c of data.data ?? []) {
        const fromName = c.username as string | undefined;
        replies.push({
          id: c.id,
          text: c.text,
          fromName,
          createdTime: c.timestamp,
          isPageAuthor:
            fromName === conn.igUsername ||
            fromName === conn.pageName ||
            fromName?.toLowerCase() === conn.igUsername?.toLowerCase(),
        });
      }
    } else {
      const res = await fetch(
        `${GRAPH}/${args.commentId}/comments?` +
          new URLSearchParams({
            fields: 'id,message,from,created_time',
            order: 'reverse_chronological',
            limit,
            access_token: token,
          }).toString(),
      );
      const data = await res.json();
      if (!res.ok) return { replies: [], error: data?.error?.message };
      for (const c of data.data ?? []) {
        const fromId = c.from?.id as string | undefined;
        const fromName = c.from?.name as string | undefined;
        replies.push({
          id: c.id,
          text: c.message,
          fromId,
          fromName,
          createdTime: c.created_time,
          isPageAuthor: fromId === conn.pageId || fromName === conn.pageName,
        });
      }
    }

    const recorded = await ctx.runQuery(internal.metaChannels.getCommentReply, {
      provider: args.provider,
      commentId: args.commentId,
    });
    if (recorded) {
      const alreadyInMeta = replies.some(
        (r) => r.text?.trim() === recorded.replyText.trim(),
      );
      if (!alreadyInMeta) {
        replies.unshift({
          id: `local:${args.commentId}`,
          text: recorded.replyText,
          fromName: conn.pageName,
          fromId: conn.pageId,
          createdTime: new Date(recorded.repliedAt).toISOString(),
          isPageAuthor: true,
          fromOurRecord: true,
          auto: recorded.auto,
        });
      }
    }

    replies.sort((a, b) => {
      const ta = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const tb = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      return ta - tb;
    });

    return { replies };
  },
});

type InboxComment = GraphComment & {
  provider: 'facebook' | 'instagram';
  postId: string;
  postPreview?: string;
  postImageUrl?: string;
  postPermalink?: string;
  reply?: {
    text: string;
    repliedAt: number;
    auto?: boolean;
    fromMeta?: boolean;
  };
};

/** Bandeja unificada: comentarios agrupados por publicación. */
export const listCommentInbox = action({
  args: {
    pageId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    groups: {
      postId: string;
      provider: 'facebook' | 'instagram';
      postPreview?: string;
      postImageUrl?: string;
      postPermalink?: string;
      comments: InboxComment[];
    }[];
    error?: string;
  }> => {
    const maxItems = args.limit ?? 80;
    const items: InboxComment[] = [];

    const [fbPosts, igPosts] = await Promise.all([
      ctx.runAction(api.metaChannels.listPosts, {
        pageId: args.pageId,
        provider: 'facebook',
        limit: 20,
      }),
      ctx.runAction(api.metaChannels.listPosts, {
        pageId: args.pageId,
        provider: 'instagram',
        limit: 20,
      }),
    ]);

    const errors = [fbPosts.error, igPosts.error].filter(Boolean);
    const candidates: { provider: 'facebook' | 'instagram'; post: GraphPost }[] = [];

    for (const post of fbPosts.posts ?? []) {
      if ((post.commentCount ?? 0) > 0) {
        candidates.push({ provider: 'facebook', post });
      }
    }
    for (const post of igPosts.posts ?? []) {
      if ((post.commentCount ?? 0) > 0) {
        candidates.push({ provider: 'instagram', post });
      }
    }

    candidates.sort(
      (a, b) => (b.post.commentCount ?? 0) - (a.post.commentCount ?? 0),
    );
    const topPosts = candidates.slice(0, 12);

    const batches = await Promise.all(
      topPosts.map(async ({ provider, post }) => {
        const res = await ctx.runAction(api.metaChannels.listComments, {
          pageId: args.pageId,
          provider,
          objectId: post.id,
          limit: 30,
        });
        return (res.comments ?? []).map(
          (comment: GraphComment): InboxComment => ({
            ...comment,
            provider,
            postId: post.id,
            postPreview: post.message,
            postImageUrl: post.imageUrl,
            postPermalink: post.permalink,
          }),
        );
      }),
    );

    for (const batch of batches) items.push(...batch);

    items.sort((a, b) => {
      const ta = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const tb = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      return tb - ta;
    });

    const sliced = items.slice(0, maxItems);

    const replyRows = await ctx.runQuery(
      internal.metaChannels.listCommentRepliesForPage,
      { pageId: args.pageId },
    );
    const replyByComment = new Map<string, Doc<'metaCommentReplies'>>(
      replyRows.map((r: Doc<'metaCommentReplies'>) => [
        `${r.provider}:${r.commentId}`,
        r,
      ]),
    );

    for (const item of sliced) {
      const key = `${item.provider}:${item.id}`;
      const recorded = replyByComment.get(key);
      if (recorded) {
        item.reply = {
          text: recorded.replyText,
          repliedAt: recorded.repliedAt,
          auto: recorded.auto,
        };
      } else if ((item.replyCount ?? 0) > 0) {
        item.reply = {
          text: 'Respuesta visible en la red social',
          repliedAt: 0,
          fromMeta: true,
        };
      }
    }

    const groupMap = new Map<
      string,
      {
        postId: string;
        provider: 'facebook' | 'instagram';
        postPreview?: string;
        postImageUrl?: string;
        postPermalink?: string;
        comments: InboxComment[];
      }
    >();

    for (const item of sliced) {
      const key = `${item.provider}:${item.postId}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.comments.push(item);
      } else {
        groupMap.set(key, {
          postId: item.postId,
          provider: item.provider,
          postPreview: item.postPreview,
          postImageUrl: item.postImageUrl,
          postPermalink: item.postPermalink,
          comments: [item],
        });
      }
    }

    const groups = [...groupMap.values()].sort((a, b) => {
      const ta = a.comments[0]?.createdTime
        ? new Date(a.comments[0].createdTime).getTime()
        : 0;
      const tb = b.comments[0]?.createdTime
        ? new Date(b.comments[0].createdTime).getTime()
        : 0;
      return tb - ta;
    });

    return {
      groups,
      error: errors[0],
    };
  },
});

/** Publica en Facebook e Instagram a la vez (IG requiere imagen). */
export const createCrossPost = action({
  args: {
    pageId: v.string(),
    message: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    publishFacebook: v.optional(v.boolean()),
    publishInstagram: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    facebook?: { ok: boolean; postId?: string; error?: string };
    instagram?: { ok: boolean; postId?: string; error?: string };
  }> => {
    const publishFacebook = args.publishFacebook !== false;
    const publishInstagram = args.publishInstagram !== false;
    const result: {
      facebook?: { ok: boolean; postId?: string; error?: string };
      instagram?: { ok: boolean; postId?: string; error?: string };
    } = {};

    if (publishFacebook) {
      result.facebook = await ctx.runAction(api.metaChannels.createPost, {
        pageId: args.pageId,
        provider: 'facebook',
        message: args.message,
        imageUrl: args.imageUrl,
        videoUrl: args.videoUrl,
      });
    }

    if (publishInstagram) {
      if (!args.imageUrl && !args.videoUrl) {
        result.instagram = {
          ok: false,
          error: 'Instagram requiere una imagen o video para publicar',
        };
      } else {
        result.instagram = await ctx.runAction(api.metaChannels.createPost, {
          pageId: args.pageId,
          provider: 'instagram',
          message: args.message,
          imageUrl: args.imageUrl,
          videoUrl: args.videoUrl,
        });
      }
    }

    return result;
  },
});

/** Tía sugiere respuestas para un comentario de red social. */
export const suggestCommentReply = action({
  args: {
    commentText: v.string(),
    fromName: v.optional(v.string()),
    postPreview: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ suggestions: string[]; error?: string }> => {
    try {
      const { chatCompletion } = await import('./lib/openai');
      const system = `Te llamas Naya y eres la asesora virtual de FincasYa.com, respondiendo comentarios públicos en Facebook o Instagram.
Genera exactamente 3 respuestas distintas, cortas (máximo 280 caracteres), cálidas, en español colombiano, tuteando al cliente.
Una puede invitar a WhatsApp https://wa.me/573157773937; otra puede pedir fechas y número de personas si preguntan precio o capacidad.
No uses markdown. Responde SOLO JSON válido: {"suggestions":["respuesta1","respuesta2","respuesta3"]}`;

      const user = `Comentario de ${args.fromName ?? 'un usuario'}: "${args.commentText.trim()}"
${args.postPreview ? `Publicación relacionada: ${args.postPreview.slice(0, 200)}` : ''}`;

      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.75,
      });

      const raw = (content ?? '').trim();
      const jsonText = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'));
      const parsed = JSON.parse(jsonText) as { suggestions?: unknown };
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
        : [];

      return { suggestions };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { suggestions: [], error: message };
    }
  },
});

// ============ MENSAJES DIRECTOS (Messenger + Instagram DM) ============

export const updateCommentAutoReply = mutation({
  args: {
    pageId: v.string(),
    enabled: v.boolean(),
    templateId: v.optional(v.string()),
    message: v.optional(v.string()),
    mode: v.optional(v.union(v.literal('template'), v.literal('bot'))),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    if (!row) throw new Error('Página no encontrada');

    const mode =
      args.mode ??
      row.autoReplyMode ??
      (args.instructions?.trim() ? 'bot' : 'template');
    const instructions =
      args.instructions !== undefined
        ? args.instructions.trim() || undefined
        : row.autoReplyInstructions;

    const templates = row.commentTemplates ?? [];
    let autoReplyMessage = args.message?.trim() || undefined;
    let autoReplyTemplateId = args.templateId ?? row.autoReplyTemplateId;

    if (args.enabled) {
      if (mode === 'bot') {
        if (!instructions) {
          throw new Error(
            'Escribe las instrucciones del bot antes de activar la auto-respuesta',
          );
        }
        autoReplyMessage = undefined;
        autoReplyTemplateId = undefined;
      } else {
        if (templates.length === 0) {
          throw new Error(
            'Crea al menos una plantilla antes de activar la respuesta automática',
          );
        }
        const tpl =
          templates.find((t) => t.id === args.templateId) ??
          templates.find((t) => t.id === autoReplyTemplateId) ??
          templates[0];
        if (!tpl) throw new Error('Plantilla no encontrada');
        autoReplyMessage = tpl.text;
        autoReplyTemplateId = tpl.id;
      }
    } else {
      autoReplyTemplateId = undefined;
      autoReplyMessage = undefined;
    }

    await ctx.db.patch(row._id, {
      autoReplyComments: args.enabled,
      autoReplyMessage,
      autoReplyTemplateId,
      autoReplyMode: mode,
      autoReplyInstructions: instructions,
      updatedAt: Date.now(),
    });
  },
});

export const saveCommentTemplates = mutation({
  args: {
    pageId: v.string(),
    templates: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        text: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    if (!row) throw new Error('Página no encontrada');

    const templates = args.templates.map((t) => ({
      id: t.id.trim(),
      label: t.label.trim(),
      text: t.text.trim(),
    }));

    for (const t of templates) {
      if (!t.id || !t.label || !t.text) {
        throw new Error('Cada plantilla necesita nombre y texto');
      }
    }

    const patch: {
      commentTemplates: typeof templates;
      updatedAt: number;
      autoReplyTemplateId?: string;
      autoReplyMessage?: string;
      autoReplyComments?: boolean;
    } = {
      commentTemplates: templates,
      updatedAt: Date.now(),
    };

    const currentTplId = row.autoReplyTemplateId;
    const mode = row.autoReplyMode ?? 'template';
    if (
      mode === 'template' &&
      currentTplId &&
      !templates.some((t) => t.id === currentTplId)
    ) {
      patch.autoReplyTemplateId = undefined;
      patch.autoReplyMessage = undefined;
      patch.autoReplyComments = false;
    }

    await ctx.db.patch(row._id, patch);
  },
});

export const saveDmTemplates = mutation({
  args: {
    pageId: v.string(),
    templates: v.array(
      v.object({
        id: v.string(),
        shortcut: v.string(),
        text: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaChannelConnections')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .first();
    if (!row) throw new Error('Página no encontrada');

    const templates = args.templates.map((t) => ({
      id: t.id.trim(),
      shortcut: t.shortcut.trim().toLowerCase(),
      text: t.text.trim(),
    }));

    const shortcuts = new Set<string>();
    for (const t of templates) {
      if (!t.id || !t.shortcut || !t.text) {
        throw new Error('Cada respuesta necesita atajo y mensaje');
      }
      if (t.shortcut.length < 3) {
        throw new Error('El método abreviado debe tener al menos 3 caracteres');
      }
      if (t.text.length > 1000) {
        throw new Error('El mensaje no puede superar 1000 caracteres');
      }
      if (shortcuts.has(t.shortcut)) {
        throw new Error(`El atajo "${t.shortcut}" ya existe`);
      }
      shortcuts.add(t.shortcut);
    }

    await ctx.db.patch(row._id, {
      dmTemplates: templates,
      updatedAt: Date.now(),
    });
  },
});

export const listCommentRepliesForPage = internalQuery({
  args: { pageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('metaCommentReplies')
      .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
      .collect();
  },
});

export const recordCommentReply = internalMutation({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    commentId: v.string(),
    replyText: v.string(),
    auto: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('metaCommentReplies')
      .withIndex('by_comment', (q) =>
        q.eq('provider', args.provider).eq('commentId', args.commentId),
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        replyText: args.replyText,
        repliedAt: now,
        auto: args.auto ?? existing.auto,
      });
      return;
    }

    await ctx.db.insert('metaCommentReplies', {
      pageId: args.pageId,
      provider: args.provider,
      commentId: args.commentId,
      replyText: args.replyText,
      repliedAt: now,
      auto: args.auto,
    });
  },
});

export const markDmThreadRead = mutation({
  args: { threadId: v.id('metaDmThreads') },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return;
    await ctx.db.patch(args.threadId, {
      lastReadAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Responde automáticamente a un comentario nuevo si está habilitado. */
export const maybeAutoReplyComment = internalAction({
  args: {
    pageId: v.string(),
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    commentId: v.string(),
    fromId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn?.connected || !conn.autoReplyComments) return;
    if (args.fromId === args.pageId || args.fromId === conn.igUserId) return;

    const existing = await ctx.runQuery(internal.metaChannels.getCommentReply, {
      provider: args.provider,
      commentId: args.commentId,
    });
    if (existing) return;

    const mode = conn.autoReplyMode ?? 'template';
    let message = '';

    if (mode === 'bot') {
      const instructions = conn.autoReplyInstructions?.trim();
      if (!instructions) return;
      try {
        const { chatCompletion } = await import('./lib/openai');
        const system = `Eres el bot de comentarios de FincasYa.com en Facebook/Instagram.
Sigue estas instrucciones del operador al pie de la letra para redactar UNA sola respuesta al comentario:

---
${instructions}
---

Reglas fijas:
- Responde en español colombiano, tono cálido y profesional.
- Máximo 280 caracteres.
- No uses markdown ni JSON; solo el texto de la respuesta.
- No inventes precios, disponibilidades ni promesas que no estén en las instrucciones.`;

        const { content } = await chatCompletion({
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `Comentario recibido: "${args.text.trim().slice(0, 500)}"`,
            },
          ],
          temperature: 0.7,
        });
        message = (content ?? '').trim().replace(/^["']|["']$/g, '');
      } catch {
        return;
      }
    } else {
      const tpls = conn.commentTemplates ?? [];
      if (!conn.autoReplyTemplateId) return;
      const tpl = tpls.find(
        (t: { id: string; text: string; label: string }) =>
          t.id === conn.autoReplyTemplateId,
      );
      if (!tpl?.text?.trim()) return;
      message = tpl.text.trim();
    }

    if (!message) return;

    await ctx.runAction(api.metaChannels.replyToComment, {
      pageId: args.pageId,
      provider: args.provider,
      commentId: args.commentId,
      message,
      auto: true,
    });
  },
});

export const getCommentReply = internalQuery({
  args: {
    provider: v.union(v.literal('facebook'), v.literal('instagram')),
    commentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('metaCommentReplies')
      .withIndex('by_comment', (q) =>
        q.eq('provider', args.provider).eq('commentId', args.commentId),
      )
      .first();
  },
});

export const patchDmParticipant = internalMutation({
  args: {
    pageId: v.string(),
    platform: v.union(v.literal('messenger'), v.literal('instagram')),
    participantId: v.string(),
    participantName: v.optional(v.string()),
    participantPictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('metaDmThreads')
      .withIndex('by_page_platform_participant', (q) =>
        q
          .eq('pageId', args.pageId)
          .eq('platform', args.platform)
          .eq('participantId', args.participantId),
      )
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, {
      participantName: args.participantName ?? row.participantName,
      participantPictureUrl: args.participantPictureUrl ?? row.participantPictureUrl,
      updatedAt: Date.now(),
    });
  },
});

/** Resuelve la URL de avatar en tiempo real (para proxy del panel admin). */
export const resolveParticipantAvatar = action({
  args: {
    pageId: v.string(),
    participantId: v.string(),
    platform: v.union(
      v.literal('messenger'),
      v.literal('instagram'),
      v.literal('facebook'),
    ),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn?.connected || !conn.pageAccessToken) {
      return { url: null as string | null };
    }
    const url = await fetchParticipantPictureUrl(
      args.participantId,
      args.platform,
      conn.pageAccessToken,
    );
    return { url: url ?? null };
  },
});

/** Obtiene nombre y foto del participante desde Meta Graph. */
export const enrichDmParticipant = internalAction({
  args: {
    pageId: v.string(),
    platform: v.union(v.literal('messenger'), v.literal('instagram')),
    participantId: v.string(),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn?.connected || !conn.pageAccessToken) return;

    const fields =
      args.platform === 'instagram'
        ? 'name,username,profile_pic'
        : 'first_name,last_name,name,profile_pic,picture';
    const res = await fetch(
      `${GRAPH}/${args.participantId}?` +
        new URLSearchParams({
          fields,
          access_token: conn.pageAccessToken,
        }).toString(),
    );
    const data = (await res.json()) as {
      name?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
      profile_pic?: string;
      picture?: { data?: { url?: string } };
      error?: { message?: string };
    };

    const name =
      data.name ||
      data.username ||
      [data.first_name, data.last_name].filter(Boolean).join(' ') ||
      undefined;
    const picture =
      (res.ok
        ? data.profile_pic || data.picture?.data?.url
        : undefined) ||
      (await fetchParticipantPictureUrl(
        args.participantId,
        args.platform,
        conn.pageAccessToken,
      ));

    if (!name && !picture) return;

    await ctx.runMutation(internal.metaChannels.patchDmParticipant, {
      pageId: args.pageId,
      platform: args.platform,
      participantId: args.participantId,
      participantName: name,
      participantPictureUrl: picture,
    });
  },
});

export const getDmThread = internalQuery({
  args: { threadId: v.id('metaDmThreads') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

function dmOwnParticipantIds(pageId: string, igUserId?: string | null): Set<string> {
  return new Set([pageId, igUserId].filter((id): id is string => Boolean(id)));
}

function pickDmParticipant(
  participants: { id?: string; name?: string }[],
  ownIds: Set<string>,
): { id?: string; name?: string } | undefined {
  return participants.find((p) => p.id && !ownIds.has(p.id));
}

async function fetchConversationParticipantId(
  conversationId: string,
  token: string,
  ownIds: Set<string>,
): Promise<string | null> {
  const res = await fetch(
    `${GRAPH}/${conversationId}?` +
      new URLSearchParams({
        fields: 'participants',
        access_token: token,
      }).toString(),
  );
  const data = (await res.json()) as {
    participants?: { data?: { id?: string }[] };
    error?: { message?: string };
  };
  if (!res.ok) return null;
  const participant = pickDmParticipant(data.participants?.data ?? [], ownIds);
  return participant?.id ?? null;
}

function dmPreviewText(
  text?: string,
  attachmentType?: 'image' | 'audio' | 'video' | 'file',
): string | undefined {
  if (text?.trim()) return text.trim();
  if (attachmentType === 'image') return '📷 Foto';
  if (attachmentType === 'audio') return '🎤 Audio';
  if (attachmentType === 'video') return '🎬 Video';
  if (attachmentType === 'file') return '📎 Archivo';
  return undefined;
}

/** Guarda un mensaje entrante (webhook) o saliente (envío desde CRM). */
export const ingestDmMessage = internalMutation({
  args: {
    pageId: v.string(),
    platform: v.union(v.literal('messenger'), v.literal('instagram')),
    participantId: v.string(),
    participantName: v.optional(v.string()),
    participantPictureUrl: v.optional(v.string()),
    metaConversationId: v.optional(v.string()),
    metaMessageId: v.optional(v.string()),
    direction: v.union(v.literal('inbound'), v.literal('outbound')),
    text: v.optional(v.string()),
    attachmentType: v.optional(
      v.union(
        v.literal('image'),
        v.literal('audio'),
        v.literal('video'),
        v.literal('file'),
      ),
    ),
    attachmentUrl: v.optional(v.string()),
    fromId: v.optional(v.string()),
    fromName: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.metaMessageId) {
      const dup = await ctx.db
        .query('metaDmMessages')
        .withIndex('by_meta_message', (q) => q.eq('metaMessageId', args.metaMessageId))
        .first();
      if (dup) return { threadId: dup.threadId, skipped: true as const };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('metaDmThreads')
      .withIndex('by_page_platform_participant', (q) =>
        q
          .eq('pageId', args.pageId)
          .eq('platform', args.platform)
          .eq('participantId', args.participantId),
      )
      .first();

    let threadId = existing?._id;
    const preview = dmPreviewText(args.text, args.attachmentType);
    if (existing) {
      await ctx.db.patch(existing._id, {
        participantName: args.participantName ?? existing.participantName,
        participantPictureUrl:
          args.participantPictureUrl ?? existing.participantPictureUrl,
        metaConversationId: args.metaConversationId ?? existing.metaConversationId,
        lastMessageText: preview ?? existing.lastMessageText,
        lastMessageAt: args.createdAt,
        updatedAt: now,
      });
    } else {
      threadId = await ctx.db.insert('metaDmThreads', {
        pageId: args.pageId,
        platform: args.platform,
        metaConversationId: args.metaConversationId,
        participantId: args.participantId,
        participantName: args.participantName,
        participantPictureUrl: args.participantPictureUrl,
        lastMessageText: preview,
        lastMessageAt: args.createdAt,
        updatedAt: now,
      });
    }

    if (!threadId) throw new Error('No se pudo crear el hilo');

    if (args.direction === 'inbound' && args.fromId && args.fromId !== args.pageId) {
      const conn = await ctx.db
        .query('metaChannelConnections')
        .withIndex('by_page', (q) => q.eq('pageId', args.pageId))
        .first();
      const ownIds = dmOwnParticipantIds(args.pageId, conn?.igUserId);
      if (!ownIds.has(args.fromId)) {
        await ctx.db.patch(threadId, {
          participantId: args.fromId,
          participantName:
            args.fromName ?? args.participantName ?? existing?.participantName,
          updatedAt: now,
        });
      }
    }

    await ctx.db.insert('metaDmMessages', {
      threadId,
      pageId: args.pageId,
      metaMessageId: args.metaMessageId,
      direction: args.direction,
      text: args.text,
      attachmentType: args.attachmentType,
      attachmentUrl: args.attachmentUrl,
      fromId: args.fromId,
      fromName: args.fromName,
      createdAt: args.createdAt,
    });

    if (args.direction === 'inbound') {
      await ctx.scheduler.runAfter(0, internal.metaChannels.enrichDmParticipant, {
        pageId: args.pageId,
        platform: args.platform,
        participantId: args.participantId,
      });
    }

    return { threadId, skipped: false as const };
  },
});

/**
 * Borra UN hilo de DM social (Instagram/Messenger) y todos sus mensajes.
 * Operación por conversación (no masiva); reutilizable por un botón "Eliminar
 * conversación" en la bandeja social.
 */
export const deleteDmThread = internalMutation({
  args: { threadId: v.id('metaDmThreads') },
  handler: async (ctx, { threadId }) => {
    const msgs = await ctx.db
      .query('metaDmMessages')
      .filter((q) => q.eq(q.field('threadId'), threadId))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    const thread = await ctx.db.get(threadId);
    if (thread) await ctx.db.delete(threadId);
    return { deleted: Boolean(thread), messages: msgs.length };
  },
});

export const listDmThreads = query({
  args: {
    pageId: v.string(),
    platform: v.optional(v.union(v.literal('messenger'), v.literal('instagram'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query('metaDmThreads')
      .withIndex('by_page_time', (q) => q.eq('pageId', args.pageId))
      .order('desc')
      .collect();

    const filtered = args.platform
      ? rows.filter((r) => r.platform === args.platform)
      : rows;

    return filtered.slice(0, limit);
  },
});

export const listDmMessages = query({
  args: {
    threadId: v.id('metaDmThreads'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('metaDmMessages')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('asc')
      .take(args.limit ?? 200);
  },
});

export const getLatestInboundSenderId = internalQuery({
  args: { threadId: v.id('metaDmThreads') },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('metaDmMessages')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(80);
    for (const msg of messages) {
      if (msg.direction === 'inbound' && msg.fromId) return msg.fromId;
    }
    return null;
  },
});

export const patchDmThreadParticipant = internalMutation({
  args: {
    threadId: v.id('metaDmThreads'),
    participantId: v.string(),
    participantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      participantId: args.participantId,
      participantName: args.participantName,
      updatedAt: Date.now(),
    });
  },
});

/** Sincroniza conversaciones desde Meta Graph (Messenger e Instagram DM). */
export const syncDmInbox = action({
  args: { pageId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; error?: string }> => {
    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { synced: 0, error: 'Página no conectada' };
    }

    if (!conn.webhookSubscribed) {
      await ctx.scheduler.runAfter(0, internal.metaChannels.subscribePageWebhook, {
        pageId: args.pageId,
        pageAccessToken: conn.pageAccessToken,
      });
    }

    const token = conn.pageAccessToken;
    const ownIds = dmOwnParticipantIds(args.pageId, conn.igUserId);
    const platforms: Array<'messenger' | 'instagram'> = ['messenger'];
    if (conn.igUserId) platforms.push('instagram');

    let synced = 0;
    const errors: string[] = [];
    const toEnrich = new Set<string>();

    for (const platform of platforms) {
      try {
        const res = await fetch(
          `${GRAPH}/${args.pageId}/conversations?` +
            new URLSearchParams({
              platform,
              fields:
                'id,updated_time,participants,messages.limit(15){id,message,from,created_time}',
              limit: '30',
              access_token: token,
            }).toString(),
        );
        const data = await res.json();
        if (!res.ok) {
          errors.push(data?.error?.message ?? `Error ${platform}`);
          continue;
        }

        for (const conv of data.data ?? []) {
          const participants: { id?: string; name?: string }[] =
            conv.participants?.data ?? [];
          const participant = pickDmParticipant(participants, ownIds);
          if (!participant?.id) continue;
          toEnrich.add(`${platform}:${participant.id}`);

          const messages: any[] = conv.messages?.data ?? [];
          for (const msg of messages) {
            const fromId = msg.from?.id;
            const direction =
              fromId && ownIds.has(fromId)
                ? ('outbound' as const)
                : ('inbound' as const);
            const createdAt = msg.created_time
              ? new Date(msg.created_time).getTime()
              : Date.now();

            await ctx.runMutation(internal.metaChannels.ingestDmMessage, {
              pageId: args.pageId,
              platform,
              participantId: participant.id,
              participantName: participant.name,
              metaConversationId: conv.id,
              metaMessageId: msg.id,
              direction,
              text: msg.message ?? undefined,
              fromId,
              fromName: msg.from?.name,
              createdAt,
            });
            synced += 1;
          }
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    for (const key of toEnrich) {
      const [platform, participantId] = key.split(':') as [
        'messenger' | 'instagram',
        string,
      ];
      await ctx.runAction(internal.metaChannels.enrichDmParticipant, {
        pageId: args.pageId,
        platform,
        participantId,
      });
    }

    return { synced, error: errors[0] };
  },
});

/** Envía un mensaje privado por Messenger o Instagram DM. */
export const sendDmMessage = action({
  args: {
    pageId: v.string(),
    threadId: v.id('metaDmThreads'),
    message: v.optional(v.string()),
    attachmentType: v.optional(
      v.union(
        v.literal('image'),
        v.literal('audio'),
        v.literal('video'),
        v.literal('file'),
      ),
    ),
    attachmentUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
    const text = args.message?.trim() ?? '';
    const attachmentUrl = args.attachmentUrl?.trim();
    if (!text && !attachmentUrl) return { ok: false, error: 'Mensaje vacío' };

    const thread = await ctx.runQuery(internal.metaChannels.getDmThread, {
      threadId: args.threadId,
    });
    if (!thread || thread.pageId !== args.pageId) {
      return { ok: false, error: 'Conversación no encontrada' };
    }

    const conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
      pageId: args.pageId,
    });
    if (!conn || !conn.connected || !conn.pageAccessToken) {
      return { ok: false, error: 'Página no conectada' };
    }

    const ownIds = dmOwnParticipantIds(args.pageId, conn.igUserId);
    let recipientId = thread.participantId;
    const participantInvalid = !recipientId || ownIds.has(recipientId);

    if (participantInvalid) {
      recipientId = '';

      if (thread.platform === 'instagram') {
        const inboundFromId = await ctx.runQuery(
          internal.metaChannels.getLatestInboundSenderId,
          { threadId: args.threadId },
        );
        if (inboundFromId && !ownIds.has(inboundFromId)) {
          recipientId = inboundFromId;
        }
      }

      if (!recipientId && thread.metaConversationId) {
        const fromConversation = await fetchConversationParticipantId(
          thread.metaConversationId,
          conn.pageAccessToken,
          ownIds,
        );
        if (fromConversation) recipientId = fromConversation;
      }
    }

    if (!recipientId || ownIds.has(recipientId)) {
      return {
        ok: false,
        error:
          thread.platform === 'instagram'
            ? 'No se encontró al usuario de Instagram. Sincroniza de nuevo o pídele que envíe otro mensaje.'
            : 'No se encontró al usuario de Messenger.',
      };
    }

    if (recipientId !== thread.participantId) {
      await ctx.runMutation(internal.metaChannels.patchDmThreadParticipant, {
        threadId: args.threadId,
        participantId: recipientId,
        participantName: thread.participantName,
      });
    }

    const messageBody = attachmentUrl
      ? {
          attachment: {
            type: args.attachmentType ?? 'file',
            payload: { url: attachmentUrl, is_reusable: true },
          },
        }
      : { text };

    // Con Facebook Login for Business (token de Página), TANTO Messenger COMO
    // Instagram Direct se envían por el endpoint de la Página. El endpoint
    // /{igUserId}/messages es del API de "Instagram con login de Instagram"
    // (otro producto) y con este token devuelve (#3) capability error.
    // El recipientId (PSID para Messenger, IGSID para Instagram) enruta el destino.
    const sendUrl = `${GRAPH}/${args.pageId}/messages`;

    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: messageBody,
        access_token: conn.pageAccessToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? 'Error al enviar';
      const subcode = data?.error?.error_subcode;
      if (data?.error?.code === 100 || subcode === 2534014) {
        return {
          ok: false,
          error:
            'Meta no reconoce al usuario de Instagram. Reconecta la página con permiso instagram_manage_messages, sincroniza el inbox y asegúrate de responder dentro de las 24 h desde su último mensaje.',
        };
      }
      return { ok: false, error: errMsg };
    }

    await ctx.runMutation(internal.metaChannels.ingestDmMessage, {
      pageId: args.pageId,
      platform: thread.platform,
      participantId: recipientId,
      participantName: thread.participantName,
      metaConversationId: thread.metaConversationId,
      metaMessageId: data.message_id,
      direction: 'outbound',
      text: text || undefined,
      attachmentType: attachmentUrl ? (args.attachmentType ?? 'file') : undefined,
      attachmentUrl: attachmentUrl || undefined,
      fromId: args.pageId,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

/** Tía sugiere respuestas para un chat privado. */
export const suggestDmReply = action({
  args: {
    messageText: v.string(),
    fromName: v.optional(v.string()),
    platform: v.optional(v.union(v.literal('messenger'), v.literal('instagram'))),
  },
  handler: async (_ctx, args): Promise<{ suggestions: string[]; error?: string }> => {
    try {
      const { chatCompletion } = await import('./lib/openai');
      const channel =
        args.platform === 'instagram' ? 'Instagram Direct' : 'Facebook Messenger';
      const system = `Te llamas Naya y eres la asesora virtual de FincasYa.com, respondiendo mensajes privados en ${channel}.
Genera exactamente 3 respuestas distintas, cortas (máximo 280 caracteres), cálidas, en español colombiano, tuteando al cliente.
Una puede invitar a WhatsApp https://wa.me/573157773937; otra puede pedir fechas y número de personas si preguntan precio o capacidad.
No uses markdown. Responde SOLO JSON válido: {"suggestions":["respuesta1","respuesta2","respuesta3"]}`;

      const user = `Mensaje de ${args.fromName ?? 'un cliente'}: "${args.messageText.trim()}"`;

      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.75,
      });

      const raw = (content ?? '').trim();
      const jsonText = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'));
      const parsed = JSON.parse(jsonText) as { suggestions?: unknown };
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
        : [];

      return { suggestions };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { suggestions: [], error: message };
    }
  },
});
