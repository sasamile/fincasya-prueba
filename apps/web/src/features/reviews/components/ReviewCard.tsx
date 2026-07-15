'use client';

import { Star, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Review } from '../types/reviews.types';

interface ReviewCardProps {
  review: Review;
}

/** Tarjeta de una reseña (port de FincasYaWeb review-card, sin avatar externo). */
export function ReviewCard({ review }: ReviewCardProps) {
  const userName = review.user?.name || 'Huésped';
  const date = format(new Date(review.createdAt), 'MMMM yyyy', { locale: es });

  return (
    <div className="group flex flex-col gap-4 p-6 rounded-3xl bg-background border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-muted/40 to-transparent rounded-bl-full -mr-16 -mt-16 pointer-events-none" />

      <div className="flex items-center gap-4 relative z-10">
        <div className="relative shrink-0">
          <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
            <User className="w-6 h-6 text-orange-500" />
          </div>
          {review.verified && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-background rounded-full shadow-sm flex items-center justify-center"
              title="Estadía verificada"
            >
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h4 className="font-bold text-foreground tracking-tight leading-tight truncate">
            {userName}
          </h4>
          <span className="text-xs font-medium text-muted-foreground mt-0.5 capitalize">
            {date}
          </span>
        </div>
      </div>

      <div className="space-y-2 relative z-10">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'w-4 h-4',
                star <= review.rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-muted text-muted-foreground/30',
              )}
            />
          ))}
          <span className="ml-2 text-sm font-bold text-foreground/80">
            {review.rating.toFixed(1)}
          </span>
        </div>

        {review.comment ? (
          <p className="text-foreground/70 text-sm leading-relaxed line-clamp-5">
            {review.comment}
          </p>
        ) : null}
      </div>

      {review.verified && (
        <div className="flex items-center gap-1.5 mt-auto pt-1 relative z-10">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">
            Estadía verificada
          </span>
        </div>
      )}
    </div>
  );
}
