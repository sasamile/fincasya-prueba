"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { generatePdfPreviewFromUrl } from "@/lib/pdf-preview";

type BlogPdfPreviewProps = {
  url: string;
  fileName: string;
  className?: string;
};

export function BlogPdfPreview({ url, fileName, className }: BlogPdfPreviewProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setThumbnail(null);
    setFailed(false);

    void generatePdfPreviewFromUrl(url)
      .then((result) => {
        if (cancelled) return;
        setThumbnail(result.thumbnail);
        setPageCount(result.pageCount);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) {
    return (
      <div
        className={cn(
          "relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-[#111] p-6 text-center",
          className,
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(254,74,25,0.4), transparent 55%)",
          }}
        />
        <FileText className="relative z-10 h-10 w-10 text-primary" />
        <p className="relative z-10 line-clamp-2 max-w-sm text-sm font-semibold text-white">
          {fileName}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-white"
        >
          Abrir PDF
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted/20",
        className,
      )}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={`Vista previa de ${fileName}`}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/75 via-black/40 to-transparent px-4 py-3">
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-bold text-white">{fileName}</p>
          {pageCount > 0 ? (
            <p className="text-[11px] text-white/80">
              {pageCount} página{pageCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-white"
        >
          Abrir
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
