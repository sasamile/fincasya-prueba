/**
 * Entrada del canal: webhook de YCloud (WhatsApp).
 * Valida + deduplica el evento, persiste el mensaje del cliente y agenda
 * el turno del agente (con un pequeno retraso para agrupar rafagas).
 *
 * URLs validas (deployment modest-husky-871):
 *   POST https://modest-husky-871.convex.site/ycloud/webhook
 *   POST https://modest-husky-871.convex.site/webhooks/ycloud  (alias)
 */
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { authComponent, buildTrustedOrigins, createAuth } from './betterAuth/auth';
import {
  inferDmPlatformFromWebhook,
  normalizeWebhookTimestamp,
} from './lib/metaDmWebhook';

const http = httpRouter();

// Rutas de Better Auth (login, sesión, etc.) — expuestas en
// https://<deployment>.convex.site/api/auth/*
authComponent.registerRoutes(http, createAuth, {
  cors: { allowedOrigins: buildTrustedOrigins() },
});

const ycloudWebhookHandler = httpAction(async (ctx, request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = body as {
    type?: string;
    id?: string;
    whatsappInboundMessage?: {
      id?: string;
      wamid?: string;
      from?: string;
      customerProfile?: { name?: string };
      type?: string;
      text?: { body?: string };
      image?: { link?: string; caption?: string };
      audio?: { link?: string };
      video?: { link?: string; caption?: string };
      document?: { link?: string; caption?: string; filename?: string };
      reaction?: { messageId?: string; message_id?: string; emoji?: string };
      context?: { id?: string; messageId?: string; message_id?: string };
    };
    whatsappMessage?: {
      id?: string;
      wamid?: string;
      status?: string;
      /** Campos presentes en whatsapp.smb.message.echoes (coexistencia). */
      from?: string;
      to?: string;
      type?: string;
      text?: { body?: string };
      image?: { link?: string; caption?: string };
      audio?: { link?: string };
      video?: { link?: string; caption?: string };
      document?: { link?: string; caption?: string; filename?: string };
    };
  };

  // ── 1) Actualización de estado de un saliente (entregado / leído / falló) ──
  if (parsed.type === 'whatsapp.message.updated' && parsed.whatsappMessage) {
    const wm = parsed.whatsappMessage;
    const wamid = wm.wamid ?? wm.id;
    const raw = (wm.status ?? '').toLowerCase();
    const status =
      raw === 'read'
        ? 'read'
        : raw === 'delivered'
          ? 'delivered'
          : raw === 'sent'
            ? 'sent'
            : raw === 'failed' || raw === 'undeliverable'
              ? 'failed'
              : raw === 'accepted'
                ? 'accepted'
                : null;
    if (wamid && status) {
      await ctx.runMutation(internal.inbound.updateMessageStatusByWamid, { wamid, status });
    }
    return json200();
  }

  // ── 1b) Echo de coexistencia: mensaje que el EQUIPO envió desde la app de
  // WhatsApp Business (no por el panel/API). Se captura al hilo como mensaje
  // de Experto y el bot se detiene en ese chat. ──
  if (parsed.type === 'whatsapp.smb.message.echoes' && parsed.whatsappMessage) {
    const wm = parsed.whatsappMessage;
    const phone = (wm.to ?? '').replace(/\D+/g, '');
    const wamid = wm.wamid ?? wm.id;
    const eventId = parsed.id ?? wamid ?? `smbecho_${Date.now()}`;

    let content = '';
    let msgType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text';
    let mediaUrl: string | undefined;
    if (wm.type === 'text' && wm.text?.body) {
      content = wm.text.body.trim();
    } else if (wm.type === 'image' && wm.image?.link) {
      msgType = 'image';
      mediaUrl = wm.image.link;
      content = wm.image.caption?.trim() || '[imagen]';
    } else if (wm.type === 'audio' && wm.audio?.link) {
      msgType = 'audio';
      mediaUrl = wm.audio.link;
      content = '[nota de voz]';
    } else if (wm.type === 'video' && wm.video?.link) {
      msgType = 'video';
      mediaUrl = wm.video.link;
      content = wm.video.caption?.trim() || '[video]';
    } else if (wm.type === 'document' && wm.document?.link) {
      msgType = 'document';
      mediaUrl = wm.document.link;
      content = wm.document.filename?.trim() || '[documento]';
    }

    if (phone && content) {
      await ctx.runMutation(internal.inbound.ingestAdvisorAppMessage, {
        eventId,
        phone,
        content,
        msgType,
        mediaUrl,
        wamid,
      });
    }
    return json200();
  }

  // ── 2) Mensaje entrante (incluye reacciones y respuestas citadas) ──
  if (
    parsed.type === 'whatsapp.inbound_message.received' &&
    parsed.whatsappInboundMessage
  ) {
    const evt = parsed.whatsappInboundMessage;
    const phone = (evt.from ?? '').replace(/\D+/g, '');
    const name = (evt.customerProfile?.name ?? '').trim();
    const wamid = evt.wamid ?? evt.id;
    const eventId = parsed.id ?? wamid ?? `evt_${Date.now()}`;

    // 2a) Reacción sobre uno de NUESTROS mensajes → se guarda como emoji.
    if (evt.type === 'reaction' && evt.reaction) {
      const targetWamid = evt.reaction.messageId ?? evt.reaction.message_id;
      if (targetWamid) {
        await ctx.runMutation(internal.inbound.setMessageReaction, {
          wamid: targetWamid,
          emoji: (evt.reaction.emoji ?? '').trim(),
        });
      }
      return json200();
    }

    let content = '';
    let msgType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text';
    let mediaUrl: string | undefined;
    if (evt.type === 'text' && evt.text?.body) {
      content = evt.text.body.trim();
    } else if (evt.type === 'image' && evt.image?.link) {
      msgType = 'image';
      mediaUrl = evt.image.link;
      content = evt.image.caption?.trim() || '[imagen]';
    } else if (evt.type === 'audio' && evt.audio?.link) {
      msgType = 'audio';
      mediaUrl = evt.audio.link;
      content = '[nota de voz]';
    } else if (evt.type === 'video' && evt.video?.link) {
      msgType = 'video';
      mediaUrl = evt.video.link;
      content = evt.video.caption?.trim() || '[video]';
    } else if (evt.type === 'document' && evt.document?.link) {
      msgType = 'document';
      mediaUrl = evt.document.link;
      content = evt.document.filename?.trim() || '[documento]';
    }

    // Respuesta citada: wamid del mensaje al que responde el cliente.
    const replyToWamid = evt.context?.id ?? evt.context?.messageId ?? evt.context?.message_id;

    if (phone && content) {
      await ctx.runMutation(internal.inbound.ingestInboundMessage, {
        eventId,
        phone,
        customerName: name,
        content,
        msgType,
        mediaUrl,
        wamid,
        replyToWamid,
      });
    }
  }

  return json200();
});

function json200(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

for (const path of ['/ycloud/webhook', '/webhooks/ycloud']) {
  http.route({ path, method: 'POST', handler: ycloudWebhookHandler });
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal público de check-in del turista (`/checkin/:reference`).
// No requiere autenticación: el cliente final lo abre desde el botón de la
// plantilla de WhatsApp `inicio_checkin_turista`. La "llave" es la `reference`
// de la reserva. El link NO expira y admite guardado parcial (llenar unos
// invitados hoy y el resto otro día con el mismo enlace).
// ─────────────────────────────────────────────────────────────────────────────

const CHECKIN_CORS = { 'Access-Control-Allow-Origin': '*' } as const;

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/** GET /api/checkin/:reference → resumen de la reserva + lo ya guardado. */
http.route({
  pathPrefix: '/api/checkin/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const key = decodeURIComponent(
      url.pathname.replace('/api/checkin/', ''),
    ).trim();

    if (!key)
      return jsonResponse({ error: 'Referencia inválida' }, 400, CHECKIN_CORS);

    const data = await ctx.runQuery(internal.checkinPortal.getForPortal, { key });
    if (data && 'portalClosed' in data && data.portalClosed) {
      return jsonResponse(
        {
          error: 'reservation_ended',
          message: 'Esta reserva ya finalizó.',
          redirectUrl: 'https://fincasya.com',
        },
        410,
        CHECKIN_CORS,
      );
    }
    if (!data) {
      return jsonResponse(
        { error: 'not_found', message: 'No encontramos esta reserva.' },
        404,
        CHECKIN_CORS,
      );
    }

    return jsonResponse({ ok: true, ...data }, 200, CHECKIN_CORS);
  }),
});

/** POST /api/checkin/:reference → guarda avance (`save`) o envía (`submit`). */
http.route({
  pathPrefix: '/api/checkin/',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const key = decodeURIComponent(
      url.pathname.replace('/api/checkin/', ''),
    ).trim();

    if (!key)
      return jsonResponse({ error: 'Referencia inválida' }, 400, CHECKIN_CORS);

    let body: {
      action?: 'save' | 'submit';
      guests?: Array<{
        nombreCompleto?: string;
        cedula?: string;
        tipoDocumento?: string;
        esMenor?: boolean;
        email?: string;
        fechaNacimiento?: string;
        telefono?: string;
      }>;
      needsEmpleada?: boolean;
      needsTeam?: boolean;
      serviciosNota?: string;
      menoresDe2?: number;
      placas?: string;
      mascotas?: number;
      observaciones?: string;
      aceptaTratamientoDatos?: boolean;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: 'Body JSON inválido' }, 400, CHECKIN_CORS);
    }

    const guests = (Array.isArray(body?.guests) ? body.guests : []).map((g) => ({
      nombreCompleto: String(g?.nombreCompleto ?? '').trim(),
      cedula: String(g?.cedula ?? '').trim() || undefined,
      tipoDocumento:
        String(g?.tipoDocumento ?? '').trim().toUpperCase() || undefined,
      esMenor: Boolean(g?.esMenor) || undefined,
      email: String(g?.email ?? '').trim().toLowerCase() || undefined,
      fechaNacimiento: String(g?.fechaNacimiento ?? '').trim() || undefined,
      telefono: String(g?.telefono ?? '').trim() || undefined,
    }));
    const payload = {
      key,
      guests,
      menoresDe2:
        body?.menoresDe2 === undefined
          ? undefined
          : Math.max(0, Math.floor(Number(body.menoresDe2) || 0)),
      placas: body?.placas?.trim() || undefined,
      mascotas:
        body?.mascotas === undefined
          ? undefined
          : Math.max(0, Math.floor(Number(body.mascotas) || 0)),
      observaciones: body?.observaciones?.trim() || undefined,
      aceptaTratamientoDatos:
        body?.aceptaTratamientoDatos === undefined
          ? undefined
          : body.aceptaTratamientoDatos === true,
      needsEmpleada: Boolean(body?.needsEmpleada),
      needsTeam: Boolean(body?.needsTeam),
      serviciosNota: body?.serviciosNota?.trim() || undefined,
    };

    const isSubmit = body?.action === 'submit';
    let result: { ok: boolean; reason?: string };
    try {
      result = isSubmit
        ? await ctx.runMutation(internal.checkinPortal.submitCheckin, payload)
        : await ctx.runMutation(internal.checkinPortal.saveDraft, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('ArgumentValidationError') ||
        message.includes('extra field')
      ) {
        return jsonResponse(
          {
            error: 'invalid_guest_data',
            message:
              'Los datos del invitado no son válidos. Recarga la página e intenta de nuevo.',
          },
          422,
          CHECKIN_CORS,
        );
      }
      console.error('[checkin] mutation failed', message);
      return jsonResponse(
        { error: 'server_error', message: 'No se pudo procesar el check-in.' },
        500,
        CHECKIN_CORS,
      );
    }

    if (!result.ok) {
      const reason = (result as { reason?: string }).reason ?? 'error';
      const statusMap: Record<string, number> = {
        not_found: 404,
        count_mismatch: 422,
        missing_guests: 422,
        missing_name: 422,
        missing_document: 422,
        missing_data_consent: 422,
        guest_list_locked: 423,
        reservation_ended: 410,
      };
      return jsonResponse(
        { error: reason, ...result },
        statusMap[reason] ?? 400,
        CHECKIN_CORS,
      );
    }

    return jsonResponse({ ...result, ok: true }, 200, CHECKIN_CORS);
  }),
});

/** OPTIONS preflight (CORS) para el portal de check-in. */
http.route({
  pathPrefix: '/api/checkin/',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }),
});

/**
 * Webhook de Meta (Facebook Pages + Instagram).
 *   Verify URL: https://<deployment>.convex.site/meta/webhook
 *
 * GET  -> handshake de verificación (hub.challenge) con META_WEBHOOK_VERIFY_TOKEN.
 * POST -> eventos (comentarios, menciones, mensajes). Se valida la firma
 *         X-Hub-Signature-256 con el App Secret antes de procesar.
 */
http.route({
  path: '/meta/webhook',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token && token === expected && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403 });
  }),
});

/** HMAC-SHA256 hex del cuerpo crudo con el App Secret (Web Crypto). */
async function metaSignatureHex(rawBody: string, appSecret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

http.route({
  path: '/meta/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;

    // Validación de firma (si hay App Secret configurado).
    if (appSecret) {
      const header = request.headers.get('x-hub-signature-256') || '';
      const provided = header.replace('sha256=', '');
      const expected = await metaSignatureHex(rawBody, appSecret);
      if (!provided || provided !== expected) {
        console.error('[meta-webhook] firma inválida');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response('Bad JSON', { status: 400 });
    }

    const object: string = body?.object ?? '';
    const provider = object === 'instagram' ? 'instagram' : 'facebook';

    for (const entry of body?.entry ?? []) {
      const pageId: string | undefined = entry?.id;
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const from = value.from ?? {};
        await ctx.runMutation(internal.metaChannels.recordWebhookEvent, {
          provider,
          pageId,
          objectId: value.post_id || value.media?.id || value.media_id,
          field: change.field,
          verb: value.verb,
          commentId: value.comment_id || value.id,
          parentId: value.parent_id,
          fromId: from.id,
          fromName: from.name || from.username,
          text: value.message || value.text,
          permalink: value.permalink_url,
          payload: change,
        });
      }

      let resolvedPageId = pageId;
      let conn: {
        pageId: string;
        igUserId?: string;
        webhookSubscribed?: boolean;
        pageAccessToken?: string;
        connected?: boolean;
      } | null = null;

      if (object === 'instagram') {
        const connByIg = await ctx.runQuery(
          internal.metaChannels.getConnectionByIgId,
          { igUserId: entry?.id },
        );
        resolvedPageId = connByIg?.pageId ?? pageId;
        conn = connByIg;
      } else if (resolvedPageId) {
        conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
          pageId: resolvedPageId,
        });
      }

      for (const messaging of entry?.messaging ?? []) {
        const senderId: string | undefined = messaging?.sender?.id;
        const recipientId: string | undefined = messaging?.recipient?.id;
        const message = messaging?.message;
        if (!senderId || !message?.mid) continue;

        if (!resolvedPageId) continue;

        if (!conn && resolvedPageId) {
          conn = await ctx.runQuery(internal.metaChannels.getConnectionByPageId, {
            pageId: resolvedPageId,
          });
        }

        const platform = inferDmPlatformFromWebhook({
          pageId: resolvedPageId,
          igUserId: conn?.igUserId,
          senderId,
          recipientId,
          isInstagramEcho: message.is_instagram_echo === true,
          webhookObject: object,
        });

        const ownIds = new Set(
          [resolvedPageId, conn?.igUserId].filter(Boolean) as string[],
        );
        const isEcho = message.is_echo === true || message.is_instagram_echo === true;
        const fromPage =
          isEcho || ownIds.has(senderId) || senderId === entry?.id;
        const direction = fromPage ? 'outbound' : 'inbound';
        const participantId =
          direction === 'inbound' ? senderId : recipientId ?? senderId;

        const text =
          typeof message.text === 'string'
            ? message.text
            : message.attachments?.length
              ? '[Adjunto]'
              : undefined;

        await ctx.runMutation(internal.metaChannels.ingestDmMessage, {
          pageId: resolvedPageId,
          platform,
          participantId,
          metaMessageId: message.mid,
          direction,
          text,
          fromId: senderId,
          createdAt: normalizeWebhookTimestamp(messaging.timestamp),
        });
      }
    }

    // Meta exige 200 rápido, siempre.
    return new Response('EVENT_RECEIVED', { status: 200 });
  }),
});

export default http;
