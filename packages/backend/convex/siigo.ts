/**
 * Integración Siigo (contabilidad + facturación electrónica DIAN).
 *
 * FASE 1 — SANDBOX + BORRADORES:
 *  - Todas las facturas se crean SIN `stamp`/`mail` (no se timbran a la DIAN).
 *  - El disparo es MANUAL desde el panel (rol contabilidad/admin).
 *  - Idempotencia por reserva (`siigoInvoices.by_booking`).
 *  - El modelo de facturación (total vs comisión) es configurable en `siigoSettings`.
 *
 * La librería pura (auth, fetch, builders) vive en `lib/siigo.ts`. Aquí van las
 * queries/mutations/actions y la persistencia (token, config, filas de factura).
 */
import { v } from 'convex/values';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { authComponent } from './betterAuth/auth';
import {
  buildCustomerPayloadFromBooking,
  buildInvoiceItemsFromBooking,
  buildPurchaseItemsFromOwnerPayout,
  buildSupplierPayloadFromOwner,
  requireSiigoEnv,
  siigoAuthenticate,
  siigoFetch,
  siigoFindCustomerByIdentification,
  siigoGetAccountGroups,
  siigoGetDocumentTypes,
  siigoGetPaymentTypes,
  siigoGetProducts,
  siigoGetTaxes,
  siigoGetUsers,
  type SiigoCustomerPayload,
  type SiigoEnv,
} from './lib/siigo';

// ---------------------------------------------------------------------------
// Rol / autorización
// ---------------------------------------------------------------------------

type AuthUser = {
  _id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

const ACCOUNTING_ROLES = new Set([
  'admin',
  'assistant',
  'superadmin',
  'contabilidad',
]);

function isAccountingRole(role?: string | null): boolean {
  return !!role && ACCOUNTING_ROLES.has(String(role).trim().toLowerCase());
}

/** Usuario de contabilidad autenticado (o null) en ctx de query/mutation. */
async function currentAccountingUser(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthUser | null> {
  const user = (await authComponent.safeGetAuthUser(ctx)) as AuthUser | null;
  if (!user || !isAccountingRole(user.role)) return null;
  return user;
}

function actorLabel(me: { name?: string | null; email?: string | null }) {
  return me.name?.trim() || me.email?.trim() || undefined;
}

/** YYYY-MM-DD de hoy en zona America/Bogota (fecha de emisión). */
function bogotaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Token plumbing (la lib es DB-free; aquí persiste)
// ---------------------------------------------------------------------------

export const _getAuth = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('siigoAuth').first();
  },
});

export const _saveAuth = internalMutation({
  args: { accessToken: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('siigoAuth').first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('siigoAuth', {
        accessToken: args.accessToken,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    }
  },
});

export const _getAccountingUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.safeGetAuthUser(ctx)) as AuthUser | null;
    if (!user || !isAccountingRole(user.role)) return null;
    return {
      id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role ?? null,
    };
  },
});

/** Devuelve un token Bearer válido, refrescando si expiró. */
async function ensureToken(
  ctx: ActionCtx,
): Promise<{ token: string; env: SiigoEnv }> {
  const env = requireSiigoEnv();
  const row = await ctx.runQuery(internal.siigo._getAuth, {});
  if (row && row.expiresAt > Date.now()) {
    return { token: row.accessToken, env };
  }
  const tok = await siigoAuthenticate(env);
  await ctx.runMutation(internal.siigo._saveAuth, {
    accessToken: tok.accessToken,
    expiresAt: tok.expiresAt,
  });
  return { token: tok.accessToken, env };
}

/** Asegura que exista el tercero en Siigo; devuelve su id. Idempotente por identificación. */
async function ensureCustomer(
  d: { env: Pick<SiigoEnv, 'partnerId' | 'baseUrl'>; token: string },
  payload: SiigoCustomerPayload,
): Promise<{ id?: string; created: boolean }> {
  if (payload.identification) {
    const found = await siigoFindCustomerByIdentification(
      d,
      payload.identification,
    );
    if (found?.id) return { id: String(found.id), created: false };
  }
  const created = await siigoFetch<{ id?: string }>({
    ...d,
    method: 'POST',
    path: '/v1/customers',
    body: payload,
  });
  return { id: created?.id ? String(created.id) : undefined, created: true };
}

// ---------------------------------------------------------------------------
// Configuración (singleton)
// ---------------------------------------------------------------------------

export const _getSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
  },
});

export const _saveCatalog = internalMutation({
  args: { catalog: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        catalogCache: args.catalog,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('siigoSettings', {
        key: 'default',
        invoiceModel: 'total',
        dianSendEnabled: false,
        catalogCache: args.catalog,
        updatedAt: now,
      });
    }
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentAccountingUser(ctx))) return null;
    const row = await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    if (!row) return null;
    // No exponemos el catalogCache aquí (grande); va por getConfigOptions.
    const { catalogCache, ...rest } = row;
    void catalogCache;
    return rest;
  },
});

export const getConfigOptions = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentAccountingUser(ctx))) return null;
    const row = await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    return row?.catalogCache ?? null;
  },
});

export const setSettings = mutation({
  args: {
    invoiceModel: v.optional(
      v.union(v.literal('total'), v.literal('comision')),
    ),
    comisionType: v.optional(
      v.union(v.literal('percent'), v.literal('fixed')),
    ),
    comisionValue: v.optional(v.number()),
    salesDocumentTypeId: v.optional(v.number()),
    purchaseDocumentTypeId: v.optional(v.number()),
    sellerUserId: v.optional(v.number()),
    salesPaymentTypeId: v.optional(v.number()),
    purchasePaymentTypeId: v.optional(v.number()),
    taxIds: v.optional(v.array(v.number())),
    defaultProductCode: v.optional(v.string()),
    comisionProductCode: v.optional(v.string()),
    depositProductCode: v.optional(v.string()),
    dianSendEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await currentAccountingUser(ctx);
    if (!me) throw new Error('No autorizado');

    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const key of [
      'invoiceModel',
      'comisionType',
      'comisionValue',
      'salesDocumentTypeId',
      'purchaseDocumentTypeId',
      'sellerUserId',
      'salesPaymentTypeId',
      'purchasePaymentTypeId',
      'taxIds',
      'defaultProductCode',
      'comisionProductCode',
      'depositProductCode',
      'dianSendEnabled',
    ] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }

    const existing = await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert('siigoSettings', {
      key: 'default',
      invoiceModel: args.invoiceModel ?? 'total',
      comisionType: args.comisionType,
      comisionValue: args.comisionValue,
      salesDocumentTypeId: args.salesDocumentTypeId,
      purchaseDocumentTypeId: args.purchaseDocumentTypeId,
      sellerUserId: args.sellerUserId,
      salesPaymentTypeId: args.salesPaymentTypeId,
      purchasePaymentTypeId: args.purchasePaymentTypeId,
      taxIds: args.taxIds,
      defaultProductCode: args.defaultProductCode,
      comisionProductCode: args.comisionProductCode,
      depositProductCode: args.depositProductCode,
      dianSendEnabled: args.dianSendEnabled ?? false,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Conexión + sincronización de configuración
// ---------------------------------------------------------------------------

export const testConnection = action({
  args: {},
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx): Promise<{ ok: boolean; message: string }> => {
    const me = await ctx.runQuery(internal.siigo._getAccountingUser, {});
    if (!me) throw new Error('No autorizado');
    try {
      const env = requireSiigoEnv();
      const tok = await siigoAuthenticate(env);
      await ctx.runMutation(internal.siigo._saveAuth, {
        accessToken: tok.accessToken,
        expiresAt: tok.expiresAt,
      });
      return {
        ok: true,
        message: 'Conexión con Siigo exitosa.',
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Error desconocido',
      };
    }
  },
});

export const syncConfig = action({
  args: {},
  handler: async (ctx): Promise<Record<string, unknown>> => {
    const me = await ctx.runQuery(internal.siigo._getAccountingUser, {});
    if (!me) throw new Error('No autorizado');
    const { token, env } = await ensureToken(ctx);
    const d = { env, token };

    const [
      salesDocs,
      purchaseDocs,
      salesPayments,
      purchasePayments,
      users,
      taxes,
      accountGroups,
      productsRaw,
    ] = await Promise.all([
      siigoGetDocumentTypes(d, 'FV'),
      siigoGetDocumentTypes(d, 'FC').catch(() => []),
      siigoGetPaymentTypes(d, 'FV'),
      siigoGetPaymentTypes(d, 'FC').catch(() => []),
      siigoGetUsers(d),
      siigoGetTaxes(d),
      siigoGetAccountGroups(d).catch(() => []),
      siigoGetProducts(d).catch(() => []),
    ]);

    const products = Array.isArray(productsRaw)
      ? productsRaw
      : (productsRaw?.results ?? []);

    const catalog = {
      salesDocs,
      purchaseDocs,
      salesPayments,
      purchasePayments,
      users,
      taxes,
      accountGroups,
      products,
      syncedAt: Date.now(),
    };
    await ctx.runMutation(internal.siigo._saveCatalog, { catalog });
    return catalog;
  },
});

// ---------------------------------------------------------------------------
// Datos para facturar (internal queries)
// ---------------------------------------------------------------------------

export const _getSalesData = internalQuery({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;
    const settings = await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    const existing = await ctx.db
      .query('siigoInvoices')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .collect();
    return { booking, settings, existing };
  },
});

export const _getPurchaseData = internalQuery({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;
    const ownerInfo = await ctx.db
      .query('propertyOwnerInfo')
      .withIndex('by_property', (q) => q.eq('propertyId', booking.propertyId))
      .first();
    const settings = await ctx.db
      .query('siigoSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    const existing = await ctx.db
      .query('siigoInvoices')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .collect();
    return { booking, ownerInfo, settings, existing };
  },
});

export const _recordInvoice = internalMutation({
  args: {
    type: v.union(v.literal('venta'), v.literal('compra')),
    bookingId: v.optional(v.id('bookings')),
    ownerInfoId: v.optional(v.id('propertyOwnerInfo')),
    ownerIdentification: v.optional(v.string()),
    siigoInvoiceId: v.optional(v.string()),
    siigoNumber: v.optional(v.string()),
    siigoCustomerId: v.optional(v.string()),
    status: v.union(
      v.literal('draft'),
      v.literal('stamped'),
      v.literal('error'),
      v.literal('cancelled'),
    ),
    invoiceModel: v.optional(
      v.union(v.literal('total'), v.literal('comision')),
    ),
    total: v.number(),
    currency: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    publicUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('siigoInvoices', {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Sincronizar cliente (tercero) — sin facturar
// ---------------------------------------------------------------------------

export const syncCustomerForBooking = action({
  args: { bookingId: v.id('bookings') },
  handler: async (
    ctx,
    args,
  ): Promise<{
    siigoCustomerId?: string;
    identification: string;
    created: boolean;
  }> => {
    const me = await ctx.runQuery(internal.siigo._getAccountingUser, {});
    if (!me) throw new Error('No autorizado');
    const data = await ctx.runQuery(internal.siigo._getSalesData, {
      bookingId: args.bookingId,
    });
    if (!data?.booking) throw new Error('Reserva no encontrada');

    const { token, env } = await ensureToken(ctx);
    const payload = buildCustomerPayloadFromBooking(data.booking);
    if (!payload.identification) {
      throw new Error('La reserva no tiene cédula del cliente para crear el tercero.');
    }
    const result = await ensureCustomer({ env, token }, payload);
    return {
      siigoCustomerId: result.id,
      identification: payload.identification,
      created: result.created,
    };
  },
});

// ---------------------------------------------------------------------------
// Factura de VENTA (prioridad)
// ---------------------------------------------------------------------------

export const createSalesInvoiceForBooking = action({
  args: { bookingId: v.id('bookings') },
  handler: async (
    ctx,
    args,
  ): Promise<{
    siigoInvoiceId?: string;
    siigoNumber?: string;
    total: number;
    status: string;
    publicUrl?: string;
  }> => {
    const me = await ctx.runQuery(internal.siigo._getAccountingUser, {});
    if (!me) throw new Error('No autorizado');

    const data = await ctx.runQuery(internal.siigo._getSalesData, {
      bookingId: args.bookingId,
    });
    if (!data?.booking) throw new Error('Reserva no encontrada');
    const { booking, settings, existing } = data;

    if (
      existing.some(
        (r) =>
          r.type === 'venta' &&
          r.status !== 'error' &&
          r.status !== 'cancelled',
      )
    ) {
      throw new Error('Esta reserva ya tiene una factura de venta en Siigo.');
    }
    if (!settings) {
      throw new Error(
        'Sincroniza y selecciona la configuración de Siigo primero (Facturación → Configuración).',
      );
    }
    if (
      !settings.salesDocumentTypeId ||
      !settings.sellerUserId ||
      !settings.salesPaymentTypeId
    ) {
      throw new Error(
        'Falta configuración de Siigo: tipo de documento, vendedor o forma de pago. Ve a Facturación → Configuración.',
      );
    }
    const productCode =
      settings.invoiceModel === 'comision'
        ? (settings.comisionProductCode ?? settings.defaultProductCode)
        : settings.defaultProductCode;
    if (!productCode) {
      throw new Error(
        'Falta el código de producto/servicio en la configuración de Siigo.',
      );
    }

    const items = buildInvoiceItemsFromBooking({
      booking,
      settings: {
        invoiceModel: settings.invoiceModel,
        comisionType: settings.comisionType,
        comisionValue: settings.comisionValue,
        defaultProductCode: settings.defaultProductCode,
        comisionProductCode: settings.comisionProductCode,
        taxIds: settings.taxIds,
      },
    });
    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
    if (total <= 0) {
      throw new Error(
        'El total facturable es 0 (revisa el valor de la reserva; el depósito reembolsable no se factura).',
      );
    }

    try {
      const { token, env } = await ensureToken(ctx);
      const customerPayload = buildCustomerPayloadFromBooking(booking);
      const customer = await ensureCustomer({ env, token }, customerPayload);
      const date = bogotaToday();

      // SIN `stamp`/`mail`: borrador, NO se timbra a la DIAN (fase 1).
      const payload = {
        document: { id: settings.salesDocumentTypeId },
        date,
        customer: {
          identification: customerPayload.identification,
          branch_office: 0,
        },
        seller: settings.sellerUserId,
        items,
        payments: [
          {
            id: settings.salesPaymentTypeId,
            value: total,
            due_date: date,
          },
        ],
        ...(booking.reference
          ? { observations: `Reserva ${booking.reference}` }
          : {}),
      };

      const resp = await siigoFetch<{
        id?: string;
        number?: number | string;
        name?: string;
        public_url?: string;
        metadata?: { public_url?: string };
      }>({
        env,
        token,
        method: 'POST',
        path: '/v1/invoices',
        body: payload,
      });

      const siigoInvoiceId = resp?.id ? String(resp.id) : undefined;
      const siigoNumber =
        resp?.number != null ? String(resp.number) : (resp?.name ?? undefined);
      const publicUrl =
        resp?.public_url ?? resp?.metadata?.public_url ?? undefined;

      await ctx.runMutation(internal.siigo._recordInvoice, {
        type: 'venta',
        bookingId: args.bookingId,
        siigoInvoiceId,
        siigoNumber,
        siigoCustomerId: customer.id,
        status: 'draft',
        invoiceModel: settings.invoiceModel,
        total,
        currency: 'COP',
        publicUrl,
        createdBy: actorLabel(me),
      });

      return { siigoInvoiceId, siigoNumber, total, status: 'draft', publicUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error creando factura';
      await ctx.runMutation(internal.siigo._recordInvoice, {
        type: 'venta',
        bookingId: args.bookingId,
        status: 'error',
        invoiceModel: settings.invoiceModel,
        total,
        currency: 'COP',
        errorMessage: msg,
        createdBy: actorLabel(me),
      });
      throw new Error(msg);
    }
  },
});

// ---------------------------------------------------------------------------
// Factura de COMPRA (propietario) — módulo separable, mismo cliente Siigo
// ---------------------------------------------------------------------------

export const createPurchaseInvoiceForOwnerPayout = action({
  args: { bookingId: v.id('bookings') },
  handler: async (
    ctx,
    args,
  ): Promise<{
    siigoInvoiceId?: string;
    siigoNumber?: string;
    total: number;
    status: string;
  }> => {
    const me = await ctx.runQuery(internal.siigo._getAccountingUser, {});
    if (!me) throw new Error('No autorizado');

    const data = await ctx.runQuery(internal.siigo._getPurchaseData, {
      bookingId: args.bookingId,
    });
    if (!data?.booking) throw new Error('Reserva no encontrada');
    const { booking, ownerInfo, settings, existing } = data;

    if (
      existing.some(
        (r) =>
          r.type === 'compra' &&
          r.status !== 'error' &&
          r.status !== 'cancelled',
      )
    ) {
      throw new Error('Esta reserva ya tiene una factura de compra en Siigo.');
    }
    if (!settings) {
      throw new Error('Configura Siigo primero (Facturación → Configuración).');
    }
    if (!settings.purchaseDocumentTypeId || !settings.purchasePaymentTypeId) {
      throw new Error(
        'Falta configuración de compras en Siigo: tipo de documento (FC) o forma de pago. Ve a Facturación → Configuración.',
      );
    }
    if (!ownerInfo || !ownerInfo.propietarioCedula) {
      throw new Error(
        'La finca no tiene propietario con cédula registrada (Propietarios). No se puede crear el tercero proveedor.',
      );
    }
    const valorAcordado = Number(booking.ownerPayout?.valorAcordado) || 0;
    if (valorAcordado <= 0) {
      throw new Error(
        'No hay valor acordado con el propietario en esta reserva (checkout del propietario).',
      );
    }

    const items = buildPurchaseItemsFromOwnerPayout({
      valorAcordado,
      reference: booking.reference,
      settings: {
        invoiceModel: settings.invoiceModel,
        defaultProductCode: settings.defaultProductCode,
        taxIds: settings.taxIds,
      },
    });
    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

    try {
      const { token, env } = await ensureToken(ctx);
      const supplierPayload = buildSupplierPayloadFromOwner(ownerInfo);
      const supplier = await ensureCustomer({ env, token }, supplierPayload);
      const date = bogotaToday();

      const payload = {
        document: { id: settings.purchaseDocumentTypeId },
        date,
        supplier: {
          identification: supplierPayload.identification,
          branch_office: 0,
        },
        items,
        payments: [
          {
            id: settings.purchasePaymentTypeId,
            value: total,
            due_date: date,
          },
        ],
        ...(booking.reference
          ? { observations: `Pago propietario reserva ${booking.reference}` }
          : {}),
      };

      const resp = await siigoFetch<{
        id?: string;
        number?: number | string;
        name?: string;
      }>({
        env,
        token,
        method: 'POST',
        path: '/v1/purchases',
        body: payload,
      });

      const siigoInvoiceId = resp?.id ? String(resp.id) : undefined;
      const siigoNumber =
        resp?.number != null ? String(resp.number) : (resp?.name ?? undefined);

      await ctx.runMutation(internal.siigo._recordInvoice, {
        type: 'compra',
        bookingId: args.bookingId,
        ownerInfoId: ownerInfo._id,
        ownerIdentification: supplierPayload.identification,
        siigoInvoiceId,
        siigoNumber,
        siigoCustomerId: supplier.id,
        status: 'draft',
        total,
        currency: 'COP',
        createdBy: actorLabel(me),
      });

      return { siigoInvoiceId, siigoNumber, total, status: 'draft' };
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Error creando factura de compra';
      await ctx.runMutation(internal.siigo._recordInvoice, {
        type: 'compra',
        bookingId: args.bookingId,
        ownerInfoId: ownerInfo._id,
        status: 'error',
        total,
        currency: 'COP',
        errorMessage: msg,
        createdBy: actorLabel(me),
      });
      throw new Error(msg);
    }
  },
});

// ---------------------------------------------------------------------------
// Vistas del panel (mes)
// ---------------------------------------------------------------------------

export const listMonthlyReservations = query({
  args: { monthStart: v.number(), monthEnd: v.number() },
  handler: async (ctx, args) => {
    if (!(await currentAccountingUser(ctx))) return [];
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_dates', (q) =>
        q.gte('fechaEntrada', args.monthStart).lt('fechaEntrada', args.monthEnd),
      )
      .collect();

    const rows = [];
    for (const b of bookings) {
      const invoices = await ctx.db
        .query('siigoInvoices')
        .withIndex('by_booking', (q) => q.eq('bookingId', b._id))
        .collect();
      const pickActive = (type: 'venta' | 'compra') =>
        invoices.find(
          (i) =>
            i.type === type &&
            i.status !== 'error' &&
            i.status !== 'cancelled',
        ) ?? invoices.find((i) => i.type === type) ?? null;
      const sale = pickActive('venta');
      const purchase = pickActive('compra');
      const property = await ctx.db.get(b.propertyId);
      rows.push({
        _id: b._id,
        reference: b.reference ?? null,
        nombreCompleto: b.nombreCompleto,
        cedula: b.cedula,
        precioTotal: b.precioTotal,
        paymentStatus: b.paymentStatus,
        status: b.status,
        fechaEntrada: b.fechaEntrada,
        fechaSalida: b.fechaSalida,
        propertyTitle: property?.title ?? null,
        hasOwnerPayout: !!(Number(b.ownerPayout?.valorAcordado) || 0),
        saleInvoice: sale
          ? {
              status: sale.status,
              siigoNumber: sale.siigoNumber ?? null,
              total: sale.total,
              publicUrl: sale.publicUrl ?? null,
              errorMessage: sale.errorMessage ?? null,
            }
          : null,
        purchaseInvoice: purchase
          ? {
              status: purchase.status,
              siigoNumber: purchase.siigoNumber ?? null,
              total: purchase.total,
              errorMessage: purchase.errorMessage ?? null,
            }
          : null,
      });
    }
    return rows.sort((a, b) => a.fechaEntrada - b.fechaEntrada);
  },
});

export const getMonthlySummary = query({
  args: { monthStart: v.number(), monthEnd: v.number() },
  handler: async (ctx, args) => {
    const empty = {
      reservasCount: 0,
      facturadasCount: 0,
      pendientesCount: 0,
      totalFacturado: 0,
      totalPendiente: 0,
    };
    if (!(await currentAccountingUser(ctx))) return empty;
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_dates', (q) =>
        q.gte('fechaEntrada', args.monthStart).lt('fechaEntrada', args.monthEnd),
      )
      .collect();

    let facturadasCount = 0;
    let totalFacturado = 0;
    let totalPendiente = 0;
    for (const b of bookings) {
      const invoices = await ctx.db
        .query('siigoInvoices')
        .withIndex('by_booking', (q) => q.eq('bookingId', b._id))
        .collect();
      const sale = invoices.find(
        (i) =>
          i.type === 'venta' &&
          i.status !== 'error' &&
          i.status !== 'cancelled',
      );
      if (sale) {
        facturadasCount += 1;
        totalFacturado += Number(sale.total) || 0;
      } else {
        totalPendiente += Number(b.precioTotal) || 0;
      }
    }
    return {
      reservasCount: bookings.length,
      facturadasCount,
      pendientesCount: bookings.length - facturadasCount,
      totalFacturado,
      totalPendiente,
    };
  },
});

// ---------------------------------------------------------------------------
// FASE 2 (dormida) — timbrado a la DIAN. NO se cablea a ningún botón en fase 1.
// ---------------------------------------------------------------------------

export const stampInvoiceToDian = action({
  args: { siigoInvoiceRowId: v.id('siigoInvoices') },
  handler: async (ctx): Promise<never> => {
    const me = await ctx.runQuery(internal.siigo._getAccountingUser, {});
    if (!me) throw new Error('No autorizado');
    const settings = await ctx.runQuery(internal.siigo._getSettings, {});
    if (!settings?.dianSendEnabled) {
      throw new Error(
        'El timbrado a la DIAN está deshabilitado (fase 2). Actívalo solo tras validar la resolución de facturación con el contador.',
      );
    }
    throw new Error('Timbrado a la DIAN aún no implementado (fase 2).');
  },
});
