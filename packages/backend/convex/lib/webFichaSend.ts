/**
 * Envío de fichas web (foto + caption + enlace fincasya.com) por YCloud.
 * No usa catálogo Meta — preview rico vía imagen + link en el caption.
 */

const SEND_DIRECTLY = 'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly';
/** Pausa entre fichas en cola (WhatsApp descarga cada imagen por URL). */
export const BETWEEN_WEB_FICHA_SENDS_MS = 800;
export const MAX_WEB_FICHAS = 20;

function requireYcloudEnv() {
  const apiKey = process.env.YCLOUD_API_KEY;
  const wabaNumber = process.env.YCLOUD_WABA_NUMBER;
  if (!apiKey || !wabaNumber) {
    throw new Error('Configura YCLOUD_API_KEY y YCLOUD_WABA_NUMBER en Convex');
  }
  return { apiKey, wabaNumber };
}

export type WebFichaCard = {
  propertyId: string;
  imageUrl: string;
  caption: string;
};

export type WebFichaSendRow = {
  propertyId: string;
  wamid?: string;
  ok: boolean;
};

function wamidFrom(parsed: unknown): string | undefined {
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

export async function sendWebFichaCard(args: {
  to: string;
  card: WebFichaCard;
}): Promise<WebFichaSendRow> {
  const { apiKey, wabaNumber } = requireYcloudEnv();
  const res = await fetch(SEND_DIRECTLY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      from: wabaNumber,
      to: args.to,
      type: 'image',
      image: {
        link: args.card.imageUrl,
        caption: args.card.caption,
      },
    }),
  });

  const text = await res.text();
  if (res.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    return { propertyId: args.card.propertyId, wamid: wamidFrom(parsed), ok: true };
  }
  console.error(
    `[webFicha] finca ${args.card.propertyId} fallo — se omite: ${res.status} ${text.slice(0, 220)}`,
  );
  return { propertyId: args.card.propertyId, ok: false };
}

/** Envío en lote síncrono (bot / scripts). Preferir cola en inbox para el panel. */
export async function sendWebFichaCards(args: {
  to: string;
  cards: WebFichaCard[];
}): Promise<WebFichaSendRow[]> {
  const rows: WebFichaSendRow[] = [];
  const cards = args.cards.slice(0, MAX_WEB_FICHAS);
  let sentAny = false;

  for (const card of cards) {
    if (sentAny) await new Promise((r) => setTimeout(r, BETWEEN_WEB_FICHA_SENDS_MS));
    sentAny = true;
    rows.push(await sendWebFichaCard({ to: args.to, card }));
  }

  return rows;
}

export function buildWebFichaCaption(args: {
  title: string;
  location: string;
  capacity: number;
  priceFrom: number;
  rating: number | null;
  url: string;
}): string {
  const lines: string[] = [`🏡 ${args.title}`];
  const meta: string[] = [];
  if (args.rating != null && args.rating > 0) meta.push(`⭐ ${args.rating.toFixed(1)}`);
  if (args.location) meta.push(`📍 ${args.location}`);
  if (meta.length) lines.push(meta.join(' · '));
  const price =
    args.priceFrom > 0
      ? `💰 Desde $${Math.round(args.priceFrom).toLocaleString('es-CO')} noche`
      : null;
  lines.push([price, `👥 ${args.capacity}`].filter(Boolean).join(' · '));
  lines.push(args.url);
  return lines.join('\n');
}
