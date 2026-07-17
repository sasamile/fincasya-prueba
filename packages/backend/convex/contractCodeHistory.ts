import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
  codeMatchesPrefix,
  highestCodeForPrefix,
  suggestNextForPrefix,
} from './lib/contractCodeSuggest';

type HistoryItem = {
  contractNumber: string;
  source: 'draft' | 'booking' | 'link' | 'contract';
  propertyId: string;
  propertyTitle: string;
  propertyCode: string;
  clientName: string;
  createdAt: number;
  status: string;
};

function normalizePrefix(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Historial de códigos filtrado por prefijo de vendedor (CR, CRA…).
 * Sugiere el siguiente número de esa serie (no por finca).
 */
export const list = query({
  args: {
    propertyId: v.optional(v.id('properties')),
    search: v.optional(v.string()),
    /** Prefijo de vendedor: CR, CRA, VA… */
    prefix: v.optional(v.string()),
    limit: v.optional(v.number()),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const page = Math.max(args.page ?? 1, 1);
    const search = (args.search ?? '').trim().toLowerCase();
    const prefix = normalizePrefix(args.prefix ?? '');

    const byNumber = new Map<string, HistoryItem>();
    const propCache = new Map<
      string,
      { title: string; code: string } | null
    >();

    const getProp = async (propertyId: Id<'properties'>) => {
      const key = String(propertyId);
      if (propCache.has(key)) return propCache.get(key)!;
      const prop = await ctx.db.get(propertyId);
      const info = prop
        ? { title: prop.title ?? '', code: prop.code ?? '' }
        : null;
      propCache.set(key, info);
      return info;
    };

    const upsert = (item: HistoryItem) => {
      const key = item.contractNumber.trim().toLowerCase().replace(/[\s\-_]+/g, '');
      if (!key) return;
      if (prefix && !codeMatchesPrefix(item.contractNumber, prefix)) return;
      const prev = byNumber.get(key);
      if (!prev || item.createdAt >= prev.createdAt) {
        byNumber.set(key, item);
      }
    };

    const contracts = await ctx.db
      .query('contracts')
      .withIndex('by_created')
      .order('desc')
      .take(2000);
    for (const c of contracts) {
      if (args.propertyId && c.propertyId !== args.propertyId) continue;
      upsert({
        contractNumber: c.contractNumber,
        source: 'contract',
        propertyId: String(c.propertyId ?? ''),
        propertyTitle: c.propertyTitle ?? '',
        propertyCode: '',
        clientName: c.clienteNombre ?? '',
        createdAt: c.updatedAt || c.createdAt || 0,
        status: c.estado || 'contrato',
      });
    }

    const saleLinks = await ctx.db.query('saleLinks').order('desc').take(1200);
    for (const link of saleLinks) {
      const code = (link.contractCode ?? '').trim();
      if (!code) continue;
      if (args.propertyId && link.propertyId !== args.propertyId) continue;
      if (prefix && !codeMatchesPrefix(code, prefix)) continue;
      const prop = await getProp(link.propertyId);
      upsert({
        contractNumber: code,
        source: 'link',
        propertyId: String(link.propertyId),
        propertyTitle: prop?.title ?? '',
        propertyCode: prop?.code ?? '',
        clientName: link.clientData?.nombre ?? '',
        createdAt: link.updatedAt || link.createdAt || 0,
        status: link.status || 'link',
      });
    }

    // Reservas: reference suele ser el CR (ej. "CR 2041")
    const bookings = await ctx.db.query('bookings').order('desc').take(1500);
    for (const b of bookings) {
      const code = (b.reference ?? '').trim();
      if (!code) continue;
      if (args.propertyId && b.propertyId !== args.propertyId) continue;
      if (prefix && !codeMatchesPrefix(code, prefix)) continue;
      const prop = await getProp(b.propertyId);
      upsert({
        contractNumber: code,
        source: 'booking',
        propertyId: String(b.propertyId),
        propertyTitle: prop?.title ?? '',
        propertyCode: prop?.code ?? '',
        clientName: b.nombreCompleto ?? '',
        createdAt: b.updatedAt || b.createdAt || 0,
        status: b.status || 'reserva',
      });
    }

    const snapshots = await ctx.db.query('adminContractSnapshots').take(600);
    for (const s of snapshots) {
      if (args.propertyId && s.propertyId !== args.propertyId) continue;
      if (prefix && !codeMatchesPrefix(s.contractNumber, prefix)) continue;
      const prop = await getProp(s.propertyId);
      const p = (s.payload ?? {}) as Record<string, unknown>;
      upsert({
        contractNumber: s.contractNumber,
        source: 'draft',
        propertyId: String(s.propertyId),
        propertyTitle: prop?.title ?? '',
        propertyCode: prop?.code ?? '',
        clientName: String(p.nombreCompleto ?? ''),
        createdAt: s.createdAt,
        status: 'Borrador',
      });
    }

    let allSorted = Array.from(byNumber.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );

    if (search) {
      allSorted = allSorted.filter(
        (i) =>
          i.contractNumber.toLowerCase().includes(search) ||
          i.clientName.toLowerCase().includes(search) ||
          i.propertyTitle.toLowerCase().includes(search) ||
          i.propertyCode.toLowerCase().includes(search),
      );
    }

    const codesForSuggestion = allSorted.map((i) => i.contractNumber);
    const lastUsed = prefix
      ? highestCodeForPrefix(codesForSuggestion, prefix)
      : null;
    const suggestedNext = prefix
      ? suggestNextForPrefix(codesForSuggestion, prefix)
      : null;

    const total = allSorted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    return {
      items: allSorted.slice(offset, offset + limit),
      total,
      page: safePage,
      limit,
      totalPages,
      codesForSuggestion,
      lastUsed,
      suggestedNext,
      prefix: prefix || undefined,
    };
  },
});
