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

const http = httpRouter();

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
    };
  };

  if (
    parsed.type === 'whatsapp.inbound_message.received' &&
    parsed.whatsappInboundMessage
  ) {
    const evt = parsed.whatsappInboundMessage;
    const phone = (evt.from ?? '').replace(/\D+/g, '');
    const name = (evt.customerProfile?.name ?? '').trim();
    const wamid = evt.wamid ?? evt.id;
    const eventId = parsed.id ?? wamid ?? `evt_${Date.now()}`;

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

    if (phone && content) {
      await ctx.runMutation(internal.inbound.ingestInboundMessage, {
        eventId,
        phone,
        customerName: name,
        content,
        msgType,
        mediaUrl,
        wamid,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

for (const path of ['/ycloud/webhook', '/webhooks/ycloud']) {
  http.route({ path, method: 'POST', handler: ycloudWebhookHandler });
}

export default http;
