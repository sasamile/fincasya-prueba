'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { Skeleton } from '@/components/ui/skeleton';

export function PublicPageShell({
  children,
  loading,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="landing min-h-screen bg-background">
      <Navbar isHome={false} />
      <main className="min-h-[60vh]">
        {loading ? (
          <div className="container mx-auto max-w-4xl px-6 py-16 space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          children
        )}
      </main>
      <Footer />
    </div>
  );
}

export function PublicPageHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="border-b border-border/30 bg-linear-to-br from-[#fff6f2] via-white to-white">
      <div className="container mx-auto max-w-4xl px-6 py-12 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  );
}
