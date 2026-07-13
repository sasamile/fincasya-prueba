import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

const DOC_TYPES = new Set([
  'payment-proof',
  'signed-contract',
  'cedula-photo',
]);

type DocType = 'payment-proof' | 'signed-contract' | 'cedula-photo';

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_').slice(0, 180) || 'documento';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const rawType = new URL(request.url).searchParams.get('type') ?? '';
  if (!DOC_TYPES.has(rawType)) {
    return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 });
  }
  const type = rawType as DocType;

  try {
    const client = getConvexHttpClient();
    const doc = await client.query(api.saleLinks.getDocumentForAdmin, {
      token,
      type,
    });
    if (!doc?.url?.trim()) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const upstream = await fetch(doc.url.trim(), { cache: 'no-store' });
    if (!upstream.ok) {
      console.error(
        '[api/sale-links/document-file] upstream',
        upstream.status,
        doc.url,
      );
      return NextResponse.json(
        { error: 'No se pudo obtener el archivo' },
        { status: 502 },
      );
    }

    const contentType =
      doc.mimeType?.trim() ||
      upstream.headers.get('content-type') ||
      'application/octet-stream';
    const body = await upstream.arrayBuffer();
    const fileName = safeFileName(doc.fileName ?? 'documento');

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[api/sale-links/document-file]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}
