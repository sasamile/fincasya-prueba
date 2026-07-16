import { v } from 'convex/values';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  normalizeContractCode,
  resolveSaleLinkReference,
} from './lib/saleLinkReference';
import { checkinGuestValidator } from './lib/checkinGuest';
import { verifyCedulaPhoto, decideCedulaVerdict } from './lib/cedulaAi';
import { verifyPaymentReceiptPhoto } from './lib/receiptAi';

type ProvisionFromSaleLinkResult =
  | { ok: true; bookingId: Id<'bookings'>; reference: string }
  | { ok: false; reason: string };

type SetCrUrlResult =
  | { ok: true; bookingId?: Id<'bookings'> }
  | { ok: false; reason: 'not_found' };

type SubmitSignedContractResult =
  | { ok: true; bookingId?: Id<'bookings'> }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeBirthdate(value: string | undefined): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
}

async function upsertCrmContactFromSaleClient(
  ctx: MutationCtx,
  client: {
    nombre: string;
    cedula: string;
    email: string;
    telefono: string;
    direccion: string;
    ciudad?: string;
    fechaNacimiento?: string;
  },
) {
  const now = Date.now();
  const phone = client.telefono.trim();
  if (!phone) return;

  const fechaNacimiento = normalizeBirthdate(client.fechaNacimiento);
  let contactId: Id<'contacts'> | undefined;

  const byPhone = await ctx.db
    .query('contacts')
    .withIndex('by_phone', (q) => q.eq('phone', phone))
    .first();
  if (byPhone) contactId = byPhone._id;

  const cedula = client.cedula.trim();
  if (!contactId && cedula) {
    const byCedula = await ctx.db
      .query('contacts')
      .withIndex('by_cedula', (q) => q.eq('cedula', cedula))
      .first();
    if (byCedula) contactId = byCedula._id;
  }

  if (contactId) {
    const existing = await ctx.db.get(contactId);
    if (!existing) return;
    await ctx.db.patch(contactId, {
      name: client.nombre || existing.name,
      email: client.email || existing.email,
      cedula: cedula || existing.cedula,
      city: client.ciudad || existing.city,
      address: client.direccion || existing.address,
      ...(fechaNacimiento ? { fechaNacimiento } : {}),
      crmType: existing.crmType ?? 'lead',
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert('contacts', {
    phone,
    name: client.nombre,
    email: client.email,
    cedula: cedula || undefined,
    city: client.ciudad,
    address: client.direccion,
    fechaNacimiento,
    crmType: 'lead',
    createdAt: now,
    updatedAt: now,
  });
}

async function assertContractCodeAvailable(
  ctx: MutationCtx,
  rawCode: string,
  excludeId?: Id<'saleLinks'>,
) {
  const code = normalizeContractCode(rawCode);
  if (!code || code.length < 2) {
    throw new Error('La codificación debe tener al menos 2 caracteres');
  }

  const existingLink = await ctx.db
    .query('saleLinks')
    .withIndex('by_contract_code', (q) => q.eq('contractCode', code))
    .first();
  if (existingLink && existingLink._id !== excludeId) {
    throw new Error(`Ya existe un link con la codificación ${code}`);
  }

  const existingBooking = await ctx.db
    .query('bookings')
    .withIndex('by_reference', (q) => q.eq('reference', code))
    .first();
  if (existingBooking) {
    throw new Error(`Ya existe una reserva con la codificación ${code}`);
  }

  return code;
}

async function resolveBookingReference(
  ctx: { db: QueryCtx['db'] },
  link: Doc<'saleLinks'>,
): Promise<string | undefined> {
  if (!link.bookingId) return undefined;
  const booking = await ctx.db.get(link.bookingId);
  if (!booking) return undefined;
  return booking.reference ?? String(booking._id);
}

type PaymentProofRecord = {
  url: string;
  fileName?: string;
  mimeType?: string;
  amount?: number;
  submittedAt: number;
};

function resolvePaymentProofs(link: {
  paymentProofs?: PaymentProofRecord[];
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofMimeType?: string;
  paymentProofAmount?: number;
  paymentProofSubmittedAt?: number;
}): PaymentProofRecord[] {
  if (link.paymentProofs?.length) return link.paymentProofs;
  if (link.paymentProofUrl) {
    return [
      {
        url: link.paymentProofUrl,
        fileName: link.paymentProofFileName,
        mimeType: link.paymentProofMimeType,
        amount: link.paymentProofAmount,
        submittedAt: link.paymentProofSubmittedAt ?? Date.now(),
      },
    ];
  }
  return [];
}

function mapPaymentProofsForPortal(link: Parameters<typeof resolvePaymentProofs>[0]) {
  return resolvePaymentProofs(link).map((proof) => ({
    fileName: proof.fileName,
    mimeType: proof.mimeType,
    amount: proof.amount,
    submittedAt: proof.submittedAt,
  }));
}

const OWNER_ACCOUNT_PREFIX = 'owner:';

type BankAccount = {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  ownerName: string;
  ownerCedula?: string;
  imageUrls?: string[];
  qrOnly?: boolean;
  brebKey?: boolean;
};

/** Mapea cuentas del propietario seleccionadas (ids con prefijo owner:). */
function mapOwnerBankAccounts(
  ownerInfo: Doc<'propertyOwnerInfo'>,
  selectedIds: string[],
): BankAccount[] {
  const ownerIds = selectedIds.filter((id) => id.startsWith(OWNER_ACCOUNT_PREFIX));
  if (ownerIds.length === 0) return [];

  const propietarioNombre = ownerInfo.propietarioNombre?.trim() ?? '';
  const propietarioCedula = ownerInfo.propietarioCedula?.trim() ?? '';

  type OwnerRow = {
    id: string;
    bankName: string;
    accountNumber: string;
    accountType?: string;
    accountHolderName?: string;
  };

  let rows: OwnerRow[] = [];
  if (ownerInfo.bankAccounts?.length) {
    rows = ownerInfo.bankAccounts.map((account) => ({
      id: account.id,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      accountHolderName: account.accountHolderName,
    }));
  } else if (ownerInfo.bankName || ownerInfo.accountNumber) {
    rows = [
      {
        id: 'primary',
        bankName: ownerInfo.bankName,
        accountNumber: ownerInfo.accountNumber,
        accountType: '',
        accountHolderName: propietarioNombre,
      },
    ];
  }

  return rows
    .filter((row) => ownerIds.includes(`${OWNER_ACCOUNT_PREFIX}${row.id}`))
    .map((row) => ({
      id: `${OWNER_ACCOUNT_PREFIX}${row.id}`,
      bankName: row.bankName,
      accountType: row.accountType?.trim() || 'Ahorros',
      accountNumber: row.accountNumber,
      ownerName: row.accountHolderName?.trim() || propietarioNombre,
      ownerCedula: propietarioCedula,
      imageUrls: [] as string[],
    }));
}

/** URLs de imágenes de la finca (tabla propertyImages). */
async function getPropertyImageUrls(
  ctx: any,
  propertyId: Id<'properties'>,
): Promise<string[]> {
  const images = await ctx.db
    .query('propertyImages')
    .withIndex('by_property', (q: any) => q.eq('propertyId', propertyId))
    .collect();

  return images
    .sort((a: Doc<'propertyImages'>, b: Doc<'propertyImages'>) =>
      (a.order ?? 0) - (b.order ?? 0),
    )
    .map((img: Doc<'propertyImages'>) => img.url?.trim())
    .filter((url: string | undefined): url is string => !!url);
}

/** Resuelve los datos de la propiedad para mostrar al cliente. */
async function resolveProperty(ctx: any, propertyId: Id<'properties'>) {
  const prop = await ctx.db.get(propertyId);
  if (!prop) return null;
  const images = await getPropertyImageUrls(ctx, propertyId);
  return {
    id: prop._id,
    title: prop.title ?? '',
    location: prop.location ?? '',
    code: prop.code ?? '',
    slug: prop.slug ?? '',
    images,
    maxGuests: prop.capacity ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Admin mutations (llamados desde NestJS con API key)
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    propertyId: v.id('properties'),
    contractCode: v.string(),
    createdBy: v.string(),
    createdByName: v.optional(v.string()),
    checkIn: v.number(),
    checkOut: v.number(),
    nights: v.number(),
    guests: v.number(),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    totalValue: v.number(),
    rentalValue: v.number(),
    depositAmount: v.number(),
    cleaningFee: v.number(),
    petDeposit: v.optional(v.number()),
    petSurcharge: v.optional(v.number()),
    petCount: v.optional(v.number()),
    advancePaymentAmount: v.optional(v.number()),
    boldPaymentUrl: v.optional(v.string()),
    boldPaymentLinkId: v.optional(v.string()),
    boldPaymentAmount: v.optional(v.number()),
    boldSurchargePercent: v.optional(v.number()),
    selectedBankAccountIds: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { contractCode: rawContractCode, ...rest } = args;
    const contractCode = await assertContractCodeAvailable(ctx, rawContractCode);
    const token = generateToken();
    const now = Date.now();
    const advance =
      typeof args.advancePaymentAmount === 'number' &&
      args.advancePaymentAmount > 0
        ? Math.floor(args.advancePaymentAmount)
        : Math.round(args.totalValue / 2);
    const id = await ctx.db.insert('saleLinks', {
      token,
      contractCode,
      ...rest,
      advancePaymentAmount: advance,
      clientStep: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    // CRM-3: promover oportunidad a "propuesta" o crearla
    const property = await ctx.db.get(args.propertyId);
    await ctx.scheduler.runAfter(0, internal.opportunities.upsertFromSaleLink, {
      saleLinkId: id,
      propertyName: property?.title ?? undefined,
      estimatedValue: args.totalValue,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      guests: args.guests,
      assignedUserId: args.createdBy,
      assignedUserName: args.createdByName,
    });

    return { id, token, contractCode };
  },
});

export const _setBoldPaymentLink = internalMutation({
  args: {
    id: v.id('saleLinks'),
    boldPaymentUrl: v.string(),
    boldPaymentLinkId: v.string(),
    boldPaymentAmount: v.number(),
    boldSurchargePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      boldPaymentUrl: args.boldPaymentUrl,
      boldPaymentLinkId: args.boldPaymentLinkId,
      boldPaymentAmount: args.boldPaymentAmount,
      boldSurchargePercent: args.boldSurchargePercent,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Crea el link de venta y, si se pide, genera automáticamente el link Bold
 * por el monto de abono (con recargo opcional).
 */
export const createWithBold = action({
  args: {
    propertyId: v.id('properties'),
    contractCode: v.string(),
    createdBy: v.string(),
    createdByName: v.optional(v.string()),
    checkIn: v.number(),
    checkOut: v.number(),
    nights: v.number(),
    guests: v.number(),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    totalValue: v.number(),
    rentalValue: v.number(),
    depositAmount: v.number(),
    cleaningFee: v.number(),
    petDeposit: v.optional(v.number()),
    petSurcharge: v.optional(v.number()),
    petCount: v.optional(v.number()),
    advancePaymentAmount: v.number(),
    boldSurchargePercent: v.optional(v.number()),
    generateBoldLink: v.boolean(),
    selectedBankAccountIds: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    id: string;
    token: string;
    contractCode: string;
    boldPaymentUrl?: string;
    boldPaymentAmount?: number;
    boldError?: string;
  }> => {
    const { generateBoldLink, boldSurchargePercent, ...createArgs } = args;
    const created = await ctx.runMutation(api.saleLinks.create, createArgs);

    if (!generateBoldLink) {
      return {
        id: String(created.id),
        token: created.token,
        contractCode: created.contractCode,
      };
    }

    const advance = Math.max(0, Math.floor(args.advancePaymentAmount || 0));
    if (advance < 1000) {
      return {
        id: String(created.id),
        token: created.token,
        contractCode: created.contractCode,
        boldError: 'El abono debe ser al menos $1.000 para generar Bold.',
      };
    }

    const surcharge = Math.max(0, Number(boldSurchargePercent) || 0);
    const boldAmount = Math.round(advance * (1 + surcharge / 100));

    try {
      const { createBoldPaymentLink } = await import('./lib/bold');
      const siteBase = (
        process.env.SITE_URL?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        'https://fincasya.com'
      ).replace(/\/$/, '');
      const callbackUrl = `${siteBase}/venta/${created.token}?bold=return`;

      const bold = await createBoldPaymentLink({
        amountCop: boldAmount,
        description: `Abono ${created.contractCode} · FincasYa`.slice(0, 100),
        reference: `SL-${created.token.slice(0, 10)}-${Date.now()}`.slice(0, 60),
        callbackUrl: callbackUrl.startsWith('https://')
          ? callbackUrl
          : undefined,
      });

      await ctx.runMutation(internal.saleLinks._setBoldPaymentLink, {
        id: created.id,
        boldPaymentUrl: bold.url,
        boldPaymentLinkId: bold.paymentLinkId,
        boldPaymentAmount: boldAmount,
        boldSurchargePercent: surcharge || undefined,
      });

      return {
        id: String(created.id),
        token: created.token,
        contractCode: created.contractCode,
        boldPaymentUrl: bold.url,
        boldPaymentAmount: boldAmount,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[saleLinks.createWithBold] Bold falló', msg);
      return {
        id: String(created.id),
        token: created.token,
        contractCode: created.contractCode,
        boldError: msg,
      };
    }
  },
});

export const update = mutation({
  args: {
    id: v.id('saleLinks'),
    propertyId: v.optional(v.id('properties')),
    checkIn: v.optional(v.number()),
    checkOut: v.optional(v.number()),
    nights: v.optional(v.number()),
    guests: v.optional(v.number()),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    totalValue: v.optional(v.number()),
    rentalValue: v.optional(v.number()),
    depositAmount: v.optional(v.number()),
    cleaningFee: v.optional(v.number()),
    petDeposit: v.optional(v.number()),
    petSurcharge: v.optional(v.number()),
    petCount: v.optional(v.number()),
    selectedBankAccountIds: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled'))),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('Sale link not found');
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id('saleLinks') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { ok: true };
  },
});

export const setContractUrl = internalMutation({
  args: {
    id: v.id('saleLinks'),
    contractUrl: v.string(),
  },
  handler: async (ctx, { id, contractUrl }) => {
    await ctx.db.patch(id, {
      contractUrl,
      contractGeneratedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Público (panel del asesor): adjunta el contrato ya generado (PDF subido a S3)
 * al link por token, para que el cliente lo vea/descargue en su portal. La
 * generación del PDF ocurre en el navegador del asesor (reutiliza la plantilla
 * QUINTA OLAYA vía /api/fincas/[id]/direct-booking-contract).
 */
export const attachContract = mutation({
  args: {
    token: v.string(),
    contractUrl: v.string(),
  },
  handler: async (ctx, { token, contractUrl }) => {
    const url = contractUrl.trim();
    if (!url) return { ok: false as const, reason: 'no_url' as const };
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    await ctx.db.patch(link._id, {
      contractUrl: url,
      contractGeneratedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true as const, contractUrl: url };
  },
});

/**
 * Público (portal del cliente / panel): adjunta la confirmación de reserva (CR)
 * ya generada (PDF en S3) al link por token, y avanza a check-in (clientStep 6)
 * si el pago está validado. La generación del PDF ocurre en una ruta Next.
 */
export const attachCr = mutation({
  args: {
    token: v.string(),
    crUrl: v.string(),
  },
  handler: async (ctx, { token, crUrl }) => {
    const url = crUrl.trim();
    if (!url) return { ok: false as const, reason: 'no_url' as const };
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    await ctx.db.patch(link._id, {
      crUrl: url,
      clientStep: Math.max(link.clientStep ?? 0, 6),
      updatedAt: Date.now(),
    });
    return { ok: true as const, crUrl: url };
  },
});

export const setCrUrl = internalMutation({
  args: {
    id: v.id('saleLinks'),
    crUrl: v.string(),
    bookingId: v.optional(v.id('bookings')),
  },
  handler: async (ctx, { id, crUrl, bookingId }): Promise<SetCrUrlResult> => {
    const link = await ctx.db.get(id);
    if (!link) return { ok: false as const, reason: 'not_found' as const };

    let resolvedBookingId = bookingId ?? link.bookingId;
    if (!resolvedBookingId && link.clientData) {
      const provisioned: ProvisionFromSaleLinkResult = await ctx.runMutation(
        internal.bookings.provisionFromSaleLink,
        { saleLinkId: id },
      );
      if (provisioned.ok) {
        resolvedBookingId = provisioned.bookingId;
      }
    }

    const patch: Record<string, unknown> = {
      crUrl,
      crGeneratedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (resolvedBookingId) patch.bookingId = resolvedBookingId;
    await ctx.db.patch(id, patch);
    return {
      ok: true as const,
      bookingId: resolvedBookingId,
    };
  },
});

/**
 * Crea la reserva (booking) al aprobar el pago para que aparezca de inmediato en
 * /admin/reservations. Requiere que el cliente ya haya llenado sus datos
 * (clientData). Es idempotente: si la reserva ya existe, `provisionFromSaleLink`
 * la reutiliza. No lanza: un fallo aquí (p. ej. disponibilidad) no debe impedir
 * marcar el pago como validado; el CR/check-in la provisionarán después.
 */
async function provisionBookingOnPayment(
  ctx: MutationCtx,
  saleLinkId: Id<'saleLinks'>,
): Promise<void> {
  const link = await ctx.db.get(saleLinkId);
  if (!link || link.bookingId || !link.clientData) return;
  try {
    (await ctx.runMutation(internal.bookings.provisionFromSaleLink, {
      saleLinkId,
    })) as ProvisionFromSaleLinkResult;
  } catch {
    /* la reserva se creará luego en CR/check-in */
  }
}

export const validatePayment = internalMutation({
  args: {
    token: v.string(),
    validatedBy: v.string(),
    validationKey: v.string(),
  },
  handler: async (ctx, { token, validatedBy, validationKey }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.paymentValidationKey !== validationKey) {
      return { ok: false, reason: 'invalid_key' };
    }
    if (link.paymentValidated) return { ok: true, alreadyValidated: true };
    await ctx.db.patch(link._id, {
      paymentValidated: true,
      paymentValidatedAt: Date.now(),
      paymentValidatedBy: validatedBy,
      clientStep: 4,
      updatedAt: Date.now(),
    });
    // Al aprobar el pago la reserva ya debe existir y verse en /admin/reservations.
    await provisionBookingOnPayment(ctx, link._id);
    // CRM-3: marcar oportunidad como ganada
    await ctx.scheduler.runAfter(0, internal.opportunities.markWon, {
      saleLinkId: link._id,
    });
    // Correo al cliente: pago validado.
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.emailClientPaymentValidated,
      { saleLinkId: link._id },
    );
    return { ok: true };
  },
});

/**
 * Aplica el resultado de una consulta Bold al saleLink.
 * Si status=PAID, marca el pago como validado (sin comprobante manual).
 */
export const _applyBoldLinkStatus = internalMutation({
  args: {
    id: v.id('saleLinks'),
    status: v.string(),
    transactionId: v.optional(v.string()),
    validatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (!link) return { ok: false as const, reason: 'not_found' as const };

    const status = args.status.trim().toUpperCase();
    const now = Date.now();
    const wasValidated = !!link.paymentValidated;
    const canAutoValidate =
      status === 'PAID' && !wasValidated && !!link.clientData;

    if (canAutoValidate) {
      await ctx.db.patch(link._id, {
        boldPaymentStatus: status,
        boldStatusCheckedAt: now,
        boldTransactionId: args.transactionId,
        paymentValidated: true,
        paymentValidatedAt: now,
        paymentValidatedBy: args.validatedBy,
        boldPaidAt: now,
        clientStep: Math.max(link.clientStep, 4),
        paymentProofUrl:
          link.paymentProofUrl?.trim() ||
          link.boldPaymentUrl ||
          `bold://${link.boldPaymentLinkId}`,
        paymentProofFileName:
          link.paymentProofFileName?.trim() ||
          'Pago Bold (verificado por API)',
        paymentProofAmount:
          link.paymentProofAmount ??
          link.boldPaymentAmount ??
          link.advancePaymentAmount,
        paymentProofSubmittedAt: link.paymentProofSubmittedAt ?? now,
        updatedAt: now,
      });
      await provisionBookingOnPayment(ctx, link._id);
      await ctx.scheduler.runAfter(0, internal.opportunities.markWon, {
        saleLinkId: link._id,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.emailClientPaymentValidated,
        { saleLinkId: link._id },
      );
    } else {
      await ctx.db.patch(link._id, {
        boldPaymentStatus: status,
        boldStatusCheckedAt: now,
        ...(args.transactionId
          ? { boldTransactionId: args.transactionId }
          : {}),
        ...(status === 'PAID' ? { boldPaidAt: link.boldPaidAt ?? now } : {}),
        updatedAt: now,
      });
    }

    return {
      ok: true as const,
      status,
      paid: status === 'PAID',
      alreadyValidated: wasValidated,
      awaitingClientData: status === 'PAID' && !wasValidated && !link.clientData,
    };
  },
});

/**
 * Consulta Bold (GET link status) y, si está PAID, valida el pago.
 * No requiere webhook ni acceso al panel de Bold: usa BOLD_IDENTIDAD_KEY.
 */
export const syncBoldPaymentStatus = action({
  args: {
    token: v.string(),
    /** Quién dispara la sync (cliente | admin email). */
    checkedBy: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    status?: string;
    paid?: boolean;
    alreadyValidated?: boolean;
    awaitingClientData?: boolean;
    reason?: string;
    error?: string;
  }> => {
    const token = args.token.trim();
    if (!token) return { ok: false, reason: 'missing_token' };

    const full = await ctx.runQuery(internal.saleLinks.getByToken, { token });
    if (!full) return { ok: false, reason: 'not_found' };

    if (full.paymentValidated) {
      return {
        ok: true,
        status: full.boldPaymentStatus ?? 'PAID',
        paid: true,
        alreadyValidated: true,
      };
    }

    const linkId = full.boldPaymentLinkId?.trim();
    if (!linkId) {
      return { ok: false, reason: 'no_bold_link' };
    }

    try {
      const { getBoldPaymentLinkStatus } = await import('./lib/bold');
      const result = await getBoldPaymentLinkStatus(linkId);
      const by = String(args.checkedBy ?? '').trim() || 'cliente';

      const applied = await ctx.runMutation(
        internal.saleLinks._applyBoldLinkStatus,
        {
          id: full._id,
          status: result.status,
          transactionId: result.transactionId,
          validatedBy: `Bold (${by})`,
        },
      );

      return {
        ok: true,
        status: applied.status,
        paid: applied.paid,
        alreadyValidated: applied.alreadyValidated,
        awaitingClientData: applied.awaitingClientData,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[saleLinks.syncBoldPaymentStatus]', msg);
      return { ok: false, error: msg };
    }
  },
});

/** Valida el pago desde el panel admin (sin clave del correo). */
export const validatePaymentAdmin = mutation({
  args: {
    token: v.string(),
    validatedBy: v.string(),
  },
  handler: async (ctx, { token, validatedBy }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (!link.paymentProofUrl?.trim()) {
      return { ok: false, reason: 'no_proof' };
    }
    if (link.paymentValidated) return { ok: true, alreadyValidated: true };
    const by = String(validatedBy ?? '').trim() || 'admin';
    await ctx.db.patch(link._id, {
      paymentValidated: true,
      paymentValidatedAt: Date.now(),
      paymentValidatedBy: by,
      clientStep: 4,
      updatedAt: Date.now(),
    });
    // Al aprobar el pago la reserva ya debe existir y verse en /admin/reservations.
    await provisionBookingOnPayment(ctx, link._id);
    // CRM-3: marcar oportunidad como ganada
    await ctx.scheduler.runAfter(0, internal.opportunities.markWon, {
      saleLinkId: link._id,
    });
    // Correo al cliente: pago validado.
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.emailClientPaymentValidated,
      { saleLinkId: link._id },
    );
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Admin queries
// ---------------------------------------------------------------------------

export const list = internalQuery({
  args: {
    createdBy: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { createdBy, status }) => {
    let docs: Doc<'saleLinks'>[];
    if (createdBy) {
      docs = await ctx.db
        .query('saleLinks')
        .withIndex('by_created_by', (q) => q.eq('createdBy', createdBy))
        .order('desc')
        .collect();
    } else {
      docs = await ctx.db.query('saleLinks').order('desc').collect();
    }
    if (status) {
      docs = docs.filter((d) => d.status === status);
    }
    return docs;
  },
});

export const getById = internalQuery({
  args: { id: v.id('saleLinks') },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// Verificación de cédula
// ---------------------------------------------------------------------------

export const _saveCedulaCheck = internalMutation({
  args: {
    token: v.string(),
    check: v.object({
      photoUrl: v.string(),
      allow: v.boolean(),
      needsReview: v.boolean(),
      reason: v.optional(v.string()),
      isCedula: v.optional(v.boolean()),
      number: v.optional(v.string()),
      name: v.optional(v.string()),
      confidence: v.optional(v.number()),
      note: v.optional(v.string()),
      checkedAt: v.number(),
    }),
  },
  handler: async (ctx, { token, check }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return;
    await ctx.db.patch(link._id, { cedulaCheck: check, updatedAt: Date.now() });
  },
});

export const _savePaymentReceiptCheck = internalMutation({
  args: {
    token: v.string(),
    check: v.object({
      photoUrl: v.string(),
      allow: v.boolean(),
      needsReview: v.boolean(),
      reason: v.optional(v.string()),
      isReceipt: v.optional(v.boolean()),
      amount: v.optional(v.number()),
      bankName: v.optional(v.string()),
      confidence: v.optional(v.number()),
      note: v.optional(v.string()),
      checkedAt: v.number(),
    }),
  },
  handler: async (ctx, { token, check }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return;
    await ctx.db.patch(link._id, {
      paymentReceiptCheck: check,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Verifica la foto de cédula recién subida. La llama el portal antes de dejar
 * pasar al cliente al paso de pago. El veredicto queda guardado en el link para
 * que submitClientData lo haga cumplir aunque el portal se lo salte.
 */
export const verifyCedula = action({
  args: {
    token: v.string(),
    photoUrl: v.string(),
    typedCedula: v.string(),
    typedName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { token, photoUrl, typedCedula, typedName },
  ): Promise<{
    allow: boolean;
    needsReview: boolean;
    reason?: string;
    aiNumber?: string;
    aiName?: string;
  }> => {
    const link = await ctx.runQuery(internal.saleLinks.getByToken, { token });
    if (!link) return { allow: false, needsReview: true, reason: 'not_found' };
    if (link.status !== 'active') {
      return { allow: false, needsReview: true, reason: 'inactive' };
    }

    const verdict = await verifyCedulaPhoto(photoUrl, typedCedula, typedName);

    await ctx.runMutation(internal.saleLinks._saveCedulaCheck, {
      token,
      check: {
        photoUrl,
        allow: verdict.allow,
        needsReview: verdict.needsReview,
        reason: verdict.reason,
        isCedula:
          verdict.check && verdict.check.cedulaProbability >= 0.8
            ? true
            : verdict.check
              ? false
              : undefined,
        number: verdict.check?.number,
        name: verdict.check?.name,
        confidence: verdict.check?.cedulaProbability,
        note: verdict.check?.note,
        checkedAt: Date.now(),
      },
    });

    return {
      allow: verdict.allow,
      needsReview: verdict.needsReview,
      reason: verdict.reason,
      aiNumber: verdict.check?.number,
      aiName: verdict.check?.name,
    };
  },
});

/**
 * Verifica que el archivo subido sea un comprobante de pago real (banco /
 * transferencia). El portal solo habilita «Enviar» si allow=true; el veredicto
 * se guarda para que submitClientData lo exija.
 */
export const verifyPaymentReceipt = action({
  args: {
    token: v.string(),
    photoUrl: v.string(),
  },
  handler: async (
    ctx,
    { token, photoUrl },
  ): Promise<{
    allow: boolean;
    needsReview: boolean;
    reason?: string;
    amount?: number;
    bankName?: string;
  }> => {
    const link = await ctx.runQuery(internal.saleLinks.getByToken, { token });
    if (!link) return { allow: false, needsReview: true, reason: 'not_found' };
    if (link.status !== 'active') {
      return { allow: false, needsReview: true, reason: 'inactive' };
    }

    const verdict = await verifyPaymentReceiptPhoto(photoUrl);

    await ctx.runMutation(internal.saleLinks._savePaymentReceiptCheck, {
      token,
      check: {
        photoUrl,
        allow: verdict.allow,
        needsReview: verdict.needsReview,
        reason: verdict.reason,
        isReceipt: verdict.check?.isReceipt,
        amount: verdict.check?.amount,
        bankName: verdict.check?.bankName,
        confidence: verdict.check?.receiptProbability,
        note: verdict.check?.note,
        checkedAt: Date.now(),
      },
    });

    return {
      allow: verdict.allow,
      needsReview: verdict.needsReview,
      reason: verdict.reason,
      amount: verdict.check?.amount,
      bankName: verdict.check?.bankName,
    };
  },
});

/**
 * Revalida número/nombre tipados contra la última lectura de IA (sin volver a
 * llamar a OpenAI). Se usa cuando el cliente corrige la cédula después de subir
 * la foto.
 */
export const revalidateCedulaTyped = action({
  args: {
    token: v.string(),
    typedCedula: v.string(),
    typedName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { token, typedCedula, typedName },
  ): Promise<{
    allow: boolean;
    needsReview: boolean;
    reason?: string;
    aiNumber?: string;
    aiName?: string;
  }> => {
    const link = await ctx.runQuery(internal.saleLinks.getByToken, { token });
    if (!link) return { allow: false, needsReview: true, reason: 'not_found' };
    if (link.status !== 'active') {
      return { allow: false, needsReview: true, reason: 'inactive' };
    }

    const prev = link.cedulaCheck;
    if (!prev?.photoUrl || !prev.number) {
      return { allow: false, needsReview: true, reason: 'unreadable' };
    }

    const verdict = decideCedulaVerdict(
      {
        cedulaProbability:
          typeof prev.confidence === 'number' ? prev.confidence : 0.9,
        number: prev.number,
        name: prev.name,
        note: prev.note,
      },
      { typedCedula, typedName },
    );

    await ctx.runMutation(internal.saleLinks._saveCedulaCheck, {
      token,
      check: {
        photoUrl: prev.photoUrl,
        allow: verdict.allow,
        needsReview: verdict.needsReview,
        reason: verdict.reason,
        isCedula: prev.isCedula,
        number: prev.number,
        name: prev.name,
        confidence: prev.confidence,
        note: prev.note,
        checkedAt: Date.now(),
      },
    });

    return {
      allow: verdict.allow,
      needsReview: verdict.needsReview,
      reason: verdict.reason,
      aiNumber: prev.number,
      aiName: prev.name,
    };
  },
});

// ---------------------------------------------------------------------------
// Public mutations (llamados desde el portal cliente, sin auth)
// ---------------------------------------------------------------------------

/** Guarda borrador del portal (paso 2) sin avanzar clientStep — sincroniza entre dispositivos. */
export const saveClientPortalDraft = internalMutation({
  args: {
    token: v.string(),
    clientPortalUiStep: v.optional(v.number()),
    clientDraftPhase: v.optional(
      v.union(v.literal('datos'), v.literal('preview'), v.literal('pago')),
    ),
    nombre: v.optional(v.string()),
    cedula: v.optional(v.string()),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    telefonoRespaldo: v.optional(v.string()),
    direccion: v.optional(v.string()),
    ciudad: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    paymentAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.status !== 'active') return { ok: false, reason: 'inactive' };
    if (link.paymentValidated) return { ok: false, reason: 'already_validated' };
    if (link.clientStep >= 4) return { ok: false, reason: 'past_payment_step' };

    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };

    if (args.clientPortalUiStep !== undefined) {
      patch.clientPortalUiStep = Math.max(1, Math.min(6, args.clientPortalUiStep));
    }
    if (args.clientDraftPhase) {
      patch.clientDraftPhase = args.clientDraftPhase;
    }
    if (args.paymentAmount !== undefined && args.paymentAmount > 0) {
      patch.clientDraftPaymentAmount = args.paymentAmount;
    }

    const nombre = args.nombre?.trim();
    const cedula = args.cedula?.trim();
    const email = args.email?.trim();
    const telefono = args.telefono?.trim();
    const telefonoRespaldo = args.telefonoRespaldo?.trim();
    const direccion = args.direccion?.trim();
    const ciudad = args.ciudad?.trim();
    const fechaNacimiento = normalizeBirthdate(args.fechaNacimiento);
    const hasAnyField = !!(
      nombre ||
      cedula ||
      email ||
      telefono ||
      telefonoRespaldo ||
      direccion ||
      ciudad ||
      fechaNacimiento
    );

    if (hasAnyField) {
      const prev = link.clientData;
      patch.clientData = {
        nombre: nombre || prev?.nombre || '',
        cedula: cedula || prev?.cedula || '',
        email: email || prev?.email || '',
        telefono: telefono || prev?.telefono || '',
        telefonoRespaldo: telefonoRespaldo || prev?.telefonoRespaldo,
        direccion: direccion || prev?.direccion || '',
        ciudad: ciudad || prev?.ciudad,
        fechaNacimiento: fechaNacimiento ?? prev?.fechaNacimiento,
        cedulaPhotoUrl: prev?.cedulaPhotoUrl,
        cedulaPhotoFileName: prev?.cedulaPhotoFileName,
        cedulaPhotoMimeType: prev?.cedulaPhotoMimeType,
        filledAt: prev?.filledAt ?? now,
      };
    }

    await ctx.db.patch(link._id, patch);
    return { ok: true };
  },
});

/** Guarda los datos del cliente + soporte de pago (paso 2 → 3). */
export const submitClientData = mutation({
  args: {
    token: v.string(),
    nombre: v.string(),
    cedula: v.string(),
    email: v.string(),
    telefono: v.string(),
    telefonoRespaldo: v.optional(v.string()),
    direccion: v.string(),
    ciudad: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    paymentProofUrl: v.optional(v.string()),
    paymentProofFileName: v.optional(v.string()),
    paymentProofMimeType: v.optional(v.string()),
    paymentProofAmount: v.optional(v.number()),
    paymentValidationKey: v.string(),
    cedulaPhotoUrl: v.optional(v.string()),
    cedulaPhotoFileName: v.optional(v.string()),
    cedulaPhotoMimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.status !== 'active') return { ok: false, reason: 'inactive' };
    if (link.paymentValidated) return { ok: false, reason: 'already_validated' };
    if (link.clientStep >= 4) return { ok: false, reason: 'past_payment_step' };

    // La foto de cédula es obligatoria. El cliente puede reenviar comprobantes
    // sin volver a subirla, por eso vale la que ya esté guardada en el link.
    const cedulaPhotoUrl =
      args.cedulaPhotoUrl?.trim() || link.clientData?.cedulaPhotoUrl?.trim();
    if (!cedulaPhotoUrl) return { ok: false, reason: 'missing_cedula' };
    const ciudad = args.ciudad?.trim();
    if (!ciudad) return { ok: false, reason: 'missing_ciudad' };
    const reusedStoredPhoto = !args.cedulaPhotoUrl?.trim();
    const telefonoRespaldo = args.telefonoRespaldo?.trim() || undefined;

    // Obligatorio: la foto debió pasar por verifyCedula. Sin veredicto (o con
    // rechazo) no se acepta el envío aunque el portal se salte el chequeo.
    const check = link.cedulaCheck;
    if (!check || check.photoUrl !== cedulaPhotoUrl) {
      return { ok: false, reason: 'cedula_not_verified' };
    }
    if (!check.allow) {
      return { ok: false, reason: check.reason || 'cedula_rejected' };
    }

    // El comprobante debió pasar por verifyPaymentReceipt (misma URL),
    // salvo si Bold ya confirmó el pago por API (sin webhook).
    const boldAlreadyPaid = link.boldPaymentStatus?.toUpperCase() === 'PAID';
    const proofUrl =
      args.paymentProofUrl?.trim() ||
      (boldAlreadyPaid
        ? link.boldPaymentUrl || `bold://${link.boldPaymentLinkId}`
        : '');
    if (!boldAlreadyPaid) {
      if (!proofUrl) return { ok: false, reason: 'missing_proof' };
      const receiptCheck = link.paymentReceiptCheck;
      if (!receiptCheck || receiptCheck.photoUrl !== proofUrl) {
        return { ok: false, reason: 'receipt_not_verified' };
      }
      if (!receiptCheck.allow) {
        return { ok: false, reason: receiptCheck.reason || 'receipt_rejected' };
      }
    }
    if (!proofUrl) return { ok: false, reason: 'missing_proof' };

    const now = Date.now();
    const fechaNacimiento = normalizeBirthdate(args.fechaNacimiento);
    const newProof: PaymentProofRecord = {
      url: proofUrl,
      fileName:
        args.paymentProofFileName ||
        (boldAlreadyPaid ? 'Pago Bold (verificado por API)' : undefined),
      mimeType: args.paymentProofMimeType,
      amount:
        args.paymentProofAmount ??
        (boldAlreadyPaid
          ? link.boldPaymentAmount ?? link.advancePaymentAmount
          : undefined),
      submittedAt: now,
    };
    const paymentProofs =
      boldAlreadyPaid && !link.paymentProofUrl
        ? [newProof]
        : [...resolvePaymentProofs(link), newProof];
    const isFirstSubmission = link.clientStep < 3;

    const patch: Record<string, unknown> = {
      clientData: {
        nombre: args.nombre,
        cedula: args.cedula,
        email: args.email,
        telefono: args.telefono,
        telefonoRespaldo,
        direccion: args.direccion,
        ciudad,
        fechaNacimiento,
        cedulaPhotoUrl,
        cedulaPhotoFileName: reusedStoredPhoto
          ? link.clientData?.cedulaPhotoFileName
          : args.cedulaPhotoFileName,
        cedulaPhotoMimeType: reusedStoredPhoto
          ? link.clientData?.cedulaPhotoMimeType
          : args.cedulaPhotoMimeType,
        filledAt: link.clientData?.filledAt ?? now,
      },
      paymentProofUrl: proofUrl,
      paymentProofFileName: newProof.fileName,
      paymentProofMimeType: newProof.mimeType,
      paymentProofAmount: newProof.amount,
      paymentProofSubmittedAt: now,
      paymentProofs,
      paymentValidationKey:
        args.paymentValidationKey.trim() ||
        link.paymentValidationKey?.trim() ||
        crypto.randomUUID(),
      updatedAt: now,
    };

    if (boldAlreadyPaid) {
      patch.paymentValidated = true;
      patch.paymentValidatedAt = now;
      patch.paymentValidatedBy = 'Bold (al enviar datos)';
      patch.boldPaidAt = link.boldPaidAt ?? now;
      patch.clientStep = 4;
      patch.clientPortalUiStep = undefined;
      patch.clientDraftPhase = undefined;
      patch.clientDraftPaymentAmount = undefined;
    } else if (isFirstSubmission) {
      patch.clientStep = 3;
      patch.clientPortalUiStep = undefined;
      patch.clientDraftPhase = undefined;
      patch.clientDraftPaymentAmount = undefined;
    }

    await ctx.db.patch(link._id, patch);

    await upsertCrmContactFromSaleClient(ctx, {
      nombre: args.nombre,
      cedula: args.cedula,
      email: args.email,
      telefono: args.telefono,
      direccion: args.direccion,
      ciudad: args.ciudad,
      fechaNacimiento,
    });

    if (boldAlreadyPaid) {
      await provisionBookingOnPayment(ctx, link._id);
      await ctx.scheduler.runAfter(0, internal.opportunities.markWon, {
        saleLinkId: link._id,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.emailClientPaymentValidated,
        { saleLinkId: link._id },
      );
    } else {
      // Notifica al admin que hay un soporte de pago por revisar.
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyAdminSaleLinkPayment,
        { saleLinkId: link._id },
      );
    }

    return { ok: true, appended: !isFirstSubmission, boldPaid: boldAlreadyPaid };
  },
});

/** Admin: reinicia comprobante y datos de cliente para volver a probar el flujo. */
export const resetPaymentSubmission = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.paymentValidated) return { ok: false, reason: 'already_validated' };
    if (!link.paymentProofUrl && link.clientStep < 3) {
      return { ok: false, reason: 'nothing_to_reset' };
    }

    await ctx.db.patch(link._id, {
      clientStep: 1,
      clientPortalUiStep: undefined,
      clientDraftPhase: undefined,
      clientDraftPaymentAmount: undefined,
      clientData: undefined,
      paymentProofUrl: undefined,
      paymentProofFileName: undefined,
      paymentProofMimeType: undefined,
      paymentProofAmount: undefined,
      paymentProofSubmittedAt: undefined,
      paymentProofs: undefined,
      paymentValidationKey: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** El cliente sube el contrato firmado (paso 4 → 5). */
export const submitSignedContract = mutation({
  args: {
    token: v.string(),
    signedContractUrl: v.string(),
    signedContractFileName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SubmitSignedContractResult> => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.clientStep < 4) return { ok: false, reason: 'not_ready' };

    const now = Date.now();
    let bookingId = link.bookingId;
    if (!bookingId && link.clientData) {
      const provisioned: ProvisionFromSaleLinkResult = await ctx.runMutation(
        internal.bookings.provisionFromSaleLink,
        { saleLinkId: link._id },
      );
      if (provisioned.ok) {
        bookingId = provisioned.bookingId;
      }
    }

    await ctx.db.patch(link._id, {
      signedContractUrl: args.signedContractUrl,
      signedContractFileName: args.signedContractFileName,
      signedContractSubmittedAt: now,
      clientStep: 5,
      ...(bookingId ? { bookingId } : {}),
      updatedAt: now,
    });
    return { ok: true, bookingId };
  },
});

/** El cliente confirma haber descargado/visto el CR (paso 5 → 6). */
export const confirmCr = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.clientStep < 5) return { ok: false, reason: 'not_ready' };

    await ctx.db.patch(link._id, {
      clientStep: 6,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

type SaleLinkCheckinResult =
  | { ok: true; bookingId: Id<'bookings'> }
  | { ok: false; reason: string; index?: number };

type CreateFromSaleLinkResult =
  | { ok: true; bookingId: Id<'bookings'> }
  | { ok: false; reason: 'not_found' | 'no_client' | 'unavailable' };

async function finalizeSaleLinkCheckin(
  ctx: MutationCtx,
  link: Doc<'saleLinks'>,
  args: {
    guests: Array<{
      nombreCompleto: string;
      cedula?: string;
      tipoDocumento?: string;
      esMenor?: boolean;
    }>;
    placas?: string;
    observaciones?: string;
  },
): Promise<SaleLinkCheckinResult> {
  if (args.guests.length < 1) {
    return { ok: false as const, reason: 'missing_guests' as const };
  }
  for (let i = 0; i < args.guests.length; i++) {
    const g = args.guests[i];
    if (!g.nombreCompleto.trim()) {
      return { ok: false as const, reason: 'missing_name' as const, index: i };
    }
    if (!g.esMenor && !g.cedula?.trim()) {
      return { ok: false as const, reason: 'missing_document' as const, index: i };
    }
  }

  const menoresDe2 = args.guests.filter((g) => g.esMenor).length;
  const guestDisplayName =
    args.guests
      .map((g) => g.nombreCompleto.trim())
      .filter(Boolean)
      .join(' · ') ||
    link.clientData?.nombre ||
    'Cliente';

  const bookingResult = (await ctx.runMutation(internal.bookings.createFromSaleLink, {
    saleLinkId: link._id,
    guestDisplayName,
    guests: args.guests,
    menoresDe2: menoresDe2 || undefined,
    mascotas: link.petCount ?? undefined,
    placas: args.placas,
    observaciones: args.observaciones,
  })) as CreateFromSaleLinkResult;

  if (!bookingResult.ok) {
    return bookingResult;
  }

  const now = Date.now();
  await ctx.db.patch(link._id, {
    checkinGuests: args.guests,
    checkinMenoresDe2: menoresDe2 || undefined,
    checkinMascotas: link.petCount ?? undefined,
    checkinPlacas: args.placas,
    checkinObservaciones: args.observaciones,
    checkinCompleted: true,
    checkinCompletedAt: now,
    bookingId: bookingResult.bookingId,
    clientStep: 7,
    updatedAt: now,
  });

  return { ok: true as const, bookingId: bookingResult.bookingId };
}

/** El cliente envía el check-in (paso 6 → completado). */
export const submitCheckin = mutation({
  args: {
    token: v.string(),
    guests: v.array(checkinGuestValidator),
    menoresDe2: v.optional(v.number()),
    mascotas: v.optional(v.number()),
    placas: v.optional(v.string()),
    observaciones: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.clientStep < 6) return { ok: false, reason: 'not_ready' };

    return finalizeSaleLinkCheckin(ctx, link, {
      guests: args.guests,
      placas: args.placas,
      observaciones: args.observaciones,
    });
  },
});

/** Lista enriquecida para el panel admin de links de venta. */
export const listForAdmin = query({
  args: {
    createdBy: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { createdBy, status }) => {
    let docs: Doc<'saleLinks'>[];
    if (createdBy) {
      docs = await ctx.db
        .query('saleLinks')
        .withIndex('by_created_by', (q) => q.eq('createdBy', createdBy))
        .order('desc')
        .collect();
    } else {
      docs = await ctx.db.query('saleLinks').order('desc').collect();
    }
    if (status) {
      docs = docs.filter((d) => d.status === status);
    }

    const rows = await Promise.all(
      docs.map(async (link) => {
        const property = await ctx.db.get(link.propertyId);
        const ownerInfo = await ctx.db
          .query('propertyOwnerInfo')
          .withIndex('by_property', (q) => q.eq('propertyId', link.propertyId))
          .unique();
        let bookingReference = resolveSaleLinkReference(link);
        let ownerOfferAcceptedAt: number | undefined;
        let ownerOfferRejectedAt: number | undefined;
        let ownerOfferRejectedReason: string | undefined;
        let ownerOfferComment: string | undefined;
        let ownerOfferCommentAt: number | undefined;
        let checkinNeedsEmpleada: boolean | undefined;
        let checkinNeedsTeam: boolean | undefined;
        let checkinServiciosNota: string | undefined;
        let horaEntrada: string | undefined;
        let ownerPayoutAbono: number | undefined;
        if (link.bookingId) {
          const booking = await ctx.db.get(link.bookingId);
          if (booking) {
            bookingReference = booking.reference ?? bookingReference;
            ownerOfferAcceptedAt =
              link.ownerOfferAcceptedAt ?? booking.ownerOfferAcceptedAt;
            ownerOfferRejectedAt =
              link.ownerOfferRejectedAt ?? booking.ownerOfferRejectedAt;
            ownerOfferRejectedReason =
              link.ownerOfferRejectedReason ?? booking.ownerOfferRejectedReason;
            ownerOfferComment =
              link.ownerOfferComment ?? booking.ownerOfferComment;
            ownerOfferCommentAt =
              link.ownerOfferCommentAt ?? booking.ownerOfferCommentAt;
            checkinNeedsEmpleada = booking.checkinNeedsEmpleada === true;
            checkinNeedsTeam = booking.checkinNeedsTeam === true;
            checkinServiciosNota = booking.checkinServiciosNota ?? undefined;
            horaEntrada = booking.horaEntrada ?? link.checkInTime ?? undefined;
            const op = booking.ownerPayout as { abono?: number } | undefined;
            ownerPayoutAbono =
              typeof op?.abono === 'number' ? op.abono : undefined;
          }
        }
        return {
          ...link,
          propertyTitle: property?.title ?? null,
          propertyLocation: property?.location ?? null,
          propietarioNombre: ownerInfo?.propietarioNombre ?? null,
          propietarioTelefono: ownerInfo?.propietarioTelefono ?? null,
          propietarioTratamiento: ownerInfo?.propietarioTratamiento ?? null,
          bookingReference,
          ownerOfferAcceptedAt,
          ownerOfferRejectedAt,
          ownerOfferRejectedReason,
          ownerOfferComment,
          ownerOfferCommentAt,
          checkinNeedsEmpleada,
          checkinNeedsTeam,
          checkinServiciosNota,
          horaEntrada,
          ownerPayoutAbono,
        };
      }),
    );
    return rows;
  },
});

/** URL del documento de un link (panel admin / proxy de previsualización). */
export const getDocumentForAdmin = query({
  args: {
    token: v.string(),
    type: v.union(
      v.literal('payment-proof'),
      v.literal('signed-contract'),
      v.literal('cedula-photo'),
    ),
  },
  handler: async (ctx, { token, type }) => {
    const trimmed = token.trim();
    if (!trimmed) return null;

    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', trimmed))
      .unique();
    if (!link) return null;

    if (type === 'payment-proof') {
      const url = link.paymentProofUrl?.trim();
      if (!url) return null;
      return {
        url,
        fileName: link.paymentProofFileName?.trim() || 'comprobante',
        mimeType: link.paymentProofMimeType?.trim() || undefined,
      };
    }

    if (type === 'signed-contract') {
      const url = link.signedContractUrl?.trim();
      if (!url) return null;
      return {
        url,
        fileName: link.signedContractFileName?.trim() || 'contrato-firmado.pdf',
        mimeType: 'application/pdf',
      };
    }

    const url = link.clientData?.cedulaPhotoUrl?.trim();
    if (!url) return null;
    return {
      url,
      fileName: link.clientData?.cedulaPhotoFileName?.trim() || 'cedula',
      mimeType: link.clientData?.cedulaPhotoMimeType?.trim() || undefined,
    };
  },
});

async function resolveOwnerAbonoFromSaleLink(
  link: Doc<'saleLinks'>,
): Promise<number> {
  const proofs = link.paymentProofs ?? [];
  const fromProofs = proofs.reduce(
    (sum, p) => sum + Math.max(0, Math.floor(Number(p.amount) || 0)),
    0,
  );
  if (fromProofs > 0) return fromProofs;
  const single = Math.max(0, Math.floor(Number(link.paymentProofAmount) || 0));
  if (single > 0) return single;
  if (link.paymentValidated) {
    return Math.max(0, Math.round(Number(link.totalValue) / 2));
  }
  return 0;
}

/** Guarda el valor ofrecido al propietario y lo refleja en la reserva. */
export const setOwnerOfferInternal = internalMutation({
  args: {
    id: v.id('saleLinks'),
    ownerOfferAmount: v.number(),
  },
  handler: async (ctx, { id, ownerOfferAmount }) => {
    const link = await ctx.db.get(id);
    if (!link) return { ok: false as const, reason: 'not_found' as const };

    const amount = Math.max(0, Math.floor(Number(ownerOfferAmount) || 0));
    const now = Date.now();
    await ctx.db.patch(id, {
      ownerOfferAmount: amount,
      updatedAt: now,
    });

    if (link.bookingId) {
      const booking = await ctx.db.get(link.bookingId);
      if (booking) {
        const prev = (booking.ownerPayout ?? {}) as Record<string, unknown>;
        const abonoFromPayments = await (async () => {
          const payments = await ctx.db
            .query('payments')
            .withIndex('by_booking', (q) => q.eq('bookingId', link.bookingId!))
            .collect();
          return payments
            .filter((p) => String(p.status ?? '').toUpperCase() === 'PAID')
            .reduce(
              (sum, p) => sum + Math.max(0, Math.floor(Number(p.amount) || 0)),
              0,
            );
        })();
        const abono =
          abonoFromPayments > 0
            ? abonoFromPayments
            : await resolveOwnerAbonoFromSaleLink(link);
        await ctx.db.patch(link.bookingId, {
          ownerPayout: {
            ...prev,
            valorAcordado: amount,
            abono: abono > 0 ? abono : undefined,
            updatedAt: now,
          },
          updatedAt: now,
        });
      }
    }

    return { ok: true as const, ownerOfferAmount: amount };
  },
});

export const markOwnerOfferSentInternal = internalMutation({
  args: { id: v.id('saleLinks') },
  handler: async (ctx, { id }) => {
    const link = await ctx.db.get(id);
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    await ctx.db.patch(id, {
      ownerOfferSentAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Expuesto al panel admin (antes vía `/api/sale-links/:id` PATCH). */
export const setOwnerOffer = mutation({
  args: {
    id: v.id('saleLinks'),
    ownerOfferAmount: v.number(),
  },
  handler: async (ctx, args): Promise<
    | { ok: true; ownerOfferAmount: number }
    | { ok: false; reason: 'not_found' }
  > => {
    return await ctx.runMutation(internal.saleLinks.setOwnerOfferInternal, args);
  },
});

/** Expuesto al panel admin (antes vía `/api/sale-links/:id` PATCH). */
export const markOwnerOfferSent = mutation({
  args: { id: v.id('saleLinks') },
  handler: async (
    ctx,
    { id },
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> => {
    return await ctx.runMutation(internal.saleLinks.markOwnerOfferSentInternal, {
      id,
    });
  },
});

/** El propietario aceptó la oferta — avanza al paso 8. */
export const onOwnerOfferAcceptedInternal = internalMutation({
  args: { saleLinkId: v.id('saleLinks') },
  handler: async (ctx, { saleLinkId }) => {
    const link = await ctx.db.get(saleLinkId);
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    const now = Date.now();
    await ctx.db.patch(saleLinkId, {
      ownerOfferAcceptedAt: now,
      clientStep: 8,
      status: 'completed',
      updatedAt: now,
    });
    return { ok: true as const };
  },
});

export const onOwnerOfferRejectedInternal = internalMutation({
  args: { saleLinkId: v.id('saleLinks'), reason: v.string() },
  handler: async (ctx, { saleLinkId, reason }) => {
    const link = await ctx.db.get(saleLinkId);
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    const now = Date.now();
    await ctx.db.patch(saleLinkId, {
      ownerOfferRejectedAt: now,
      ownerOfferRejectedReason: reason.trim(),
      updatedAt: now,
    });
    return { ok: true as const };
  },
});

export const onOwnerOfferCommentInternal = internalMutation({
  args: { saleLinkId: v.id('saleLinks'), comment: v.string() },
  handler: async (ctx, { saleLinkId, comment }) => {
    const link = await ctx.db.get(saleLinkId);
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    const now = Date.now();
    await ctx.db.patch(saleLinkId, {
      ownerOfferComment: comment.trim(),
      ownerOfferCommentAt: now,
      updatedAt: now,
    });
    return { ok: true as const };
  },
});

// ---------------------------------------------------------------------------
// Public query (portal del cliente)
// ---------------------------------------------------------------------------

type ConfirmCrResult =
  | { ok: true; bookingReference: string }
  | { ok: false; reason: string };

type EnsureBookingForCheckinResult =
  | { ok: true; bookingReference: string }
  | { ok: false; reason: string };

/** InternalMutation: confirmar CR desde HTTP route */
export const confirmCrInternal = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<ConfirmCrResult> => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.clientStep < 5) return { ok: false, reason: 'not_ready' };

    const provisioned: ProvisionFromSaleLinkResult = await ctx.runMutation(
      internal.bookings.provisionFromSaleLink,
      {
        saleLinkId: link._id,
      },
    );
    if (!provisioned.ok) {
      return { ok: false, reason: provisioned.reason };
    }

    await ctx.db.patch(link._id, {
      clientStep: 6,
      bookingId: provisioned.bookingId,
      updatedAt: Date.now(),
    });
    return {
      ok: true,
      bookingReference: provisioned.reference,
    };
  },
});

/** Sincroniza el link de venta cuando el check-in se guarda vía portal estándar. */
export const syncCheckinFromBooking = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    completed: v.boolean(),
    guests: v.optional(
      v.array(checkinGuestValidator),
    ),
    menoresDe2: v.optional(v.number()),
    placas: v.optional(v.string()),
    mascotas: v.optional(v.number()),
    observaciones: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .first();
    if (!link) return { ok: false as const, reason: 'no_link' as const };

    const now = Date.now();
    const patch: Record<string, unknown> = {
      checkinGuests: args.guests,
      checkinMenoresDe2: args.menoresDe2,
      checkinMascotas: args.mascotas,
      checkinPlacas: args.placas,
      checkinObservaciones: args.observaciones,
      updatedAt: now,
    };
    if (args.completed) {
      patch.checkinCompleted = true;
      patch.checkinCompletedAt = now;
      patch.clientStep = 7;
    }
    await ctx.db.patch(link._id, patch);
    return { ok: true as const };
  },
});

/** Asegura que exista reserva para el check-in (paso 6). */
export const ensureBookingForCheckinInternal = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<EnsureBookingForCheckinResult> => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.clientStep < 6) return { ok: false, reason: 'not_ready' };

    const provisioned: ProvisionFromSaleLinkResult = await ctx.runMutation(
      internal.bookings.provisionFromSaleLink,
      {
        saleLinkId: link._id,
      },
    );
    if (!provisioned.ok) {
      return { ok: false, reason: provisioned.reason };
    }

    if (!link.bookingId) {
      await ctx.db.patch(link._id, {
        bookingId: provisioned.bookingId,
        updatedAt: Date.now(),
      });
    }

    return {
      ok: true,
      bookingReference: provisioned.reference,
    };
  },
});

/** InternalMutation: check-in desde HTTP route */
export const submitCheckinInternal = internalMutation({
  args: {
    token: v.string(),
    guests: v.array(checkinGuestValidator),
    menoresDe2: v.optional(v.number()),
    mascotas: v.optional(v.number()),
    placas: v.optional(v.string()),
    observaciones: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    if (!link) return { ok: false, reason: 'not_found' };
    if (link.clientStep < 6) return { ok: false, reason: 'not_ready' };

    return finalizeSaleLinkCheckin(ctx, link, {
      guests: args.guests,
      placas: args.placas,
      observaciones: args.observaciones,
    });
  },
});

/** Query pública para el portal del cliente (React hooks). */
export const getPublicByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return null;

    const property = await resolveProperty(ctx, link.propertyId);
    const settings = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();

    let bankAccounts: BankAccount[] = [];
    if (settings?.payload?.bankAccounts && link.selectedBankAccountIds.length > 0) {
      const allAccounts = settings.payload.bankAccounts as BankAccount[];
      const globalIds = link.selectedBankAccountIds.filter(
        (id) => !id.startsWith(OWNER_ACCOUNT_PREFIX),
      );
      bankAccounts = allAccounts.filter((a) => globalIds.includes(a.id));
    }
    if (
      link.selectedBankAccountIds.some((id) => id.startsWith(OWNER_ACCOUNT_PREFIX))
    ) {
      const ownerInfo = await ctx.db
        .query('propertyOwnerInfo')
        .withIndex('by_property', (q) => q.eq('propertyId', link.propertyId))
        .unique();
      if (ownerInfo) {
        bankAccounts = [
          ...bankAccounts,
          ...mapOwnerBankAccounts(ownerInfo, link.selectedBankAccountIds),
        ];
      }
    }

    const bookingReference =
      (await resolveBookingReference(ctx, link)) ?? resolveSaleLinkReference(link);

    return {
      token: link.token,
      contractCode: link.contractCode ?? resolveSaleLinkReference(link),
      status: link.status,
      clientStep: link.clientStep,
      clientPortalUiStep: link.clientPortalUiStep,
      clientDraftPhase: link.clientDraftPhase,
      clientDraftPaymentAmount: link.clientDraftPaymentAmount,
      property,
      checkIn: link.checkIn,
      checkOut: link.checkOut,
      nights: link.nights,
      guests: link.guests,
      checkInTime: link.checkInTime,
      checkOutTime: link.checkOutTime,
      totalValue: link.totalValue,
      rentalValue: link.rentalValue,
      depositAmount: link.depositAmount,
      cleaningFee: link.cleaningFee,
      petDeposit: link.petDeposit,
      petSurcharge: link.petSurcharge,
      petCount: link.petCount,
      advancePaymentAmount:
        link.advancePaymentAmount ?? Math.round(link.totalValue / 2),
      boldPaymentUrl: link.boldPaymentUrl,
      boldPaymentAmount: link.boldPaymentAmount,
      boldSurchargePercent: link.boldSurchargePercent,
      boldPaymentStatus: link.boldPaymentStatus,
      bankAccounts,
      selectedBankAccountIds: link.selectedBankAccountIds,
      clientDataFilled: !!link.clientData,
      clientName: link.clientData?.nombre,
      clientData: link.clientData
        ? {
            nombre: link.clientData.nombre,
            cedula: link.clientData.cedula,
            email: link.clientData.email,
            telefono: link.clientData.telefono,
            telefonoRespaldo: link.clientData.telefonoRespaldo,
            direccion: link.clientData.direccion,
            ciudad: link.clientData.ciudad,
            fechaNacimiento: link.clientData.fechaNacimiento,
            cedulaPhotoUrl: link.clientData.cedulaPhotoUrl,
            cedulaPhotoFileName: link.clientData.cedulaPhotoFileName,
          }
        : undefined,
      // Veredicto de cédula para que el portal no vuelva a pedir foto/IA si ya pasó.
      cedulaCheck: link.cedulaCheck
        ? {
            allow: link.cedulaCheck.allow,
            photoUrl: link.cedulaCheck.photoUrl,
            number: link.cedulaCheck.number,
            reason: link.cedulaCheck.reason,
          }
        : undefined,
      paymentProofSubmitted: !!link.paymentProofUrl,
      paymentProofFileName: link.paymentProofFileName,
      paymentProofSubmittedAt: link.paymentProofSubmittedAt,
      paymentProofAmount: link.paymentProofAmount,
      paymentProofs: mapPaymentProofsForPortal(link),
      paymentValidated: !!link.paymentValidated,
      contractUrl: link.contractUrl,
      signedContractSubmitted: !!link.signedContractUrl,
      crUrl: link.crUrl,
      bookingReference,
      checkinCompleted: link.checkinCompleted,
      checkinGuests: link.checkinGuests,
    };
  },
});

/**
 * Página pública `/validar-pago/[token]?key=…` — no requiere sesión admin.
 * Quien tenga el enlace del correo puede ver el resumen y validar.
 */
export const getPaymentReviewByKey = query({
  args: { token: v.string(), validationKey: v.string() },
  handler: async (ctx, { token, validationKey }) => {
    const trimmedToken = token.trim();
    const trimmedKey = validationKey.trim();
    if (!trimmedToken || !trimmedKey) {
      return { ok: false as const, reason: 'key_required' as const };
    }

    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', trimmedToken))
      .unique();
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    if (link.paymentValidationKey?.trim() !== trimmedKey) {
      return { ok: false as const, reason: 'invalid_key' as const };
    }

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
      ok: true as const,
      token: link.token,
      clientName: link.clientData?.nombre,
      clientEmail: link.clientData?.email,
      propertyName,
      totalValue: link.totalValue,
      proofAmount: link.paymentProofAmount,
      proofFileName: link.paymentProofFileName,
      proofMimeType: link.paymentProofMimeType,
      checkIn: link.checkIn,
      checkOut: link.checkOut,
      guests: link.guests,
      createdByName: link.createdByName,
      paymentValidated: !!link.paymentValidated,
      hasProof: !!link.paymentProofUrl?.trim(),
    };
  },
});

/** Valida el pago desde el enlace del correo (token + key), sin login admin. */
export const validatePaymentByKey = mutation({
  args: {
    token: v.string(),
    validationKey: v.string(),
    validatedBy: v.optional(v.string()),
  },
  handler: async (ctx, { token, validationKey, validatedBy }) => {
    const trimmedToken = token.trim();
    const trimmedKey = validationKey.trim();
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', trimmedToken))
      .unique();
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    if (link.paymentValidationKey !== trimmedKey) {
      return { ok: false as const, reason: 'invalid_key' as const };
    }
    if (link.paymentValidated) {
      return { ok: true as const, alreadyValidated: true as const };
    }
    const by = String(validatedBy ?? '').trim() || 'correo magic link';
    await ctx.db.patch(link._id, {
      paymentValidated: true,
      paymentValidatedAt: Date.now(),
      paymentValidatedBy: by,
      clientStep: 4,
      updatedAt: Date.now(),
    });
    await provisionBookingOnPayment(ctx, link._id);
    await ctx.scheduler.runAfter(0, internal.opportunities.markWon, {
      saleLinkId: link._id,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.emailClientPaymentValidated,
      { saleLinkId: link._id },
    );
    return { ok: true as const };
  },
});

/** Metadatos del comprobante si la clave del correo admin es válida. */
export const getPaymentProofForValidationKey = internalQuery({
  args: { token: v.string(), validationKey: v.string() },
  handler: async (ctx, { token, validationKey }) => {
    const trimmedToken = token.trim();
    const trimmedKey = validationKey.trim();
    if (!trimmedToken) return { ok: false as const, reason: 'not_found' as const };
    if (!trimmedKey) return { ok: false as const, reason: 'key_required' as const };

    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', trimmedToken))
      .unique();
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    if (link.paymentValidationKey?.trim() !== trimmedKey) {
      return { ok: false as const, reason: 'invalid_key' as const };
    }
    if (!link.paymentProofUrl?.trim()) {
      return { ok: false as const, reason: 'no_proof' as const };
    }

    const fileName = link.paymentProofFileName?.trim() || 'comprobante';
    return {
      ok: true as const,
      paymentProofUrl: link.paymentProofUrl.trim(),
      paymentProofFileName: fileName,
      paymentProofMimeType: link.paymentProofMimeType,
      clientName: link.clientData?.nombre ?? 'Cliente',
      totalValue: link.totalValue ?? 0,
    };
  },
});

/** InternalQuery equivalente para HTTP routes (mismo output que getPublicByToken). */
export const getForPortal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query('saleLinks')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (!link) return null;

    const property = await resolveProperty(ctx, link.propertyId);
    const settings = await ctx.db
      .query('adminContractSettings')
      .withIndex('by_scope', (q) => q.eq('scope', 'global'))
      .unique();

    let bankAccounts: BankAccount[] = [];
    if (settings?.payload?.bankAccounts && link.selectedBankAccountIds.length > 0) {
      const allAccounts = settings.payload.bankAccounts as BankAccount[];
      const globalIds = link.selectedBankAccountIds.filter(
        (id) => !id.startsWith(OWNER_ACCOUNT_PREFIX),
      );
      bankAccounts = allAccounts.filter((a) => globalIds.includes(a.id));
    }
    if (
      link.selectedBankAccountIds.some((id) => id.startsWith(OWNER_ACCOUNT_PREFIX))
    ) {
      const ownerInfo = await ctx.db
        .query('propertyOwnerInfo')
        .withIndex('by_property', (q) => q.eq('propertyId', link.propertyId))
        .unique();
      if (ownerInfo) {
        bankAccounts = [
          ...bankAccounts,
          ...mapOwnerBankAccounts(ownerInfo, link.selectedBankAccountIds),
        ];
      }
    }

    const bookingReference =
      (await resolveBookingReference(ctx, link)) ?? resolveSaleLinkReference(link);

    return {
      token: link.token,
      contractCode: link.contractCode ?? resolveSaleLinkReference(link),
      status: link.status,
      clientStep: link.clientStep,
      clientPortalUiStep: link.clientPortalUiStep,
      clientDraftPhase: link.clientDraftPhase,
      clientDraftPaymentAmount: link.clientDraftPaymentAmount,
      property,
      checkIn: link.checkIn,
      checkOut: link.checkOut,
      nights: link.nights,
      guests: link.guests,
      checkInTime: link.checkInTime,
      checkOutTime: link.checkOutTime,
      totalValue: link.totalValue,
      rentalValue: link.rentalValue,
      depositAmount: link.depositAmount,
      cleaningFee: link.cleaningFee,
      petDeposit: link.petDeposit,
      petSurcharge: link.petSurcharge,
      petCount: link.petCount,
      advancePaymentAmount:
        link.advancePaymentAmount ?? Math.round(link.totalValue / 2),
      boldPaymentUrl: link.boldPaymentUrl,
      boldPaymentAmount: link.boldPaymentAmount,
      boldSurchargePercent: link.boldSurchargePercent,
      boldPaymentStatus: link.boldPaymentStatus,
      bankAccounts,
      selectedBankAccountIds: link.selectedBankAccountIds,
      clientDataFilled: !!link.clientData,
      clientName: link.clientData?.nombre,
      clientData: link.clientData
        ? {
            nombre: link.clientData.nombre,
            cedula: link.clientData.cedula,
            email: link.clientData.email,
            telefono: link.clientData.telefono,
            telefonoRespaldo: link.clientData.telefonoRespaldo,
            direccion: link.clientData.direccion,
            ciudad: link.clientData.ciudad,
            fechaNacimiento: link.clientData.fechaNacimiento,
            cedulaPhotoUrl: link.clientData.cedulaPhotoUrl,
            cedulaPhotoFileName: link.clientData.cedulaPhotoFileName,
          }
        : undefined,
      cedulaCheck: link.cedulaCheck
        ? {
            allow: link.cedulaCheck.allow,
            photoUrl: link.cedulaCheck.photoUrl,
            number: link.cedulaCheck.number,
            reason: link.cedulaCheck.reason,
          }
        : undefined,
      paymentProofSubmitted: !!link.paymentProofUrl,
      paymentProofFileName: link.paymentProofFileName,
      paymentProofSubmittedAt: link.paymentProofSubmittedAt,
      paymentProofAmount: link.paymentProofAmount,
      paymentProofs: mapPaymentProofsForPortal(link),
      paymentValidated: !!link.paymentValidated,
      contractUrl: link.contractUrl,
      signedContractSubmitted: !!link.signedContractUrl,
      crUrl: link.crUrl,
      bookingReference,
      checkinCompleted: link.checkinCompleted,
      checkinGuests: link.checkinGuests,
    };
  },
});
