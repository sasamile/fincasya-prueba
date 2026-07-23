/**
 * Open Graph para WhatsApp / crawlers.
 * WhatsApp es estricto: falla con WebP, PNG raros, o cuando `og:url` no
 * coincide con el dominio del link compartido (www.fincasya.com).
 *
 * Regla: `og:url` / canonical SIEMPRE usan el dominio público en deploys
 * remotos — nunca `*.vercel.app`.
 */

/** Dominio canónico público (links / OG / WhatsApp). */
export const PRODUCTION_SITE_ORIGIN = "https://www.fincasya.com";

/** JPG cuadrado de marca — WhatsApp prefiera JPEG sobre PNG. */
const DEFAULT_OG_IMAGE = `${PRODUCTION_SITE_ORIGIN}/icons/fincasya-link-logo.jpg`;

function isEphemeralHost(url: string): boolean {
  return /localhost|127\.0\.0\.1|\.vercel\.app/i.test(url);
}

function tryParseHttpOrigin(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value || isEphemeralHost(value)) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalDev(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "development"
  );
}

/**
 * Origen para og:url / canonical.
 * En local: localhost. En cualquier deploy remoto: siempre www.fincasya.com
 * (aunque Vercel sirva el sitio desde un hostname *.vercel.app).
 */
export function getPublicSiteOrigin(): string {
  if (isLocalDev()) {
    return (
      tryParseHttpOrigin(
        process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
      ) ?? "http://localhost:3789"
    );
  }

  return (
    tryParseHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    PRODUCTION_SITE_ORIGIN
  );
}

/** Absoluta en el dominio público; WebP → JPG para crawlers. */
export function toAbsolutePublicImageUrl(
  imageUrl: string | null | undefined,
): string {
  if (!imageUrl?.trim()) return DEFAULT_OG_IMAGE;

  let pathOrUrl = imageUrl.trim();
  // Preferir JPEG del banner del blog (OG / WhatsApp no siempre abre WebP).
  if (pathOrUrl.endsWith(".webp")) {
    pathOrUrl = pathOrUrl.replace(/\.webp$/i, ".jpg");
  }
  // Par local DSC: si alguien guardó .webp en Convex, OG usa el jpeg legacy
  // solo si no hay jpg; los DSC tienen .jpg.jpeg — no aplica aquí.

  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    try {
      const u = new URL(pathOrUrl);
      if (isEphemeralHost(u.origin)) {
        return `${PRODUCTION_SITE_ORIGIN}${u.pathname}${u.search}`;
      }
      return pathOrUrl;
    } catch {
      return DEFAULT_OG_IMAGE;
    }
  }

  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${PRODUCTION_SITE_ORIGIN}${path}`;
}

/**
 * URL de imagen OG.
 * Misma origen que el link (www.fincasya.com) — más fiable en WhatsApp
 * que proxies de terceros.
 */
export function buildOgImageUrl(imageUrl: string | null | undefined): string {
  return toAbsolutePublicImageUrl(imageUrl);
}

export function buildOgMetadata(args: {
  title: string;
  description: string;
  path: string;
  imageUrl?: string | null;
  /** No indexar (links de venta / check-in). */
  noIndex?: boolean;
}) {
  const origin = getPublicSiteOrigin();
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const pageUrl = `${origin}${path}`;
  const optimizedImageUrl = buildOgImageUrl(args.imageUrl);
  const description = args.description.slice(0, 200);

  return {
    title: args.title,
    description,
    ...(args.noIndex ? { robots: { index: false, follow: false } } : {}),
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: args.title,
      description,
      url: pageUrl,
      siteName: "FincasYa",
      images: [
        {
          url: optimizedImageUrl,
          secureUrl: optimizedImageUrl,
          width: 1200,
          height: 630,
          alt: args.title,
          type: "image/jpeg",
        },
      ],
      locale: "es_CO" as const,
      type: "website" as const,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: args.title,
      description,
      images: [optimizedImageUrl],
    },
    other: {
      image: optimizedImageUrl,
      thumbnail: optimizedImageUrl,
    },
  };
}
