import { buildBlogDocumentEmbedHtml } from "@/features/blog/utils/blog-document-embed";

export type BlogDocumentRef = {
  type: "pdf" | "doc";
  url: string;
  fileName: string;
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i;

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url.trim());
}

export function isDocUrl(url: string): boolean {
  return /\.docx?(\?|#|$)/i.test(url.trim());
}

export function isLikelyImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isPdfUrl(trimmed) || isDocUrl(trimmed)) return false;
  if (IMAGE_EXT.test(trimmed)) return true;
  return !/\.(pdf|docx?|mp4|webm|mov)(\?|#|$)/i.test(trimmed);
}

function fileNameFromUrl(url: string, fallback = "documento"): string {
  try {
    const path = new URL(url, "https://fincasya.com").pathname;
    const base = decodeURIComponent(path.split("/").pop() || fallback);
    return base || fallback;
  } catch {
    const parts = url.split("/").pop()?.split("?")[0];
    return parts ? decodeURIComponent(parts) : fallback;
  }
}

function classifyUrl(url: string): BlogDocumentRef | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isPdfUrl(trimmed)) {
    return { type: "pdf", url: trimmed, fileName: fileNameFromUrl(trimmed, "documento.pdf") };
  }
  if (isDocUrl(trimmed)) {
    return { type: "doc", url: trimmed, fileName: fileNameFromUrl(trimmed, "documento.doc") };
  }
  return null;
}

/** Primer PDF o DOC enlazado en el HTML del artículo. */
export function extractFirstDocumentFromHtml(
  html?: string,
): BlogDocumentRef | null {
  if (!html?.trim()) return null;

  const patterns = [
    /data-pdf-url=["']([^"']+)["']/i,
    /<iframe[^>]+src=["']([^"']+\.pdf[^"']*)["']/i,
    /<a[^>]+href=["']([^"']+\.(?:pdf|docx?))["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const url = match?.[1];
    if (url) {
      const doc = classifyUrl(url);
      if (doc) return doc;
    }
  }

  return null;
}

/** Imagen destacada, o el primer documento del contenido si no hay imagen. */
export function resolvePostFeaturedMedia(
  imageUrl?: string,
  contentHtml?: string,
): { type: "image"; url: string } | BlogDocumentRef | null {
  const image = imageUrl?.trim();
  if (image) {
    if (isLikelyImageUrl(image)) return { type: "image", url: image };
    const asDoc = classifyUrl(image);
    if (asDoc) return asDoc;
  }
  return extractFirstDocumentFromHtml(contentHtml);
}

/** Convierte enlaces sueltos a PDF/DOC en bloques con vista previa embebida. */
export function enhanceBlogContentHtml(html: string): string {
  if (!html.includes(".pdf") && !html.includes(".doc")) return html;

  return html.replace(
    /<a\s+([^>]*?)href=["']([^"']+\.(pdf|docx?))(\?[^"']*)?["']([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, _before, url, _ext, _query, _after, inner) => {
      if (full.includes("blog-document")) return full;
      const plain = inner.replace(/<[^>]+>/g, "").trim();
      const fileName =
        plain && /\.(pdf|docx?)$/i.test(plain)
          ? plain
          : fileNameFromUrl(url);
      return buildBlogDocumentEmbedHtml(url, fileName);
    },
  );
}
