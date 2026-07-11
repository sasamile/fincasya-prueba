/**
 * Envio de fichas del catalogo de WhatsApp (Meta) via YCloud.
 * Portado del sistema anterior (fincasya-new/convex/lib/ycloud/senders.ts):
 * una tarjeta `interactive product` POR FINCA (no product_list), con pausa
 * entre fichas para que Meta no las agrupe, y resiliente: una ficha que
 * falle (ej. producto no registrado, error 131009) se omite y se sigue.
 */

const SEND_DIRECTLY = 'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly';
/** Pausa entre fichas — evita que Meta las agrupe en "Catalogo enviado". */
const BETWEEN_SENDS_MS = 1500;
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

export async function sendCatalogCards(args: {
  to: string;
  catalogId: string;
  cards: CatalogCard[];
  /** Corta cuando este numero de fichas SALIO bien (default 12). */
  maxOk?: number;
}): Promise<CatalogSendRow[]> {
  const { apiKey, wabaNumber } = requireYcloudEnv();
  const rows: CatalogSendRow[] = [];
  const maxOk = args.maxOk ?? MAX_CATALOG_CARDS;
  let okCount = 0;
  let sentAny = false;
  const cards = args.cards.slice(0, MAX_CATALOG_CANDIDATES);
  for (let i = 0; i < cards.length; i++) {
    if (okCount >= maxOk) break;
    const card = cards[i];
    if (sentAny) await new Promise((r) => setTimeout(r, BETWEEN_SENDS_MS));
    const res = await fetch(SEND_DIRECTLY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        from: wabaNumber,
        to: args.to,
        type: 'interactive',
        interactive: {
          type: 'product',
          body: { text: card.bodyText },
          footer: { text: 'FincasYa' },
          action: {
            catalog_id: args.catalogId,
            product_retailer_id: card.productRetailerId,
          },
        },
      }),
    });
    const text = await res.text();
    sentAny = true;
    if (res.ok) {
      okCount++;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      rows.push({
        productRetailerId: card.productRetailerId,
        wamid: wamidFrom(parsed),
        ok: true,
      });
    } else {
      // Ficha mala NO aborta el resto (regla del sistema anterior).
      console.error(
        `[catalog] ficha ${card.productRetailerId} fallo — se omite: ${res.status} ${text.slice(0, 220)}`,
      );
      rows.push({ productRetailerId: card.productRetailerId, ok: false });
    }
  }
  return rows;
}

export function formatCop(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}
