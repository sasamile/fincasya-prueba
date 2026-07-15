'use client';

import { ReviewCard } from './ReviewCard';
import type { Review } from '../types/reviews.types';

interface ReviewsListProps {
  /** undefined = cargando (convención de useQuery de convex/react). */
  reviews: Review[] | undefined;
}

/** Grilla de reseñas con skeleton de carga y estado vacío (port de FincasYaWeb). */
export function ReviewsList({ reviews }: ReviewsListProps) {
  if (reviews === undefined) {
    return (
      <div className="grid md:grid-cols-2 gap-6 py-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse flex gap-4 p-6 rounded-3xl border border-border/60"
          >
            <div className="rounded-full bg-muted h-12 w-12 shrink-0" />
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground bg-muted/40 rounded-2xl border border-dashed border-border">
        <p>Aún no hay reseñas para esta finca.</p>
        <p className="text-sm">¡Sé el primero en compartir tu experiencia!</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 py-4">
      {reviews.map((review) => (
        <ReviewCard key={review._id} review={review} />
      ))}
    </div>
  );
}
