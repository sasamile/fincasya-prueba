/**
 * Correos de la plataforma — un solo módulo central.
 *
 * Cada tipo de correo es un `internalAction` que:
 *   1. resuelve los datos que necesita desde la BD (internalQuery),
 *   2. resuelve los destinatarios (cliente = su email; admin = lista
 *      configurable `notificationSettings.resolveAdminEmails`),
 *   3. arma el HTML con las plantillas y llama `sendEmail`.
 *
 * Los flujos de negocio solo agregan `ctx.scheduler.runAfter(0, internal.
 * notifications.<x>, {...})` en su disparador — no llevan lógica de correo.
 */
import { v } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { api, internal } from './_generated/api';
import { sendEmail } from './lib/email';
import {
  wrap,
  rows,
  formatCOP,
  formatDate,
  formatDateTime,
} from './lib/emailTemplates';
import { isHiddenAccessLogEmail } from './lib/roles';
import { siteUrl } from './lib/publicSiteUrl';
import { resolveSaleLinkReference } from './lib/saleLinkReference';

/** Asunto de correos de pago: finca + CR cuando existan. */
function paymentEmailSubject(
  prefix: string,
  opts: { propertyName?: string | null; cr?: string | null; clientName?: string | null },
): string {
  const parts = [prefix];
  const finca = opts.propertyName?.trim();
  const cr = opts.cr?.trim();
  if (finca) parts.push(finca);
  if (cr) parts.push(cr);
  const client = opts.clientName?.trim();
  if (client) parts.push(client);
  return parts.join(' · ');
}

function formatHoraIngreso(hora?: string | null, ms?: number): string {
  const s = String(hora ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    let h = parseInt(m[1], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m[2]} ${ampm}`;
  }
  if (s) return s;
  if (ms != null && Number.isFinite(ms)) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    }).format(new Date(ms));
  }
  return '10:00 AM';
}

// ─── Datos para correos de link de venta ────────────────────────────────────

export const _saleLinkEmailData = internalQuery({
  args: { saleLinkId: v.id('saleLinks') },
  handler: async (ctx, { saleLinkId }) => {
    const link = await ctx.db.get(saleLinkId);
    if (!link) return null;
    let propertyName: string | undefined;
    try {
      const prop = await ctx.db.get(link.propertyId);
      propertyName =
        (prop as { title?: string; nombre?: string } | null)?.title ??
        (prop as { title?: string; nombre?: string } | null)?.nombre;
    } catch {
      /* no crítico */
    }
    return {
      token: link.token,
      validationKey: link.paymentValidationKey,
      clientName: link.clientData?.nombre,
      clientEmail: link.clientData?.email,
      propertyName,
      cr: resolveSaleLinkReference(link),
      totalValue: link.totalValue,
      proofAmount: link.paymentProofAmount,
      checkIn: link.checkIn,
      checkOut: link.checkOut,
      guests: link.guests,
      createdByName: link.createdByName,
      paymentValidated: !!link.paymentValidated,
    };
  },
});

/**
 * Garantiza token + paymentValidationKey para el magic link público
 * `/validar-pago/[token]?key=…` (sin login admin).
 */
export const _ensureSaleLinkValidationKey = internalMutation({
  args: { saleLinkId: v.id('saleLinks') },
  handler: async (ctx, { saleLinkId }) => {
    const link = await ctx.db.get(saleLinkId);
    if (!link?.token?.trim()) return null;
    let validationKey = link.paymentValidationKey?.trim() ?? '';
    if (!validationKey) {
      validationKey = crypto.randomUUID();
      await ctx.db.patch(saleLinkId, {
        paymentValidationKey: validationKey,
        updatedAt: Date.now(),
      });
    }
    return { token: link.token.trim(), validationKey };
  },
});

// ─── Admin: un cliente subió su soporte de pago ──────────────────────────────

export const notifyAdminSaleLinkPayment = internalAction({
  args: { saleLinkId: v.id('saleLinks') },
  handler: async (ctx, { saleLinkId }): Promise<void> => {
    const [data, admins, ensured] = await Promise.all([
      ctx.runQuery(internal.notifications._saleLinkEmailData, { saleLinkId }),
      ctx.runQuery(internal.notificationSettings.resolveAdminEmails, {}),
      ctx.runMutation(internal.notifications._ensureSaleLinkValidationKey, {
        saleLinkId,
      }),
    ]);
    if (!data || admins.length === 0 || !ensured) return;

    // Nunca mandar a /admin/payment-review: ese path exige sesión y se
    // queda en "Verificando acceso…" si el admin abre el correo sin login.
    const reviewUrl = `${siteUrl()}/validar-pago/${encodeURIComponent(ensured.token)}?key=${encodeURIComponent(ensured.validationKey)}`;

    const html = wrap({
      title: 'Un cliente subió su soporte de pago',
      intro:
        'Abre este enlace para ver el comprobante y validar el pago (no necesitas entrar al panel).',
      bodyHtml: rows([
        ['Cliente', data.clientName],
        ['Finca', data.propertyName],
        ['CR', data.cr],
        ['Monto reportado', formatCOP(data.proofAmount)],
        ['Valor total', formatCOP(data.totalValue)],
        ['Check-in', formatDate(data.checkIn)],
        ['Check-out', formatDate(data.checkOut)],
        ['Huéspedes', data.guests ? String(data.guests) : undefined],
        ['Asesor', data.createdByName],
      ]),
      ctaLabel: 'Revisar pago',
      ctaUrl: reviewUrl,
    });

    await sendEmail({
      to: admins.map((email: string) => ({ email })),
      subject: paymentEmailSubject('Soporte de pago', {
        propertyName: data.propertyName,
        cr: data.cr,
        clientName: data.clientName,
      }),
      html,
    });
  },
});

// ─── Cliente: su pago fue validado ───────────────────────────────────────────

export const emailClientPaymentValidated = internalAction({
  args: { saleLinkId: v.id('saleLinks') },
  handler: async (ctx, { saleLinkId }): Promise<void> => {
    const data = await ctx.runQuery(internal.notifications._saleLinkEmailData, {
      saleLinkId,
    });
    if (!data?.clientEmail) return;

    const html = wrap({
      title: '✅ ¡Tu pago fue validado!',
      intro: `Hola ${data.clientName ?? ''}, confirmamos tu pago. Ya puedes continuar con tu reserva.`,
      bodyHtml: rows([
        ['Finca', data.propertyName],
        ['CR', data.cr],
        ['Check-in', formatDate(data.checkIn)],
        ['Check-out', formatDate(data.checkOut)],
        ['Huéspedes', data.guests ? String(data.guests) : undefined],
      ]),
      ctaLabel: 'Continuar mi reserva',
      ctaUrl: `${siteUrl()}/venta/${data.token}`,
    });

    await sendEmail({
      to: [{ email: data.clientEmail, name: data.clientName }],
      subject: paymentEmailSubject('✅ Pago validado', {
        propertyName: data.propertyName,
        cr: data.cr,
      }),
      html,
    });
  },
});

// ─── Admin: alguien inició sesión en el panel ───────────────────────────────

export const notifyAdminSessionLogin = internalAction({
  args: {
    userName: v.optional(v.string()),
    userEmail: v.string(),
    role: v.optional(v.string()),
    loginAt: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const loginEmail = args.userEmail.trim().toLowerCase();
    // Cuentas de servicio / bot: nunca avisar.
    if (isHiddenAccessLogEmail(loginEmail)) return;

    const admins = await ctx.runQuery(
      internal.notificationSettings.resolveAdminEmails,
      {},
    );
    // No notificar al mismo usuario que acaba de entrar (evita autocorreo al admin).
    const recipients = admins.filter((email: string) => email !== loginEmail);
    if (recipients.length === 0) return;

    const displayName = args.userName?.trim() || args.userEmail;
    const html = wrap({
      title: '🔐 Nuevo acceso al panel',
      intro: `${displayName} acaba de iniciar sesión en la plataforma.`,
      bodyHtml: rows([
        ['Usuario', displayName],
        ['Correo', args.userEmail],
        ['Rol', args.role],
        ['Fecha y hora', formatDateTime(args.loginAt)],
      ]),
      ctaLabel: 'Ver historial de accesos',
      ctaUrl: `${siteUrl()}/admin/access-logs`,
    });

    await sendEmail({
      to: recipients.map((email: string) => ({ email })),
      subject: `🔐 Acceso al panel — ${displayName}`,
      html,
    });
  },
});

/**
 * Correo manual de invitación al check-in (botón "Correo" en admin/reservas).
 * Misma lógica que fincasya-new `sendCheckinInvitation`.
 */
export const sendCheckinInvitationEmail = action({
  args: { bookingId: v.id('bookings') },
  handler: async (
    ctx,
    { bookingId },
  ): Promise<{ ok: boolean; to?: string; error?: string }> => {
    const booking = await ctx.runQuery(api.bookings.getById, { id: bookingId });
    if (!booking) return { ok: false, error: 'Reserva no encontrada' };

    const clientEmail = String(booking.correo ?? '').trim();
    if (!clientEmail) {
      return { ok: false, error: 'La reserva no tiene correo del cliente' };
    }

    const reference = String(booking.reference ?? bookingId).trim() || bookingId;
    const propertyTitle =
      (booking.property as { title?: string } | null)?.title?.trim() ||
      'tu finca';
    const clientName =
      String(booking.nombreCompleto ?? '').trim() || 'huésped';

    const fechaRaw = new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Bogota',
    }).format(new Date(booking.fechaEntrada));
    const checkInDate =
      fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);
    const checkInTime = formatHoraIngreso(
      booking.horaEntrada,
      booking.fechaEntrada,
    );
    const checkinUrl = `${siteUrl()}/checkin/${encodeURIComponent(reference)}`;

    const html = wrap({
      title: `¡Falta poco para tu llegada a ${propertyTitle}!`,
      intro: `Hola ${clientName}, para autorizar tu ingreso completa tu check-in (lista de invitados con nombre y cédula).`,
      bodyHtml:
        rows([
          ['Fecha de entrada', checkInDate],
          ['Hora de ingreso', checkInTime],
          ['Referencia', reference],
          ['Finca', propertyTitle],
        ]) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
          <tr>
            <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;font-size:13px;color:#9a3412;line-height:1.55">
              <strong style="color:#c2410c">Importante:</strong> el check-in debe completarse mínimo <strong>36 horas antes</strong> de tu llegada. Puedes guardar el avance y volver al mismo enlace cuando quieras.
            </td>
          </tr>
         </table>`,
      ctaLabel: 'Hacer mi check-in',
      ctaUrl: checkinUrl,
    });

    const result = await sendEmail({
      to: [{ email: clientEmail, name: clientName }],
      subject: `📋 Completa tu check-in para ${propertyTitle}`,
      html,
    });

    if (!result.ok) {
      return {
        ok: false,
        to: clientEmail,
        error: result.error || 'No se pudo enviar el correo de check-in',
      };
    }

    return { ok: true, to: clientEmail };
  },
});
