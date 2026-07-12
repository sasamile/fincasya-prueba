'use client';

import { ConvexReactClient } from 'convex/react';

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://modest-husky-871.convex.cloud';

/** Cliente Convex compartido (browser). Usado por Providers y llamadas imperativas del admin. */
export const convex = new ConvexReactClient(convexUrl);

/** @deprecated Usa `convex` directamente. */
export function getConvexClient() {
  return convex;
}
