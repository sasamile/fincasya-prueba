/**
 * Callback de OAuth de Meta (Facebook Login). Meta redirige el navegador aquí
 * con `?code=...` tras autorizar. Debe ser server-side: el intercambio del code
 * requiere el App Secret (que vive solo en Convex). Igual que calendar-callback.
 *
 * El `redirectUri` usado aquí debe coincidir EXACTAMENTE con el pasado a
 * `generateAuthUrl` y estar registrado en la config de la app de Meta
 * (Facebook Login → Valid OAuth Redirect URIs).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const error =
    searchParams.get('error_description') || searchParams.get('error');

  if (error || !code) {
    const msg = encodeURIComponent(error || 'No se recibió el código de Meta');
    return NextResponse.redirect(`${origin}/admin/canales?error=${msg}`);
  }

  try {
    const client = getConvexHttpClient();
    const result = await client.action(
      api.metaChannels.exchangeCodeAndConnect,
      {
        code,
        redirectUri: `${origin}/api/admin/meta-callback`,
      },
    );
    return NextResponse.redirect(
      `${origin}/admin/canales?success=1&connected=${result.connected}`,
    );
  } catch (e) {
    console.error('[meta-callback]', e);
    const message =
      e instanceof Error ? e.message.slice(0, 240) : 'Error desconocido';
    return NextResponse.redirect(
      `${origin}/admin/canales?error=${encodeURIComponent(message)}`,
    );
  }
}
