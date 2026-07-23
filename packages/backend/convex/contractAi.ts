/**
 * Herramienta "Contrato IA" del inbox: analiza una conversación de WhatsApp y
 * extrae los datos para prellenar un contrato (finca, fechas, personas, precio,
 * datos del cliente). Usa el LLM (gpt-4.1) vía lib/openai.
 *
 * REGLA DURA: si el cliente seleccionó/respondió a una ficha del catálogo,
 * ESA finca gana siempre — aunque antes haya escrito otro nombre (ej. "Tramontini").
 */
import { v } from 'convex/values';
import { action, internalQuery } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { chatCompletion } from './lib/openai';

type FincaRef = { id: string; title: string };

/** Contexto para la extracción: transcript, contacto y catálogo de fincas. */
type ExtractionContext = {
  contact: {
    name: string;
    phone: string;
    cedula: string;
    email: string;
    city: string;
  };
  messages: Array<{ fromAdvisor: boolean; content: string }>;
  fincas: Array<{
    id: string;
    title: string;
    code: string;
    location: string;
    capacity: number;
    priceBase: number;
  }>;
  /**
   * Finca elegida vía catálogo WhatsApp (tap / reply a ficha / order).
   * Si está presente, el prefill DEBE usarla (prioridad sobre texto libre).
   */
  catalogSelectedFinca: FincaRef | null;
};

async function propertyFromRetailerId(
  ctx: QueryCtx,
  retailerId: string,
): Promise<FincaRef | null> {
  const rid = retailerId.trim();
  if (!rid) return null;
  const mapping = await ctx.db
    .query('propertyWhatsAppCatalog')
    .withIndex('by_retailer', (q) => q.eq('productRetailerId', rid))
    .first();
  if (mapping) {
    const prop = await ctx.db.get(mapping.propertyId);
    if (prop?.title) return { id: String(prop._id), title: prop.title };
  }
  // A veces el retailerId es el _id de la finca.
  try {
    const prop = await ctx.db.get(rid as Id<'properties'>);
    if (prop?.title) return { id: String(prop._id), title: prop.title };
  } catch {
    /* id inválido */
  }
  return null;
}

function retailerFromMeta(
  meta: { productRetailerId?: string } | null | undefined,
): string {
  return String(meta?.productRetailerId ?? '').trim();
}

function retailerFromContent(content: string): string {
  const m = content.match(/product_retailer_id:\s*([^\s)\n]+)/i);
  return m?.[1]?.trim() ?? '';
}

/**
 * Resuelve la finca del catálogo que el cliente eligió (más reciente gana).
 * Fuentes: metadata.productRetailerId, reply a ficha, lastReferredRetailerId.
 */
async function resolveCatalogSelectedFinca(
  ctx: QueryCtx,
  conversation: Doc<'conversations'>,
  ordered: Doc<'messages'>[],
): Promise<FincaRef | null> {
  const byWamid = new Map<string, Doc<'messages'>>();
  for (const m of ordered) {
    if (m.wamid) byWamid.set(m.wamid, m);
  }

  // Del más reciente al más viejo: primera referencia a catálogo gana.
  for (let i = ordered.length - 1; i >= 0; i--) {
    const m = ordered[i]!;
    if (m.deletedAt) continue;

    let rid = retailerFromMeta(
      m.metadata as { productRetailerId?: string } | null,
    );
    if (!rid) rid = retailerFromContent(m.content ?? '');

    // Reply a una ficha ("Este me gusta" citando el producto).
    if (!rid && m.sender === 'user' && m.replyToWamid) {
      const parent = byWamid.get(m.replyToWamid);
      if (parent) {
        rid =
          retailerFromMeta(
            parent.metadata as { productRetailerId?: string } | null,
          ) || retailerFromContent(parent.content ?? '');
      }
    }

    if (!rid) continue;
    const finca = await propertyFromRetailerId(ctx, rid);
    if (finca) return finca;
  }

  const sticky = conversation.lastReferredRetailerId?.trim();
  if (sticky) return await propertyFromRetailerId(ctx, sticky);
  return null;
}

export const getExtractionContext = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<ExtractionContext | null> => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return null;

    const contact = await ctx.db.get(conv.contactId);

    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', conversationId),
      )
      .order('desc')
      .take(160);
    const ordered = recent.reverse().filter((m) => !m.deletedAt);

    const catalogSelectedFinca = await resolveCatalogSelectedFinca(
      ctx,
      conv,
      ordered,
    );

    // Transcript: texto + fichas de catálogo (para que la IA vea la elección).
    const messages = ordered
      .filter((m) => {
        const t = m.type ?? 'text';
        return t === 'text' || t === 'product';
      })
      .map((m) => {
        const isAdvisor = Boolean(m.sentByUserId) || m.sender === 'assistant';
        let content = m.content ?? '';
        if ((m.type ?? 'text') === 'product') {
          content = content || '🏡 Ficha de catálogo';
        }
        return { fromAdvisor: isAdvisor, content };
      })
      .filter((m) => m.content.trim().length > 0);

    const properties = await ctx.db.query('properties').collect();
    const fincas = properties
      .filter((p) => p.title)
      .map((p) => ({
        id: String(p._id),
        title: p.title,
        code: p.code ?? '',
        location: p.location ?? '',
        capacity: p.capacity ?? 0,
        priceBase: p.priceBase ?? 0,
      }));

    return {
      contact: contact
        ? {
            name: contact.name ?? '',
            phone: contact.phone ?? '',
            cedula: (contact as { cedula?: string }).cedula ?? '',
            email: contact.email ?? '',
            city: (contact as { city?: string }).city ?? '',
          }
        : { name: '', phone: '', cedula: '', email: '', city: '' },
      messages,
      fincas,
      catalogSelectedFinca,
    };
  },
});

function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .toLowerCase()
    .trim();
}

export type ContractExtraction = {
  finca: { id: string; title: string } | null;
  fincaGuess: string;
  contractCode: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pricePerNight: number;
  total: number;
  client: {
    name: string;
    cedula: string;
    phone: string;
    email: string;
    city: string;
    address: string;
  };
  notes: string;
};

export const extractFromConversation = action({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<ContractExtraction> => {
    const context: ExtractionContext | null = await ctx.runQuery(
      internal.contractAi.getExtractionContext,
      { conversationId },
    );
    if (!context) throw new Error('Conversación no encontrada.');

    const transcript = context.messages
      .map((m) => `${m.fromAdvisor ? 'ASESOR' : 'CLIENTE'}: ${m.content}`)
      .join('\n')
      .slice(0, 12000);

    const catalog = context.fincas
      .map((f) => `- ${f.title}${f.code ? ` (código ${f.code})` : ''} · ${f.location} · cap ${f.capacity}`)
      .join('\n')
      .slice(0, 6000);

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
    }).format(new Date());

    const catalogPickHint = context.catalogSelectedFinca
      ? `\n\nSELECCIÓN DEL CATÁLOGO (PRIORIDAD MÁXIMA): el cliente ya eligió la finca «${context.catalogSelectedFinca.title}» tocando/respondiendo una ficha. ` +
        `Usa EXACTAMENTE ese título en fincaGuess. Ignora nombres de finca escritos antes en texto libre (ej. "Tramontini") si contradicen esta selección.`
      : '';

    const system =
      'Eres un asistente que extrae los datos para un contrato de arriendo de ' +
      'finca a partir de una conversación de WhatsApp entre un ASESOR de FincasYa ' +
      'y un CLIENTE. Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin texto ' +
      'extra, sin markdown. Usa los datos del chat; si un dato no aparece, deja ' +
      'string vacío o 0. Fechas en formato YYYY-MM-DD. La fecha de hoy (Colombia) ' +
      `es ${today}. Interpreta fechas relativas ("este finde", "el 15") en el ` +
      'año correcto. Precios en números enteros COP (sin puntos ni símbolos). ' +
      'Para la finca, elige el título EXACTO del catálogo que mejor coincida. ' +
      'REGLA: si el cliente respondió a una ficha ("Este me gusta", "esa", "me ' +
      'interesa") o hay SELECCIÓN DEL CATÁLOGO, esa finca gana siempre sobre ' +
      'cualquier nombre escrito antes en texto libre.\n\n' +
      'Esquema JSON:\n' +
      '{"fincaGuess": string, "contractCode": string, "checkIn": string, ' +
      '"checkOut": string, "guests": number, "pricePerNight": number, ' +
      '"total": number, "client": {"name": string, "cedula": string, ' +
      '"phone": string, "email": string, "city": string, "address": string}, ' +
      '"notes": string}';

    const user =
      `CATÁLOGO DE FINCAS:\n${catalog || '(sin catálogo)'}` +
      `${catalogPickHint}\n\n` +
      `DATOS DEL CONTACTO (WhatsApp): nombre="${context.contact.name}" ` +
      `tel="${context.contact.phone}" cedula="${context.contact.cedula}" ` +
      `correo="${context.contact.email}" ciudad="${context.contact.city}"\n\n` +
      `CONVERSACIÓN:\n${transcript || '(sin mensajes)'}`;

    const { content } = await chatCompletion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
    });

    let parsed: Partial<ContractExtraction> & {
      client?: Partial<ContractExtraction['client']>;
    } = {};
    try {
      const jsonText =
        content?.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim() ??
        '{}';
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = {};
    }

    // Matchear la finca sugerida por el LLM contra el catálogo real.
    const guess = String(parsed.fincaGuess ?? '').trim();
    let finca: FincaRef | null = null;
    if (guess) {
      const g = normalize(guess);
      const match =
        context.fincas.find((f) => normalize(f.title) === g) ??
        context.fincas.find(
          (f) => normalize(f.title).includes(g) || g.includes(normalize(f.title)),
        ) ??
        context.fincas.find((f) => f.code && normalize(f.code) === g);
      if (match) finca = { id: match.id, title: match.title };
    }

    // PRIORIDAD DURA: selección del catálogo siempre gana (aunque el LLM
    // prefiera un nombre escrito antes, ej. "Tramontini").
    let fincaGuessOut = guess;
    if (context.catalogSelectedFinca) {
      finca = context.catalogSelectedFinca;
      fincaGuessOut = context.catalogSelectedFinca.title;
    }

    const c: Partial<ContractExtraction['client']> = parsed.client ?? {};
    return {
      finca,
      fincaGuess: fincaGuessOut,
      contractCode: String(parsed.contractCode ?? '').trim(),
      checkIn: String(parsed.checkIn ?? '').trim(),
      checkOut: String(parsed.checkOut ?? '').trim(),
      guests: Number(parsed.guests) || 0,
      pricePerNight: Number(parsed.pricePerNight) || 0,
      total: Number(parsed.total) || 0,
      client: {
        name: String(c.name ?? context.contact.name ?? '').trim(),
        cedula: String(c.cedula ?? context.contact.cedula ?? '').trim(),
        phone: String(c.phone ?? context.contact.phone ?? '').trim(),
        email: String(c.email ?? context.contact.email ?? '').trim(),
        city: String(c.city ?? context.contact.city ?? '').trim(),
        address: String(c.address ?? '').trim(),
      },
      notes: String(parsed.notes ?? '').trim(),
    };
  },
});
