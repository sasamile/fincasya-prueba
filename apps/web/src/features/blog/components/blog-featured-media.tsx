"use client";

import { useMemo } from "react";
import Image from "next/image";
import { FileText } from "lucide-react";
import { resolvePostFeaturedMedia } from "@/features/blog/utils/blog-media-utils";
import { BlogPdfPreview } from "@/features/blog/components/blog-pdf-preview";
import { BlogDocFileCard } from "@/features/blog/components/blog-doc-file-card";
import { cn } from "@/lib/utils";

type BlogFeaturedMediaProps = {
  imageUrl?: string;
  contentHtml?: string;
  title: string;
  category: string;
  className?: string;
  imageClassName?: string;
  /** Primera imagen visible (LCP): precarga con prioridad alta. */
  priority?: boolean;
};

function looksLikeUuidFileName(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx?)$/i.test(
    name.trim(),
  );
}

/** Rutas locales o hosts ya permitidos en next.config → next/image. */
function canOptimizeImage(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const host = new URL(url).hostname;
    return (
      host.endsWith(".convex.cloud") ||
      host.endsWith(".amazonaws.com") ||
      host === "lh3.googleusercontent.com" ||
      host === "ui-avatars.com"
    );
  } catch {
    return false;
  }
}

/** Preferir WebP local cuando exista el par optimizado. */
function preferLocalWebp(url: string): string {
  if (url === "/images/PHOTO-2026-07-23-11-02-24.jpg") {
    return "/images/PHOTO-2026-07-23-11-02-24.webp";
  }
  const dsc = url.match(/^\/images\/(DSC09\d+)\.jpg\.jpeg$/i);
  if (dsc) return `/images/${dsc[1]}.webp`;
  return url;
}

export function BlogFeaturedMedia({
  imageUrl,
  contentHtml,
  title,
  category,
  className,
  imageClassName,
  priority = false,
}: BlogFeaturedMediaProps) {
  const media = useMemo(
    () => resolvePostFeaturedMedia(imageUrl, contentHtml),
    [imageUrl, contentHtml],
  );

  if (media?.type === "image") {
    const src = preferLocalWebp(media.url);
    const optimized = canOptimizeImage(src);

    if (optimized) {
      return (
        <div className={cn("relative h-full w-full", className)}>
          <Image
            src={src}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            quality={75}
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            className={cn("object-cover", imageClassName)}
          />
        </div>
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={cn("h-full w-full object-cover", imageClassName, className)}
      />
    );
  }

  if (media?.type === "pdf") {
    const displayName =
      looksLikeUuidFileName(media.fileName) || !media.fileName
        ? title || "Documento PDF"
        : media.fileName;
    return (
      <BlogPdfPreview
        url={media.url}
        fileName={displayName}
        className={cn("h-full", className)}
      />
    );
  }

  if (media?.type === "doc") {
    const displayName =
      looksLikeUuidFileName(media.fileName) || !media.fileName
        ? title || "Documento"
        : media.fileName;
    return (
      <BlogDocFileCard
        url={media.url}
        fileName={displayName}
        className={cn("h-full", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden bg-[#111] text-white",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(254,74,25,0.45), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.08), transparent 50%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/apple-touch-icon.png"
        alt=""
        className="relative z-10 h-16 w-16 rounded-2xl shadow-lg"
        aria-hidden
      />
      <div className="relative z-10 px-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
          {category || "Blog"}
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-white/90">
          {title}
        </p>
      </div>
      <FileText className="absolute right-4 bottom-4 h-5 w-5 text-white/15" aria-hidden />
    </div>
  );
}
