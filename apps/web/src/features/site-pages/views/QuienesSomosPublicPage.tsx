'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Target,
  Rocket,
  ShieldCheck,
  CheckCircle2,
  Award,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { QUIENES_SOMOS_DEFAULT } from '@/features/admin/constants/quienes-somos.constants';
import type { QuienesSomosData } from '@/features/admin/types/quienes-somos.types';
import { useQuienesSomosContent } from '@/features/site-pages/hooks/use-internal-page';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
};

function normalizeStringList(
  value: string | string[] | undefined,
  fallback: string[],
): string[] {
  if (value === undefined) return fallback;
  if (Array.isArray(value)) return value.length > 0 ? value : fallback;
  return value.trim() ? [value] : fallback;
}

/** Convex puede devolver objetivos/politicas como string o string[] (schema legacy). */
type QuienesSomosRaw = Omit<Partial<QuienesSomosData>, 'objetivos' | 'politicas'> & {
  _creationTime?: number;
  objetivos?: string | string[];
  politicas?: string | string[];
};

function mergeContent(raw: QuienesSomosRaw | null): QuienesSomosData {
  if (!raw) return { ...QUIENES_SOMOS_DEFAULT };
  const { _creationTime: _ignored, objetivos, politicas, ...rest } = raw;
  return {
    ...QUIENES_SOMOS_DEFAULT,
    ...rest,
    objetivos: normalizeStringList(objetivos, QUIENES_SOMOS_DEFAULT.objetivos),
    politicas: normalizeStringList(politicas, QUIENES_SOMOS_DEFAULT.politicas),
    carouselImages:
      raw.carouselImages?.length ? raw.carouselImages : QUIENES_SOMOS_DEFAULT.carouselImages,
  };
}

export function QuienesSomosPublicPage() {
  const { data: raw, loading: isLoading } = useQuienesSomosContent();
  const content = useMemo(() => mergeContent(raw), [raw]);
  const [currentImage, setCurrentImage] = useState(0);

  const images = content.carouselImages?.length
    ? content.carouselImages
    : QUIENES_SOMOS_DEFAULT.carouselImages;

  useEffect(() => {
    if (isLoading) return;
    const hash = window.location.hash?.replace('#', '');
    if (!hash) return;
    const t = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 300);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => {
    if (images.length <= 1) return;
    setCurrentImage(0);
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images]);

  const nextSlide = () => {
    if (images.length <= 1) return;
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    if (images.length <= 1) return;
    setCurrentImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  if (isLoading) {
    return (
      <div className="landing min-h-screen bg-background">
        <main className="relative min-h-screen overflow-x-hidden">
          <div className="w-full py-4">
            <Navbar isHome={false} />
          </div>
          <div className="container mx-auto px-6 py-24 text-center text-muted-foreground">
            Cargando...
          </div>
          <Footer />
        </main>
      </div>
    );
  }

  return (
    <div className="landing min-h-screen bg-background">
      <main className="relative min-h-screen overflow-x-hidden">
        <div className="w-full py-4">
          <Navbar isHome={false} />
        </div>

        {/* Hero */}
        <section className="relative overflow-hidden pt-16 pb-12 lg:pt-24 lg:pb-16">
          <div className="absolute inset-0 z-0 opacity-10 blur-3xl">
            <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary" />
            <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-orange-600" />
          </div>
          <div className="container relative z-10 mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mx-auto max-w-4xl text-center"
            >
              <span className="mb-6 inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
                Sobre Nosotros
              </span>
              <h1 className="mb-4 text-2xl leading-tight font-bold md:text-4xl">
                ¿QUÉ ES <span className="text-primary italic">FINCASYA</span>?
              </h1>
              <div
                className="prose prose-base dark:prose-invert mx-auto max-w-none text-center text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: content.queEsFincasYa }}
              />
            </motion.div>
          </div>
        </section>

        {/* Misión y visión */}
        <section className="bg-secondary/10 py-12">
          <div className="container mx-auto px-6">
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
              <motion.div
                {...fadeInUp}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Target className="text-primary" size={20} />
                  </div>
                  <h2 className="mb-3 text-lg font-bold tracking-wider uppercase">
                    MISIÓN
                  </h2>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: content.mision }}
                />
              </motion.div>

              <motion.div
                {...fadeInUp}
                transition={{ delay: 0.2 }}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-orange-600/20 bg-orange-600/10">
                    <Rocket className="text-orange-600" size={20} />
                  </div>
                  <h2 className="mb-3 text-lg font-bold tracking-wider uppercase">
                    VISIÓN
                  </h2>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: content.vision }}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Objetivos */}
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-4xl">
              <motion.div {...fadeInUp} className="mb-10 text-center">
                <h2 className="mb-4 text-2xl font-bold md:text-3xl">
                  NUESTROS OBJETIVOS
                </h2>
                <div className="mx-auto h-1 w-16 rounded-full bg-primary" />
              </motion.div>
              <motion.ul
                variants={staggerContainer}
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true }}
                className="grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2"
              >
                {(Array.isArray(content.objetivos) ? content.objetivos : []).map(
                  (obj, i) => (
                    <motion.li
                      key={obj}
                      {...fadeInUp}
                      transition={{ delay: i * 0.1 }}
                      className="m-0 flex items-center gap-3 rounded-xl border border-border/20 bg-secondary/10 p-4 shadow-sm"
                    >
                      <CheckCircle2 className="shrink-0 text-primary" size={18} />
                      <span className="text-sm text-muted-foreground">{obj}</span>
                    </motion.li>
                  ),
                )}
              </motion.ul>
            </div>
          </div>
        </section>

        {/* Trayectoria — ancla #trayectoria */}
        <section
          id="trayectoria"
          className="relative scroll-mt-24 overflow-hidden bg-black py-16 text-white"
        >
          <div className="absolute inset-0 z-0 opacity-10 blur-3xl">
            <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary" />
            <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-orange-600" />
          </div>
          <div className="container relative z-10 mx-auto px-6">
            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <motion.div {...fadeInUp}>
                <span className="mb-4 block text-xs font-bold tracking-widest text-primary uppercase">
                  Trayectoria
                </span>
                <h2 className="mb-5 text-2xl leading-tight font-bold md:text-3xl">
                  {content.trayectoriaTitle}
                </h2>
                <div
                  className="prose prose-sm prose-invert mb-6 max-w-none text-white/70"
                  dangerouslySetInnerHTML={{
                    __html: content.trayectoriaParagraphs,
                  }}
                />

                <motion.div
                  {...fadeInUp}
                  className="group relative mb-8 overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-r from-primary/20 via-primary/40 to-primary/20 p-1 shadow-[0_0_20px_rgba(249,87,42,0.1)]"
                >
                  <div className="absolute inset-0 bg-primary/5 transition-colors group-hover:bg-primary/10" />
                  <div className="relative flex items-center gap-4 rounded-xl bg-black/40 p-4 backdrop-blur-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/20">
                      <Award className="text-primary" size={20} />
                    </div>
                    <div>
                      <h3 className="mb-0.5 text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
                        {content.recognitionTitle}
                      </h3>
                      <p className="text-sm leading-tight font-bold text-white">
                        {content.recognitionSubtitle}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <div className="mb-8 grid grid-cols-2 gap-6">
                  {content.stats.map((stat) => (
                    <div key={stat.label} className="border-l-2 border-primary pl-4">
                      <div className="mb-1 text-2xl font-bold text-primary md:text-3xl">
                        {stat.value}
                      </div>
                      <div className="text-[10px] font-medium tracking-widest text-white/50 uppercase md:text-xs">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/#fincas"
                  className="inline-block rounded-full bg-[#f9572a] px-6 py-3 text-xs font-bold text-white transition-all hover:bg-[#fa6b43]"
                >
                  Explorar Propiedades
                </Link>
              </motion.div>

              <motion.div
                {...fadeInUp}
                className="group relative aspect-square overflow-hidden rounded-[32px] border border-white/10 bg-secondary/20 md:aspect-video lg:aspect-square"
              >
                <AnimatePresence initial={false}>
                  <motion.div
                    key={currentImage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={images[currentImage] ?? '/instagram-feed.jpeg'}
                      alt={`FincasYa Trayectoria ${currentImage + 1}`}
                      fill
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between p-6">
                  <button
                    type="button"
                    onClick={prevSlide}
                    className="group/btn flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-all hover:bg-primary"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft
                      size={20}
                      className="transition-transform group-hover/btn:-translate-x-0.5"
                    />
                  </button>
                  <div className="flex gap-1.5 rounded-full border border-white/5 bg-black/40 px-3 py-1.5 backdrop-blur-md">
                    {images.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          i === currentImage ? 'w-8 bg-primary' : 'w-2 bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="group/btn flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-all hover:bg-primary"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight
                      size={20}
                      className="transition-transform group-hover/btn:translate-x-0.5"
                    />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Video */}
        {content.videoUrl ? (
          <section className="relative overflow-hidden border-t border-border/20 bg-secondary/5 py-14 md:py-24">
            <div className="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/20 to-transparent" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-linear-to-r from-transparent via-orange-600/20 to-transparent" />
            <div className="container mx-auto px-6">
              <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="order-1"
                >
                  <span className="mb-3 block text-[10px] font-bold tracking-[0.2em] text-primary uppercase md:text-xs">
                    {content.videoBadge || 'Conócenos mejor'}
                  </span>
                  <h2 className="mb-5 text-2xl leading-[1.1] font-bold tracking-tight text-foreground md:text-4xl">
                    {content.videoTitle || 'NUESTRA HISTORIA EN VIDEO'}
                  </h2>
                  <div className="mb-6 h-1.5 w-16 rounded-full bg-primary" />
                  <div
                    className="mb-8 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base [&_p]:mb-4 last:[&_p]:mb-0"
                    dangerouslySetInnerHTML={{
                      __html:
                        content.videoDescription ??
                        '<p>Descubre el propósito detrás de FincasYa.</p>',
                    }}
                  />
                  <div className="inline-flex items-center gap-4 rounded-3xl border border-border/50 bg-background/50 p-4 shadow-sm backdrop-blur-md transition-transform duration-300 hover:scale-105">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/20">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[9px] font-bold tracking-widest text-orange-600 uppercase">
                        Seguridad
                      </span>
                      <span className="text-sm leading-none font-bold text-foreground">
                        100% Verificado
                      </span>
                    </div>
                  </div>
                </motion.div>
                <div className="order-2 flex justify-center">
                  <div className="relative w-full max-w-[300px] md:max-w-[360px]">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8 }}
                      className="relative z-10 aspect-9/16 overflow-hidden rounded-[40px] border-2 border-black/90 bg-black shadow-[0_48px_80px_-16px_rgba(0,0,0,0.2)] backdrop-blur-3xl md:rounded-[56px]"
                    >
                      <video
                        src={content.videoUrl}
                        className="h-full w-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                        controls
                        poster={images[0]}
                      />
                    </motion.div>
                    <div className="absolute -top-12 -right-12 -z-10 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
                    <div className="absolute -bottom-12 -left-12 -z-10 h-48 w-48 rounded-full bg-orange-600/20 blur-[80px]" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Políticas */}
        <section className="relative overflow-hidden border-t border-border/30 bg-background py-24">
          <div className="absolute top-0 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="container relative z-10 mx-auto px-6">
            <motion.div {...fadeInUp} className="mx-auto mb-16 max-w-4xl text-center">
              <span className="mb-4 block text-[10px] font-bold tracking-widest text-primary uppercase md:text-xs">
                Compromiso FincasYa
              </span>
              <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
                NUESTRAS POLÍTICAS
              </h2>
              <p className="mx-auto max-w-2xl text-sm leading-relaxed font-medium text-muted-foreground/80 md:text-base">
                Lineamientos cuidadosamente diseñados para garantizar la
                excelencia, seguridad y absoluta transparencia en cada reserva.
              </p>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
              className="mx-auto flex max-w-7xl flex-wrap justify-center gap-6 lg:gap-8"
            >
              {(Array.isArray(content.politicas) ? content.politicas : []).map(
                (pol, i) => (
                  <motion.div
                    key={pol}
                    {...fadeInUp}
                    transition={{ delay: i * 0.1 }}
                    className="group relative w-full overflow-hidden rounded-[32px] border border-border/40 bg-secondary/5 p-6 shadow-sm transition-all duration-500 hover:border-primary/30 hover:bg-secondary/10 hover:shadow-xl hover:shadow-primary/5 md:w-[calc(50%-12px)] lg:w-[calc(33.333%-21.33px)] md:p-8"
                  >
                    <div className="pointer-events-none absolute -inset-px rounded-[32px] bg-linear-to-b from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="relative z-10 flex items-start gap-4">
                      <span className="-mt-1 text-2xl leading-none font-bold text-muted-foreground/30 transition-colors select-none group-hover:text-primary/40 lg:text-3xl">
                        {(i + 1).toString().padStart(2, '0')}
                      </span>
                      <p className="text-sm leading-snug font-semibold text-foreground lg:text-base">
                        {pol}
                      </p>
                    </div>
                  </motion.div>
                ),
              )}
            </motion.div>
          </div>
        </section>

        {/* Presencia institucional */}
        <section className="border-t border-border/50 py-16">
          <div className="container mx-auto px-6 text-center">
            <motion.div {...fadeInUp} className="mx-auto max-w-4xl text-center">
              <h2 className="mb-4 text-sm font-bold tracking-widest text-muted-foreground uppercase">
                Presencia Institucional
              </h2>
              <div
                className="prose prose-sm dark:prose-invert mx-auto mb-6 max-w-none text-center text-muted-foreground"
                dangerouslySetInnerHTML={{
                  __html: content.presenciaInstitucional,
                }}
              />
              <div className="flex flex-wrap items-center justify-center gap-12 opacity-60 grayscale transition-all duration-500 hover:grayscale-0">
                <div className="relative h-16 w-32">
                  <Image
                    src="/anato.webp"
                    alt="ANATO Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="text-xl font-bold tracking-tighter text-muted-foreground">
                  TURISMO META
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
