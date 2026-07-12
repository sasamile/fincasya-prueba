'use client';

import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

export interface GalleryItem {
  url: string;
  type?: 'image' | 'video';
}

interface ImageViewerModalProps {
  images: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageViewerModal({ images, initialIndex = 0, onClose }: ImageViewerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [api, setApi] = useState<CarouselApi>();
  const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!api) return;
    api.scrollTo(initialIndex, true);
    const onSelect = () => {
      const newIndex = api.selectedScrollSnap();
      setCurrentIndex(newIndex);
      thumbnailRefs.current[newIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    };
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api, initialIndex]);

  const handleNext = useCallback(() => api?.scrollNext(), [api]);
  const handlePrev = useCallback(() => api?.scrollPrev(), [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handleNext, handlePrev]);

  if (!mounted) return null;

  const current = images[currentIndex];

  return createPortal(
    <div className="fixed inset-0 z-100 flex flex-col bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-4 text-white shrink-0">
        <span className="text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full text-white hover:bg-white/10"
        >
          <X className="size-5" />
        </Button>
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 min-h-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          className="absolute left-2 z-10 rounded-full bg-black/40 text-white hover:bg-black/60 hidden md:flex"
        >
          <ChevronLeft className="size-6" />
        </Button>

        <Carousel setApi={setApi} className="w-full max-w-5xl h-full" opts={{ loop: true }}>
          <CarouselContent className="h-[60vh] md:h-[70vh] ml-0">
            {images.map((item, idx) => (
              <CarouselItem key={idx} className="pl-0 h-full flex items-center justify-center">
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    controls
                    autoPlay
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="max-h-full max-w-full rounded-lg object-contain"
                    draggable={false}
                  />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="absolute right-2 z-10 rounded-full bg-black/40 text-white hover:bg-black/60 hidden md:flex"
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>

      {current?.type === 'video' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none md:hidden">
          <Play className="size-12 text-white/50" />
        </div>
      )}

      <div className="shrink-0 p-4 overflow-x-auto">
        <div className="flex gap-2 justify-center">
          {images.map((item, idx) => (
            <div
              key={idx}
              ref={(el) => {
                thumbnailRefs.current[idx] = el;
              }}
              onClick={() => api?.scrollTo(idx)}
              className={cn(
                'relative w-14 h-14 rounded-lg overflow-hidden cursor-pointer shrink-0 border-2 transition-all',
                idx === currentIndex ? 'border-white scale-105' : 'border-transparent opacity-60',
              )}
            >
              {item.type === 'video' ? (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                  <Play className="size-4 text-white fill-white" />
                </div>
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
