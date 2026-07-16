"use client";

import { Home } from "lucide-react";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  property: NonNullable<SaleLinkPublicData["property"]>;
}

export function VentaPropertyBanner({ property }: Props) {
  const subtitle = [property.location, property.code].filter(Boolean).join(" · ");
  const image = property.images?.[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {image ? (
        <div className="relative aspect-video w-full sm:aspect-21/9 sm:max-h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={property.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-4 sm:p-5">
            <h2 className="line-clamp-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
              {property.title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-white/80">{subtitle}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Home className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-base font-semibold tracking-tight">
              {property.title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
