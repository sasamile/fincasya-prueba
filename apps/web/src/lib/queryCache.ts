/**
 * Caché en memoria (a nivel de módulo) para que reabrir un chat o el catálogo
 * muestre AL INSTANTE lo último visto, mientras la consulta en vivo de Convex
 * se resuelve en segundo plano. Vive mientras la pestaña está abierta.
 */
export const messagesCache = new Map<string, unknown>();
export const catalogCache = { value: undefined as unknown };

/** Devuelve el valor en vivo si existe; si no, el último cacheado. */
export function withCache<T>(live: T | undefined, cache: Map<string, unknown>, key: string): T | undefined {
  if (live !== undefined) {
    cache.set(key, live);
    return live;
  }
  return cache.get(key) as T | undefined;
}
