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
 * Maximo de fichas EXITOSAS por envio (regla del equipo 2026-07: hasta 12
 * por lote; si el cliente pide MAS opciones se envia el siguiente lote —
 * enviar_catalogo excluye las ya enviadas, asi que sale "el resto").
 */
export const MAX_CATALOG_CARDS = 12;
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
  /**
   * IDs alternativos a probar si Meta responde 131009 con el principal
   * (ej. código de finca VLL#004 cuando el Content ID en Meta no es el _id).
   */
  alternateRetailerIds?: string[];
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

function uniqueRetailerIds(primary: string, alternates?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [primary, ...(alternates ?? [])]) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function postCatalogCard(args: {
  apiKey: string;
  wabaNumber: string;
  to: string;
  catalogId: string;
  productRetailerId: string;
  bodyText: string;
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
        body: { text: args.bodyText },
        footer: { text: 'FincasYa' },
        action: {
          catalog_id: args.catalogId,
          product_retailer_id: args.productRetailerId,
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
  const retailerCandidates = uniqueRetailerIds(
    args.card.productRetailerId,
    args.card.alternateRetailerIds,
  );
  const catalogCandidates = [args.catalogId, FALLBACK_CATALOG_ID].filter(
    (id, i, arr) => id && arr.indexOf(id) === i,
  );

  let lastFail: { status: number; text: string; catalogId: string; retailerId: string } | null =
    null;

  for (const catalogId of catalogCandidates) {
    for (const productRetailerId of retailerCandidates) {
      const result = await postCatalogCard({
        apiKey,
        wabaNumber,
        to: args.to,
        catalogId,
        productRetailerId,
        bodyText: args.card.bodyText,
      });

      if (result.ok) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(result.text);
        } catch {
          parsed = undefined;
        }
        if (
          productRetailerId !== args.card.productRetailerId ||
          catalogId !== args.catalogId
        ) {
          console.log(
            `[catalog] ficha OK con fallback retailer=${productRetailerId} catalog=${catalogId} (pedido ${args.card.productRetailerId} / ${args.catalogId})`,
          );
        }
        return {
          productRetailerId,
          wamid: wamidFrom(parsed),
          ok: true,
          catalogIdUsed: catalogId,
        };
      }

      lastFail = {
        status: result.status,
        text: result.text,
        catalogId,
        retailerId: productRetailerId,
      };

      // Solo tiene sentido probar otro retailer/catalog si es 131009 / catalog inválido.
      if (!isInvalidCatalogError(result.status, result.text)) {
        console.error(
          `[catalog] ficha ${productRetailerId} catalog=${catalogId} fallo — se omite: ${result.status} ${result.text.slice(0, 220)}`,
        );
        return { productRetailerId: args.card.productRetailerId, ok: false };
      }
    }
  }

  console.error(
    `[catalog] ficha ${args.card.productRetailerId} fallo — se omite: ${lastFail?.status ?? '?'} catalog=${lastFail?.catalogId ?? args.catalogId} tried=${retailerCandidates.join(',')} ${lastFail?.text.slice(0, 180) ?? ''}`,
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

/** Extrae precio y si llevaba prefijo "Desde" del bodyText de una ficha. */
export function parsePriceFromCatalogBody(bodyText: string): {
  priceFrom: number;
  priceIsDesde: boolean;
} | null {
  const priceIsDesde = /\bDesde\b/i.test(bodyText);
  const m = bodyText.match(/\$\s*([\d.]+)/);
  if (!m) return null;
  const priceFrom = Number(m[1].replace(/\./g, ''));
  if (!Number.isFinite(priceFrom) || priceFrom <= 0) return null;
  return { priceFrom, priceIsDesde };
}
