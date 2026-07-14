/**
 * Open Graph para WhatsApp / crawlers.
 * WhatsApp es estricto: falla con WebP, imágenes grandes o URLs relativas.
 * Proxy via images.weserv.nl → JPEG 800×418 (mismo patrón de FincasYaWeb).
 */

/** JPEG 1200×630 (sin alfa): WhatsApp falla con PNG transparentes/cuadrados. */
const DEFAULT_OG_IMAGE = "https://fincasya.com/icons/fincasya-link-logo.jpg";

export function getPublicSiteOrigin(): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env && !/localhost|127\.0\.0\.1/i.test(env)) {
    return env.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`;
  }
  return "https://fincasya.com";
}

export function buildOgImageUrl(imageUrl: string | null | undefined): string {
  const absoluteImageUrl = imageUrl
    ? imageUrl.startsWith("http")
      ? imageUrl
      : `https://fincasya.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
    : DEFAULT_OG_IMAGE;

  if (!imageUrl) return absoluteImageUrl;

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
  const pageUrl = `${origin}${args.path.startsWith("/") ? args.path : `/${args.path}`}`;
  const optimizedImageUrl = buildOgImageUrl(args.imageUrl);
  const description = args.description.slice(0, 200);
  const isDefaultImage = !args.imageUrl;

  return {
    title: args.title,
    description,
    ...(args.noIndex ? { robots: { index: false, follow: false } } : {}),
    alternates: {
      canonical: args.path.startsWith("/") ? args.path : `/${args.path}`,
    },
    openGraph: {
      title: args.title,
      description,
      url: pageUrl,
      siteName: "FincasYa",
      images: [
        {
          url: optimizedImageUrl,
          width: isDefaultImage ? 1200 : 800,
          height: isDefaultImage ? 630 : 418,
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
