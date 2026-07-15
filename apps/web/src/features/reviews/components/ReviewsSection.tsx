'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ReviewsList } from './ReviewsList';
import { ReviewForm } from './ReviewForm';

interface ReviewsSectionProps {
  propertyId: string;
}

/**
 * Sección pública de reseñas de una finca (port de FincasYaWeb
 * reviews-section, sobre Convex en vez de REST): header con promedio +
 * contador, modal con el formulario y la grilla de reseñas.
 */
export function ReviewsSection({ propertyId }: ReviewsSectionProps) {
  const reviews = useQuery(api.reviews.list, { propertyId });
  const [isOpen, setIsOpen] = useState(false);

  const reviewCount = reviews?.length ?? 0;
  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : null;

  return (
    <div className="py-10 max-md:px-3" id="reviews-section">
      <Separator className="mb-10" />
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Lo que dicen nuestros huéspedes
          </h2>
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            {averageRating !== null && (
              <span className="inline-flex items-center gap-1 font-bold text-foreground">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {averageRating.toFixed(1)}
              </span>
            )}
            <span>
              {reviewCount === 1 ? '1 evaluación' : `${reviewCount} evaluaciones`}
            </span>
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="max-md:w-full rounded-lg px-6">
              Escribir una reseña
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl">
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle className="text-base font-bold text-center">
                Escribir una reseña
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 overflow-y-auto overscroll-contain">
              <ReviewForm propertyId={propertyId} onReviewAdded={() => setIsOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ReviewsList reviews={reviews} />
    </div>
  );
}
