/**
 * Better Auth montado directo en Convex (componente oficial), sin backend
 * Nest de por medio. Las rutas HTTP se registran en `convex/http.ts` y quedan
 * disponibles en `https://<deployment>.convex.site/api/auth/*`.
 */
import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import type { GenericCtx } from '@convex-dev/better-auth/utils';
import type { BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth';
import { components } from '../_generated/api';
import type { DataModel } from '../_generated/dataModel';
import authConfig from '../auth.config';
import schema from './schema';

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  verbose: false,
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const database = authComponent.adapter(ctx);

  const siteUrl = process.env.SITE_URL || 'http://localhost:3789';

  return {
    appName: 'FincasYa',
    baseURL: siteUrl + '/api/auth',
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    database,
    trustedOrigins: [
      'http://localhost:3789',
      'https://modest-husky-871.convex.site',
      'https://fincasya.com',
      'https://www.fincasya.com',
    ],
    emailAndPassword: {
      enabled: true,
    },
    // Nuestra app (localhost:3789) y Convex (*.convex.site) son orígenes
    // distintos: las cookies de sesión necesitan SameSite=None + Secure para
    // que el navegador las envíe en las peticiones cross-origin del cliente
    // de Better Auth. Secure funciona igual porque convex.site siempre es https,
    // sin importar que nuestra app corra en http://localhost en dev.
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'operador',
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 días
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      convex({
        authConfig,
        options: { basePath: '/api/auth' },
        jwt: { expirationSeconds: 60 * 60 * 24 },
      }),
    ],
  } satisfies BetterAuthOptions;
};

// Usado por createApi/CLI para extraer el schema con contexto vacío.
export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
