/**
 * Home pública — port 1:1 de FincasYaWeb/app/page.tsx (lógica de filtrado en
 * 4 etapas), con datos directo de Convex (`api.landing.listProperties`) en vez
 * del backend Nest. El orden custom por pestaña (tabOrder del CMS) no existe
 * en `prueba`: se usa el fallback (favoritas primero), igual que producción
 * cuando el CMS no tiene orden guardado.
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { RegionFilter } from './components/RegionFilter';
import { FeaturedFincas } from './components/FeaturedFincas';
import { CtaSection } from './components/CtaSection';
import { SocialSection } from './components/SocialSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { FincaCardSkeleton } from './components/FincaCardSkeleton';
import { OpenChatButton } from './components/OpenChatButton';
import { WhatsappFab } from './components/WhatsappFab';
import { Skeleton } from '@/components/ui/skeleton';
import { HomeStoreProvider, useHomeStore } from './store/home-store';
import { useDebounce } from '@/hooks/use-debounce';
import {
  CATALOG_GEO_TAB_IDS,
  type CatalogGeoTabId,
  formatCatalogTabLabel,
  propertyMatchesCatalogTab,
  propertyMatchesEventosTab,
  propertyMatchesGeoTab,
  propertyMatchesLuxuryTab,
} from '@/lib/property/catalog-filter-tags';
import { filterPropertiesByGuests } from './lib/guest-capacity-filter';
import {
  propertyMatchesSearchQuery,
  propertySearchRelevanceScore,
} from '@/lib/property/property-search';
import type { PropertyResponse } from './types';

/** Mientras el web-chat no está portado, el asistente abre WhatsApp. */
function openChat() {
  window.open(
    'https://wa.me/573157773937?text=Hola!%20Quiero%20ayuda%20para%20encontrar%20una%20finca',
    '_blank',
  );
}

function Home() {
  const { category, destination, guests, propertyName, setCategory } = useHomeStore();
  const [isChangingCategory, setIsChangingCategory] = useState(false);

  const debouncedPropertyName = useDebounce(propertyName, 400);
  const debouncedDestination = useDebounce(destination, 400);

  const propertiesData = useQuery(api.landing.listProperties);
  const isLoading = propertiesData === undefined;
  const fincas: PropertyResponse[] = useMemo(() => propertiesData ?? [], [propertiesData]);

  // 1. Stage 1: filtro por buscador (Destino + Huéspedes + Nombre)
  const searchFilteredFincas = useMemo(() => {
    let result = fincas;
    if (debouncedDestination) {
      result = result.filter((f) =>
        propertyMatchesSearchQuery(
          { title: f.title, location: f.location, code: f.code },
          debouncedDestination,
          ['location'],
        ),
      );
    }
    if (guests) {
      const guestsCount = parseInt(guests, 10);
      if (!isNaN(guestsCount) && guestsCount > 0) {
        result = filterPropertiesByGuests(result, guestsCount);
      }
    }
    if (debouncedPropertyName) {
      result = result.filter((f) =>
        propertyMatchesSearchQuery(
          { title: f.title, location: f.location, code: f.code },
          debouncedPropertyName,
          ['title', 'code'],
        ),
      );
    }
    return result;
  }, [debouncedDestination, guests, fincas, debouncedPropertyName]);

  // 2. Stage 2: regiones disponibles según resultados
  const availableRegions = useMemo(() => {
    const available = new Set<string>();
    if (searchFilteredFincas.length === 0) return [];
    searchFilteredFincas.forEach((f) => {
      if (f.isFavorite) available.add('favoritas');
      if (propertyMatchesLuxuryTab(f)) available.add('luxury');
      if (propertyMatchesEventosTab(f)) available.add('eventos');
      for (const geoId of CATALOG_GEO_TAB_IDS) {
        if (propertyMatchesGeoTab(f, geoId)) available.add(geoId);
      }
    });
    return Array.from(available);
  }, [searchFilteredFincas]);

  // 3. Stage 3: filtro final por categoría (pestaña de región)
  const filteredFincas = useMemo(() => {
    const result = searchFilteredFincas;
    let filtered = result;

    if (category === 'todas') {
      filtered = result;
    } else if (category === 'favoritas') {
      filtered = result.filter((f) => f.isFavorite);
    } else if (category === 'luxury') {
      filtered = result.filter((f) => propertyMatchesLuxuryTab(f));
    } else if (category === 'eventos') {
      filtered = result.filter((f) => propertyMatchesEventosTab(f));
    } else if ((CATALOG_GEO_TAB_IDS as readonly string[]).includes(category)) {
      const geoId = category as CatalogGeoTabId;
      filtered = result.filter((f) => propertyMatchesGeoTab(f, geoId));
    } else {
      filtered = result.filter((f) => propertyMatchesCatalogTab(f, category));
    }

    const finalResult = [...filtered];
    const nameSearchQuery = debouncedPropertyName.trim();

    const compareFavorites = (a: PropertyResponse, b: PropertyResponse) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    };

    // 4. Stage 4: con búsqueda por nombre, prioriza relevancia; si no, favoritas primero.
    if (nameSearchQuery) {
      finalResult.sort((a, b) => {
        const scoreDiff =
          propertySearchRelevanceScore(
            { title: b.title, location: b.location, code: b.code },
            nameSearchQuery,
            ['title', 'code'],
          ) -
          propertySearchRelevanceScore(
            { title: a.title, location: a.location, code: a.code },
            nameSearchQuery,
            ['title', 'code'],
          );
        if (scoreDiff !== 0) return scoreDiff;
        return compareFavorites(a, b);
      });
    } else {
      finalResult.sort(compareFavorites);
    }

    return finalResult;
  }, [category, searchFilteredFincas, debouncedPropertyName]);

  const handleCategoryChange = (newCategory: string) => {
    if (newCategory === category) return;
    setIsChangingCategory(true);
    setCategory(newCategory);
    setTimeout(() => {
      setIsChangingCategory(false);
    }, 300);
  };

  const sectionTitle = useMemo(() => {
    if (destination && filteredFincas.length > 0) return `Resultados para "${destination}"`;
    const regionLabels: Record<string, string> = {
      todas: 'Todas las Fincas',
      'cerca-bogota': 'Cerca a Bogotá',
      melgar: 'Melgar',
      villavicencio: 'Villavicencio',
      anapoima: 'Anapoima',
      villeta: 'Villeta',
      playa: 'Destinos de Playa',
      'eje-cafetero': 'Eje Cafetero',
      luxury: 'Fincas Luxury',
      eventos: 'Fincas para Eventos',
      favoritas: 'Fincas Favoritas',
    };
    return regionLabels[category] ?? `Fincas · ${formatCatalogTabLabel(category)}`;
  }, [category, destination, filteredFincas.length]);

  const displayFincas = filteredFincas;

  return (
    <main className="relative min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <Hero fincas={fincas} onOpenChat={openChat} />
      {isLoading ? (
        <div className="container mx-auto px-0 md:px-0 mb-20 mt-0">
          <div className="max-w-[1600px] w-full mx-auto px-4 md:px-8 mt-8">
            <div className="flex gap-4 mb-8 overflow-x-auto">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-32 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <FincaCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <Footer />
        </div>
      ) : (
        <>
          <div id="fincas" className="max-w-[1600px] w-full mx-auto px-4 md:px-8">
            <RegionFilter
              selectedRegion={category}
              onSelectRegion={handleCategoryChange}
              availableRegions={availableRegions}
            />

            {isChangingCategory ? (
              <div className="container mx-auto px-0 md:px-0 mb-20 mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <FincaCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : (
              <FeaturedFincas fincas={displayFincas} title={sectionTitle} />
            )}

            <div className="mt-12 mb-16 md:mt-16 md:mb-20">
              <OpenChatButton onOpenChat={openChat} />
            </div>
          </div>
          <SocialSection />
          <TestimonialsSection />
          <CtaSection />
          <Footer />
        </>
      )}
      <WhatsappFab />
    </main>
  );
}

export function LandingPage() {
  return (
    <div className="landing h-full overflow-y-auto overflow-x-hidden">
      <HomeStoreProvider>
        <Home />
      </HomeStoreProvider>
    </div>
  );
}
