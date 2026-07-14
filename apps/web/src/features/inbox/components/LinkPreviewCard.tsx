'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  domain: string;
};

export function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'`]+/i);
  if (!match) return null;
  return match[0].replace(/[)\],.!?;:'"…]+$/g, '');
}

export function LinkPreviewCard({
  preview,
  loading,
  onDismiss,
  className,
}: {
  preview: LinkPreviewData | null;
  loading?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  if (loading && !preview) {
    return (
      <div
        className={cn(
          'mb-1.5 flex overflow-hidden rounded-xl bg-[#1d1f1f]',
          className,
        )}
      >
        <div className="bg-muted/40 h-[72px] w-[72px] shrink-0 animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2 px-3 py-2.5">
          <div className="bg-muted/50 h-3.5 w-3/4 animate-pulse rounded" />
          <div className="bg-muted/40 h-3 w-full animate-pulse rounded" />
          <div className="bg-muted/30 h-2.5 w-1/3 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const title = preview.title || preview.domain;
  const description = preview.description;
  const domain = (preview.siteName || preview.domain).toLowerCase();

  return (
    <div
      className={cn(
        'relative mb-1.5 flex overflow-hidden rounded-xl bg-[#1d1f1f]',
        className,
      )}
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image}
          alt=""
          className="h-[78px] w-[78px] shrink-0 object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="bg-muted/30 text-muted-foreground flex h-[78px] w-[78px] shrink-0 items-center justify-center text-[11px] font-semibold uppercase">
          {preview.domain.slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1 py-2 pr-8 pl-3">
        <p className="line-clamp-1 text-[13.5px] leading-snug font-semibold text-[#e9edef]">
          {title}
        </p>
        {description ? (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[12.5px] leading-snug">
            {description}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-1 truncate text-[11.5px] lowercase">
          {domain}
        </p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full"
          aria-label="Cerrar preview"
          title="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
