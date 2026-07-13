import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

const DOC_KINDS = new Set(['contract', 'confirmation']);

type DocKind = 'contract' | 'confirmation';

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_').slice(0, 180) || 'documento';
}

function isAllowedDocumentUrl(url: string): boolean {
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
  if (!bucket) return url.startsWith('https://') || url.startsWith('http://');
  return (
    url.includes(`${bucket}.s3.`) ||
    url.includes(`s3.amazonaws.com/${bucket}/`) ||
    url.includes(`s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${bucket}/`)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractNumber: string }> },
) {
  const { contractNumber } = await params;
  const code = decodeURIComponent(contractNumber ?? '').trim();
  if (!code) {
    return NextResponse.json({ error: 'Falta el número de contrato' }, { status: 400 });
  }

  const rawKind = new URL(request.url).searchParams.get('kind') ?? 'contract';
  if (!DOC_KINDS.has(rawKind)) {
    return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 });
  }
  const kind = rawKind as DocKind;

  try {
    const client = getConvexHttpClient();
    const detail = await client.query(api.contracts.getDetail, {
      contractNumber: code,
    });
    if (!detail) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const doc =
      kind === 'confirmation'
        ? {
            url: detail.confirmationPdfUrl,
            fileName: detail.confirmationPdfFilename,
            mimeType: 'application/pdf',
          }
        : {
            url: detail.pdfUrl,
            fileName: detail.pdfFilename,
            mimeType: undefined as string | undefined,
          };

    const fileUrl = doc.url?.trim();
    if (!fileUrl) {
      return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 });
    }
    if (!isAllowedDocumentUrl(fileUrl)) {
      return NextResponse.json({ error: 'URL de documento no permitida' }, { status: 403 });
    }

    const upstream = await fetch(fileUrl, { cache: 'no-store' });
    if (!upstream.ok) {
      console.error(
        '[api/contracts/document-file] upstream',
        upstream.status,
        fileUrl,
      );
      return NextResponse.json(
        { error: 'No se pudo obtener el archivo' },
        { status: 502 },
      );
    }

    const contentType =
      doc.mimeType?.trim() ||
      upstream.headers.get('content-type') ||
      'application/pdf';
    const body = await upstream.arrayBuffer();
    const fileName = safeFileName(doc.fileName ?? `contrato-${code}.pdf`);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[api/contracts/document-file]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}
