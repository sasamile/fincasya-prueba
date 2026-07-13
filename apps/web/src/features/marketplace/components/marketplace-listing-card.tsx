"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { ImageWithBlur } from "@/components/ui/image-with-blur";
import { fincaDetailPath } from "@/features/fincas/utils/property-listing-mode";
import type { PropertyResponse } from "@/features/fincas/types/fincas.types";
import { openSaleWhatsApp } from "@/features/marketplace/lib/sale-whatsapp";
import {
  formatSaleSquareMeters,
  saleListingDescription,
} from "@/features/fincas/utils/sale-listing";
import { MapPin, Star } from "lucide-react";

function formatPropertyType(type?: string): string {
  if (!type) return "Propiedad";
  const labels: Record<string, string> = {
    FINCA: "Finca",
    CASA_CAMPESTRE: "Casa campestre",
    VILLA: "Villa",
    HACIENDA: "Hacienda",
    QUINTA: "Quinta",
    APARTAMENTO: "Apartamento",
    CASA: "Casa",
    CASA_PRIVADA: "Casa privada",
    CASA_EN_CONJUNTO_CERRADO: "Casa en conjunto",
    VILLA_PRIVADA: "Villa privada",
    CONDOMINIO: "Condominio",
    CASA_BOUTIQUE: "Casa boutique",
    YATE: "Yate",
    ISLA: "Isla",
    GLAMPING: "Glamping",
  };
  return labels[type] ?? type.replace(/_/g, " ").toLowerCase();
}

function plainDescription(html: string | undefined, maxLen: number): string {
  if (!html) return "";
  const t = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > maxLen ? `${t.slice(0, maxLen).trim()}…` : t;
}

interface MarketplaceListingCardProps {
  finca: PropertyResponse;
}

export function MarketplaceListingCard({ finca }: MarketplaceListingCardProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [slide, setSlide] = useState(0);
  const images = finca.images?.length ? finca.images : ["/placeholder.jpg"];
  const total = images.length;
  const detailHref = fincaDetailPath(finca, "sale");
  const saleAmount =
    finca.salePriceCop != null &&
    Number.isFinite(finca.salePriceCop) &&
    finca.salePriceCop > 0
      ? finca.salePriceCop
      : null;
  const priceLine = saleAmount
    ? `Desde $ ${saleAmount.toLocaleString("es-CO")}`
    : "Consultar precio";
  const headline = `${formatPropertyType(finca.type)} en ${finca.location}`;
  const snippet = plainDescription(saleListingDescription(finca), 220);
  const areaLabel = formatSaleSquareMeters(finca.saleSquareMeters);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSlide(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <article className="group flex flex-col md:flex-row w-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="relative w-full md:w-[min(42%,380px)] md:shrink-0 aspect-4/3 md:aspect-auto md:min-h-[260px]">
        <Carousel
          setApi={setApi}
          opts={{ loop: total > 1 }}
          className="h-full w-full"
        >
          <CarouselContent className="h-full ml-0">
            {images.map((src, index) => (
              <CarouselItem key={index} className="pl-0 h-full basis-full">
                <Link
                  href={detailHref}
                  className="relative block h-full min-h-[220px] md:min-h-[260px]"
                >
                  <ImageWithBlur
                    src={src}
                    alt={`${finca.title} — ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    priority={index === 0}
                    loading={index === 0 ? undefined : "lazy"}
                    sizes="(max-width: 768px) 100vw, 380px"
                  />
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          {total > 1 ? (
            <>
              <CarouselPrevious
                type="button"
                className="left-2 border-none bg-black/45 text-white hover:bg-black/60 hover:text-white h-9 w-9"
              />
              <CarouselNext
                type="button"
                className="right-2 border-none bg-black/45 text-white hover:bg-black/60 hover:text-white h-9 w-9"
              />
            </>
          ) : null}
        </Carousel>
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide text-white bg-orange-500 shadow-sm">
            En venta
          </span>
          {finca.isFavorite ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide text-amber-950 bg-amber-400 shadow-sm">
              <Star className="w-3 h-3 fill-current" />
              Destacado
            </span>
          ) : null}
        </div>
        {total > 1 ? (
          <div className="absolute bottom-3 right-3 z-10 rounded-md bg-black/55 text-white text-[11px] font-semibold px-2 py-0.5 pointer-events-none">
            {slide + 1}/{total}
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-linear-to-t from-black/70 to-transparent pt-4 pb-1.5 px-3 pointer-events-none">
          <p className="text-white text-xs font-semibold truncate drop-shadow-sm">
            FincasYa · Marketplace
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col min-w-0 p-5 md:p-6 md:pl-7 pb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
          FincasYa
        </span>

        <p className="text-2xl md:text-[26px] font-bold text-foreground tracking-tight mb-2">
          {priceLine}
        </p>
        <p className="text-sm md:text-base font-semibold text-foreground/90 leading-snug mb-3 line-clamp-2">
          {headline}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1">{finca.location}</span>
          </span>
          <span className="text-border">|</span>
          <span>{finca.capacity} personas</span>
          {areaLabel ? (
            <>
              <span className="text-border">|</span>
              <span>{areaLabel}</span>
            </>
          ) : null}
          {finca.code ? (
            <>
              <span className="text-border">|</span>
              <span className="font-mono text-[11px]">Ref. {finca.code}</span>
            </>
          ) : null}
        </div>

        <h2 className="text-sm font-bold text-foreground line-clamp-2 mb-2">
          {finca.title}
        </h2>
        {snippet ? (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">
            {snippet}
          </p>
        ) : null}

        <div className="mt-auto pt-1">
          <Button
            type="button"
            className="w-full sm:w-auto rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold gap-2 shadow-sm h-11 px-8"
            onClick={() => openSaleWhatsApp(finca)}
          >
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </Button>
        </div>
      </div>
    </article>
  );
}
