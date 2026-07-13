/**
 * Herramienta "Contrato IA" del inbox: analiza una conversación de WhatsApp y
 * extrae los datos para prellenar un contrato (finca, fechas, personas, precio,
 * datos del cliente). Usa el LLM (gpt-4.1) vía lib/openai.
 */
import { v } from 'convex/values';
import { action, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { chatCompletion } from './lib/openai';

/** Contexto para la extracción: transcript, contacto y catálogo de fincas. */
export const getExtractionContext = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return null;

    const contact = await ctx.db.get(conv.contactId);

    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', conversationId),
      )
      .order('desc')
      .take(120);
    const ordered = recent
      .reverse()
      .filter((m) => !m.deletedAt && (m.type ?? 'text') === 'text');

    const messages = ordered.map((m) => ({
      fromAdvisor: Boolean(m.sentByUserId),
      content: m.content ?? '',
    }));

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
    const context = await ctx.runQuery(
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

    const system =
      'Eres un asistente que extrae los datos para un contrato de arriendo de ' +
      'finca a partir de una conversación de WhatsApp entre un ASESOR de FincasYa ' +
      'y un CLIENTE. Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin texto ' +
      'extra, sin markdown. Usa los datos del chat; si un dato no aparece, deja ' +
      'string vacío o 0. Fechas en formato YYYY-MM-DD. La fecha de hoy (Colombia) ' +
      `es ${today}. Interpreta fechas relativas ("este finde", "el 15") en el ` +
      'año correcto. Precios en números enteros COP (sin puntos ni símbolos). ' +
      'Para la finca, elige el título EXACTO del catálogo que mejor coincida con ' +
      'lo hablado; ponlo en "fincaGuess".\n\n' +
      'Esquema JSON:\n' +
      '{"fincaGuess": string, "contractCode": string, "checkIn": string, ' +
      '"checkOut": string, "guests": number, "pricePerNight": number, ' +
      '"total": number, "client": {"name": string, "cedula": string, ' +
      '"phone": string, "email": string, "city": string, "address": string}, ' +
      '"notes": string}';

    const user =
      `CATÁLOGO DE FINCAS:\n${catalog || '(sin catálogo)'}\n\n` +
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

    // Matchear la finca sugerida contra el catálogo real.
    const guess = String(parsed.fincaGuess ?? '').trim();
    let finca: { id: string; title: string } | null = null;
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

    const c: Partial<ContractExtraction['client']> = parsed.client ?? {};
    return {
      finca,
      fincaGuess: guess,
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
