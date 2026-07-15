'use client';

/**
 * Detalle público de una finca — réplica visual de FincasYaWeb/finca-detail-content.tsx.
 * El flujo de reservas con calendario vive en producción (Nest); aquí el CTA es WhatsApp.
 */
import { notFound } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import {
  MapPin,
  Users,
  Star,
  Check,
  MessageCircle,
  LayoutGrid,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { OpenChatButton } from '@/features/landing/components/OpenChatButton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, getSeededRating } from '@/lib/utils';
import { HeroGallery } from './components/HeroGallery';
import { FincaDetailSkeleton } from './components/FincaDetailSkeleton';
import { FincaMap } from './components/FincaMap';
import { ShareButton } from './components/ShareButton';
import { FincaContactCard } from './components/FincaContactCard';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import { MARKETPLACE_WHATSAPP_E164 } from '@/features/marketplace/lib/sale-whatsapp';

import { openChatAssistant } from '@/features/landing/components/ChatAssistantWidget';

function openChat() {
  openChatAssistant();
}

interface FincaDetailPageProps {
  slug: string;
  modoVenta?: boolean;
}

export function FincaDetailPage({ slug, modoVenta }: FincaDetailPageProps) {
  const finca = useQuery(api.landing.getPropertyBySlug, { slug });
  const [isMuted, setIsMuted] = useState(true);

  if (finca === undefined) {
    return (
      <div className="landing min-h-screen">
        <main className="min-h-screen bg-background flex flex-col">
          <Navbar isHome={false} isFincaPage />
          <FincaDetailSkeleton />
          <Footer />
        </main>
      </div>
    );
  }

  if (finca === null) {
    notFound();
  }

  const isFavorite = finca.isFavorite ?? (finca.rating || 0) >= 4.8;
  const isSaleMode = Boolean(modoVenta || finca.marketplaceForSale);
  const displayDescription =
    isSaleMode && finca.saleDescription ? finca.saleDescription : finca.description;

  const featuresByZone = finca.features.reduce<Record<string, typeof finca.features>>(
    (acc, feature) => {
      const zoneName = feature.zone || 'General';
      if (!acc[zoneName]) acc[zoneName] = [];
      acc[zoneName].push(feature);
      return acc;
    },
    {},
  );
  const existingZones = Object.keys(featuresByZone);
  const zones = [
    ...finca.zoneOrder.filter((z) => existingZones.includes(z)),
    ...existingZones.filter((z) => !finca.zoneOrder.includes(z)),
  ];

  return (
    <div className="landing min-h-screen">
      <main
        className={cn(
          'min-h-screen bg-background transition-colors duration-700 pb-24 md:pb-0',
          isFavorite && 'bg-linear-to-b from-neutral-50 to-white',
        )}
      >
        <Navbar isHome={false} isFincaPage />
        <div className="px-0 md:px-6 lg:px-20 max-md:bg-background">
          <HeroGallery title={finca.title} images={finca.images} video={finca.video} />

          <section className="md:pb-10 relative max-md:z-40 -mt-14 max-md:bg-background max-md:overflow-hidden rounded-t-3xl md:rounded-none md:mt-0">
            <div className="container mx-auto px-0 md:px-6 lg:px-6">
              <div className="grid lg:grid-cols-3 max-lg:gap-10">
                <div className="lg:col-span-2 lg:mr-10">
                  <div
                    className={cn(
                      'py-6 max-md:px-5 max-md:pt-8 md:p-0 border-none',
                      isFavorite && 'md:border-l md:border-primary/10',
                    )}
                  >
                    <h1 className="text-2xl md:text-3xl font-bold mb-6 tracking-tight">
                      {finca.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mb-4 mt-2 md:mt-8">
                      <Badge variant="secondary" className="gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        {finca.reviewsCount > 0 && finca.rating
                          ? finca.rating.toFixed(1)
                          : getSeededRating(finca.id)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="w-3 h-3" />
                        {finca.location}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Users className="w-3 h-3" />
                        {finca.capacity} Personas
                      </Badge>
                      {isFavorite && (
                        <div className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide text-gray-900 bg-[#eeebe7] shadow-lg flex items-center gap-1.5 uppercase">
                          Favorita entre viajeros
                        </div>
                      )}
                      <ShareButton finca={finca} />
                    </div>
                  </div>

                  {/* Mobile video reel */}
                  {finca.video && (
                    <div className="block lg:hidden mb-12 max-md:-mt-6 rounded-2xl overflow-hidden shadow-2xl border border-border/20 mx-3">
                      <div className="relative w-full h-[60vh]">
                        <video
                          src={finca.video}
                          className="w-full h-full object-cover"
                          controls={false}
                          autoPlay
                          muted={isMuted}
                          loop
                          playsInline
                        />
                        <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/60 pointer-events-none flex items-end p-6">
                          <div className="text-white">
                            <p className="font-bold text-lg mb-1">Recorrido Virtual</p>
                            <p className="text-sm opacity-80">Descubre cada rincón</p>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                          <div className="bg-black/50 backdrop-blur-md rounded-full p-3 shadow-lg">
                            <Play className="w-6 h-6 text-white fill-white" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsMuted(!isMuted)}
                            className="bg-black/50 backdrop-blur-md rounded-full p-3 shadow-lg transition-transform active:scale-90"
                          >
                            {isMuted ? (
                              <VolumeX className="w-6 h-6 text-white" />
                            ) : (
                              <Volume2 className="w-6 h-6 text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {displayDescription ? (
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line mb-8 max-md:px-3">
                      {displayDescription}
                    </p>
                  ) : null}

                  <Separator className="my-8" />

                  <div className="mb-12 max-md:px-3">
                    <h2 className="text-lg md:text-xl font-bold mb-6">Lo que este lugar ofrece</h2>
                    <div className="space-y-6">
                      {zones.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No hay amenidades registradas.</p>
                      ) : (
                        zones.map((zone) => (
                          <div key={zone}>
                            {(zones.length > 1 || zone !== 'General') && (
                              <h3 className="font-semibold text-sm mb-2 text-foreground/90 flex items-center gap-2 uppercase">
                                <LayoutGrid className="w-4 h-4" />
                                {zone}
                              </h3>
                            )}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-2">
                              {featuresByZone[zone]?.map((feature, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-3 py-0.5 transition-all hover:translate-x-1 duration-300"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 p-1.5 overflow-hidden border border-border/50 shadow-sm">
                                    {feature.iconUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={feature.iconUrl}
                                        alt={feature.name}
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                      />
                                    ) : feature.emoji ? (
                                      <span className="text-lg leading-none">{feature.emoji}</span>
                                    ) : (
                                      <Check className="w-4 h-4 text-foreground/50" />
                                    )}
                                  </div>
                                  <span className="text-xs font-medium text-foreground/80 line-clamp-2 uppercase">
                                    {feature.name}
                                    {feature.quantity ? ` (${feature.quantity})` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 mb-12 max-md:px-3">
                    <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-5 h-5 text-blue-400" />
                      </div>
                      <p className="text-blue-900 text-xs md:text-sm leading-relaxed font-medium">
                        Siempre debes confirmar la disponibilidad con un experto, comunícate con
                        nosotros vía{' '}
                        <a
                          href={`https://wa.me/${MARKETPLACE_WHATSAPP_E164}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 font-bold underline cursor-pointer"
                        >
                          Whatsapp
                        </a>
                        .
                      </p>
                    </div>
                    <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-2xl p-6 flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Star className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-emerald-900 text-xs md:text-sm leading-relaxed">
                        Pregunta por descuentos en temporada baja. En temporadas especiales los
                        costos y el mínimo de noches cambian:{' '}
                        <strong className="text-emerald-950">Navidad</strong> (aprox. 20–26 de
                        diciembre) suele exigir{' '}
                        <strong className="text-emerald-950">3 a 4 noches mínimo</strong>;{' '}
                        <strong className="text-emerald-950">Fin de año</strong> (aprox. 27 de
                        diciembre al 2 de enero) suele exigir{' '}
                        <strong className="text-emerald-950">6 a 7 noches mínimo</strong>; el{' '}
                        <strong className="text-emerald-950">puente de Reyes</strong> suele exigir{' '}
                        <strong className="text-emerald-950">2 a 3 noches mínimo</strong>. Semana
                        Santa y otros puentes pueden tener condiciones distintas: confirma siempre
                        con un asesor.
                      </p>
                    </div>
                  </div>

                  <div className="max-md:px-3">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center max-md:hidden">
                        <Check className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold tracking-tight">
                        Condiciones y Responsabilidades
                      </h3>
                    </div>
                    <div className="space-y-4 text-muted-foreground text-sm leading-relaxed px-2">
                      <p>
                        <strong className="text-foreground">FINCASYA</strong> no se compromete a
                        realizar devoluciones de dinero en caso de cancelaciones fortuitas por
                        razones ajenas a nuestra voluntad, se aplazará la fecha en caso dado
                        siempre y cuando la novedad sea notificada como mínimo siete (7) días
                        hábiles antes de la fecha de ingreso registrada.
                      </p>
                      <p>Nos reservamos el derecho de admisión en algunas propiedades.</p>
                      <p>
                        <strong className="text-foreground">FINCASYA</strong> no se hará responsable
                        de accidentes ocasionados durante su estancia, tampoco por hurtos o daños
                        ocasionados por terceros.
                      </p>
                      <p>
                        El depósito se reintegrará bien sea a su salida o al día siguiente de la
                        desocupación una vez se haya concluido la revisión legítima de la
                        propiedad.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1 max-md:px-3 md:ml-4">
                  <FincaContactCard finca={finca} modoVenta={isSaleMode} />
                </div>
              </div>

              <FincaMap lat={finca.lat} lng={finca.lng} location={finca.location} />

              <ReviewsSection propertyId={finca.id} />

              <div className="mt-10 mb-12 md:mt-12 md:mb-16">
                <OpenChatButton
                  title="¿Tienes preguntas sobre esta finca?"
                  description="Pregúntale al asistente IA por disponibilidad, capacidad, servicios o cómo llegar."
                  ctaLabel="Preguntar ahora"
                  onOpenChat={openChat}
                />
              </div>
            </div>
          </section>
        </div>
        <Footer />
      </main>
    </div>
  );
}
