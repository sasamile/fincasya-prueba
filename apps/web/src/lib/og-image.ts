/**
 * Open Graph para WhatsApp / crawlers.
 * WhatsApp es estricto: falla con WebP, PNG raros, imágenes grandes o URLs relativas.
 * Siempre convertimos a JPEG 800×418 vía images.weserv.nl.
 *
 * Importante: `og:url` y `metadataBase` NUNCA deben ser un hostname
 * `*.vercel.app` cuando el link compartido es www.fincasya.com — WhatsApp
 * descarta la preview si el dominio no coincide.
 */

/** Dominio canónico público (links / OG / WhatsApp). */
export const PRODUCTION_SITE_ORIGIN = "https://www.fincasya.com";

/** En prod hoy existe el PNG 1200×630; el JPG se desplegará junto. */
const DEFAULT_OG_IMAGE = "https://www.fincasya.com/icons/fincasya-link-logo.png";

function isEphemeralHost(url: string): boolean {
  return /localhost|127\.0\.0\.1|\.vercel\.app/i.test(url);
}

export function getPublicSiteOrigin(): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env && !isEphemeralHost(env)) {
    return env.replace(/\/$/, "");
  }

  // Producción en Vercel: el hostname interno es *.vercel.app; el dominio
  // real (custom) es el que debe ir en og:url / canonical.
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_ORIGIN;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    // Solo previews / branch deploys: ahí sí tiene sentido el URL de Vercel.
    return vercel.startsWith("http")
      ? vercel.replace(/\/$/, "")
      : `https://${vercel}`;
  }

  return PRODUCTION_SITE_ORIGIN;
}

export function buildOgImageUrl(imageUrl: string | null | undefined): string {
  const absoluteImageUrl = imageUrl
    ? imageUrl.startsWith("http")
      ? imageUrl
      : `${PRODUCTION_SITE_ORIGIN}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
    : DEFAULT_OG_IMAGE;

  return `https://images.weserv.nl/?url=${encodeURIComponent(absoluteImageUrl)}&w=800&h=418&fit=cover&output=jpg&q=75`;
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
    metadataBase: new URL(origin),
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
          width: 800,
          height: 418,
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
