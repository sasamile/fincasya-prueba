import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { normalizeContractLookupQueryConvex } from './lib/contractLookup';
import { enrichContactFromContractClient } from './contacts';

/** Orden de avance del contrato; al fusionar, gana el estado más avanzado. */
const ESTADO_RANK: Record<string, number> = {
  anulado: 0,
  borrador: 1,
  expirado: 2,
  generado: 3,
  enviado: 4,
  /** El cliente devolvió el contrato firmado (lo valida la IA). */
  firmado: 5,
  completado: 6,
  pagado: 7,
};

function rank(estado?: string): number {
  return ESTADO_RANK[String(estado ?? '').toLowerCase()] ?? 0;
}

/** El contador CR solo avanza con contrato real (generado+), no con borradores. */
function shouldCommitContractCode(estado?: string): boolean {
  return rank(estado) >= rank('generado');
}

type ContractFields = {
  contractNumber: string;
  propertyId?: Id<'properties'>;
  propertyTitle?: string;
  propertyLocation?: string;
  clienteNombre?: string;
  clienteCedula?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  /** Segundo número de contacto. Dato interno: NO sale en el contrato. */
  clienteTelefonoAdicional?: string;
  clienteCiudad?: string;
  clienteDireccion?: string;
  firmanteNombre?: string;
  firmanteCedula?: string;
  valorTotal?: number;
  fechaEntrada?: string;
  fechaSalida?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  confirmationPdfUrl?: string;
  confirmationPdfFilename?: string;
  estado?: string;
  origen?: string;
  bookingId?: Id<'bookings'>;
  fillTokenId?: Id<'contractFillTokens'>;
  draftJson?: string;
  conversationId?: string;
};

/** ¿Es un código autoinventado del inbox (no un CR real)? */
function isAutoInboxContractNumber(num: string): boolean {
  return /^INBOX-/i.test(num.trim());
}

/** CR legible para la lista: booking.reference, código tipado, o Sin CR. */
export function resolveContractDisplayNumber(
  contractNumber: string,
  opts?: {
    bookingReference?: string | null;
    draftContractCode?: string | null;
  },
): string {
  const bookingRef = String(opts?.bookingReference ?? '').trim();
  if (bookingRef) return bookingRef;

  const draftCode = String(opts?.draftContractCode ?? '').trim();
  if (draftCode && !isAutoInboxContractNumber(draftCode)) return draftCode;

  const num = contractNumber.trim();
  if (num && !isAutoInboxContractNumber(num)) return num;

  return 'Sin CR';
}

function extractDraftContractCode(
  draftJson?: string | null,
): string | undefined {
  if (!draftJson?.trim()) return undefined;
  try {
    const parsed = JSON.parse(draftJson) as { contractCode?: unknown };
    const code = String(parsed.contractCode ?? '').trim();
    return code || undefined;
  } catch {
    return undefined;
  }
}

/** Extrae PDF de confirmación de reserva en multimedia. */
function extractConfirmationPdfFromMultimedia(
  multimedia?: Array<{ name?: string; url?: string; type?: string }> | null,
): { url?: string; filename?: string } | null {
  for (const m of multimedia ?? []) {
    const name = String(m.name ?? '').toLowerCase();
    if (
      name.includes('confirmacion') ||
      name.includes('confirmation') ||
      name.includes('confirmación')
    ) {
      const url = String(m.url ?? '').trim();
      if (url) {
        return { url, filename: m.name ?? undefined };
      }
    }
  }
  return null;
}

/** Solo archivos Contrato_* del borrador admin. */
function extractContractFromDraftJson(draftJson?: string | null): {
  url?: string;
  filename?: string;
} {
  if (!draftJson) return {};
  try {
    const draft = JSON.parse(draftJson) as {
      multimediaLinks?: Array<{ url?: string; name?: string }>;
    };
    for (const m of draft.multimediaLinks ?? []) {
      const name = String(m?.name ?? '');
      const url = String(m?.url ?? '').trim();
      if (!url) continue;
      if (/^contrato[_\s-]/i.test(name) || name.toLowerCase().includes('contrato')) {
        return { url, filename: name || undefined };
      }
    }
  } catch {
    /* ignore */
  }
  return {};
}

function extractContractPdfFromMultimedia(
  multimedia?: Array<{ name?: string; url?: string }> | null,
): { code: string; url?: string } | null {
  for (const m of multimedia ?? []) {
    const name = m.name ?? '';
    const match =
      name.match(/^Contrato[_\s-]+(.+?)\.pdf$/i) ??
      name.match(/^Contrato[_\s-]+(.+?)\.docx$/i);
    if (match?.[1]?.trim()) {
      return { code: match[1].trim(), url: m.url };
    }
  }
  return null;
}

/**
 * Upsert idempotente:
 * 1) por contractNumber (CR tipado)
 * 2) si no hay match y hay conversationId, reutiliza el borrador/generado de
 *    esa conversación (evita duplicar al regenerar sin enviar)
 * Solo avanza el estado (nunca retrocede) vía ESTADO_RANK.
 * Tras guardar, rellena en el lead/CRM solo los campos que falten
 * (dirección, correo, número adicional, ciudad, etc.).
 */
async function upsertContract(
  ctx: MutationCtx,
  fields: ContractFields,
): Promise<void> {
  const num = fields.contractNumber.trim();
  if (!num) return;
  const now = Date.now();
  const convId = fields.conversationId?.trim() || undefined;

  let existing = await ctx.db
    .query('contracts')
    .withIndex('by_contract_number', (q) =>
      q.eq('contractNumber', num),
    )
    .first();

  let draftByConversation: typeof existing = null;
  if (convId) {
    draftByConversation = await ctx.db
      .query('contracts')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', convId),
      )
      .first();
    if (!existing && draftByConversation) {
      const st = String(draftByConversation.estado ?? '').toLowerCase();
      const open =
        st === 'borrador' ||
        st === 'generado' ||
        isAutoInboxContractNumber(draftByConversation.contractNumber);
      if (open) existing = draftByConversation;
    }
  }

  const cleaned: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(fields)) {
    if (k === 'contractNumber' || k === 'estado') continue;
    if (val !== undefined && val !== null && val !== '') cleaned[k] = val;
  }
  if (convId) cleaned.conversationId = convId;

  const syncLeadFromContract = async () => {
    await enrichContactFromContractClient(ctx, {
      conversationId: convId,
      contractName: fields.clienteNombre,
      contractCedula: fields.clienteCedula,
      contractEmail: fields.clienteEmail,
      contractPhone: fields.clienteTelefono,
      contractPhoneAlt: fields.clienteTelefonoAdicional,
      contractCity: fields.clienteCiudad,
      contractAddress: fields.clienteDireccion,
    });
  };

  if (!existing) {
    const estado = fields.estado || 'borrador';
    await ctx.db.insert('contracts', {
      contractNumber: num,
      estado,
      createdAt: now,
      updatedAt: now,
      ...cleaned,
    });
    if (shouldCommitContractCode(estado)) {
      try {
        await ctx.runMutation(
          internal.adminContractSettings.commitContractCodeInternal,
          { code: num },
        );
      } catch {
        /* contador opcional */
      }
    }
    await syncLeadFromContract();
    return;
  }

  const nextEstado =
    fields.estado && rank(fields.estado) >= rank(existing.estado)
      ? fields.estado
      : existing.estado;

  const patch: Record<string, unknown> = {
    ...cleaned,
    estado: nextEstado,
    updatedAt: now,
  };

  // Si el asesor tipó un CR real sobre un borrador INBOX-*, renombra la fila.
  let redundantInboxDraftId: typeof existing._id | null = null;
  if (
    num !== existing.contractNumber &&
    isAutoInboxContractNumber(existing.contractNumber) &&
    !isAutoInboxContractNumber(num)
  ) {
    const taken = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', num),
      )
      .first();
    if (!taken || taken._id === existing._id) {
      patch.contractNumber = num;
    } else {
      // Ese CR ya existe (el contrato real). El borrador INBOX que estábamos
      // por actualizar es un DUPLICADO de la misma conversación: antes se
      // quedaba como fila fantasma "Borrador" que la lista mostraba con el
      // mismo código (Adriana, 22-jul). Aplicamos el patch al contrato real y
      // borramos el borrador INBOX.
      redundantInboxDraftId = existing._id;
      existing = taken;
      patch.estado =
        fields.estado && rank(fields.estado) >= rank(taken.estado)
          ? fields.estado
          : taken.estado;
    }
  }

  await ctx.db.patch(existing._id, patch);

  if (redundantInboxDraftId && redundantInboxDraftId !== existing._id) {
    await ctx.db.delete(redundantInboxDraftId);
  }

  // Si actualizamos por CR y quedó un borrador INBOX huérfano de la misma
  // conversación, elimínalo.
  if (
    draftByConversation &&
    draftByConversation._id !== existing._id &&
    draftByConversation._id !== redundantInboxDraftId &&
    isAutoInboxContractNumber(draftByConversation.contractNumber)
  ) {
    const st = String(draftByConversation.estado ?? '').toLowerCase();
    if (st === 'borrador' || st === 'generado') {
      await ctx.db.delete(draftByConversation._id);
    }
  }

  if (shouldCommitContractCode(String(nextEstado))) {
    try {
      await ctx.runMutation(
        internal.adminContractSettings.commitContractCodeInternal,
        { code: String(patch.contractNumber ?? existing.contractNumber) },
      );
    } catch {
      /* contador opcional */
    }
  }

  await syncLeadFromContract();
}

export const upsert = mutation({
  args: {
    contractNumber: v.string(),
    propertyId: v.optional(v.id('properties')),
    propertyTitle: v.optional(v.string()),
    propertyLocation: v.optional(v.string()),
    clienteNombre: v.optional(v.string()),
    clienteCedula: v.optional(v.string()),
    clienteEmail: v.optional(v.string()),
    clienteTelefono: v.optional(v.string()),
    clienteTelefonoAdicional: v.optional(v.string()),
    clienteCiudad: v.optional(v.string()),
    clienteDireccion: v.optional(v.string()),
    firmanteNombre: v.optional(v.string()),
    firmanteCedula: v.optional(v.string()),
    valorTotal: v.optional(v.number()),
    fechaEntrada: v.optional(v.string()),
    fechaSalida: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    pdfFilename: v.optional(v.string()),
    confirmationPdfUrl: v.optional(v.string()),
    confirmationPdfFilename: v.optional(v.string()),
    estado: v.optional(v.string()),
    origen: v.optional(v.string()),
    bookingId: v.optional(v.id('bookings')),
    fillTokenId: v.optional(v.id('contractFillTokens')),
    draftJson: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await upsertContract(ctx, args as ContractFields);
    return { ok: true };
  },
});

/** Uso interno (sale links, etc.): mismo upsert sin exponer la API pública. */
export const upsertInternal = internalMutation({
  args: {
    contractNumber: v.string(),
    propertyId: v.optional(v.id('properties')),
    propertyTitle: v.optional(v.string()),
    propertyLocation: v.optional(v.string()),
    clienteNombre: v.optional(v.string()),
    clienteCedula: v.optional(v.string()),
    clienteEmail: v.optional(v.string()),
    clienteTelefono: v.optional(v.string()),
    clienteTelefonoAdicional: v.optional(v.string()),
    clienteCiudad: v.optional(v.string()),
    clienteDireccion: v.optional(v.string()),
    firmanteNombre: v.optional(v.string()),
    firmanteCedula: v.optional(v.string()),
    valorTotal: v.optional(v.number()),
    fechaEntrada: v.optional(v.string()),
    fechaSalida: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    pdfFilename: v.optional(v.string()),
    confirmationPdfUrl: v.optional(v.string()),
    confirmationPdfFilename: v.optional(v.string()),
    estado: v.optional(v.string()),
    origen: v.optional(v.string()),
    bookingId: v.optional(v.id('bookings')),
    fillTokenId: v.optional(v.id('contractFillTokens')),
    draftJson: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await upsertContract(ctx, args as ContractFields);
    return { ok: true };
  },
});

export const updateStatus = mutation({
  args: { contractNumber: v.string(), estado: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', args.contractNumber.trim()),
      )
      .first();
    if (!existing) return { ok: false };
    await ctx.db.patch(existing._id, {
      estado: args.estado,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** "YYYY-MM-DD" → ms epoch (mediodía, sin drift de zona). 0 si no parsea. */
function ymdToMs(value?: string): number {
  const raw = (value ?? '').trim();
  if (!raw) return 0;
  const ms = Date.parse(`${raw}T12:00:00-05:00`);
  return Number.isFinite(ms) ? ms : 0;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Contrato en forma de RESERVA, para "Confirmar pago".
 *
 * El buscador de Confirmar pago (api/bookings/by-contract) miraba solo en
 * `bookings` y en los borradores del generador de admin. Los contratos hechos
 * desde el INBOX viven únicamente en esta tabla, así que el asesor generaba el
 * contrato, lo veía en la lista y al buscarlo le decía "No se encontró una
 * reserva ni un borrador con ese contrato" (Adriana, 22-jul, contrato 2709).
 *
 * Los datos de la estadía salen de `draftJson`, que es el borrador completo
 * tal como lo llenó el asesor.
 */
export const getBookingLikeByContractNumber = query({
  args: { contractNumber: v.string() },
  handler: async (ctx, args) => {
    const raw = args.contractNumber.trim();
    if (!raw) return null;
    const normalized = normalizeContractLookupQueryConvex(raw);
    const keys = [...new Set([normalized, raw].filter((k) => k.length > 0))];

    let contract = null;
    for (const key of keys) {
      contract = await ctx.db
        .query('contracts')
        .withIndex('by_contract_number', (q) => q.eq('contractNumber', key))
        .first();
      if (contract) break;
    }
    if (!contract) return null;

    let draft: Record<string, unknown> = {};
    if (contract.draftJson) {
      try {
        const parsed = JSON.parse(contract.draftJson);
        if (parsed && typeof parsed === 'object') {
          draft = parsed as Record<string, unknown>;
        }
      } catch {
        // Borrador ilegible: se responde igual con los campos del contrato.
      }
    }

    const property = contract.propertyId
      ? await ctx.db.get(contract.propertyId)
      : null;
    const str = (value: unknown): string =>
      typeof value === 'string' ? value : '';

    return {
      _id: contract._id,
      /** Marca de origen: la UI avisa que viene de un contrato, no de reserva. */
      isContractRecord: true as const,
      propertyId: contract.propertyId,
      propertyTitle:
        contract.propertyTitle ||
        (property as { title?: string } | null)?.title ||
        '',
      propertyLocation:
        contract.propertyLocation ||
        (property as { location?: string } | null)?.location ||
        '',
      reference: contract.contractNumber,
      nombreCompleto: contract.clienteNombre ?? '',
      cedula: contract.clienteCedula ?? '',
      correo: contract.clienteEmail ?? '',
      celular: contract.clienteTelefono ?? '',
      celularAdicional: contract.clienteTelefonoAdicional ?? '',
      address: contract.clienteDireccion ?? '',
      city: contract.clienteCiudad ?? '',
      fechaEntrada: ymdToMs(contract.fechaEntrada),
      fechaSalida: ymdToMs(contract.fechaSalida),
      horaEntrada: str(draft.checkInTime) || undefined,
      horaSalida: str(draft.checkOutTime) || undefined,
      precioTotal: contract.valorTotal ?? num(draft.valorTotal),
      numeroPersonas: num(draft.guests) || 1,
      numeroNoches: num(draft.nights) || 1,
      numeroMascotas: num(draft.petCount),
      depositoMascotas: num(draft.petDeposit),
      depositoGarantia: num(draft.refundableDeposit),
      depositoAseo: num(draft.cleaningFee),
      estado: contract.estado,
      origen: contract.origen ?? '',
    };
  },
});

export const get = query({
  args: { contractNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', args.contractNumber.trim()),
      )
      .first();
  },
});

/** Detalle enriquecido: contrato + link de llenado + CR de reserva. */
export const getDetail = query({
  args: { contractNumber: v.string() },
  handler: async (ctx, args) => {
    const contract = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', args.contractNumber.trim()),
      )
      .first();
    if (!contract) return null;

    let fillToken: {
      _id: Id<'contractFillTokens'>;
      token: string;
      status: string;
      source?: string;
      filledData?: {
        nombre: string;
        cedula: string;
        email: string;
        telefono: string;
        direccion: string;
        ciudad?: string;
        cedulaPhotoUrls?: string[];
        filledAt: number;
      };
      propertyTitle?: string;
      propertyLocation?: string;
      fechaEntrada?: string;
      fechaSalida?: string;
      precioTotal?: number;
    } | null = null;

    // fillTokenId se guarda como texto (dato migrado); normaliza al id de la
    // tabla antes de resolver — si no resuelve, simplemente no hay fill token.
    const fillTokenDocId = contract.fillTokenId
      ? ctx.db.normalizeId('contractFillTokens', contract.fillTokenId)
      : null;
    if (fillTokenDocId) {
      const row = await ctx.db.get(fillTokenDocId);
      if (row) {
        fillToken = {
          _id: row._id,
          token: row.token,
          status: row.status,
          source: row.source,
          filledData: row.filledData,
          propertyTitle: row.propertyTitle,
          propertyLocation: row.propertyLocation,
          fechaEntrada: row.fechaEntrada,
          fechaSalida: row.fechaSalida,
          precioTotal: row.precioTotal,
        };
      }
    }

    let bookingReference: string | undefined;
    let bookingMultimedia: Array<{ name?: string; url?: string; type?: string }> | undefined;
    if (contract.bookingId) {
      const booking = await ctx.db.get(contract.bookingId);
      bookingReference = booking?.reference ?? undefined;
      bookingMultimedia = booking?.multimedia;
    }

    let pdfUrl = contract.pdfUrl;
    let pdfFilename = contract.pdfFilename;
    if (!pdfUrl) {
      const fromDraft = extractContractFromDraftJson(contract.draftJson);
      pdfUrl = fromDraft.url;
      pdfFilename = fromDraft.filename;
    }
    if (!pdfUrl && bookingMultimedia) {
      const fromBooking = extractContractPdfFromMultimedia(bookingMultimedia);
      pdfUrl = fromBooking?.url;
      pdfFilename = fromBooking
        ? `Contrato_${fromBooking.code}.pdf`
        : undefined;
    }

    let confirmationPdfUrl = contract.confirmationPdfUrl;
    let confirmationPdfFilename = contract.confirmationPdfFilename;
    if (!confirmationPdfUrl && bookingMultimedia) {
      const conf = extractConfirmationPdfFromMultimedia(bookingMultimedia);
      confirmationPdfUrl = conf?.url;
      confirmationPdfFilename = conf?.filename;
    }

    return {
      contract,
      fillToken,
      bookingReference,
      pdfUrl,
      pdfFilename,
      confirmationPdfUrl,
      confirmationPdfFilename,
      hasConfirmation: !!confirmationPdfUrl,
    };
  },
});

export const remove = mutation({
  args: { contractNumber: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', args.contractNumber.trim()),
      )
      .first();
    if (!existing) return { ok: false };
    await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

const CONTRATO_ORIGENES = new Set(['link', 'inbox', 'admin']);

export const list = query({
  args: {
    estado: v.optional(v.string()),
    origen: v.optional(v.string()),
    /** contrato = sin confirmación de pago; confirmacion = con PDF de confirmación */
    tipo: v.optional(v.string()),
    propertyId: v.optional(v.id('properties')),
    search: v.optional(v.string()),
    /** Código de reserva (CR) */
    cr: v.optional(v.string()),
    limit: v.optional(v.number()),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const page = Math.max(args.page ?? 1, 1);
    const search = (args.search ?? '').trim().toLowerCase();
    const cr = (args.cr ?? '').trim().toLowerCase();

    let all = await ctx.db
      .query('contracts')
      .withIndex('by_created')
      .order('desc')
      .take(5000);

    all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    const summaryCounts: Record<string, number> = {};
    for (const c of all) {
      summaryCounts[c.estado] = (summaryCounts[c.estado] ?? 0) + 1;
    }
    const summaryTotal = all.length;

    if (args.estado && args.estado !== 'todos') {
      all = all.filter((c) => c.estado === args.estado);
    } else {
      // "Todos" = contratos reales. Los borradores no van en el gestor (no
      // consumen numeración ni muestran acciones de PDF final).
      all = all.filter((c) => c.estado !== 'borrador');
    }
    if (args.origen) all = all.filter((c) => c.origen === args.origen);
    if (args.tipo === 'contrato') {
      all = all.filter((c) => !c.confirmationPdfUrl);
    } else if (args.tipo === 'confirmacion') {
      all = all.filter((c) => !!c.confirmationPdfUrl);
    }
    if (args.propertyId)
      all = all.filter((c) => c.propertyId === args.propertyId);
    if (cr) {
      const bookingIds = new Set<string>();
      const bookings = await ctx.db.query('bookings').take(5000);
      for (const b of bookings) {
        const ref = String(b.reference ?? '').trim().toLowerCase();
        if (ref && ref.includes(cr)) bookingIds.add(String(b._id));
      }
      all = all.filter((c) => {
        if (c.contractNumber.toLowerCase().includes(cr)) return true;
        if (c.bookingId && bookingIds.has(String(c.bookingId))) return true;
        return false;
      });
    }
    if (search) {
      all = all.filter(
        (c) =>
          c.contractNumber.toLowerCase().includes(search) ||
          (c.clienteNombre ?? '').toLowerCase().includes(search) ||
          (c.propertyTitle ?? '').toLowerCase().includes(search),
      );
    }

    // COLAPSA DUPLICADOS POR CR (Adriana, 22-jul): un mismo código puede tener
    // el contrato real y un borrador INBOX fantasma que la lista mostraba con
    // el mismo número. Se conserva el MÁS AVANZADO (mayor estado; a igualdad,
    // el que ya tiene PDF y el más reciente). Los "Sin CR" no se agrupan: son
    // contratos distintos que aún no tienen código.
    const dedupKey = (c: (typeof all)[number]): string | null => {
      const draftCode = extractDraftContractCode(c.draftJson);
      const code =
        (draftCode && !isAutoInboxContractNumber(draftCode) && draftCode) ||
        (!isAutoInboxContractNumber(c.contractNumber) && c.contractNumber) ||
        '';
      return code ? code.trim().toLowerCase() : null;
    };
    const mejorPorCr = new Map<string, (typeof all)[number]>();
    const deduped: typeof all = [];
    for (const c of all) {
      const key = dedupKey(c);
      if (!key) {
        deduped.push(c);
        continue;
      }
      const prev = mejorPorCr.get(key);
      if (!prev) {
        mejorPorCr.set(key, c);
        continue;
      }
      const gana =
        rank(c.estado) !== rank(prev.estado)
          ? rank(c.estado) > rank(prev.estado)
          : Number(Boolean(c.pdfUrl)) !== Number(Boolean(prev.pdfUrl))
            ? Boolean(c.pdfUrl)
            : (c.updatedAt ?? 0) > (prev.updatedAt ?? 0);
      if (gana) mejorPorCr.set(key, c);
    }
    all = [...deduped, ...mejorPorCr.values()].sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );

    const counts: Record<string, number> = {};
    for (const c of all) counts[c.estado] = (counts[c.estado] ?? 0) + 1;

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const pageItems = all.slice(offset, offset + limit);

    const bookingRefs = new Map<string, string>();
    const bookingIds = [
      ...new Set(
        pageItems
          .map((c) => c.bookingId)
          .filter((id): id is Id<'bookings'> => !!id),
      ),
    ];
    await Promise.all(
      bookingIds.map(async (id) => {
        const b = await ctx.db.get(id);
        const ref = String(b?.reference ?? '').trim();
        if (ref) bookingRefs.set(String(id), ref);
      }),
    );

    const items = pageItems.map((c) => {
      const bookingReference = c.bookingId
        ? bookingRefs.get(String(c.bookingId))
        : undefined;
      const draftContractCode = extractDraftContractCode(c.draftJson);
      const displayNumber = resolveContractDisplayNumber(c.contractNumber, {
        bookingReference,
        draftContractCode,
      });
      return {
        ...c,
        bookingReference,
        displayNumber,
      };
    });

    return {
      items,
      total,
      page: safePage,
      limit,
      totalPages,
      counts,
      summaryTotal,
      summaryCounts,
    };
  },
});

/**
 * Reconstruye la tabla `contracts` desde las fuentes históricas:
 * adminContractSnapshots (borradores), contractFillTokens (links) y bookings
 * (reservas con contrato). Idempotente: se puede correr varias veces.
 */
export const backfill = mutation({
  args: {},
  handler: async (ctx) => {
    let procesados = 0;

    // Cache de fincas para no re-leer la misma propiedad muchas veces.
    const propCache = new Map<
      string,
      { title?: string; location?: string } | null
    >();
    const getProp = async (id?: Id<'properties'> | null) => {
      if (!id) return null;
      const key = String(id);
      if (propCache.has(key)) return propCache.get(key) ?? null;
      const prop = (await ctx.db.get(id)) as {
        title?: string;
        location?: string;
      } | null;
      propCache.set(key, prop);
      return prop;
    };

    // 1) Borradores admin (Contratos y Confirmación) → generado.
    const snapshots = await ctx.db.query('adminContractSnapshots').collect();
    for (const s of snapshots) {
      const prop = await getProp(s.propertyId);
      const p = (s.payload ?? {}) as Record<string, any>;
      let pdfUrl: string | undefined;
      let pdfFilename: string | undefined;
      const links = p.multimediaLinks;
      if (Array.isArray(links)) {
        for (const m of links) {
          const url = String(m?.url ?? '').trim();
          if (url) {
            pdfUrl = url;
            pdfFilename = String(m?.name ?? '').trim() || undefined;
            break;
          }
        }
      }
      await upsertContract(ctx, {
        contractNumber: s.contractNumber,
        propertyId: s.propertyId,
        propertyTitle: prop?.title,
        propertyLocation: prop?.location,
        clienteNombre: p.nombreCompleto,
        clienteCedula: p.cedula,
        clienteEmail: p.correo,
        clienteTelefono: p.celular,
        valorTotal: Number(p.precioTotal) || undefined,
        fechaEntrada: p.fechaEntrada ? String(p.fechaEntrada) : undefined,
        fechaSalida: p.fechaSalida ? String(p.fechaSalida) : undefined,
        pdfUrl,
        pdfFilename,
        estado: 'generado',
        origen: 'admin',
        draftJson: JSON.stringify(p),
      });
      procesados++;
    }

    // 2) Links de contrato → enviado / completado / expirado.
    const tokens = await ctx.db.query('contractFillTokens').collect();
    for (const t of tokens) {
      let draft: Record<string, any> | null = null;
      if (t.contractDraftJson) {
        try {
          draft = JSON.parse(t.contractDraftJson);
        } catch {
          draft = null;
        }
      }
      const code = String(draft?.contractNumber ?? '').trim();
      if (!code) continue;
      const propId = (draft?.propertyId as Id<'properties'>) || undefined;
      const prop = await getProp(propId);
      const estado =
        t.status === 'filled'
          ? 'completado'
          : t.status === 'expired'
            ? 'expirado'
            : 'enviado';
      await upsertContract(ctx, {
        contractNumber: code,
        propertyId: propId,
        propertyTitle: prop?.title ?? t.propertyTitle,
        propertyLocation: prop?.location ?? t.propertyLocation,
        clienteNombre: t.filledData?.nombre,
        clienteCedula: t.filledData?.cedula,
        clienteEmail: t.filledData?.email,
        clienteTelefono: t.filledData?.telefono,
        clienteCiudad: t.filledData?.ciudad,
        clienteDireccion: t.filledData?.direccion,
        firmanteNombre: draft?.adminName,
        firmanteCedula: draft?.adminCedula,
        valorTotal: Number(draft?.contractTotal) || t.precioTotal || undefined,
        fechaEntrada: t.fechaEntrada,
        fechaSalida: t.fechaSalida,
        estado,
        origen: t.source === 'inbox' ? 'inbox' : 'link',
        fillTokenId: t._id,
        draftJson: t.contractDraftJson ?? undefined,
      });
      procesados++;
    }

    // 3) Reservas con contrato adjunto → pagado.
    const bookings = await ctx.db.query('bookings').order('desc').take(3000);
    for (const b of bookings) {
      const pdf = extractContractPdfFromMultimedia(b.multimedia);
      const confirmation = extractConfirmationPdfFromMultimedia(b.multimedia);
      const code = (pdf?.code || (b.reference ?? '').trim()).trim();
      if (!code) continue;
      const prop = await getProp(b.propertyId ?? undefined);
      await upsertContract(ctx, {
        contractNumber: code,
        propertyId: b.propertyId ?? undefined,
        propertyTitle: prop?.title,
        propertyLocation: prop?.location,
        clienteNombre: b.nombreCompleto,
        clienteCedula: b.cedula,
        clienteEmail: b.correo,
        clienteTelefono: b.celular,
        valorTotal: Number(b.precioTotal) || undefined,
        fechaEntrada: b.fechaEntrada ? String(b.fechaEntrada) : undefined,
        fechaSalida: b.fechaSalida ? String(b.fechaSalida) : undefined,
        pdfUrl: pdf?.url,
        pdfFilename: pdf ? `Contrato_${pdf.code}.pdf` : undefined,
        confirmationPdfUrl: confirmation?.url,
        confirmationPdfFilename: confirmation?.filename,
        estado: confirmation ? 'pagado' : 'generado',
        origen: confirmation ? 'confirmacion' : 'admin',
        bookingId: b._id,
      });
      procesados++;
    }

    return { ok: true, procesados };
  },
});
