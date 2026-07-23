/**
 * COTIZACIÓN AL PROPIETARIO (Adriana, 22-jul).
 *
 * Una página aparte baja las reservas, el asesor teclea en cuánto se le
 * negoció la finca al dueño, se genera un documento con la marca y se envía por
 * correo al propietario.
 *
 * El correo del propietario se precarga de la ficha de la finca
 * (`propietarioCorreo`) y el asesor puede corregirlo antes de enviar.
 */
import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { api } from './_generated/api';
import { sendEmail } from './lib/email';

/** Reservas para el selector de la página, con datos del propietario. */
export const listReservations = query({
  args: { buscar: v.optional(v.string()) },
  handler: async (ctx, { buscar }) => {
    const bookings = await ctx.db.query('bookings').order('desc').take(300);

    const needle = (buscar ?? '').trim().toLowerCase();
    const filtradas = needle
      ? bookings.filter((b) => {
          const ref = String(b.reference ?? '').toLowerCase();
          const nombre = String(b.nombreCompleto ?? '').toLowerCase();
          return ref.includes(needle) || nombre.includes(needle);
        })
      : bookings.slice(0, 60);

    return Promise.all(
      filtradas.slice(0, 60).map(async (b) => {
        const property = b.propertyId ? await ctx.db.get(b.propertyId) : null;
        const p = (property ?? {}) as Record<string, unknown>;
        return {
          _id: b._id,
          reference: b.reference ?? '',
          nombreCompleto: b.nombreCompleto ?? '',
          propertyId: b.propertyId,
          propertyTitle: (p.title as string) ?? '',
          propertyLocation: (p.location as string) ?? '',
          propietarioNombre: (p.propietarioNombre as string) ?? '',
          propietarioCorreo: (p.propietarioCorreo as string) ?? '',
          propietarioTelefono: (p.propietarioTelefono as string) ?? '',
          fechaEntrada: b.fechaEntrada,
          fechaSalida: b.fechaSalida,
          numeroNoches: b.numeroNoches,
          numeroPersonas: b.numeroPersonas,
          precioTotal: b.precioTotal,
          groupType: b.groupType ?? '',
        };
      }),
    );
  },
});

/** Deja registrado en la reserva el valor negociado con el propietario. */
export const recordOwnerAmount = mutation({
  args: { bookingId: v.id('bookings'), amount: v.number() },
  handler: async (ctx, { bookingId, amount }): Promise<{ ok: boolean }> => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return { ok: false };
    await ctx.db.patch(bookingId, {
      ownerNegotiatedAmount: amount,
      ownerNegotiatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Envía la cotización al correo del propietario (Brevo), con el documento PDF
 * adjunto. El PDF se genera y sube en el cliente; aquí solo llega su URL.
 */
export const sendToOwner = action({
  args: {
    to: v.string(),
    ownerName: v.optional(v.string()),
    propertyTitle: v.string(),
    contractReference: v.optional(v.string()),
    amount: v.number(),
    pdfUrl: v.string(),
    pdfFilename: v.string(),
    bookingId: v.optional(v.id('bookings')),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const to = args.to.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return { ok: false, error: 'El correo del propietario no es válido.' };
    }

    const saludo = args.ownerName?.trim()
      ? `Hola ${args.ownerName.trim()},`
      : 'Hola,';
    const ref = args.contractReference?.trim()
      ? ` (reserva ${args.contractReference.trim()})`
      : '';
    const html = `
      <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
        <p>${saludo}</p>
        <p>Te compartimos la cotización de tu propiedad
          <strong>${args.propertyTitle}</strong>${ref}.</p>
        <p>Adjuntamos el documento con los detalles de la negociación. Quedamos
          atentos a tu confirmación.</p>
        <p>Un saludo,<br/>Equipo FincasYa.com</p>
      </div>`;

    const result = await sendEmail({
      to: [{ email: to, name: args.ownerName?.trim() || undefined }],
      subject: `Cotización de tu propiedad ${args.propertyTitle} — FincasYa.com`,
      html,
      attachments: [{ url: args.pdfUrl, name: args.pdfFilename }],
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? 'No se pudo enviar el correo.' };
    }
    if (args.bookingId) {
      await ctx.runMutation(api.ownerQuotes.recordOwnerAmount, {
        bookingId: args.bookingId,
        amount: args.amount,
      });
    }
    return { ok: true };
  },
});
