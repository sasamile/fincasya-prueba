'use client';

import { Star } from 'lucide-react';
import { cn, getSeededRating } from '@/lib/utils';
import type { PropertyDetail } from '../types';

const WHATSAPP_NUMBER = '573157773937';

interface FincaContactCardProps {
  finca: PropertyDetail;
}

export function FincaContactCard({ finca }: FincaContactCardProps) {
  const price = finca.priceBase;
  const priceOriginal = finca.priceOriginal ?? 0;
  const rating = finca.rating;
  const reviewsCount = finca.reviewsCount;

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hola, me interesa la finca *${finca.title}* (${finca.location}). ¿Está disponible?`,
  )}`;

  const cardContent = (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">${price.toLocaleString('es-CO')}</span>
            {priceOriginal > 0 && (
              <span className="text-sm font-medium text-muted-foreground line-through decoration-red-500/50">
                ${priceOriginal.toLocaleString('es-CO')}
              </span>
            )}
          </div>
          <span className="text-base font-light text-muted-foreground"> noche</span>
        </div>
        <div className="flex items-center gap-1 text-sm pt-1">
          <Star className="w-4 h-4 fill-foreground text-foreground" />
          <span className="font-medium">
            {rating && rating > 0 ? rating.toFixed(1) : getSeededRating(finca.id)}
          </span>
          <span className="text-muted-foreground">
            · {reviewsCount > 0 ? `${reviewsCount} evaluaciones` : 'Nuevo'}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Precio de referencia. Confirma disponibilidad y condiciones con un asesor antes de reservar.
      </p>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full h-12 items-center justify-center text-base font-semibold rounded-lg mb-4 bg-[#fe4a19] hover:bg-[#fe4a19]/90 text-white shadow-lg shadow-orange-500/20 transition-all duration-300 active:scale-[0.98]"
      >
        Validar disponibilidad
      </a>

      <p className="text-center text-sm text-muted-foreground">No se te cobrará nada todavía</p>
    </div>
  );

  return (
    <>
      <div className="hidden md:block sticky top-28 bg-card border border-border/40 rounded-xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all duration-300">
        {cardContent}
      </div>

      {/* Mobile sticky footer — estilo Airbnb */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t-[0.5px] border-zinc-200 p-3 px-6 flex justify-between items-center h-[72px]">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col text-left active:scale-[0.98] transition-transform min-w-0"
        >
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-foreground">
              ${price.toLocaleString('es-CO')}
            </span>
            <span className="text-[14px] font-normal text-muted-foreground">noche</span>
          </div>
          <span className="text-[14px] font-semibold text-foreground underline decoration-zinc-400 underline-offset-2 mt-0.5">
            Consultar disponibilidad
          </span>
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex h-[48px] items-center justify-center px-6 sm:px-10 text-[16px] font-bold rounded-[8px] active:scale-[0.95] transition-transform shadow-none',
            'bg-[#fe4a19] hover:bg-[#fe4a19]/90 text-white',
          )}
        >
          Disponibilidad
        </a>
      </div>
    </>
  );
}
