import { v } from 'convex/values';
import { internalAction, internalQuery, mutation } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';

const REQUEST_TYPES = [
  'acceso',
  'rectificacion',
  'cancelacion',
  'oposicion',
  'revocatoria',
  'queja',
] as const;

type RequestType = (typeof REQUEST_TYPES)[number];

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  acceso: 'Acceso',
  rectificacion: 'Rectificación',
  cancelacion: 'Cancelación / Supresión',
  oposicion: 'Oposición',
  revocatoria: 'Revocatoria del consentimiento',
  queja: 'Queja por uso indebido',
};

const DOCUMENT_TYPES = ['CC', 'CE', 'PA', 'NIT', 'OTRO'] as const;

function trim(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function assertRequestType(value: string): RequestType {
  if ((REQUEST_TYPES as readonly string[]).includes(value)) {
    return value as RequestType;
  }
  throw new Error('Tipo de solicitud inválido.');
}

function assertDocumentType(value: string): string {
  if ((DOCUMENT_TYPES as readonly string[]).includes(value)) {
    return value;
  }
  throw new Error('Tipo de documento inválido.');
}

/** Formulario público /habeas-data — persiste en Convex (sin Nest). */
export const submit = mutation({
  args: {
    fullName: v.string(),
    documentType: v.string(),
    documentNumber: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    requestType: v.string(),
    description: v.string(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fullName = trim(args.fullName, 200);
    const documentNumber = trim(args.documentNumber, 50);
    const email = trim(args.email, 254).toLowerCase();
    const phone = args.phone ? trim(args.phone, 30) : undefined;
    const description = trim(args.description, 5000);
    const documentType = assertDocumentType(trim(args.documentType, 10));
    const requestType = assertRequestType(trim(args.requestType, 30));

    if (!fullName) throw new Error('El nombre completo es obligatorio.');
    if (!documentNumber) throw new Error('El número de documento es obligatorio.');
    if (!email || !isValidEmail(email)) throw new Error('Correo electrónico inválido.');
    if (!description || description.length < 10) {
      throw new Error('Describe tu solicitud con al menos 10 caracteres.');
    }

    const now = Date.now();
    const id = await ctx.db.insert('habeas_data_requests', {
      fullName,
      documentType,
      documentNumber,
      email,
      phone,
      requestType,
      description,
      status: 'pending',
      submittedAt: now,
      userAgent: args.userAgent ? trim(args.userAgent, 500) : undefined,
      ipAddress: args.ipAddress ? trim(args.ipAddress, 80) : undefined,
    });

    await ctx.scheduler.runAfter(0, internal.habeasData.sendNotificationEmail, {
      requestId: id,
    });

    return { ok: true as const, id };
  },
});

export const getById = internalQuery({
  args: { requestId: v.id('habeas_data_requests') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

/** Notifica al equipo comercial vía Brevo (si está configurado). */
export const sendNotificationEmail = internalAction({
  args: { requestId: v.id('habeas_data_requests') },
  handler: async (ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    const toEmail =
      process.env.HABEAS_DATA_EMAIL?.trim() ||
      process.env.ADMIN_EMAIL?.trim() ||
      'comercial@fincasya.com';
    const senderEmail =
      process.env.BREVO_SENDER_EMAIL?.trim() || 'comercial@fincasya.com';
    const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'FincasYa';

    if (!apiKey) {
      console.warn('[habeasData] BREVO_API_KEY no configurada — solicitud guardada sin email.');
      return;
    }

    const request: Doc<'habeas_data_requests'> | null = await ctx.runQuery(
      internal.habeasData.getById,
      {
        requestId: args.requestId,
      },
    );
    if (!request) return;

    const typeLabel = REQUEST_TYPE_LABELS[request.requestType as RequestType];
    const submitted = new Date(request.submittedAt).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
    });

    const htmlContent = `
      <h2>Nueva solicitud Habeas Data</h2>
      <p><strong>Tipo:</strong> ${typeLabel}</p>
      <p><strong>Nombre:</strong> ${request.fullName}</p>
      <p><strong>Documento:</strong> ${request.documentType} ${request.documentNumber}</p>
      <p><strong>Email:</strong> ${request.email}</p>
      ${request.phone ? `<p><strong>Teléfono:</strong> ${request.phone}</p>` : ''}
      <p><strong>Recibida:</strong> ${submitted}</p>
      <p><strong>Descripción:</strong></p>
      <p>${request.description.replace(/\n/g, '<br/>')}</p>
      <hr/>
      <p style="color:#666;font-size:12px">ID: ${request._id}</p>
    `;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail }],
        replyTo: { email: request.email, name: request.fullName },
        subject: `[Habeas Data] ${typeLabel} — ${request.fullName}`,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[habeasData] Brevo error:', res.status, text);
    }
  },
});
