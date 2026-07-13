"use client";

import { useMemo } from "react";
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
};

export function BlogFeaturedMedia({
  imageUrl,
  contentHtml,
  title,
  category,
  className,
  imageClassName,
}: BlogFeaturedMediaProps) {
  const media = useMemo(
    () => resolvePostFeaturedMedia(imageUrl, contentHtml),
    [imageUrl, contentHtml],
  );

  if (media?.type === "image") {
    return (
      <img
        src={media.url}
        alt={title}
        className={cn("h-full w-full object-cover", imageClassName, className)}
      />
    );
  }

  if (media?.type === "pdf") {
    return (
      <BlogPdfPreview
        url={media.url}
        fileName={media.fileName}
        className={cn("h-full", className)}
      />
    );
  }

  if (media?.type === "doc") {
    return (
      <BlogDocFileCard
        url={media.url}
        fileName={media.fileName}
        className={cn("h-full", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full items-center justify-center text-muted-foreground/30",
        className,
      )}
    >
      <span className="text-6xl font-bold">{category[0]}</span>
    </div>
  );
}
