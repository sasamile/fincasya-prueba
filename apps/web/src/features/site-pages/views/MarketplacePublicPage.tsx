'use client';

import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { SearchX } from 'lucide-react';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { OpenChatButton } from '@/features/landing/components/OpenChatButton';
import { MarketplaceListingCard } from '@/features/marketplace/components/marketplace-listing-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { PropertyResponse } from '@/features/fincas/types/fincas.types';
import { openChatAssistant } from '@/features/landing/components/ChatAssistantWidget';

export function MarketplacePublicPage() {
  const raw = useQuery(api.landing.listMarketplaceProperties);
  const loading = raw === undefined;
  const fincas = (raw ?? []) as PropertyResponse[];

  return (
    <div className="landing flex min-h-screen flex-col bg-background">
      <Navbar isHome={false} />
      <main className="flex-1 py-10 pt-24 md:py-28">
        <div className="container mx-auto max-w-5xl px-4 md:px-6">
          <div className="mb-8 md:mb-10">
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Fincas a la venta
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Propiedades publicadas en venta. Revisa la ficha completa o escríbenos por WhatsApp
              para precio, visita y documentación.
            </p>
          </div>

          <div className="mb-8 md:mb-10">
            <OpenChatButton
              title="¿Buscas algo específico?"
              description="Cuéntale al asistente IA qué tipo de propiedad necesitas y te ayuda a filtrar."
              onOpenChat={openChatAssistant}
            />
          </div>

          {loading ? (
            <div className="flex flex-col gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card/50 p-4 md:flex-row"
                >
                  <Skeleton className="aspect-4/3 w-full shrink-0 rounded-xl md:aspect-auto md:min-h-[260px] md:w-[380px]" />
                  <div className="flex-1 space-y-3 py-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-2/3 max-w-sm" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-10 w-full max-w-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : fincas.length === 0 ? (
            <EmptyState
              title="Aún no hay propiedades en venta"
              description="Cuando marques fincas en el admin como Marketplace y les des un valor, aparecerán aquí."
              icon={SearchX}
            />
          ) : (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                {fincas.length}{' '}
                {fincas.length === 1 ? 'propiedad publicada' : 'propiedades publicadas'}
              </p>
              <div className="flex flex-col gap-6 md:gap-8">
                {fincas.map((finca) => (
                  <MarketplaceListingCard key={finca.id} finca={finca} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
