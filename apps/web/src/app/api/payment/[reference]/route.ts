import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET_NAME || '';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const key = decodeURIComponent(reference).trim();
    if (!key) {
      return NextResponse.json({ error: 'Referencia inválida' }, { status: 400 });
    }
    const client = getConvexHttpClient();
    const data = await client.query(api.paymentPortal.getByReference, { key });
    if (!data) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[payment GET]', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el portal de pago' },
      { status: 500 },
    );
  }
}

/** Sube comprobante (imagen/PDF) y lo registra; Convex agenda análisis IA del monto. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const key = decodeURIComponent(reference).trim();
    if (!key) {
      return NextResponse.json({ error: 'Referencia inválida' }, { status: 400 });
    }

    if (!BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
      return NextResponse.json(
        { error: 'Faltan credenciales AWS para subir el soporte.' },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }

    const mime = file.type || 'application/octet-stream';
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      return NextResponse.json(
        { error: 'Solo se permiten imágenes o PDF' },
        { status: 400 },
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo es muy grande (máx. 5 MB)' },
        { status: 400 },
      );
    }

    const ext =
      file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
      (isPdf ? 'pdf' : 'jpg');
    const objectKey = `images/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
        Body: bytes,
        ContentType: mime,
      }),
    );
    const receiptUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${objectKey}`;

    const bankAccountId = String(form.get('bankAccountId') ?? '').trim() || undefined;
    const bankName = String(form.get('bankName') ?? '').trim() || undefined;
    const amountRaw = String(form.get('amount') ?? '').replace(/[^\d]/g, '');
    const amount = amountRaw ? Number(amountRaw) : undefined;

    const client = getConvexHttpClient();
    const result = await client.mutation(api.paymentPortal.submitReceipt, {
      key,
      bankAccountId,
      bankName,
      amount: amount && amount > 0 ? amount : undefined,
      receiptUrl,
      fileName: file.name,
      mimeType: mime,
    });

    if (!result?.ok) {
      const reasons: Record<string, string> = {
        not_found: 'Reserva no encontrada',
        upload_disabled: 'La carga de soportes no está habilitada para esta reserva',
        missing_receipt: 'No se pudo guardar la URL del comprobante',
      };
      return NextResponse.json(
        {
          error:
            reasons[String((result as { reason?: string })?.reason)] ??
            'No se pudo registrar el soporte',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      receiptId: result.receiptId,
      receiptUrl,
    });
  } catch (error) {
    console.error('[payment POST]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo enviar el comprobante',
      },
      { status: 500 },
    );
  }
}
