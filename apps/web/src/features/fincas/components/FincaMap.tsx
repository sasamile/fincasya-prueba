'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FincaMapProps {
  lat: number;
  lng: number;
  location: string;
}

export function FincaMap({ lat, lng, location }: FincaMapProps) {
  const [isInteractive, setIsInteractive] = useState(false);
  const hasCoords = lat !== 0 && lng !== 0;

  if (!hasCoords) return null;

  return (
    <div className="my-10 max-md:px-3">
      <div className="md:bg-neutral-50/50 md:border md:border-border/50 md:rounded-3xl p-3 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl shrink-0 font-bold">A dónde irás</h2>
          <div className="w-full h-px bg-border/50" />
          <p className="text-muted-foreground shrink-0">({location})</p>
        </div>
        <div
          className="w-full h-[480px] rounded-2xl overflow-hidden bg-neutral-200 relative z-0 border border-border/50 group"
          onClick={() => setIsInteractive(true)}
          onMouseLeave={() => setIsInteractive(false)}
        >
          <div
            className={cn(
              'absolute inset-0 z-10 flex items-center justify-center bg-black/5 transition-opacity duration-300',
              isInteractive ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-pointer',
            )}
          >
            {!isInteractive && (
              <span className="bg-background/80 backdrop-blur-xs px-4 py-2 rounded-full text-sm font-medium shadow-sm">
                Haz clic para interactuar con el mapa
              </span>
            )}
          </div>
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
            className={cn('w-full h-full', isInteractive ? 'pointer-events-auto' : 'pointer-events-none')}
            title={`Mapa de ${location}`}
          />
        </div>
      </div>
    </div>
  );
}
