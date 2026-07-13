import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET_NAME || '';

const s3 =
  BUCKET && process.env.AWS_ACCESS_KEY_ID
    ? new S3Client({
        region: REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      })
    : null;

export type BookingMultimediaFile = {
  url: string;
  name: string;
  type: string;
  size?: number;
  uploadedAt?: number;
};

type BookingStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PAID'
  | 'CANCELLED'
  | 'COMPLETED';

export type ParsedBookingForm = {
  propertyId: Id<'properties'>;
  nombreCompleto: string;
  cedula: string;
  celular: string;
  correo: string;
  fechaEntrada: number;
  fechaSalida: number;
  numeroNoches: number;
  numeroPersonas: number;
  personasAdicionales?: number;
  tieneMascotas?: boolean;
  numeroMascotas?: number;
  detallesMascotas?: string;
  subtotal: number;
  costoPersonasAdicionales?: number;
  costoMascotas?: number;
  depositoMascotas?: number;
  sobrecargoMascotas?: number;
  costoPersonalServicio?: number;
  depositoGarantia?: number;
  depositoAseo?: number;
  discountCode?: string;
  discountAmount?: number;
  issueDate?: string;
  economicAdjustments?: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'INCREMENT' | 'DISCOUNT';
    createdBy?: string;
    createdAt: number;
  }>;
  precioTotal: number;
  currency?: string;
  temporada: string;
  observaciones?: string;
  city?: string;
  address?: string;
  fechaNacimiento?: string;
  isDirect?: boolean;
  purpose?: string;
  groupType?: string;
  isEvento?: boolean;
  reference?: string;
  calendarLabel?: string;
  horaEntrada?: string;
  horaSalida?: string;
  status?: BookingStatus;
  multimedia?: BookingMultimediaFile[];
};

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function num(form: FormData, key: string): number {
  const raw = str(form, key);
  if (!raw) return 0;
  const n = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function bool(form: FormData, key: string): boolean {
  const raw = str(form, key).toLowerCase();
  return raw === 'true' || raw === '1';
}

function optionalStr(form: FormData, key: string): string | undefined {
  const v = str(form, key);
  return v || undefined;
}

function parseStatus(form: FormData): BookingStatus | undefined {
  const raw = str(form, 'status').toUpperCase();
  const allowed: BookingStatus[] = [
    'PENDING',
    'PENDING_PAYMENT',
    'CONFIRMED',
    'PAID',
    'CANCELLED',
    'COMPLETED',
  ];
  return allowed.includes(raw as BookingStatus) ? (raw as BookingStatus) : undefined;
}

function parseEconomicAdjustments(form: FormData) {
  const raw = str(form, 'economicAdjustments');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function collectMultimediaFiles(form: FormData): File[] {
  const files: File[] = [];
  const entries = form.getAll('multimedia');
  for (const value of entries) {
    if (value instanceof File && value.size > 0) {
      files.push(value);
    }
  }
  return files;
}

async function uploadDocument(file: File): Promise<BookingMultimediaFile> {
  if (!s3 || !BUCKET) {
    throw new Error(
      'Faltan credenciales AWS para subir archivos (AWS_S3_BUCKET_NAME / AWS_ACCESS_KEY_ID).',
    );
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const contentType = file.type || 'application/octet-stream';
  const key = `documents/${randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: contentType === 'application/pdf' ? 'inline' : undefined,
    }),
  );

  return {
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
    name: file.name,
    type: contentType,
    size: file.size,
    uploadedAt: Date.now(),
  };
}

export async function uploadBookingMultimedia(
  files: File[],
): Promise<BookingMultimediaFile[]> {
  const out: BookingMultimediaFile[] = [];
  for (const file of files) {
    out.push(await uploadDocument(file));
  }
  return out;
}

/** Convierte el FormData del modal de reserva manual al payload de Convex. */
export async function parseBookingFormData(
  form: FormData,
): Promise<ParsedBookingForm> {
  const propertyId = str(form, 'propertyId');
  const nombreCompleto = str(form, 'nombreCompleto');
  const fechaEntrada = num(form, 'fechaEntrada');
  const fechaSalida = num(form, 'fechaSalida');

  if (!propertyId) throw new Error('Falta seleccionar la finca.');
  if (!nombreCompleto) throw new Error('Falta el nombre del huésped.');
  if (!fechaEntrada || !fechaSalida) {
    throw new Error('Faltan las fechas de entrada o salida.');
  }

  const multimediaFiles = collectMultimediaFiles(form);
  const multimedia =
    multimediaFiles.length > 0
      ? await uploadBookingMultimedia(multimediaFiles)
      : undefined;

  const payload: ParsedBookingForm = {
    propertyId: propertyId as Id<'properties'>,
    nombreCompleto,
    cedula: str(form, 'cedula'),
    celular: str(form, 'celular'),
    correo: str(form, 'correo'),
    fechaEntrada,
    fechaSalida,
    numeroNoches: Math.max(1, num(form, 'numeroNoches') || 1),
    numeroPersonas: Math.max(1, num(form, 'numeroPersonas') || 1),
    personasAdicionales: num(form, 'personasAdicionales') || undefined,
    tieneMascotas: form.has('tieneMascotas') ? bool(form, 'tieneMascotas') : undefined,
    numeroMascotas: num(form, 'numeroMascotas') || undefined,
    detallesMascotas: optionalStr(form, 'detallesMascotas'),
    subtotal: num(form, 'subtotal'),
    costoPersonasAdicionales: num(form, 'costoPersonasAdicionales') || undefined,
    costoMascotas: num(form, 'costoMascotas') || undefined,
    depositoMascotas: num(form, 'depositoMascotas') || undefined,
    sobrecargoMascotas: num(form, 'sobrecargoMascotas') || undefined,
    costoPersonalServicio: num(form, 'costoPersonalServicio') || undefined,
    depositoGarantia: num(form, 'depositoGarantia') || undefined,
    depositoAseo: num(form, 'depositoAseo') || undefined,
    discountCode: optionalStr(form, 'discountCode'),
    discountAmount: num(form, 'discountAmount') || undefined,
    issueDate: optionalStr(form, 'issueDate'),
    economicAdjustments: parseEconomicAdjustments(form),
    precioTotal: num(form, 'precioTotal'),
    currency: optionalStr(form, 'currency') ?? 'COP',
    temporada: str(form, 'temporada') || 'ESTANDAR',
    observaciones: optionalStr(form, 'observaciones'),
    city: optionalStr(form, 'city'),
    address: optionalStr(form, 'address'),
    fechaNacimiento: optionalStr(form, 'fechaNacimiento'),
    isDirect: form.has('isDirect') ? bool(form, 'isDirect') : true,
    purpose: optionalStr(form, 'purpose'),
    groupType: optionalStr(form, 'groupType'),
    isEvento: form.has('isEvento') ? bool(form, 'isEvento') : undefined,
    reference: optionalStr(form, 'reference'),
    calendarLabel: optionalStr(form, 'calendarLabel'),
    horaEntrada: optionalStr(form, 'horaEntrada'),
    horaSalida: optionalStr(form, 'horaSalida'),
    status: parseStatus(form),
    multimedia,
  };

  if (!payload.precioTotal || payload.precioTotal <= 0) {
    throw new Error('El precio total debe ser mayor a cero.');
  }

  return payload;
}

export async function readBookingFormRequest(
  request: Request,
): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return request.formData();
  }

  // Compatibilidad: JSON directo (p. ej. herramientas internas).
  const body = (await request.json()) as Record<string, unknown>;
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value == null) continue;
    if (typeof value === 'object') {
      form.set(key, JSON.stringify(value));
    } else {
      form.set(key, String(value));
    }
  }
  return form;
}
