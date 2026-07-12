/** Grilla principal de fincas — port 1:1 de FincasYaWeb featured-fincas.tsx. */
import { useState, useMemo, useEffect } from 'react';
import type { PropertyResponse } from '../types';
import { FincaCardHome } from './FincaCardHome';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoritesCarousel } from './FavoritesCarousel';
import { SearchX, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeaturedFincasProps {
  fincas: PropertyResponse[];
  title?: string;
}

const INITIAL_LIMIT = 8;
const INCREASE_BY = 8;

export function FeaturedFincas({ fincas, title = 'Favorita entre huéspedes' }: FeaturedFincasProps) {
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  const currentHash = useMemo(() => {
    return fincas.map((f) => f.id).join(',');
  }, [fincas]);

  useEffect(() => {
    setLimit(INITIAL_LIMIT);
  }, [currentHash]);

  const { favorites, regular } = useMemo(() => {
    const favs = fincas.filter((f) => f.isFavorite);
    const regs = fincas.filter((f) => !f.isFavorite);
    return { favorites: favs, regular: regs };
  }, [fincas]);

  const displayedRegular = useMemo(() => {
    return regular.slice(0, limit);
  }, [regular, limit]);

  const handleLoadMore = () => {
    setLimit((prev) => prev + INCREASE_BY);
  };

  if (fincas.length === 0) {
    return (
      <section className="container mx-auto px-4 mb-20 mt-8">
        <EmptyState
          title="No se encontraron fincas"
          description="No hemos encontrado propiedades que coincidan con tus criterios. Intenta ajustar los filtros o prueba otra categoría."
          icon={SearchX}
        />
      </section>
    );
  }

  return (
    <section className="container mx-auto md:px-4 mb-20 mt-2">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{title}</h2>
          <p className="text-muted-foreground text-sm">
            {fincas.length} {fincas.length === 1 ? 'finca disponible' : 'fincas disponibles'}
          </p>
        </div>
      </div>

      {favorites.length > 0 && <FavoritesCarousel fincas={favorites} />}

      {favorites.length > 0 && regular.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-foreground">Nuestras recomendaciones</h3>
        </div>
      )}

      <div className="grid grid-cols-1 items-start md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 md:gap-y-12">
        {displayedRegular.map((finca) => (
          <FincaCardHome
            key={finca.id}
            finca={finca}
            badge={finca.isNew ? { text: 'Nueva', color: 'yellow' } : undefined}
          />
        ))}
      </div>

      {limit < regular.length && (
        <div className="mt-16 flex justify-center">
          <Button
            onClick={handleLoadMore}
            className="group relative h-14 px-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-black transition-all duration-500 shadow-2xl hover:shadow-primary/20 active:scale-95 flex items-center gap-4 overflow-hidden border-0"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

            <span className="relative z-10 uppercase tracking-[0.2em] text-[10px]">
              Mostrar más fincas
            </span>

            <div className="relative z-10 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-all duration-300">
              <ChevronDown className="w-4 h-4 text-primary group-hover:text-white group-hover:translate-y-0.5 transition-all duration-300" />
            </div>
          </Button>
        </div>
      )}
    </section>
  );
}
