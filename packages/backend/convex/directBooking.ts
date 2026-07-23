/**
 * Reserva directa web (Propiedad Empresa): crea booking + link Bold,
 * y tras pago genera contrato/CR y lo envía por correo.
 */
import { v } from 'convex/values';
import { action, internalMutation, mutation, query } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { createBoldPaymentLink } from './lib/bold';
import { sendEmail } from './lib/email';
import { verifyCedulaPhoto } from './lib/cedulaAi';
import { getPublicSiteOrigin } from './lib/publicSiteUrl';

function ymdFromMs(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** Siguiente CR libre del vendedor con iniciales "CR" (o el primero activo). */
async function peekDefaultCr(ctx: Pick<ActionCtx, 'runQuery'>): Promise<string> {
  const payload = (await ctx.runQuery(api.adminContractSettings.getGlobalPayload, {})) as {
    contractSellers?: Array<{
      id: string;
      iniciales: string;
      lastNumber: number;
      activo?: boolean;
    }>;
  } | null;
  const sellers = (payload?.contractSellers ?? []).filter((s) => s.activo !== false);
  const cr =
    sellers.find((s) => s.iniciales?.toUpperCase() === 'CR') ?? sellers[0];
  if (!cr?.id) {
    return `FY-${Date.now()}`;
  }
  const peeked = (await ctx.runQuery(api.adminContractSettings.peekNextContractCode, {
    sellerId: cr.id,
  })) as { code?: string } | null;
  return peeked?.code?.trim() || `FY-${Date.now()}`;
}

/**
 * Crea la reserva directa + link Bold por el total completo
 * (arriendo + depósito de daños + mascotas/servicio vía calculateStayPrice).
 */
export const createWithBold = action({
  args: {
    propertyId: v.id('properties'),
    nombreCompleto: v.string(),
    cedula: v.string(),
    celular: v.string(),
    celularAdicional: v.optional(v.string()),
    correo: v.string(),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    fechaEntrada: v.number(),
    fechaSalida: v.number(),
    numeroPersonas: v.number(),
    numeroMascotas: v.optional(v.number()),
    incluirServicio: v.optional(v.boolean()),
    password: v.optional(v.string()),
    portalOrigin: v.optional(v.string()),
    purpose: v.optional(v.string()),
    groupType: v.optional(v.string()),
    isEvento: v.optional(v.boolean()),
    eventType: v.optional(v.string()),
    eventGuests: v.optional(v.string()),
    eventGuestsCount: v.optional(v.string()),
    eventServices: v.optional(v.string()),
    eventDecoration: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    cedulaPhotoUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    bookingId: string;
    reference: string;
    contractCode: string;
    total: number;
    advance: number;
    damageDeposit: number;
    subtotal: number;
    boldPaymentUrl: string | undefined;
    boldError: string | undefined;
    checkIn: string;
    checkOut: string;
    propertyTitle: string;
  }> => {
    const property = await ctx.runQuery(api.fincas.getByIdPublic, {
      id: args.propertyId,
    });
    if (!property) throw new Error('Finca no encontrada.');
    if (property.reservable === false) {
      throw new Error('Esta finca no admite reserva web.');
    }

    const cedulaPhotoUrl = args.cedulaPhotoUrl.trim();
    if (!cedulaPhotoUrl) {
      throw new Error('Debes adjuntar la foto de tu cédula.');
    }
    const cedulaVerdict = await verifyCedulaPhoto(
      cedulaPhotoUrl,
      args.cedula,
      args.nombreCompleto,
    );
    if (!cedulaVerdict.allow) {
      throw new Error(
        cedulaVerdict.reason === 'number_mismatch'
          ? 'El número de la cédula en la foto no coincide con el que escribiste.'
          : cedulaVerdict.reason === 'name_mismatch'
            ? 'El nombre en la cédula no coincide con el que escribiste.'
            : 'No pudimos validar tu cédula. Sube una foto más clara del frente.',
      );
    }

    const checkInYmd = ymdFromMs(args.fechaEntrada);
    const checkOutYmd = ymdFromMs(args.fechaSalida);
    const price = await ctx.runQuery(api.fincas.calculateStayPrice, {
      propertyId: args.propertyId,
      fechaEntrada: checkInYmd,
      fechaSalida: checkOutYmd,
      numeroPersonas: args.numeroPersonas,
      numeroMascotas: args.numeroMascotas ?? 0,
      incluirServicio: args.incluirServicio === true,
    });

    const nights = Math.max(1, price.nightsCount ?? 1);
    const total = Math.max(0, Math.round(Number(price.total) || 0));
    if (total < 2000) throw new Error('Total de reserva inválido.');

    const advance = total;
    const contractCode = await peekDefaultCr(ctx);
    const reference = `FY-${Date.now()}`.slice(0, 60);

    const isEvento = args.isEvento === true || args.purpose === 'EVENTO';
    const detallesEvento = isEvento
      ? {
          extraSound: args.eventServices?.includes('SONIDO')
            ? 'SI'
            : undefined,
          liveMusic: args.eventServices?.includes('MUSICA_VIVO')
            ? 'SI'
            : undefined,
          dj: args.eventServices?.includes('DJ') ? 'SI' : undefined,
          decoration: args.eventDecoration || undefined,
          additionalGuests:
            args.eventGuests === 'SI'
              ? args.eventGuestsCount || 'SI'
              : args.eventGuests === 'NO'
                ? 'NO'
                : undefined,
        }
      : undefined;

    const bookingId = (await ctx.runMutation(api.bookings.create, {
      propertyId: args.propertyId,
      nombreCompleto: args.nombreCompleto.trim(),
      cedula: args.cedula.trim(),
      celular: args.celular.trim(),
      celularAdicional: args.celularAdicional?.trim() || undefined,
      correo: args.correo.trim().toLowerCase(),
      city: args.city?.trim() || undefined,
      address: args.address?.trim() || undefined,
      fechaNacimiento: args.fechaNacimiento?.trim() || undefined,
      cedulaPhotoUrl,
      fechaEntrada: args.fechaEntrada,
      fechaSalida: args.fechaSalida,
      numeroNoches: nights,
      numeroPersonas: Math.max(1, args.numeroPersonas),
      tieneMascotas: (args.numeroMascotas ?? 0) > 0,
      numeroMascotas: args.numeroMascotas ?? 0,
      subtotal: Math.round(Number(price.subtotal) || 0),
      costoMascotas: Math.round(Number(price.pets?.total) || 0),
      depositoMascotas: Math.round(Number(price.pets?.refundable) || 0),
      sobrecargoMascotas: Math.round(
        Number(price.pets?.serviceFee || 0) + Number(price.pets?.cleaningFee || 0),
      ),
      costoPersonalServicio: Math.round(Number(price.serviceStaff?.fee) || 0),
      depositoGarantia: Math.round(Number(price.damageDeposit) || 0),
      depositoAseo: 0,
      precioTotal: total,
      temporada: String(price.appliedRule || 'Estándar'),
      isDirect: true,
      reference,
      status: 'PENDING_PAYMENT',
      calendarLabel: contractCode,
      purpose: args.purpose?.trim() || undefined,
      groupType: args.groupType?.trim() || undefined,
      isEvento,
      detallesEvento,
      observaciones: args.eventType?.trim()
        ? `Tipo de evento: ${args.eventType.trim()}`
        : undefined,
    })) as Id<'bookings'>;

    try {
      await ctx.runMutation(internal.adminContractSettings.commitContractCodeInternal, {
        code: contractCode,
      });
    } catch {
      /* contador opcional si no hay vendedores configurados */
    }

    await ctx.runMutation(internal.directBooking.attachContractCode, {
      bookingId,
      contractCode,
    });

    const rawOrigin = args.portalOrigin?.trim() || '';
    const origin =
      rawOrigin &&
      !/\.vercel\.app/i.test(rawOrigin) &&
      !/localhost|127\.0\.0\.1/i.test(rawOrigin)
        ? rawOrigin
        : getPublicSiteOrigin();
    const callbackUrl = `${origin.replace(/\/$/, '')}/fincas/book/success?ref=${encodeURIComponent(reference)}`;

    let boldPaymentUrl: string | undefined;
    let boldError: string | undefined;
    try {
      const bold = await createBoldPaymentLink({
        amountCop: advance,
        description: `Reserva ${contractCode} · ${property.title}`.slice(0, 100),
        reference: `DB-${reference}`.slice(0, 60),
        callbackUrl,
      });
      boldPaymentUrl = bold.url;
      await ctx.runMutation(internal.directBooking.attachBoldLink, {
        bookingId,
        boldPaymentUrl: bold.url,
        boldPaymentLinkId: bold.paymentLinkId,
        boldPaymentAmount: advance,
      });
    } catch (err) {
      boldError = err instanceof Error ? err.message : String(err);
    }

    return {
      bookingId: String(bookingId),
      reference,
      contractCode,
      total,
      advance,
      damageDeposit: Math.round(Number(price.damageDeposit) || 0),
      subtotal: Math.round(Number(price.subtotal) || 0),
      boldPaymentUrl,
      boldError,
      checkIn: checkInYmd,
      checkOut: checkOutYmd,
      propertyTitle: property.title,
    };
  },
});

/** Valida foto de cédula (misma IA que el link de venta) sin token de sale link. */
export const verifyCedula = action({
  args: {
    photoUrl: v.string(),
    typedCedula: v.string(),
    typedName: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    { photoUrl, typedCedula, typedName },
  ): Promise<{
    allow: boolean;
    needsReview: boolean;
    reason?: string;
    aiNumber?: string;
    aiName?: string;
  }> => {
    const verdict = await verifyCedulaPhoto(photoUrl, typedCedula, typedName);
    return {
      allow: verdict.allow,
      needsReview: verdict.needsReview,
      reason: verdict.reason,
      aiNumber: verdict.check?.number,
      aiName: verdict.check?.name,
    };
  },
});

export const attachContractCode = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    contractCode: v.string(),
  },
  handler: async (ctx, { bookingId, contractCode }) => {
    // Guarda el CR en calendarLabel; `reference` sigue siendo FY-… (Bold / lookup).
    await ctx.db.patch(bookingId, {
      calendarLabel: contractCode,
      updatedAt: Date.now(),
    });
  },
});

export const attachBoldLink = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    boldPaymentUrl: v.string(),
    boldPaymentLinkId: v.string(),
    boldPaymentAmount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookingId, {
      boldPaymentUrl: args.boldPaymentUrl,
      boldPaymentLinkId: args.boldPaymentLinkId,
      boldPaymentAmount: args.boldPaymentAmount,
      updatedAt: Date.now(),
    });
  },
});

/** Público: estado de la reserva directa por reference/CR. */
export const getByReferencePublic = query({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const ref = reference.trim();
    if (!ref) return null;
    const booking = await ctx.db
      .query('bookings')
      .withIndex('by_reference', (q) => q.eq('reference', ref))
      .first();
    if (!booking) return null;
    const property = await ctx.db.get(booking.propertyId);
    return {
      bookingId: String(booking._id),
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      nombreCompleto: booking.nombreCompleto,
      correo: booking.correo,
      celular: booking.celular,
      cedula: booking.cedula,
      fechaEntrada: booking.fechaEntrada,
      fechaSalida: booking.fechaSalida,
      numeroPersonas: booking.numeroPersonas,
      numeroMascotas: booking.numeroMascotas,
      precioTotal: booking.precioTotal,
      subtotal: booking.subtotal,
      depositoGarantia: booking.depositoGarantia,
      boldPaymentUrl: booking.boldPaymentUrl,
      boldPaymentAmount: booking.boldPaymentAmount,
      contractUrl: booking.contractUrl,
      propertyId: String(booking.propertyId),
      propertyTitle: property?.title ?? '',
      propertySlug: property?.slug ?? '',
      contractCode: booking.calendarLabel ?? booking.reference ?? '',
    };
  },
});

export const markPaid = mutation({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const booking = await ctx.db
      .query('bookings')
      .withIndex('by_reference', (q) => q.eq('reference', reference.trim()))
      .first();
    if (!booking) throw new Error('Reserva no encontrada.');
    await ctx.db.patch(booking._id, {
      status: 'PAID',
      paymentStatus: 'PAID',
      updatedAt: Date.now(),
    });
    return { ok: true, bookingId: booking._id };
  },
});

export const attachContractUrl = mutation({
  args: {
    reference: v.string(),
    contractUrl: v.string(),
  },
  handler: async (ctx, { reference, contractUrl }) => {
    const booking = await ctx.db
      .query('bookings')
      .withIndex('by_reference', (q) => q.eq('reference', reference.trim()))
      .first();
    if (!booking) throw new Error('Reserva no encontrada.');
    await ctx.db.patch(booking._id, {
      contractUrl: contractUrl.trim(),
      status: booking.status === 'PENDING_PAYMENT' ? 'CONFIRMED' : booking.status,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Envía el contrato PDF por Brevo al correo del cliente. */
export const emailContract = action({
  args: {
    toEmail: v.string(),
    toName: v.string(),
    contractCode: v.string(),
    propertyTitle: v.string(),
    contractUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <p>Hola ${args.toName},</p>
        <p>Adjunto encuentras el contrato de tu reserva en <strong>${args.propertyTitle}</strong>
        (código <strong>${args.contractCode}</strong>).</p>
        <p>También puedes descargarlo aquí:
          <a href="${args.contractUrl}">${args.contractUrl}</a>
        </p>
        <p>Gracias por reservar con FincasYa.</p>
      </div>
    `;
    const result = await sendEmail({
      to: [{ email: args.toEmail, name: args.toName }],
      subject: `Contrato ${args.contractCode} · ${args.propertyTitle}`,
      html,
      attachments: [
        {
          url: args.contractUrl,
          name: `Contrato_${args.contractCode}.pdf`,
        },
      ],
    });
    return result;
  },
});
