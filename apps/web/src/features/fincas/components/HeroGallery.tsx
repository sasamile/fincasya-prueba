'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { ImageViewerModal, type GalleryItem } from './ImageViewerModal';

interface HeroGalleryProps {
  title: string;
  images: string[];
  video?: string | null;
}

export function HeroGallery({ title, images, video }: HeroGalleryProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [photoIndex, setPhotoIndex] = React.useState(0);

  const gallery = images.length > 0 ? images : ['/gml/Logo.png'];

  const galleryItems: GalleryItem[] = React.useMemo(() => {
    const items: GalleryItem[] = gallery.map((img) => ({ url: img, type: 'image' }));
    if (video) items.push({ url: video, type: 'video' });
    return items;
  }, [gallery, video]);

  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setViewerOpen(true);
  };

  React.useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);
    api.on('select', () => setCurrent(api.selectedScrollSnap() + 1));
  }, [api]);

  return (
    <section className="relative w-full">
      <div className="container mx-auto mb-8 md:mt-8 lg:px-6">
        <div className="relative overflow-hidden md:rounded-2xl">
          {/* Mobile carousel */}
          <div className="block md:hidden h-[60vh] relative">
            <Carousel setApi={setApi} className="w-full h-full" opts={{ loop: true }}>
              <CarouselContent className="h-full ml-0">
                {gallery.map((image, index) => (
                  <CarouselItem key={index} className="pl-0 h-full">
                    <div
                      className="relative w-full h-full cursor-zoom-in"
                      onClick={() => openLightbox(index)}
                    >
                      <img
                        src={image}
                        alt={`${title} - ${index + 1}`}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading={index === 0 ? 'eager' : 'lazy'}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="absolute bottom-10 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold border border-white/20 shadow-lg">
                {current} / {count}
              </div>
            </Carousel>
          </div>

          {/* Desktop Airbnb grid */}
          <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[500px] cursor-pointer group">
            <div
              className="col-span-2 row-span-2 relative overflow-hidden group/main"
              onClick={() => openLightbox(0)}
            >
              <Link href="/">
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 left-4 z-20 gap-2 rounded-full shadow-lg hover:scale-105 transition-transform bg-background/80 backdrop-blur-md border border-border/20 font-bold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </Button>
              </Link>
              <img
                src={gallery[0]}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover/main:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
            </div>

            {gallery.slice(1, video ? 3 : 4).map((img, i) => (
              <div
                key={i}
                className="relative overflow-hidden"
                onClick={() => openLightbox(i + 1)}
              >
                <img
                  src={img}
                  alt={`${title} - ${i + 2}`}
                  className="absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
              </div>
            ))}

            <div
              className={cn(
                'relative overflow-hidden bg-black flex items-center justify-center',
                video && 'row-span-2 col-start-4 row-start-1',
              )}
              onClick={
                video
                  ? () => openLightbox(galleryItems.length - 1)
                  : gallery[4]
                    ? () => openLightbox(4)
                    : undefined
              }
            >
              {video ? (
                <div className="w-full h-full relative">
                  <video
                    src={video}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center shadow-2xl ring-1 ring-white/20 group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                gallery[4] && (
                  <img
                    src={gallery[4]}
                    alt={`${title} - 5`}
                    className="absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.02]"
                  />
                )
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <ImageViewerModal
          images={galleryItems}
          initialIndex={photoIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </section>
  );
}
