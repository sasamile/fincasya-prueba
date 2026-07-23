/**
 * Origen público canónico para links en correos, WhatsApp y portales.
 * Nunca usar `*.vercel.app` en producción — los admins/clientes abren
 * www.fincasya.com y el preview de Vercel rompe el flujo.
 */

export const PRODUCTION_SITE_ORIGIN = 'https://www.fincasya.com';

function isEphemeralHost(url: string): boolean {
  return /localhost|127\.0\.0\.1|\.vercel\.app/i.test(url);
}

function tryParseHttpOrigin(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value || isEphemeralHost(value)) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Base URL del sitio público (sin slash final).
 * En local: localhost. En remoto: siempre www.fincasya.com salvo
 * `SITE_URL`/`NEXT_PUBLIC_SITE_URL` con un dominio real no-Vercel.
 */
export function getPublicSiteOrigin(): string {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'development') {
    return (
      tryParseHttpOrigin(
        process.env.SITE_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_APP_URL,
      ) ?? 'http://localhost:3789'
    );
  }

  return (
    tryParseHttpOrigin(process.env.SITE_URL) ||
    tryParseHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    PRODUCTION_SITE_ORIGIN
  );
}

/** Alias usado en correos / mensajes. */
export function siteUrl(): string {
  return getPublicSiteOrigin();
}
