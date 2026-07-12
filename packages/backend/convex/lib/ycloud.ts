/** Envio de mensajes de texto por YCloud (WhatsApp). */

function requireYcloudEnv() {
  const apiKeyValue = process.env.YCLOUD_API_KEY;
  const wabaNumber = process.env.YCLOUD_WABA_NUMBER;
  if (!apiKeyValue || !wabaNumber) {
    throw new Error('Configura YCLOUD_API_KEY y YCLOUD_WABA_NUMBER en Convex');
  }
  return { apiKey: apiKeyValue, wabaNumber };
}

/** Extrae el wamid de la respuesta de YCloud (varias formas posibles). */
function wamidFromResponse(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const o = parsed as Record<string, unknown>;
  if (typeof o.wamid === 'string' && o.wamid.length > 6) return o.wamid.trim();
  const nested = o.whatsappMessage;
  if (nested && typeof nested === 'object') {
    const w = (nested as Record<string, unknown>).wamid;
    if (typeof w === 'string' && w.length > 6) return w.trim();
  }
  return undefined;
}

export async function sendWhatsappText(args: {
  to: string;
  text: string;
  /** wamid del mensaje al que se responde (cita, estilo WhatsApp). */
  contextWamid?: string;
}): Promise<{ wamid?: string }> {
  const { apiKey, wabaNumber } = requireYcloudEnv();
  const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      from: wabaNumber,
      to: args.to,
      type: 'text',
      text: { body: args.text },
      ...(args.contextWamid
        ? { context: { message_id: args.contextWamid } }
        : {}),
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`YCloud send ${res.status}: ${bodyText.slice(0, 400)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = undefined;
  }
  return { wamid: wamidFromResponse(parsed) };
}

/**
 * Envía una reacción (emoji) sobre un mensaje del cliente. `emoji` vacío quita
 * la reacción. `wamid` es el id del mensaje del cliente al que se reacciona.
 */
export async function sendWhatsappReaction(args: {
  to: string;
  wamid: string;
  emoji: string;
}): Promise<{ wamid?: string }> {
  const { apiKey, wabaNumber } = requireYcloudEnv();
  const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      from: wabaNumber,
      to: args.to,
      type: 'reaction',
      reaction: { message_id: args.wamid, emoji: args.emoji },
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`YCloud reaction ${res.status}: ${bodyText.slice(0, 400)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = undefined;
  }
  return { wamid: wamidFromResponse(parsed) };
}

/** Normaliza telefono a solo digitos (formato de `contacts.phone`). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, '');
}
