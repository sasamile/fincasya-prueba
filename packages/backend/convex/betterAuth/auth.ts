/**
 * Better Auth montado directo en Convex (componente oficial), sin backend
 * Nest de por medio. Las rutas HTTP se registran en `convex/http.ts` y quedan
 * disponibles en `https://<deployment>.convex.site/api/auth/*`.
 */
import { createClient } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
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

export function buildTrustedOrigins(): string[] {
  const origins = new Set([
    'http://localhost:3789',
    'https://modest-husky-871.convex.site',
    'https://fincasya.com',
    'https://www.fincasya.com',
    'https://fincasya-prueba-web.vercel.app',
  ]);

  const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, '');
  if (siteUrl) origins.add(siteUrl);

  const extra = process.env.TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (extra) extra.forEach((o) => origins.add(o));

  return [...origins];
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const database = authComponent.adapter(ctx);

  const siteUrl = process.env.SITE_URL || 'http://localhost:3789';
  const convexSiteUrl =
    process.env.CONVEX_SITE_URL ?? 'https://modest-husky-871.convex.site';

  return {
    appName: 'FincasYa',
    // Auth vive en *.convex.site; la app en localhost/Vercel es otro origen.
    baseURL: convexSiteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    database,
    trustedOrigins: buildTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'operador',
          input: false,
        },
        phone: {
          type: 'string',
          required: false,
          input: false,
        },
        position: {
          type: 'string',
          required: false,
          input: false,
        },
        documentId: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 días
      updateAge: 60 * 60 * 24,
    },
    /**
     * UNA SOLA SESIÓN POR CUENTA (Adriana, 22-jul).
     *
     * La misma cuenta quedaba abierta en dos computadores a la vez. Ahora, al
     * iniciar sesión, se cierran TODAS las sesiones anteriores de ese usuario:
     * entra el nuevo y el anterior queda deslogueado.
     *
     * Va en try/catch a propósito: si la limpieza falla, el login NO se rompe
     * — es preferible una sesión de más que dejar a alguien sin poder entrar.
     */
    databaseHooks: {
      session: {
        create: {
          after: async (
            session: { userId: string; token: string },
            endpointCtx?: unknown,
          ) => {
            try {
              // El adapter llega en el contexto del hook (no en el factory).
              const db = (
                endpointCtx as
                  | {
                      context?: {
                        adapter?: {
                          findMany: (a: unknown) => Promise<unknown>;
                          delete: (a: unknown) => Promise<unknown>;
                        };
                      };
                    }
                  | undefined
              )?.context?.adapter;
              if (!db) return;

              const previas = (await db.findMany({
                model: 'session',
                where: [{ field: 'userId', value: session.userId }],
              })) as Array<{ token?: string }>;

              for (const previa of previas) {
                if (!previa?.token || previa.token === session.token) continue;
                await db.delete({
                  model: 'session',
                  where: [{ field: 'token', value: previa.token }],
                });
              }
            } catch (err) {
              console.error(
                '[auth] no se pudieron cerrar las sesiones anteriores',
                err,
              );
            }
          },
        },
      },
    },
    plugins: [
      // Guarda la sesión en localStorage y la manda por header Better-Auth-Cookie
      // (las cookies de terceros en el navegador suelen bloquearse).
      crossDomain({ siteUrl }),
      convex({
        authConfig,
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
