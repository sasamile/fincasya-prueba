/**
 * Envio de fichas del catalogo de WhatsApp (Meta) via YCloud.
 * Portado del sistema anterior (fincasya-new/convex/lib/ycloud/senders.ts):
 * una tarjeta `interactive product` POR FINCA (no product_list), con pausa
 * entre fichas para que Meta no las agrupe, y resiliente: una ficha que
 * falle (ej. producto no registrado, error 131009) se omite y se sigue.
 * Si Meta responde 131009, reintenta con FALLBACK_CATALOG_ID (mismo
 * comportamiento que new/sendCatalogToYcloud).
 */

import { FALLBACK_CATALOG_ID } from './ycloud/constants';

const SEND_DIRECTLY = 'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly';
/** Pausa entre fichas — evita que Meta las agrupe en "Catalogo enviado". */
export const BETWEEN_CATALOG_SENDS_MS = 1000;
/**
 * Maximo de fichas EXITOSAS por envio (regla del equipo: se mandan hartas,
 * 16-20 fincas por lote; WhatsApp permite hasta 30).
 */
export const MAX_CATALOG_CARDS = 20;
/**
 * Candidatos a intentar por envio: mas que el maximo de fichas porque
 * algunos productos pueden no estar registrados en el catalogo Meta
 * (error 131009) y se omiten sin abortar.
 */
export const MAX_CATALOG_CANDIDATES = 30;

function requireYcloudEnv() {
  const apiKey = process.env.YCLOUD_API_KEY;
  const wabaNumber = process.env.YCLOUD_WABA_NUMBER;
  if (!apiKey || !wabaNumber) {
    throw new Error('Configura YCLOUD_API_KEY y YCLOUD_WABA_NUMBER en Convex');
  }
  return { apiKey, wabaNumber };
}

export type CatalogCard = {
  productRetailerId: string;
  /** Cuerpo de la ficha (ej. "💰 Desde $850.000 por noche · hasta 12 personas"). */
  bodyText: string;
};

export type CatalogSendRow = {
  productRetailerId: string;
  wamid?: string;
  ok: boolean;
  /** Catalogo Meta con el que salio (util si hubo fallback). */
  catalogIdUsed?: string;
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

function isInvalidCatalogError(status: number, text: string): boolean {
  return status === 400 && /invalid.*catalog|131009/i.test(text);
}

async function postCatalogCard(args: {
  apiKey: string;
  wabaNumber: string;
  to: string;
  catalogId: string;
  card: CatalogCard;
}): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(SEND_DIRECTLY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-API-Key': args.apiKey,
    },
    body: JSON.stringify({
      from: args.wabaNumber,
      to: args.to,
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: args.card.bodyText },
        footer: { text: 'FincasYa' },
        action: {
          catalog_id: args.catalogId,
          product_retailer_id: args.card.productRetailerId,
        },
      },
    }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export async function sendCatalogCard(args: {
  to: string;
  catalogId: string;
  card: CatalogCard;
}): Promise<CatalogSendRow> {
  const { apiKey, wabaNumber } = requireYcloudEnv();
  let catalogId = args.catalogId;

  let result = await postCatalogCard({
    apiKey,
    wabaNumber,
    to: args.to,
    catalogId,
    card: args.card,
  });

  // Igual que new: si el producto no esta en el catalogo principal, probar fallback.
  if (
    !result.ok &&
    isInvalidCatalogError(result.status, result.text) &&
    catalogId !== FALLBACK_CATALOG_ID
  ) {
    catalogId = FALLBACK_CATALOG_ID;
    result = await postCatalogCard({
      apiKey,
      wabaNumber,
      to: args.to,
      catalogId,
      card: args.card,
    });
  }

  if (result.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = undefined;
    }
    return {
      productRetailerId: args.card.productRetailerId,
      wamid: wamidFrom(parsed),
      ok: true,
      catalogIdUsed: catalogId,
    };
  }
  console.error(
    `[catalog] ficha ${args.card.productRetailerId} fallo — se omite: ${result.status} ${result.text.slice(0, 220)}`,
  );
  return { productRetailerId: args.card.productRetailerId, ok: false };
}

export async function sendCatalogCards(args: {
  to: string;
  catalogId: string;
  cards: CatalogCard[];
  /** Corta cuando este numero de fichas SALIO bien (default 12). */
  maxOk?: number;
}): Promise<CatalogSendRow[]> {
  const rows: CatalogSendRow[] = [];
  const maxOk = args.maxOk ?? MAX_CATALOG_CARDS;
  let okCount = 0;
  let sentAny = false;
  // Si una ficha forzo el fallback, las siguientes usan ese catalogo de entrada.
  let catalogId = args.catalogId;
  const cards = args.cards.slice(0, MAX_CATALOG_CANDIDATES);
  for (let i = 0; i < cards.length; i++) {
    if (okCount >= maxOk) break;
    const card = cards[i];
    if (sentAny) await new Promise((r) => setTimeout(r, BETWEEN_CATALOG_SENDS_MS));
    sentAny = true;
    const row = await sendCatalogCard({ to: args.to, catalogId, card });
    rows.push(row);
    if (row.ok) {
      okCount++;
      if (row.catalogIdUsed) catalogId = row.catalogIdUsed;
    } else if (catalogId !== FALLBACK_CATALOG_ID) {
      // Tras un 131009 en el principal, el siguiente intento ya parte del fallback.
      catalogId = FALLBACK_CATALOG_ID;
    }
  }
  return rows;
}

export function formatCop(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}
