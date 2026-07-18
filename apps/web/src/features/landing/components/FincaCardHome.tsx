/** Card de finca del home — port de FincasYaWeb finca-card-home.tsx.
 *  (img nativa en vez de next/image; iconos: SVG → emoji → inferido → check.) */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, Users, Check } from 'lucide-react';
import { cn, getSeededRating, slugify } from '@/lib/utils';
import { inferEmojiForFeatureName } from '@/features/fincas/utils/catalog-description';
import type { PropertyResponse } from '../types';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';

type CardFeature = PropertyResponse['features'][number];

function resolveFeatureEmoji(feature: CardFeature): string | null {
  if (feature.emoji?.trim()) return feature.emoji.trim();
  const inferred = inferEmojiForFeatureName(feature.name);
  // inferEmoji cae en ✅ cuando no reconoce el nombre; eso no aporta en la card.
  return inferred === '✅' ? null : inferred;
}

function featureVisualKey(f: CardFeature): string {
  return f.iconUrl || resolveFeatureEmoji(f) || f.name;
}

function FeatureIcon({ feature }: { feature: CardFeature }) {
  if (feature.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={feature.iconUrl}
        alt={feature.name}
        className="w-full h-full object-contain"
      />
    );
  }
  const emoji = resolveFeatureEmoji(feature);
  if (emoji) {
    return (
      <span className="text-sm leading-none" aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center border border-border">
      <Check className="w-3 h-3 text-muted-foreground" />
    </div>
  );
}

interface FincaCardHomeProps {
  finca: PropertyResponse;
  badge?: {
    text: string;
    color?: 'green' | 'orange' | 'blue' | 'yellow';
  };
  /** Enlace con ?modo=venta para marketplace */
  modoVenta?: boolean;
}

export function FincaCardHome({ finca, badge, modoVenta }: FincaCardHomeProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  const price = finca.priceBase;
  const baseUrl = `/fincas/${finca.slug || slugify(finca.title)}`;
  const fincaUrl = modoVenta ? `${baseUrl}?modo=venta` : baseUrl;

  useEffect(() => {
    if (!api) return;
    setCurrentImageIndex(api.selectedScrollSnap());
    api.on('select', () => {
      setCurrentImageIndex(api.selectedScrollSnap());
    });
  }, [api]);

  const images = finca.images.length > 0 ? finca.images : ['/gml/Logo.png'];

  return (
    <div className="group w-full block border border-border rounded-3xl p-4 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 bg-card/30">
      <div className="relative aspect-4/3 rounded-2xl overflow-hidden mb-4">
        {/* Image Carousel */}
        <Carousel setApi={setApi} opts={{ loop: true }} className="w-full h-full">
          <CarouselContent className="h-full ml-0">
            {images.map((image, index) => (
              <CarouselItem key={index} className="pl-0 h-full w-full">
                <Link href={fincaUrl} className="block w-full h-full">
                  <div className="relative w-full h-full">
                    <img
                      src={image}
                      alt={finca.title || 'Finca'}
                      loading={index === 0 ? undefined : 'lazy'}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 border-none shadow-sm h-8 w-8" />
          <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 border-none shadow-sm h-8 w-8" />
        </Carousel>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
          {finca.images.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors shadow-sm',
                idx === currentImageIndex ? 'bg-white' : 'bg-white/50',
              )}
            />
          ))}
        </div>
        {/* Badge */}
        {badge ? (
          <div
            className={cn(
              'absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide text-white shadow-sm',
              badge.color === 'green'
                ? 'bg-green-600'
                : badge.color === 'orange'
                  ? 'bg-orange-500'
                  : badge.color === 'yellow'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-blue-600',
            )}
          >
            {badge.text}
          </div>
        ) : finca.isFavorite ? (
          <div className="absolute top-3 left-3 z-20 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide text-foreground bg-accent shadow-lg flex items-center gap-1.5 uppercase">
              Favorita entre viajeros
            </div>
          </div>
        ) : null}
        {/* Favorite Button */}
        <button
          className="absolute top-3 right-3 z-10 transition-transform active:scale-95"
          onClick={(e) => {
            e.preventDefault();
            setIsFavorited(!isFavorited);
          }}
        >
          <Heart
            className={cn(
              'w-6 h-6 drop-shadow-md transition-colors',
              isFavorited ? 'fill-red-500 text-red-500' : 'fill-black/50 text-white',
            )}
          />
        </button>
      </div>
      {/* Content */}
      <Link href={fincaUrl} className="block">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-foreground line-clamp-1 flex-1 mr-2">{finca.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-3.5 h-3.5 fill-current text-primary" />
            <span className="text-xs font-medium text-foreground">
              {finca.rating && finca.rating > 0 ? finca.rating.toFixed(1) : getSeededRating(finca.id)}
            </span>
            <span className="text-xs text-muted-foreground">({finca.reviewsCount})</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate text-xs leading-relaxed">{finca.location}</span>
        </div>

        {/* Feature Icons */}
        {finca.features.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            {(() => {
              const seen = new Set<string>();
              const unique = finca.features.filter((f) => {
                const key = featureVisualKey(f);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              // Prioriza amenidades con SVG o emoji para no llenar la fila de checks.
              const ranked = [...unique].sort((a, b) => {
                const score = (f: CardFeature) =>
                  f.iconUrl ? 2 : resolveFeatureEmoji(f) ? 1 : 0;
                return score(b) - score(a);
              });
              return ranked.slice(0, 4).map((feature, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                  title={feature.name}
                >
                  <FeatureIcon feature={feature} />
                </div>
              ));
            })()}
          </div>
        )}

        <div className="flex items-end justify-between gap-2 min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 text-sm">
            {finca.priceOriginal != null && finca.priceOriginal > 0 && (
              <span className="text-[11px] text-muted-foreground line-through decoration-red-400/50 mr-0.5 italic">
                ${finca.priceOriginal.toLocaleString('es-CO')}
              </span>
            )}
            <span className="text-[12.5px] font-bold text-foreground">
              ${price.toLocaleString('es-CO')}
            </span>
            <span className="text-muted-foreground font-normal text-xs">noche</span>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap tabular-nums"
            title={`Capacidad hasta ${finca.capacity} personas`}
          >
            <Users className="size-3.5 shrink-0" aria-hidden />
            {finca.capacity} pax
          </span>
        </div>
      </Link>
    </div>
  );
}
