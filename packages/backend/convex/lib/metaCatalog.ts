/**
 * Meta Commerce Catalog — lectura de productos vía Graph API.
 * Token: META_GRAPH_ACCESS_TOKEN en env de Convex.
 */

const GRAPH_VERSION = 'v22.0';

export type MetaCatalogProduct = {
  id: string;
  retailer_id?: string;
  name?: string;
};

function requireMetaToken(): string {
  const token = process.env.META_GRAPH_ACCESS_TOKEN;
  if (!token?.trim()) {
    throw new Error(
      'Configura META_GRAPH_ACCESS_TOKEN en Convex (Settings → Environment Variables)',
    );
  }
  return token.trim();
}

/** Normaliza retailer_id para comparación (trim, sin espacios extra). */
export function normalizeRetailerId(raw: string): string {
  return String(raw ?? '').trim();
}

/** IDs internos de Meta Graph (`id`) — distintos del retailer_id del feed. */
export function isMetaGraphProductId(id: string): boolean {
  return /^js[a-z0-9]{20,}$/i.test(normalizeRetailerId(id));
}

/** Mapeo inválido: productRetailerId vacío o finca inexistente (no confundir con id=propertyId — eso es correcto en fincasya). */
export function isInvalidCatalogMapping(
  productRetailerId: string,
  propertyId: string,
): boolean {
  return !normalizeRetailerId(productRetailerId);
}

/** Extrae código de finca del título Meta (ej. "VILLA GREEN 12PAX VC#014" → VC#014). */
export function extractPropertyCodeFromName(name: string): string | null {
  const match = name.match(/\b([A-Z]{2,5}#\d{2,4})\b/i);
  return match ? normalizeRetailerId(match[1].toUpperCase()) : null;
}

/**
 * retailer_id que WhatsApp acepta en product_retailer_id.
 * Prioriza retailer_id del feed; si falta o es id interno, infiere del nombre.
 */
export function resolveWhatsAppRetailerId(product: MetaCatalogProduct): string | null {
  const retailer = normalizeRetailerId(product.retailer_id ?? '');
  if (retailer && !isMetaGraphProductId(retailer)) return retailer;
  if (product.name) {
    const fromName = extractPropertyCodeFromName(product.name);
    if (fromName) return fromName;
  }
  return null;
}

/**
 * Lista todos los productos del catálogo Meta (paginado).
 * Usa retailer_id — el mismo valor que WhatsApp espera en product_retailer_id.
 */
export async function fetchAllCatalogProducts(
  catalogMetaId: string,
): Promise<MetaCatalogProduct[]> {
  const token = requireMetaToken();
  const all: MetaCatalogProduct[] = [];
  let url: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${catalogMetaId}/products` +
    `?fields=retailer_id,id,name&limit=250`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    let parsed: {
      data?: MetaCatalogProduct[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    };
    try {
      parsed = JSON.parse(body) as typeof parsed;
    } catch {
      throw new Error(`Meta Graph API respuesta inválida (${res.status}): ${body.slice(0, 300)}`);
    }
    if (!res.ok || parsed.error) {
      throw new Error(
        `Meta Graph API ${res.status}: ${parsed.error?.message ?? body.slice(0, 300)}`,
      );
    }
    all.push(...(parsed.data ?? []));
    url = parsed.paging?.next ?? null;
  }
  return all;
}

/** retailer_id listo para mapear (descarta vacíos e ids internos Meta). */
export function retailerIdsFromProducts(products: MetaCatalogProduct[]): string[] {
  const ids = new Set<string>();
  for (const p of products) {
    const id = resolveWhatsAppRetailerId(p);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Mapa id interno Meta → retailer_id válido para WhatsApp. */
export function metaInternalIdToRetailer(
  products: MetaCatalogProduct[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products) {
    const retailer = resolveWhatsAppRetailerId(p);
    if (retailer && p.id) map.set(normalizeRetailerId(p.id), retailer);
  }
  return map;
}
