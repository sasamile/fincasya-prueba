import { v } from 'convex/values';
import { internalAction, internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { sendEmail } from './lib/email';
import { wrap, rows } from './lib/emailTemplates';

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

/* ─────────────────────────────────────────────────────────────
 * Panel admin (Ley 1581): listar, contar pendientes y gestionar
 * el estado de cada solicitud (con notas internas del equipo).
 * ───────────────────────────────────────────────────────────── */

const STATUSES = ['pending', 'in_progress', 'resolved', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

function assertStatus(value: string): Status {
  if ((STATUSES as readonly string[]).includes(value)) return value as Status;
  throw new Error('Estado inválido.');
}

/** Lista de solicitudes para el panel (filtro opcional por estado). */
export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    if (args.status) {
      const status = assertStatus(args.status);
      return await ctx.db
        .query('habeas_data_requests')
        .withIndex('by_status', (q) => q.eq('status', status))
        .order('desc')
        .take(limit);
    }
    return await ctx.db
      .query('habeas_data_requests')
      .withIndex('by_submittedAt')
      .order('desc')
      .take(limit);
  },
});

/** Solicitudes pendientes (badge del menú admin). */
export const countPending = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('habeas_data_requests')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();
    return rows.length;
  },
});

/** Cambia el estado de una solicitud y/o guarda notas internas. */
export const updateStatus = mutation({
  args: {
    id: v.id('habeas_data_requests'),
    status: v.string(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error('Solicitud no encontrada.');
    const status = assertStatus(args.status);

    const patch: Partial<Doc<'habeas_data_requests'>> = { status };
    if (args.adminNotes !== undefined) {
      patch.adminNotes = trim(args.adminNotes, 4000) || undefined;
    }
    if (status === 'resolved' || status === 'rejected') {
      patch.resolvedAt = Date.now();
    }
    await ctx.db.patch(args.id, patch);
    return { ok: true as const };
  },
});

/** Notifica al equipo (lista admin configurable) vía Brevo. */
export const sendNotificationEmail = internalAction({
  args: { requestId: v.id('habeas_data_requests') },
  handler: async (ctx, args) => {
    const request: Doc<'habeas_data_requests'> | null = await ctx.runQuery(
      internal.habeasData.getById,
      { requestId: args.requestId },
    );
    if (!request) return;

    // Lista admin configurable (con fallback a HABEAS_DATA_EMAIL para compat).
    const admins: string[] = await ctx.runQuery(
      internal.notificationSettings.resolveAdminEmails,
      {},
    );
    const habeasOverride = process.env.HABEAS_DATA_EMAIL?.trim();
    const recipients = habeasOverride ? [habeasOverride, ...admins] : admins;
    const to = [...new Set(recipients)].map((email) => ({ email }));

    const typeLabel = REQUEST_TYPE_LABELS[request.requestType as RequestType];
    const submitted = new Date(request.submittedAt).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
    });

    const html = wrap({
      title: '📋 Nueva solicitud de Habeas Data',
      intro: 'Un usuario envió una solicitud desde el sitio público.',
      bodyHtml:
        rows([
          ['Tipo', typeLabel],
          ['Nombre', request.fullName],
          ['Documento', `${request.documentType} ${request.documentNumber}`],
          ['Email', request.email],
          ['Teléfono', request.phone],
          ['Recibida', submitted],
        ]) +
        `<p style="margin:12px 0 0;font-size:14px;color:#3f3f46"><strong>Descripción:</strong><br/>${request.description.replace(
          /\n/g,
          '<br/>',
        )}</p>`,
    });

    await sendEmail({
      to,
      subject: `[Habeas Data] ${typeLabel} — ${request.fullName}`,
      html,
      replyTo: { email: request.email, name: request.fullName },
    });
  },
});
