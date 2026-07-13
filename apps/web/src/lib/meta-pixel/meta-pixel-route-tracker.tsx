"use client";

import { Suspense } from "react";
import { useMetaPixelPageView } from "./use-meta-pixel";

/**
 * Componente cliente delgado que escucha cambios de ruta del App Router y
 * dispara `fbq('track', 'PageView')` en cada navegación.
 *
 * Va envuelto en <Suspense> porque `useSearchParams()` (usado adentro)
 * requiere un boundary de Suspense en Next.js 15+/16.
 */
function MetaPixelRouteListener() {
  useMetaPixelPageView();
  return null;
}

export function MetaPixelRouteTracker() {
  return (
    <Suspense fallback={null}>
      <MetaPixelRouteListener />
    </Suspense>
  );
}
