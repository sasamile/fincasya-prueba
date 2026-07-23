/**
 * Proxy de avatares de Meta (Facebook Messenger / comentarios / Instagram).
 * Las URLs de perfil caducan; este endpoint pide una foto fresca a Graph API
 * en cada carga (con caché corta en el navegador).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#e4e6eb"/><circle cx="48" cy="36" r="18" fill="#bcc0c4"/><ellipse cx="48" cy="78" rx="28" ry="20" fill="#bcc0c4"/></svg>`;

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('pageId')?.trim();
  const participantId = req.nextUrl.searchParams.get('participantId')?.trim();
  const platform = req.nextUrl.searchParams.get('platform')?.trim();

  if (!pageId || !participantId || !platform) {
    return new NextResponse(PLACEHOLDER_SVG, {
      status: 400,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }

  if (
    platform !== 'messenger' &&
    platform !== 'instagram' &&
    platform !== 'facebook'
  ) {
    return new NextResponse(PLACEHOLDER_SVG, {
      status: 400,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const client = getConvexHttpClient();
    const { url } = await client.action(api.metaChannels.resolveParticipantAvatar, {
      pageId,
      participantId,
      platform,
    });

    if (!url) {
      // Meta no da foto (falta permiso o el usuario no la comparte). El
      // placeholder es una respuesta válida: 200 + caché, para no repetir en
      // cada carga una consulta a Graph que tarda segundos.
      return new NextResponse(PLACEHOLDER_SVG, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'private, max-age=900',
        },
      });
    }

    const imgRes = await fetch(url);
    if (!imgRes.ok || !imgRes.body) {
      return new NextResponse(PLACEHOLDER_SVG, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'private, max-age=900',
        },
      });
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    return new NextResponse(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(PLACEHOLDER_SVG, {
      status: 502,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }
}
