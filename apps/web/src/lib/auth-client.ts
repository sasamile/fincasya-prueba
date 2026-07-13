/**
 * Cliente de Better Auth (login del panel /inbox). Habla directo con Convex
 * — las rutas de Better Auth están montadas en `convex/http.ts`, expuestas en
 * `{CONVEX_SITE_URL}/api/auth/*`. Sin backend Nest de por medio.
 */
import { createAuthClient } from 'better-auth/react';
import {
  convexClient,
  crossDomainClient,
} from '@convex-dev/better-auth/client/plugins';

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? 'https://modest-husky-871.convex.site';

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});
