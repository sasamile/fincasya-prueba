/**
 * Oportunidades comerciales — embudo de ventas CRM-3.
 *
 * Reglas:
 * - Solo crea / actualiza desde tres disparadores automáticos:
 *   1. Bot fija dealLabel en contacto → stage "calificado"
 *   2. Asesor crea saleLink → stage "propuesta"
 *   3. Pago validado en saleLink → stage "ganada"
 * - Un contacto puede tener varias oportunidades a lo largo del tiempo.
 * - Una oportunidad por saleLinkId (upsert idempotente).
 * - El kanban solo muestra stages NO terminales activos (oculta "ganada"/"perdida"
 *   a menos que el filtro lo pida).
 */
import { v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

// ─── Disparadores internos ─────────────────────────────────────────────────

/**
 * Llamado desde contacts.setLeadDealLabel cuando el bot detecta finca+fechas.
 * Crea o actualiza la oportunidad "calificado" vinculada a la conversación.
 */
export const upsertFromDealLabel = internalMutation({
  args: {
    contactId: v.id('contacts'),
    conversationId: v.optional(v.id('conversations')),
    dealLabel: v.string(),
    assignedUserId: v.optional(v.string()),
    assignedUserName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Si ya hay una oportunidad activa (no ganada/perdida) para esta conversación, actualiza
    if (args.conversationId) {
      const existing = await ctx.db
        .query('opportunities')
        .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
        .filter((q) =>
          q.and(
            q.neq(q.field('stage'), 'ganada'),
            q.neq(q.field('stage'), 'perdida'),
          ),
        )
        .first();

      if (existing) {
        // Solo sube el stage (nunca baja de propuesta → calificado)
        const newStage =
          existing.stage === 'propuesta' ||
          existing.stage === 'negociacion'
            ? existing.stage
            : 'calificado';
        await ctx.db.patch(existing._id, {
          dealLabel: args.dealLabel,
          stage: newStage,
          updatedAt: Date.now(),
        });
        return { updated: true, id: existing._id };
      }
    }

    // Si ya hay una oportunidad activa para este contacto sin sale link (from bot), actualiza
    const contactOpps = await ctx.db.query('opportunities').order('desc').take(200);
    const existingContact = contactOpps.find(
      (o) =>
        o.contactId === args.contactId &&
        o.source === 'bot' &&
        o.stage !== 'ganada' &&
        o.stage !== 'perdida',
    ) ?? null;

    if (existingContact) {
      const newStage =
        existingContact.stage === 'propuesta' ||
        existingContact.stage === 'negociacion'
          ? existingContact.stage
          : 'calificado';
      await ctx.db.patch(existingContact._id, {
        dealLabel: args.dealLabel,
        stage: newStage,
        conversationId: args.conversationId ?? existingContact.conversationId,
        updatedAt: Date.now(),
      });
      return { updated: true, id: existingContact._id };
    }

    // Crea nueva
    const id = await ctx.db.insert('opportunities', {
      contactId: args.contactId,
      conversationId: args.conversationId,
      stage: 'calificado',
      dealLabel: args.dealLabel,
      source: 'bot',
      assignedUserId: args.assignedUserId,
      assignedUserName: args.assignedUserName,
      createdAt: Date.now(),
    });
    return { created: true, id };
  },
});

/**
 * Llamado desde saleLinks.create cuando el asesor genera un link de venta.
 * Crea o actualiza la oportunidad a "propuesta".
 */
export const upsertFromSaleLink = internalMutation({
  args: {
    contactId: v.optional(v.id('contacts')),
    conversationId: v.optional(v.id('conversations')),
    saleLinkId: v.id('saleLinks'),
    propertyName: v.optional(v.string()),
    estimatedValue: v.optional(v.number()),
    checkIn: v.optional(v.number()),
    checkOut: v.optional(v.number()),
    guests: v.optional(v.number()),
    assignedUserId: v.optional(v.string()),
    assignedUserName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotente: si ya existe para este saleLink, actualiza
    const bySaleLink = await ctx.db
      .query('opportunities')
      .withIndex('by_sale_link', (q) => q.eq('saleLinkId', args.saleLinkId))
      .first();

    if (bySaleLink) {
      await ctx.db.patch(bySaleLink._id, {
        stage: bySaleLink.stage === 'ganada' || bySaleLink.stage === 'perdida'
          ? bySaleLink.stage
          : 'propuesta',
        propertyName: args.propertyName ?? bySaleLink.propertyName,
        estimatedValue: args.estimatedValue ?? bySaleLink.estimatedValue,
        checkIn: args.checkIn ?? bySaleLink.checkIn,
        checkOut: args.checkOut ?? bySaleLink.checkOut,
        guests: args.guests ?? bySaleLink.guests,
        updatedAt: Date.now(),
      });
      return { updated: true, id: bySaleLink._id };
    }

    // Busca oportunidad activa del contacto/conversación para promover
    let existingId: Id<'opportunities'> | undefined;
    if (args.conversationId) {
      const byConv = await ctx.db
        .query('opportunities')
        .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
        .filter((q) =>
          q.and(
            q.neq(q.field('stage'), 'ganada'),
            q.neq(q.field('stage'), 'perdida'),
          ),
        )
        .first();
      if (byConv) existingId = byConv._id;
    }

    if (existingId) {
      await ctx.db.patch(existingId, {
        saleLinkId: args.saleLinkId,
        stage: 'propuesta',
        propertyName: args.propertyName,
        estimatedValue: args.estimatedValue,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        guests: args.guests,
        source: 'sale_link',
        updatedAt: Date.now(),
      });
      return { updated: true, id: existingId };
    }

    // Sin contexto previo: crea desde cero
    const id = await ctx.db.insert('opportunities', {
      contactId: args.contactId,
      conversationId: args.conversationId,
      saleLinkId: args.saleLinkId,
      stage: 'propuesta',
      propertyName: args.propertyName,
      estimatedValue: args.estimatedValue,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      guests: args.guests,
      source: 'sale_link',
      assignedUserId: args.assignedUserId,
      assignedUserName: args.assignedUserName,
      createdAt: Date.now(),
    });
    return { created: true, id };
  },
});

/**
 * Llamado desde saleLinks.validatePayment / validatePaymentAdmin.
 * Marca la oportunidad como "ganada" y la vincula al booking si hay.
 */
export const markWon = internalMutation({
  args: {
    saleLinkId: v.id('saleLinks'),
    bookingId: v.optional(v.id('bookings')),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db
      .query('opportunities')
      .withIndex('by_sale_link', (q) => q.eq('saleLinkId', args.saleLinkId))
      .first();
    if (!opp) return { notFound: true };
    if (opp.stage === 'ganada') return { alreadyWon: true };
    await ctx.db.patch(opp._id, {
      stage: 'ganada',
      bookingId: args.bookingId,
      updatedAt: Date.now(),
    });
    return { ok: true, id: opp._id };
  },
});

// ─── Queries públicas ────────────────────────────────────────────────────────

const ACTIVE_STAGES = ['nuevo', 'calificado', 'propuesta', 'negociacion'] as const;

export const list = query({
  args: {
    /** null = todas las etapas; 'active' = solo activas; stage literal */
    stageFilter: v.optional(v.string()),
    assignedUserId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;

    let rows = await ctx.db.query('opportunities').order('desc').take(500);

    // Filtro de stage
    if (args.stageFilter && args.stageFilter !== 'all') {
      if (args.stageFilter === 'active') {
        rows = rows.filter((r) => (ACTIVE_STAGES as readonly string[]).includes(r.stage));
      } else {
        rows = rows.filter((r) => r.stage === args.stageFilter);
      }
    }

    // Filtro de asesor
    if (args.assignedUserId) {
      rows = rows.filter((r) => r.assignedUserId === args.assignedUserId);
    }

    rows = rows.slice(0, limit);

    // Enriquecer con nombre del contacto
    const contactIds = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[];
    const contacts = await Promise.all(contactIds.map((id) => ctx.db.get(id as Id<'contacts'>)));
    const contactMap = new Map(
      contacts.filter(Boolean).map((c) => [c!._id as string, c!]),
    );

    return rows.map((opp) => {
      const contact = opp.contactId ? contactMap.get(opp.contactId as string) : undefined;
      return {
        ...opp,
        contactName: contact?.baseName ?? contact?.name ?? opp.dealLabel ?? '—',
        contactPhone: (contact as { phone?: string } | undefined)?.phone ?? '',
      };
    });
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('opportunities').order('desc').take(1000);

    const byStage: Record<string, number> = {};
    let totalValue = 0;
    let wonValue = 0;
    let wonCount = 0;

    for (const opp of all) {
      byStage[opp.stage] = (byStage[opp.stage] ?? 0) + 1;
      const val = opp.estimatedValue ?? 0;
      totalValue += val;
      if (opp.stage === 'ganada') {
        wonValue += val;
        wonCount++;
      }
    }

    const activeCount = all.filter((o) =>
      (ACTIVE_STAGES as readonly string[]).includes(o.stage),
    ).length;

    const totalDeals = all.length;
    const conversionRate =
      totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0;

    return {
      total: totalDeals,
      active: activeCount,
      won: wonCount,
      lost: byStage['perdida'] ?? 0,
      totalValue,
      wonValue,
      conversionRate,
      byStage,
    };
  },
});

export const listByContact = query({
  args: {
    contactId: v.id('contacts'),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query('opportunities').order('desc').take(500);
    return all.filter((o) => o.contactId === args.contactId).slice(0, 20);
  },
});

// ─── Mutaciones del panel ────────────────────────────────────────────────────

export const updateStage = mutation({
  args: {
    id: v.id('opportunities'),
    stage: v.union(
      v.literal('nuevo'),
      v.literal('calificado'),
      v.literal('propuesta'),
      v.literal('negociacion'),
      v.literal('ganada'),
      v.literal('perdida'),
    ),
    lostReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.id);
    if (!opp) throw new Error('Oportunidad no encontrada');
    await ctx.db.patch(args.id, {
      stage: args.stage,
      lostReason: args.lostReason,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const create = mutation({
  args: {
    contactId: v.id('contacts'),
    dealLabel: v.optional(v.string()),
    propertyName: v.optional(v.string()),
    estimatedValue: v.optional(v.number()),
    checkIn: v.optional(v.number()),
    checkOut: v.optional(v.number()),
    guests: v.optional(v.number()),
    assignedUserId: v.optional(v.string()),
    assignedUserName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('opportunities', {
      ...args,
      stage: 'nuevo',
      source: 'manual',
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const markLost = mutation({
  args: {
    id: v.id('opportunities'),
    lostReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      stage: 'perdida',
      lostReason: args.lostReason,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// ─── Backfill desde datos existentes ────────────────────────────────────────

/**
 * Ejecutar UNA sola vez para poblar el pipeline desde saleLinks existentes.
 * `bunx convex run opportunities:backfillFromSaleLinks`
 */
export const backfillFromSaleLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query('saleLinks').order('desc').take(500);
    let created = 0;
    let skipped = 0;

    for (const link of links) {
      // Verificar si ya existe
      const existing = await ctx.db
        .query('opportunities')
        .withIndex('by_sale_link', (q) => q.eq('saleLinkId', link._id))
        .first();
      if (existing) { skipped++; continue; }

      const stage =
        link.status === 'cancelled'
          ? 'perdida'
          : link.paymentValidated
          ? 'ganada'
          : link.clientStep >= 3
          ? 'negociacion'
          : 'propuesta';

      // Intentar resolver propiedad
      let propertyName: string | undefined;
      try {
        const prop = await ctx.db.get(link.propertyId);
        propertyName = (prop as { title?: string } | null)?.title ?? undefined;
      } catch { /* no crítico */ }

      await ctx.db.insert('opportunities', {
        saleLinkId: link._id,
        stage,
        propertyName,
        estimatedValue: link.totalValue,
        checkIn: link.checkIn,
        checkOut: link.checkOut,
        guests: link.guests,
        source: 'sale_link',
        assignedUserId: link.createdBy,
        assignedUserName: link.createdByName,
        createdAt: link.createdAt,
      });
      created++;
    }
    return { created, skipped };
  },
});
