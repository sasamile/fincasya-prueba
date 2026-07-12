/** Carrusel de favoritas — port 1:1 de FincasYaWeb favorites-carousel.tsx. */
import { useMemo } from 'react';
import type { PropertyResponse } from '../types';
import { FincaCardHome } from './FincaCardHome';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

interface FavoritesCarouselProps {
  fincas: PropertyResponse[];
}

export function FavoritesCarousel({ fincas }: FavoritesCarouselProps) {
  const carouselKey = useMemo(() => fincas.map((f) => f.id).join(','), [fincas]);

  if (fincas.length === 0) return null;

  return (
    <div className="mb-12 mt-4">
      <div className="relative p-6 md:p-8 rounded-[32px] border border-primary/20 bg-primary/5 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div>
              <h3 className="text-xl md:text-xl font-bold text-foreground">Fincas Favoritas</h3>
              <p className="text-xs text-muted-foreground">
                Seleccionadas especialmente para ti en esta categoría
              </p>
            </div>
          </div>

          <Carousel key={carouselKey} opts={{ align: 'start', loop: false }} className="w-full">
            <CarouselContent
              className={cn('-ml-4 md:-ml-6 items-start', fincas.length <= 3 && 'md:justify-center')}
            >
              {fincas.map((finca) => (
                <CarouselItem
                  key={finca.id}
                  className={cn(
                    'pl-4 md:pl-6 basis-full md:basis-1/2 lg:basis-1/4',
                    fincas.length === 1 && 'lg:max-w-[350px]',
                    fincas.length === 2 && 'lg:basis-1/3',
                    fincas.length === 3 && 'lg:basis-1/3',
                  )}
                >
                  <div>
                    <FincaCardHome
                      finca={finca}
                      badge={finca.isNew ? { text: 'Nueva', color: 'yellow' } : undefined}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {fincas.length > 1 && (
              <>
                <CarouselPrevious className="absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 bg-background border-primary/30 text-primary hover:bg-accent hover:text-primary h-9 w-9 md:h-11 md:w-11 shadow-lg transition-opacity z-10" />
                <CarouselNext className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 bg-background border-primary/30 text-primary hover:bg-accent hover:text-primary h-9 w-9 md:h-11 md:w-11 shadow-lg transition-opacity z-10" />
              </>
            )}
          </Carousel>
        </div>
      </div>
    </div>
  );
}
