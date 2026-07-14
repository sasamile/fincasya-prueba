'use client';

/**
 * Registra las visitas del sitio público en Convex (`siteAnalytics.recordPageView`),
 * que alimenta la tarjeta "Visitas al sitio" del dashboard admin.
 * Cuenta la carga inicial y cada navegación client-side del App Router.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

/** Rutas internas que no cuentan como visita (mismo criterio que PublicSiteWidgets). */
const HIDDEN_PREFIXES = ['/admin', '/checkin', '/anfitrion', '/dev-doc', '/_font-check'];

export function SiteVisitTracker() {
  const pathname = usePathname() ?? '';
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const hidden = HIDDEN_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (hidden) return;
    // Evita duplicados (Strict Mode en dev, re-renders sin cambio de ruta).
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    convex.mutation(api.siteAnalytics.recordPageView, { path: pathname }).catch(() => {
      // La visita no es crítica: nunca rompemos la página por analytics.
    });
  }, [pathname]);

  return null;
}
