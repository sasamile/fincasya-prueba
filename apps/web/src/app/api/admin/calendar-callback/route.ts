/**
 * Callback de OAuth de Google Calendar. Google redirige el navegador aquí con
 * `?code=...` tras autorizar. Esta ruta DEBE ser server-side (el intercambio del
 * code requiere el client_secret) — es un caso legítimo de route handler, igual
 * que `/api/admin/upload`.
 *
 * El `redirectUri` usado aquí debe coincidir EXACTAMENTE con el que se pasó a
 * `generateAuthUrl` (mismo origin) y estar registrado en Google Cloud Console.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Usa la convención de query params que ya lee la página (`success`/`error`).
  if (error || !code) {
    const msg = encodeURIComponent(error || 'No se recibió el código de Google');
    return NextResponse.redirect(`${origin}/admin/reservations?error=${msg}`);
  }

  try {
    const client = getConvexHttpClient();
    await client.action(api.googleCalendar.exchangeCodeForTokens, {
      code,
      redirectUri: `${origin}/api/admin/calendar-callback`,
    });
    return NextResponse.redirect(
      `${origin}/admin/reservations?success=1&migrate=1`,
    );
  } catch (e) {
    console.error('[calendar-callback]', e);
    const message = e instanceof Error ? e.message.slice(0, 200) : 'Error desconocido';
    return NextResponse.redirect(
      `${origin}/admin/reservations?error=${encodeURIComponent(message)}`,
    );
  }
}
