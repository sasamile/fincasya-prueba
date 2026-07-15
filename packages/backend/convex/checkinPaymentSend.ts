/**
 * Resumen de pago al completar el check-in (portado de v1, mejorado).
 *
 * En v1 el envío era manual desde el panel (el frontend armaba el texto). Aquí
 * se dispara AUTOMÁTICO al final de `checkinPortal.submitCheckin` y el texto se
 * arma en el backend con los datos reales (total, abono neto, saldo). Es
 * idempotente vía `bookings.checkinPaymentSentAt` (no reenvía al re-enviar el
 * formulario del check-in).
 */
import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { netPaidFromPayments, pendingFromTotal } from './lib/bookingPayments';
import { sendTextToYcloud } from './lib/ycloud/senders';

function normalizeOutboundPhone(raw: string | undefined | null): string {
  const cleaned = String(raw ?? '').replace(/[^\d]/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 10 && cleaned.startsWith('3')) return `57${cleaned}`;
  return cleaned;
}

function paymentPortalBase(): string {
  return (
    process.env.PAYMENT_PORTAL_BASE_URL || 'https://fincasya.com/pago'
  ).replace(/\/+$/, '');
}

function formatCop(value: number): string {
  return `$ ${Math.round(value).toLocaleString('es-CO')}`;
}

function formatFecha(ms: number): string {
  return new Date(ms).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Datos mínimos para armar y enviar el resumen. */
export const getSummaryData = internalQuery({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;
    const property = await ctx.db.get(booking.propertyId);
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_booking', (q) => q.eq('bookingId', bookingId))
      .collect();
    const pagoTotal = netPaidFromPayments(payments);
    const precioTotal = Number(booking.precioTotal) || 0;
    return {
      celular: booking.celular,
      nombre: booking.nombreCompleto ?? '',
      reference: (booking.reference ?? String(booking._id)) as string,
      propertyTitle:
        (property as { title?: string } | null)?.title ?? 'tu finca',
      fechaEntrada: booking.fechaEntrada,
      horaEntrada: booking.horaEntrada ?? null,
      precioTotal,
      pagoTotal,
      pagoPendiente: pendingFromTotal(precioTotal, pagoTotal),
      alreadySent: Boolean(booking.checkinPaymentSentAt),
    };
  },
});

export const markSent = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }) => {
    await ctx.db.patch(bookingId, {
      checkinPaymentSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Envía por WhatsApp el resumen de pago de la reserva (tras el check-in). */
export const sendPaymentSummaryToBooking = internalAction({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }) => {
    const data = await ctx.runQuery(internal.checkinPaymentSend.getSummaryData, {
      bookingId,
    });
    if (!data) return { ok: false as const, reason: 'not_found' as const };
    if (data.alreadySent) return { ok: true as const, skipped: 'already_sent' as const };

    const to = normalizeOutboundPhone(data.celular);
    if (!to) return { ok: false as const, reason: 'no_phone' as const };

    const primerNombre = data.nombre.trim().split(/\s+/)[0] || 'Hola';
    const lineas = [
      '*FincasYa.com* — Check-in recibido ✅',
      '',
      `Hola ${primerNombre},`,
      '',
      `Recibimos el check-in de tu reserva *${data.reference}*.`,
      '',
      `Finca: *${data.propertyTitle}*`,
      `Ingreso: ${formatFecha(data.fechaEntrada)}${data.horaEntrada ? ` · ${data.horaEntrada}` : ''}`,
      '',
      '*Resumen de pago*',
      `Valor total reservado: ${formatCop(data.precioTotal)}`,
    ];
    if (data.pagoTotal > 0) {
      lineas.push(`Abono registrado: ${formatCop(data.pagoTotal)}`);
    }
    if (data.pagoPendiente > 0) {
      lineas.push(`*Saldo pendiente: ${formatCop(data.pagoPendiente)}*`);
      lineas.push('');
      lineas.push('Consulta los medios de pago y paga tu saldo aquí:');
      lineas.push(`${paymentPortalBase()}/${encodeURIComponent(data.reference)}`);
    } else {
      lineas.push('✅ Tu reserva está *paga en su totalidad*.');
    }
    lineas.push('');
    lineas.push('Quedamos atentos. ¡Gracias por tu confianza! 💚');

    try {
      await sendTextToYcloud({ to, text: lineas.join('\n'), sendDirectly: true });
    } catch (err) {
      console.error('[checkinPaymentSend] fallo el envío', err);
      return { ok: false as const, reason: 'send_failed' as const };
    }
    await ctx.runMutation(internal.checkinPaymentSend.markSent, { bookingId });
    return { ok: true as const };
  },
});
