/** Reseñas de Google — port de FincasYaWeb testimonials-section.tsx.
 *  Data: snapshot local de reseñas reales (google-reviews.json). Los modales
 *  usan overlays propios (mismo look) en vez de radix Dialog. */
import { Heart, Star, X, MessageCircle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import GOOGLE_REVIEWS from '../data/google-reviews.json';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  location: string;
  quote: string;
  rating: number;
  image: string;
  photos?: string[];
  likes?: number;
  profileUrl?: string | null;
  ownerResponse?: {
    text: string;
    date: string | null;
  } | null;
}

const REVIEWS_DATA = GOOGLE_REVIEWS as unknown as {
  reviews: Testimonial[];
  totalCount?: number;
};

/**
 * URLs de fotos de reseñas que ya fallaron (Google expira los links de fotos
 * adjuntas del snapshot con el tiempo, a diferencia de los avatares de perfil
 * que son estables). Se comparte entre instancias para no reintentar cargas
 * rotas conocidas.
 */
const brokenPhotoUrls = new Set<string>();

/** Fotos de una reseña, excluyendo las que ya se confirmó que no cargan. */
function usableReviewPhotos(photos: string[] | undefined): string[] {
  return (photos ?? []).filter((p) => !brokenPhotoUrls.has(p));
}

export function TestimonialsSection() {
  const testimonials: Testimonial[] = REVIEWS_DATA.reviews ?? [];
  const totalCount = REVIEWS_DATA.totalCount ?? 125;
  const [visibleTestimonials, setVisibleTestimonials] = useState<Testimonial[]>([]);
  const [selectedReview, setSelectedReview] = useState<Testimonial | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  // Fuerza un re-render cuando una foto de reseña falla (Google la expiró),
  // para que `usableReviewPhotos` la excluya del carrusel.
  const [, bumpPhotoFilter] = useState(0);
  const markPhotoBroken = (url: string) => {
    brokenPhotoUrls.add(url);
    bumpPhotoFilter((n) => n + 1);
  };

  // Lightbox
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const openLightbox = (images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // Infinite scroll de la galería
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]!.isIntersecting && visibleTestimonials.length < testimonials.length) {
          setPage((prev) => prev + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [visibleTestimonials.length, testimonials.length],
  );

  useEffect(() => {
    setVisibleTestimonials(testimonials.slice(0, page * PAGE_SIZE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const carouselItems = testimonials.slice(0, 10);

  return (
    <section id="reseñas" className="py-24 relative overflow-hidden bg-background">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-6"
          >
            <Heart className="w-3 h-3 fill-orange-500" />
            Lo que dicen nuestros huéspedes
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-[40px] font-black text-foreground mb-6 tracking-tight leading-tight"
          >
            Experiencias que <span className="text-primary italic">enamoran</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-base text-muted-foreground font-medium leading-relaxed"
          >
            Miles de personas ya han encontrado su lugar ideal. Únete a nuestra comunidad y crea
            recuerdos inolvidables.
          </motion.p>
        </div>

        <div className="max-w-6xl mx-auto relative md:px-12">
          <Carousel
            opts={{ align: 'start', loop: true }}
            plugins={[Autoplay({ delay: 4000 })]}
            className="w-full"
          >
            <CarouselContent className="-ml-4 pb-8">
              {carouselItems.map((testimonial) => (
                <CarouselItem key={testimonial.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <motion.div
                    whileHover={{ y: -8 }}
                    className="h-full group cursor-pointer"
                    onClick={() => setSelectedReview(testimonial)}
                  >
                    <div className="h-full bg-card/70 backdrop-blur-xl rounded-[40px] p-8 border border-border/50 shadow-xl shadow-gray-200/20 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 flex flex-col items-start text-left group-hover:bg-card/90">
                      <div className="flex gap-0.5 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i < testimonial.rating ? 'text-orange-400 fill-orange-400' : 'text-muted'}`}
                          />
                        ))}
                      </div>

                      <p className="text-foreground/80 text-sm font-medium leading-[1.6] mb-8 italic flex-1 line-clamp-4">
                        "{testimonial.quote}"
                      </p>

                      <div className="flex items-center gap-4 pt-6 border-t border-border/50 w-full mt-auto">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg border-2 border-background ring-4 ring-primary/5 shrink-0">
                          <img
                            src={testimonial.image}
                            alt={testimonial.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-foreground font-bold text-sm truncate">
                            {testimonial.name}
                          </h4>
                          <p className="text-primary text-[10px] font-semibold uppercase tracking-wider truncate">
                            {testimonial.role} · {testimonial.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground font-bold text-[10px] shrink-0">
                          <Heart
                            className={cn(
                              'w-3 h-3',
                              (testimonial.likes || 0) > 0 ? 'fill-current' : 'fill-none',
                            )}
                          />
                          {testimonial.likes || 0}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-6 bg-background border-border shadow-xl hover:bg-accent hover:text-primary transition-all duration-300" />
            <CarouselNext className="hidden md:flex -right-6 bg-background border-border shadow-xl hover:bg-accent hover:text-primary transition-all duration-300" />
          </Carousel>

          <div className="mt-12 text-center">
            <button
              onClick={() => setIsGalleryOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-background hover:bg-primary hover:text-white text-foreground font-bold rounded-full shadow-lg hover:shadow-primary/20 transition-all group border-2 border-border cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Ver todas las reseñas
            </button>
          </div>
        </div>
      </div>

      {/* Modal detalle de reseña */}
      {selectedReview && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedReview(null);
          }}
        >
          <div className="max-w-2xl w-full bg-background/95 backdrop-blur-xl border border-border/50 rounded-[40px] shadow-2xl p-0 overflow-hidden relative">
            <button
              onClick={() => setSelectedReview(null)}
              className="absolute right-6 top-6 w-10 h-10 rounded-full bg-white/50 backdrop-blur-md flex items-center justify-center hover:bg-white transition-all z-10 shadow-sm"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex flex-col items-center max-h-[90vh] overflow-y-auto">
              <div className="w-full bg-muted/30 p-8 pb-4 flex flex-col items-center relative">
                <div className="w-24 h-24 rounded-full overflow-hidden shadow-2xl border-4 border-background mb-4 ring-8 ring-primary/5">
                  <img
                    src={selectedReview.image}
                    alt={selectedReview.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < selectedReview.rating ? 'text-orange-400 fill-orange-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em]">
                    · {selectedReview.location}
                  </span>
                </div>
              </div>

              <div className="p-8 md:p-12 w-full pt-0">
                <div className="relative mb-12 text-center px-0">
                  <p className="relative text-foreground/80 text-sm pt-8 font-medium leading-[1.8] italic">
                    "{selectedReview.quote}"
                  </p>
                </div>

                {(() => {
                  const photos = usableReviewPhotos(selectedReview.photos);
                  if (photos.length === 0) return null;
                  return (
                    <div className="mb-12">
                      <Carousel className="w-full" opts={{ align: 'start', loop: false }}>
                        <CarouselContent className="-ml-4">
                          {photos.map((photo, i) => (
                            <CarouselItem key={photo} className="pl-4 basis-1/2 md:basis-1/3">
                              <div
                                className="rounded-3xl overflow-hidden shadow-xl aspect-square border border-border cursor-zoom-in"
                                onClick={() => openLightbox(photos, i)}
                              >
                                <img
                                  src={photo}
                                  alt={`Review photo ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={() => markPhotoBroken(photo)}
                                />
                              </div>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                      </Carousel>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 mb-10 text-muted-foreground font-bold text-[10px] uppercase tracking-widest border-t border-border pt-8 justify-center">
                  <Heart
                    className={cn(
                      'w-4 h-4',
                      (selectedReview.likes || 0) > 0 ? 'text-primary fill-primary' : 'text-gray-300',
                    )}
                  />
                  {selectedReview.likes || 0}{' '}
                  {(selectedReview.likes || 0) === 1
                    ? 'PERSONA LE GUSTA ESTO'
                    : 'PERSONAS LE GUSTA ESTO'}
                </div>

                {selectedReview.ownerResponse && (
                  <div className="mb-8 flex flex-col items-center w-full">
                    <div className="px-4 py-1.5 bg-orange-500 text-white text-[9px] font-bold uppercase tracking-[0.2em] rounded-full mb-4 shadow-lg shadow-orange-500/20">
                      Respuesta de FincasYa
                    </div>
                    <div className="w-full p-4 px-0 bg-accent/50 rounded-[40px] border border-border relative">
                      <p className="text-muted-foreground text-sm italic leading-relaxed text-center">
                        "{selectedReview.ownerResponse.text}"
                      </p>
                      {selectedReview.ownerResponse.date && (
                        <p className="text-muted-foreground/60 text-[9px] font-bold mt-6 text-center uppercase tracking-widest">
                          Respondido {selectedReview.ownerResponse.date}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mt-12 pt-8 border-t border-border italic">
                  <div className="flex items-center gap-3 text-primary font-bold text-xs uppercase tracking-widest">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    Reseña Verificada
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal galería completa */}
      {isGalleryOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsGalleryOpen(false);
          }}
        >
          <div className="max-w-2xl w-full h-[90vh] bg-background border border-border/50 rounded-[32px] shadow-2xl p-0 overflow-hidden flex flex-col">
            <div className="p-6 md:px-10 flex justify-between items-center bg-background border-b border-border z-20 shrink-0">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-foreground tracking-tight">
                  {totalCount} reseñas
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsGalleryOpen(false)}
                  className="w-10 h-10 rounded-full bg-gray-200/60 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all duration-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-background">
              <div className="max-w-3xl mx-auto space-y-12 pb-10">
                {visibleTestimonials.map((testimonial, index) => (
                  <div key={`${testimonial.id}-${index}`} className="flex flex-col items-start">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm border border-gray-200">
                        <img
                          src={testimonial.image}
                          alt={testimonial.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground leading-tight text-base">
                          {testimonial.name}
                        </h4>
                        <p className="text-muted-foreground text-xs font-medium">
                          {testimonial.location}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < testimonial.rating ? 'text-neutral-900 fill-neutral-900' : 'text-gray-200'}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        · {testimonial.role}
                      </span>
                    </div>

                    <p className="text-foreground/90 text-base font-normal leading-[1.6] whitespace-pre-wrap mb-6">
                      {testimonial.quote}
                    </p>

                    {(() => {
                      const photos = usableReviewPhotos(testimonial.photos);
                      if (photos.length === 0) return null;
                      return (
                        <div className="w-full mb-6">
                          <Carousel className="w-full" opts={{ align: 'start', loop: false }}>
                            <CarouselContent className="-ml-3">
                              {photos.map((photo, i) => (
                                <CarouselItem key={photo} className="pl-3 basis-1/2 md:basis-[180px]">
                                  <div
                                    className="rounded-2xl overflow-hidden shadow-lg aspect-square border border-gray-200 cursor-zoom-in relative"
                                    onClick={() => openLightbox(photos, i)}
                                  >
                                    <img
                                      src={photo}
                                      alt={`Review photo ${i + 1}`}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                      onError={() => markPhotoBroken(photo)}
                                    />
                                  </div>
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                          </Carousel>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between w-full mt-2">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                          <Heart
                            className={cn(
                              'w-3 h-3',
                              (testimonial.likes || 0) > 0 ? 'text-primary fill-primary' : 'fill-none',
                            )}
                          />
                          {testimonial.likes || 0}
                        </div>
                        {testimonial.profileUrl && (
                          <a
                            href={testimonial.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-primary/60 hover:text-primary font-bold text-[10px] uppercase tracking-widest transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Perfil
                          </a>
                        )}
                      </div>
                    </div>

                    {testimonial.ownerResponse && (
                      <div className="w-full mt-6 pl-6 border-l-2 border-primary/20 bg-neutral-50 p-4 rounded-xl">
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Respuesta de FincasYa
                        </div>
                        <p className="text-neutral-600 text-sm leading-relaxed">
                          {testimonial.ownerResponse.text}
                        </p>
                      </div>
                    )}

                    {index < visibleTestimonials.length - 1 && (
                      <div className="w-full h-px bg-neutral-100 mt-12" />
                    )}
                  </div>
                ))}

                {visibleTestimonials.length < testimonials.length && (
                  <div ref={lastElementRef} className="py-12 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                      Cargando más reseñas
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox de fotos */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewerOpen(false);
          }}
        >
          <button
            onClick={() => setViewerOpen(false)}
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {viewerImages.length > 1 && (
            <button
              onClick={() => setViewerIndex((i) => (i - 1 + viewerImages.length) % viewerImages.length)}
              className="absolute left-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <img
            src={viewerImages[viewerIndex]}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
          />
          {viewerImages.length > 1 && (
            <button
              onClick={() => setViewerIndex((i) => (i + 1) % viewerImages.length)}
              className="absolute right-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
