'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
} as const;

export function PublicMarketingShell({
  loading,
  unavailable,
  children,
}: {
  loading?: boolean;
  unavailable?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="landing min-h-screen">
      <main className="relative min-h-screen overflow-x-hidden bg-background">
        <div className="w-full py-4">
          <Navbar isHome={false} />
        </div>
        {loading ? (
          <div className="container mx-auto px-6 py-24 text-center text-muted-foreground">
            Cargando...
          </div>
        ) : unavailable ? (
          <div className="container mx-auto px-6 py-24 text-center">
            <h1 className="text-2xl font-bold">Página no disponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta página todavía no tiene contenido configurado.
            </p>
          </div>
        ) : (
          children
        )}
        <Footer />
      </main>
    </div>
  );
}

export function PublicBlackHero({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle?: string;
  stats?: { value: string; label: string }[];
}) {
  return (
    <section className="relative overflow-hidden bg-black py-16 text-white lg:py-24">
      <div className="absolute inset-0 z-0 opacity-10 blur-3xl">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-orange-600" />
      </div>
      <div className="relative z-10 container mx-auto px-6 text-center">
        <h1 className="mb-4 text-3xl font-extrabold md:text-5xl">{title}</h1>
        {subtitle ? (
          <p className="mx-auto mb-10 max-w-xl text-lg text-white/80">{subtitle}</p>
        ) : null}
        {stats?.length ? (
          <div className="flex flex-wrap justify-center gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-extrabold text-primary md:text-3xl">
                  {stat.value}
                </div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
