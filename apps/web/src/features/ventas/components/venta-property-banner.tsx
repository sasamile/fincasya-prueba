"use client";

import { Home } from "lucide-react";
import type { SaleLinkPublicData } from "./venta-page-content";

interface Props {
  property: NonNullable<SaleLinkPublicData["property"]>;
}

export function VentaPropertyBanner({ property }: Props) {
  const subtitle = [property.location, property.code].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-sm">
      {property.images?.[0] ? (
        <div className="relative h-40 w-full sm:h-48">
          <img
            src={property.images[0]}
            alt={property.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h2 className="line-clamp-2 text-base font-bold leading-snug text-white drop-shadow-sm">
              {property.title}
            </h2>
            {subtitle ? (
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/85">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Home className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">
              {property.title}
            </h2>
            {subtitle ? (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
