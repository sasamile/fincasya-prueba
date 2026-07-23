/**
 * Métricas del Tablero de Control (Dashboard Ejecutivo).
 * Radiografía financiera/operativa: ventas, chats IA, conversión y actividad.
 */
import { query } from './_generated/server';

const SOLD_STATUSES = new Set(['CONFIRMED', 'PAID', 'COMPLETED']);

function monthWindow(nowMs: number, offsetMonths = 0) {
  const d = new Date(nowMs);
  const start = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + offsetMonths + 1, 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function inRange(ts: number | undefined, startMs: number, endMs: number) {
  if (ts == null || !Number.isFinite(ts)) return false;
  return ts >= startMs && ts < endMs;
}

export const executiveStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const current = monthWindow(now, 0);
    const previous = monthWindow(now, -1);

    // ── Ventas (reservas confirmadas/pagadas del mes por fecha de entrada) ──
    const bookings = await ctx.db.query('bookings').take(4000);
    let totalSales = 0;
    let prevSales = 0;
    let soldBookingsThisMonth = 0;
    let bookingsThisMonth = 0;

    /** Últimos 6 meses (índice 0 = hace 5 meses … 5 = mes actual). */
    const monthWindows = Array.from({ length: 6 }, (_, i) =>
      monthWindow(now, i - 5),
    );
    const salesByMonthRaw = monthWindows.map((w) => ({
      startMs: w.startMs,
      endMs: w.endMs,
      revenue: 0,
      bookings: 0,
    }));

    for (const b of bookings) {
      const entrada = b.fechaEntrada;
      const status = String(b.status ?? '').toUpperCase();
      const isSold = SOLD_STATUSES.has(status);
      const inCurrent = inRange(entrada, current.startMs, current.endMs);
      const inPrev = inRange(entrada, previous.startMs, previous.endMs);

      if (inCurrent) {
        bookingsThisMonth += 1;
        if (isSold) {
          soldBookingsThisMonth += 1;
          totalSales += Number(b.precioTotal ?? 0);
        }
      }
      if (inPrev && isSold) {
        prevSales += Number(b.precioTotal ?? 0);
      }

      if (!isSold || entrada == null) continue;
      for (const bucket of salesByMonthRaw) {
        if (entrada >= bucket.startMs && entrada < bucket.endMs) {
          bucket.revenue += Number(b.precioTotal ?? 0);
          bucket.bookings += 1;
          break;
        }
      }
    }

    const monthNames = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const salesByMonth = salesByMonthRaw.map((bucket, i) => {
      const d = new Date(bucket.startMs);
      const isCurrent = i === salesByMonthRaw.length - 1;
      const isPrev = i === salesByMonthRaw.length - 2;
      return {
        name: isCurrent
          ? 'Mes actual'
          : isPrev
            ? 'Mes pasado'
            : (monthNames[d.getMonth()] ?? `${d.getMonth() + 1}`),
        revenue: bucket.revenue,
        bookings: bucket.bookings,
      };
    });

    const salesGrowth =
      prevSales > 0
        ? ((totalSales - prevSales) / prevSales) * 100
        : totalSales > 0
          ? 100
          : 0;

    // ── Chats activos con IA ──
    const aiConvs = await ctx.db
      .query('conversations')
      .withIndex('by_status', (q) => q.eq('status', 'ai'))
      .take(2000);

    let activeAiChats = 0;
    let humanChats = 0;
    for (const c of aiConvs) {
      if (c.deletedAt || c.archived) continue;
      activeAiChats += 1;
    }

    const humanRows = await ctx.db
      .query('conversations')
      .withIndex('by_status', (q) => q.eq('status', 'human'))
      .take(2000);
    for (const c of humanRows) {
      if (c.deletedAt || c.archived) continue;
      humanChats += 1;
    }

    // Conversaciones con actividad este mes (para conversión chat → reserva)
    const recentConvs = await ctx.db
      .query('conversations')
      .withIndex('by_last_message')
      .order('desc')
      .take(1500);

    let chatsTouchedThisMonth = 0;
    for (const c of recentConvs) {
      if (c.deletedAt || c.archived) continue;
      const at = c.lastMessageAt ?? c.createdAt;
      if (inRange(at, current.startMs, current.endMs)) {
        chatsTouchedThisMonth += 1;
      }
    }

    // Tasa: reservas vendidas / chats activos del mes (operativa WhatsApp)
    const conversionRate =
      chatsTouchedThisMonth > 0
        ? Math.round((soldBookingsThisMonth / chatsTouchedThisMonth) * 1000) /
          10
        : 0;

    // CRM (complemento)
    const opportunities = await ctx.db
      .query('opportunities')
      .order('desc')
      .take(1000);
    let crmWon = 0;
    for (const o of opportunities) {
      if (o.stage === 'ganada') crmWon += 1;
    }
    const crmConversionRate =
      opportunities.length > 0
        ? Math.round((crmWon / opportunities.length) * 1000) / 10
        : 0;

    // ── Feed de actividad reciente ──
    type ActivityItem = {
      id: string;
      kind: 'booking' | 'chat' | 'contract';
      title: string;
      subtitle: string;
      at: number;
      href: string;
      amount?: number;
    };

    const activity: ActivityItem[] = [];

    const recentBookings = [...bookings]
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 8);

    for (const b of recentBookings) {
      const property = await ctx.db.get(b.propertyId);
      const at = b.createdAt ?? b._creationTime ?? 0;
      activity.push({
        id: `booking-${b._id}`,
        kind: 'booking',
        title: property?.title ?? 'Nueva reserva',
        subtitle: `Reserva ${String(b.status ?? '').toUpperCase()}`,
        at,
        href: `/admin/reservations?bookingId=${b._id}`,
        amount: b.precioTotal ?? undefined,
      });
    }

    for (const c of recentConvs.slice(0, 10)) {
      if (c.deletedAt || c.archived) continue;
      const contact = await ctx.db.get(c.contactId);
      const at = c.lastMessageAt ?? c.createdAt;
      const statusLabel =
        c.status === 'ai' ? 'IA activa' : c.status === 'human' ? 'Humano' : 'Cerrada';
      activity.push({
        id: `chat-${c._id}`,
        kind: 'chat',
        title: contact?.name || contact?.phone || 'Chat',
        subtitle: `WhatsApp · ${statusLabel}`,
        at,
        href: `/admin/inbox`,
      });
    }

    const contracts = await ctx.db
      .query('contracts')
      .withIndex('by_created')
      .order('desc')
      .take(8);

    for (const ct of contracts) {
      if (ct.estado === 'borrador') continue;
      activity.push({
        id: `contract-${ct._id}`,
        kind: 'contract',
        title: ct.contractNumber || 'Contrato',
        subtitle: `${ct.clienteNombre || 'Cliente'} · ${ct.estado}`,
        at: ct.createdAt ?? ct.updatedAt ?? 0,
        href: `/admin/contracts`,
        amount: ct.valorTotal ?? undefined,
      });
    }

    activity.sort((a, b) => b.at - a.at);
    const recentActivity = activity.slice(0, 12);

    return {
      totalSales,
      prevSales,
      salesGrowth,
      soldBookingsThisMonth,
      bookingsThisMonth,
      activeAiChats,
      humanChats,
      chatsTouchedThisMonth,
      conversionRate,
      crmConversionRate,
      salesByMonth,
      recentActivity,
      generatedAt: now,
    };
  },
});
