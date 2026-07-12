/**
 * Subida de archivos del panel admin al bucket S3 de FincasYa.
 * Espejo del `S3Service` de fincasya-new (Nest): misma estructura de carpetas
 * (`images/`, `videos/`, `documents/`, `features/`) y misma URL pública
 * `https://{bucket}.s3.{region}.amazonaws.com/{key}`, para que las imágenes
 * nuevas convivan con las ya migradas.
 *
 * Server-side a propósito: el bucket NO tiene CORS para PUT desde el navegador
 * (verificado), así que presigned URLs no funcionan sin tocar su config.
 *
 * Nota de seguridad: valida carpeta/tipo/tamaño. La autenticación fina queda
 * pendiente igual que en el resto del backend Convex de `prueba` (las
 * mutations tampoco validan sesión todavía); el panel gatea por better-auth
 * en el cliente.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
/** Videos de fincas pueden pesar bastante; margen amplio. */
export const maxDuration = 120;

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET_NAME || '';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

/** Carpetas permitidas y qué tipos de archivo acepta cada una. */
const FOLDERS: Record<string, { accept: (type: string, ext: string) => boolean; maxBytes: number }> = {
  images: {
    accept: (type) => type.startsWith('image/'),
    maxBytes: 25 * 1024 * 1024,
  },
  features: {
    accept: (type, ext) => type === 'image/svg+xml' || ext === 'svg' || type.startsWith('image/'),
    maxBytes: 5 * 1024 * 1024,
  },
  videos: {
    accept: (type, ext) => type.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext),
    maxBytes: 300 * 1024 * 1024,
  },
  documents: {
    accept: (type, ext) =>
      type === 'application/pdf' ||
      type.startsWith('image/') ||
      ['pdf', 'doc', 'docx'].includes(ext),
    maxBytes: 25 * 1024 * 1024,
  },
};

export async function POST(req: NextRequest) {
  if (!BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    return NextResponse.json(
      { error: 'Faltan credenciales AWS en el .env (AWS_S3_BUCKET_NAME / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).' },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  const folder = String(form.get('folder') ?? 'images');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo (campo "file")' }, { status: 400 });
  }
  const folderCfg = FOLDERS[folder];
  if (!folderCfg) {
    return NextResponse.json({ error: `Carpeta no permitida: ${folder}` }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const contentType = file.type || 'application/octet-stream';
  if (!folderCfg.accept(contentType, ext)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido para ${folder}: ${contentType}` },
      { status: 400 },
    );
  }
  if (file.size > folderCfg.maxBytes) {
    return NextResponse.json(
      { error: `Archivo demasiado grande (máx ${Math.round(folderCfg.maxBytes / 1024 / 1024)}MB)` },
      { status: 400 },
    );
  }

  const key = `${folder}/${randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // PDFs se abren en el navegador; el resto se sirve como recurso normal.
        ContentDisposition: contentType === 'application/pdf' ? 'inline' : undefined,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: `Error subiendo a S3: ${message}` }, { status: 502 });
  }

  return NextResponse.json({
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
  });
}
