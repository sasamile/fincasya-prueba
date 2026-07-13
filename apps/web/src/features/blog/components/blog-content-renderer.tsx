"use client";

import { useEffect, useMemo, useRef } from "react";
import { generatePdfPreviewFromUrl } from "@/lib/pdf-preview";
import {
  BLOG_CONTENT_PROSE_CLASSES,
} from "@/features/blog/utils/blog-document-embed";
import { enhanceBlogContentHtml } from "@/features/blog/utils/blog-media-utils";

type BlogContentRendererProps = {
  html: string;
  className?: string;
};

async function hydratePdfThumbnailSlot(slot: HTMLElement, url: string) {
  if (slot.dataset.pdfThumbReady === "true") return;
  slot.dataset.pdfThumbReady = "loading";

  try {
    const { thumbnail, pageCount } = await generatePdfPreviewFromUrl(url);
    slot.dataset.pdfThumbReady = "true";
    slot.innerHTML = `
      <img src="${thumbnail}" alt="Vista previa del PDF" class="h-full w-full object-cover object-top" />
      <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-4 py-2 text-[11px] font-semibold text-white">
        Vista previa · ${pageCount} pág.
      </div>
    `;
  } catch {
    slot.dataset.pdfThumbReady = "true";
    slot.innerHTML = `
      <div class="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No se pudo generar la vista previa. Usa el enlace de descarga.
      </div>
    `;
  }
}

export function BlogContentRenderer({ html, className }: BlogContentRendererProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const enhancedHtml = useMemo(() => enhanceBlogContentHtml(html), [html]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const slots = root.querySelectorAll<HTMLElement>(
      ".blog-document-pdf [data-pdf-thumbnail-slot]",
    );

    slots.forEach((slot) => {
      const container = slot.closest<HTMLElement>(".blog-document-pdf");
      const url = container?.dataset.pdfUrl;
      if (!url) return;
      void hydratePdfThumbnailSlot(slot, url);
    });
  }, [enhancedHtml]);

  return (
    <div
      ref={rootRef}
      className={className ?? BLOG_CONTENT_PROSE_CLASSES}
      dangerouslySetInnerHTML={{ __html: enhancedHtml }}
    />
  );
}
