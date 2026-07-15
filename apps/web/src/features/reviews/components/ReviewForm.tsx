'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ReviewFormProps {
  propertyId: string;
  onReviewAdded: () => void;
}

/**
 * Formulario público de reseña (port de FincasYaWeb review-form, sin login):
 * estrellas + nombre (texto simple, se guarda denormalizado) + comentario.
 */
export function ReviewForm({ propertyId, onReviewAdded }: ReviewFormProps) {
  const createReview = useMutation(api.reviews.create);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [userName, setUserName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Por favor, selecciona una calificación.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createReview({
        propertyId,
        rating,
        comment: comment.trim() || undefined,
        userName: userName.trim() || undefined,
      });
      toast.success('¡Gracias por tu reseña!');
      setRating(0);
      setUserName('');
      setComment('');
      onReviewAdded();
    } catch {
      toast.error('Hubo un error al enviar tu reseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          ¿Cómo calificarías tu experiencia?
        </h3>
        <p className="text-sm text-muted-foreground">
          Tu opinión ayuda a otros viajeros a elegir la mejor opción.
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`Calificar con ${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
              className="focus:outline-none transition-transform active:scale-95"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={cn(
                  'w-9 h-9 transition-colors',
                  star <= (hoverRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-muted text-muted-foreground/30',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="review-name" className="text-sm font-bold text-foreground/80">
          Tu nombre
        </label>
        <Input
          id="review-name"
          placeholder="¿Cómo te llamas?"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          maxLength={80}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="review-comment" className="text-sm font-bold text-foreground/80">
          Tu comentario
        </label>
        <Textarea
          id="review-comment"
          placeholder="¿Qué fue lo que más te gustó? ¿Alguna recomendación para futuros huéspedes?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
          className="min-h-[140px] p-4 rounded-xl resize-none"
        />
      </div>

      <div className="flex justify-end pt-4 border-t border-border/60">
        <Button
          type="submit"
          size="lg"
          className="w-full h-12 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
          disabled={isSubmitting || rating === 0 || !comment.trim()}
        >
          {isSubmitting ? 'Enviando...' : 'Publicar reseña'}
        </Button>
      </div>
    </form>
  );
}
