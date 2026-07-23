/**
 * Reportes contables para exportar a Excel (cualquier software contable).
 *
 * - `getMovimientos({ start, end })`: libro de ingresos/egresos por rango de
 *   fechas, SOLO con datos del sistema:
 *     · Ingresos  = abonos de turistas (tabla `payments`, excepto REEMBOLSO).
 *     · Egresos   = reembolsos (payments REEMBOLSO) + pagos a propietarios
 *                   (`bookings.ownerPayout.abonos[]`) + devoluciones de depósito
 *                   (`bookings.depositReturn.devolucion`) + gastos operativos
 *                   y salidas de caja menor (`operationalMovements`).
 *     · Nota: las entradas de caja menor (fondeo) NO cuentan como ingreso.
 * - `getTercerosConReserva()`: clientes únicos (dedup por cédula) con reserva,
 *   para importar como terceros a Siigo / cualquier contable.
 *
 * Ambas queries están restringidas a contabilidad/admin (devuelven vacío si no).
 */
import { v } from 'convex/values';
import { query, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { authComponent } from './betterAuth/auth';

const ACCOUNTING_ROLES = new Set([
  'admin',
  'assistant',
  'superadmin',
  'contabilidad',
]);

async function isAccounting(ctx: QueryCtx): Promise<boolean> {
  const user = (await authComponent.safeGetAuthUser(ctx)) as
    | { role?: string | null }
    | null;
  const role = String(user?.role ?? '')
    .trim()
    .toLowerCase();
  return ACCOUNTING_ROLES.has(role);
}

function bogotaDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function digits(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

type Movimiento = {
  fechaMs: number;
  fecha: string;
  finca: string;
  operacion: string;
  entidad: string;
  ingreso: number;
  egreso: number;
  observaciones: string;
  /** A quién corresponde el movimiento (cliente o propietario según la fila). */
  nombre: string;
  cedula: string;
  // DESGLOSE para la contadora (Adriana, 22-jul): cada fila dice SIEMPRE de
  // qué reserva es, quién es el cliente y quién el propietario — antes
  // `nombre` era uno u otro y no se sabía cuál.
  reserva: string;
  cliente: string;
  clienteCedula: string;
  propietario: string;
  propietarioCedula: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  ABONO_50: 'ABONO 50% RESERVA',
  SALDO_50: 'SALDO RESERVA',
  COMPLETO: 'PAGO COMPLETO RESERVA',
  REEMBOLSO: 'REEMBOLSO',
};

export const getMovimientos = query({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    const empty = {
      rows: [] as Movimiento[],
      totals: { totalIngresos: 0, totalEgresos: 0, neto: 0 },
    };
    if (!(await isAccounting(ctx))) return empty;

    const rows: Movimiento[] = [];
    const propertyCache = new Map<string, Doc<'properties'> | null>();
    const getProperty = async (id: Id<'properties'>) => {
      const key = String(id);
      if (propertyCache.has(key)) return propertyCache.get(key) ?? null;
      const p = await ctx.db.get(id);
      propertyCache.set(key, p);
      return p;
    };

    // --- Ingresos + reembolsos (tabla payments, por fecha) ---
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_created', (q) =>
        q.gte('createdAt', args.start).lt('createdAt', args.end),
      )
      .collect();

    for (const p of payments) {
      const booking = await ctx.db.get(p.bookingId);
      const property = booking ? await getProperty(booking.propertyId) : null;
      const isRefund = p.type === 'REEMBOLSO';
      const amount = Number(p.amount) || 0;
      rows.push({
        fechaMs: p.createdAt,
        fecha: bogotaDate(p.createdAt),
        finca: property?.title ?? booking?.reference ?? '',
        operacion: PAYMENT_LABELS[p.type] ?? p.type,
        entidad: p.paymentMethod ?? '',
        ingreso: isRefund ? 0 : amount,
        egreso: isRefund ? amount : 0,
        observaciones: p.notes ?? p.reference ?? booking?.reference ?? '',
        nombre: booking?.nombreCompleto ?? '',
        cedula: booking?.cedula ?? '',
        reserva: booking?.reference ?? '',
        cliente: booking?.nombreCompleto ?? '',
        clienteCedula: booking?.cedula ?? '',
        propietario: property?.propietarioNombre ?? '',
        propietarioCedula: property?.propietarioCedula ?? '',
      });
    }

    // --- Egresos embebidos en bookings (pagos a propietario + devoluciones) ---
    const bookings = await ctx.db.query('bookings').collect();
    for (const b of bookings) {
      const property = await getProperty(b.propertyId);
      const fincaLabel = property?.title ?? b.reference ?? '';

      const abonos = b.ownerPayout?.abonos ?? [];
      for (const abono of abonos) {
        const ms = Number(abono.createdAt) || 0;
        if (ms < args.start || ms >= args.end) continue;
        rows.push({
          fechaMs: ms,
          fecha: abono.fecha || bogotaDate(ms),
          finca: fincaLabel,
          operacion: 'PAGO PROPIETARIO',
          entidad: abono.medio ?? '',
          ingreso: 0,
          egreso: Number(abono.amount) || 0,
          observaciones: b.reference ? `Reserva ${b.reference}` : '',
          nombre: property?.propietarioNombre ?? '',
          cedula: property?.propietarioCedula ?? '',
          reserva: b.reference ?? '',
          cliente: b.nombreCompleto ?? '',
          clienteCedula: b.cedula ?? '',
          propietario: property?.propietarioNombre ?? '',
          propietarioCedula: property?.propietarioCedula ?? '',
        });
      }

      const dev = b.depositReturn?.devolucion;
      if (dev && (Number(dev.valor) || 0) > 0) {
        const ms = Number(dev.ts) || 0;
        if (ms >= args.start && ms < args.end) {
          rows.push({
            fechaMs: ms,
            fecha: dev.fecha || bogotaDate(ms),
            finca: fincaLabel,
            operacion: 'DEVOLUCIÓN DEPÓSITO',
            entidad: dev.medio ?? '',
            ingreso: 0,
            egreso: Number(dev.valor) || 0,
            observaciones: dev.observaciones ?? '',
            nombre: b.nombreCompleto ?? '',
            cedula: b.cedula ?? '',
            reserva: b.reference ?? '',
            cliente: b.nombreCompleto ?? '',
            clienteCedula: b.cedula ?? '',
            propietario: property?.propietarioNombre ?? '',
            propietarioCedula: property?.propietarioCedula ?? '',
          });
        }
      }
    }

    // --- Gastos operativos + salidas de caja menor ---
    const ops = await ctx.db
      .query('operationalMovements')
      .withIndex('by_fecha', (q) =>
        q.gte('fechaMs', args.start).lt('fechaMs', args.end),
      )
      .collect();
    for (const m of ops) {
      if (m.deletedAt) continue;
      // Fondeo de caja: no es ingreso del negocio ni egreso.
      if (m.kind === 'caja_entrada') continue;
      const isCaja = m.kind === 'caja_salida';
      rows.push({
        fechaMs: m.fechaMs,
        fecha: m.fecha || bogotaDate(m.fechaMs),
        finca: m.propertyTitle ?? '',
        operacion: isCaja
          ? `CAJA MENOR — ${m.category}`
          : `GASTO — ${m.category}`,
        entidad: m.medio ?? (isCaja ? 'Caja menor' : ''),
        ingreso: 0,
        egreso: Number(m.amount) || 0,
        observaciones: m.notes ?? '',
        nombre: m.beneficiario ?? m.createdByName ?? '',
        cedula: '',
        // Gasto operativo: no cuelga de una reserva ni de un propietario.
        reserva: '',
        cliente: '',
        clienteCedula: '',
        propietario: '',
        propietarioCedula: '',
      });
    }

    rows.sort((a, b) => a.fechaMs - b.fechaMs);

    const totalIngresos = rows.reduce((s, r) => s + r.ingreso, 0);
    const totalEgresos = rows.reduce((s, r) => s + r.egreso, 0);
    return {
      rows,
      totals: {
        totalIngresos,
        totalEgresos,
        neto: totalIngresos - totalEgresos,
      },
    };
  },
});

export type TerceroExport = {
  identificacion: string;
  nombres: string;
  apellidos: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  correo: string;
};

/**
 * DESGLOSE POR RESERVA para la contadora (Adriana, 22-jul).
 *
 * Una fila por reserva con TODO lo que necesita entender el negocio de esa
 * reserva: quién es el cliente, quién el propietario, cuánto pagó el turista,
 * cuánto se le reconoció y se le pagó al propietario, cuánto se devolvió, y
 * cuánto quedó para FincasYa.
 *
 *   Ganancia FincasYa = cobrado al cliente − pagado al propietario − devuelto
 *
 * Se cuenta por la fecha de ENTRADA de la reserva, que es como se cierra el mes.
 */
type FilaReserva = {
  reserva: string;
  finca: string;
  ubicacion: string;
  fechaEntrada: string;
  fechaSalida: string;
  noches: number;
  personas: number;
  cliente: string;
  clienteCedula: string;
  clienteTelefono: string;
  propietario: string;
  propietarioCedula: string;
  valorReserva: number;
  cobradoCliente: number;
  reembolsadoCliente: number;
  acordadoPropietario: number;
  pagadoPropietario: number;
  saldoPropietario: number;
  devolucionDeposito: number;
  gananciaFincasya: number;
  estado: string;
};

export const getDesglosePorReserva = query({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    if (!(await isAccounting(ctx))) return { rows: [], totals: null };

    const bookings = await ctx.db.query('bookings').collect();
    const propertyCache = new Map<string, Doc<'properties'> | null>();
    const getProperty = async (id: Id<'properties'>) => {
      const key = String(id);
      if (propertyCache.has(key)) return propertyCache.get(key) ?? null;
      const p = await ctx.db.get(id);
      propertyCache.set(key, p);
      return p;
    };

    const rows: FilaReserva[] = [];
    for (const b of bookings) {
      const entrada = Number(b.fechaEntrada) || 0;
      if (entrada < args.start || entrada >= args.end) continue;
      if (String(b.status ?? '').toUpperCase() === 'CANCELLED') continue;

      const property = await getProperty(b.propertyId);

      // Lo que el turista efectivamente pagó (pagos menos reembolsos).
      const payments = await ctx.db
        .query('payments')
        .withIndex('by_booking', (q) => q.eq('bookingId', b._id))
        .collect();
      let cobrado = 0;
      let reembolsado = 0;
      for (const p of payments) {
        const monto = Number(p.amount) || 0;
        const estado = String(p.status ?? '').toUpperCase();
        if (estado && estado !== 'PAID' && estado !== 'APPROVED') continue;
        if (p.type === 'REEMBOLSO') reembolsado += monto;
        else cobrado += monto;
      }

      // Propietario: lo acordado/cotizado y lo realmente pagado.
      const acordadoPropietario =
        Number(b.ownerPayout?.valorAcordado) ||
        Number(b.ownerNegotiatedAmount) ||
        0;
      const pagadoPropietario = (b.ownerPayout?.abonos ?? []).reduce(
        (sum, a) => sum + (Number(a.amount) || 0),
        0,
      );
      const devolucionDeposito = Number(b.depositReturn?.devolucion?.valor) || 0;

      const cobradoNeto = cobrado - reembolsado;
      const gananciaFincasya =
        cobradoNeto - pagadoPropietario - devolucionDeposito;

      rows.push({
        reserva: b.reference ?? '',
        finca: property?.title ?? '',
        ubicacion: property?.location ?? '',
        fechaEntrada: bogotaDate(entrada),
        fechaSalida: b.fechaSalida ? bogotaDate(Number(b.fechaSalida)) : '',
        noches: Number(b.numeroNoches) || 0,
        personas: Number(b.numeroPersonas) || 0,
        cliente: b.nombreCompleto ?? '',
        clienteCedula: b.cedula ?? '',
        clienteTelefono: b.celular ?? '',
        propietario: property?.propietarioNombre ?? '',
        propietarioCedula: property?.propietarioCedula ?? '',
        valorReserva: Number(b.precioTotal) || 0,
        cobradoCliente: cobrado,
        reembolsadoCliente: reembolsado,
        acordadoPropietario,
        pagadoPropietario,
        saldoPropietario: Math.max(acordadoPropietario - pagadoPropietario, 0),
        devolucionDeposito,
        gananciaFincasya,
        estado: b.status ?? '',
      });
    }

    rows.sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));

    const suma = (k: keyof FilaReserva) =>
      rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

    return {
      rows,
      totals: {
        reservas: rows.length,
        valorReserva: suma('valorReserva'),
        cobradoCliente: suma('cobradoCliente'),
        reembolsadoCliente: suma('reembolsadoCliente'),
        acordadoPropietario: suma('acordadoPropietario'),
        pagadoPropietario: suma('pagadoPropietario'),
        saldoPropietario: suma('saldoPropietario'),
        devolucionDeposito: suma('devolucionDeposito'),
        gananciaFincasya: suma('gananciaFincasya'),
      },
    };
  },
});

export const getTercerosConReserva = query({
  args: {},
  handler: async (ctx): Promise<TerceroExport[]> => {
    if (!(await isAccounting(ctx))) return [];
    const bookings = await ctx.db.query('bookings').collect();
    const byCedula = new Map<string, TerceroExport>();

    for (const b of bookings) {
      const cedula = digits(b.cedula);
      if (!cedula) continue;
      const nombre = String(b.nombreCompleto ?? '').trim();
      const parts = nombre.split(/\s+/).filter(Boolean);
      const [nombres, apellidos] =
        parts.length <= 1
          ? [nombre || 'Cliente', '']
          : parts.length === 2
            ? [parts[0], parts[1]]
            : [parts.slice(0, parts.length - 2).join(' '), parts.slice(-2).join(' ')];

      const existing = byCedula.get(cedula);
      const candidate: TerceroExport = {
        identificacion: cedula,
        nombres: existing?.nombres || nombres,
        apellidos: existing?.apellidos || apellidos,
        ciudad: existing?.ciudad || String(b.city ?? '').trim(),
        direccion: existing?.direccion || String(b.address ?? '').trim(),
        telefono: existing?.telefono || digits(b.celular),
        correo: existing?.correo || String(b.correo ?? '').trim(),
      };
      byCedula.set(cedula, candidate);
    }

    return Array.from(byCedula.values()).sort((a, b) =>
      a.nombres.localeCompare(b.nombres, 'es'),
    );
  },
});
