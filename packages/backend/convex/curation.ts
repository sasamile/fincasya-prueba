/**
 * CAPA 2 — Pipeline de curacion del historico conversacional.
 *
 * "Aprender solo" con filtro automatico, sin curacion manual constante:
 *   1. Etiqueta cada conversacion:  venta (hubo reserva) | positiva (cierre
 *      agradecido, sin quejas) | problematica (quejas/errores) | neutra.
 *   2. Solo de las 'venta' y 'positiva' extrae pares cliente->respuesta como
 *      ejemplares. Las 'problematica' quedan marcadas y JAMAS se usan como
 *      ejemplo de como responder.
 *   3. Prioriza respuestas escritas por Expertoes humanos (sentByUserId) y
 *      descarta respuestas repetidas (bloques estaticos del bot viejo).
 *   4. `embedPending` calcula embeddings de lo nuevo (idempotente).
 *
 * Todo es idempotente (conversationLabels evita re-curar), asi que el cron
 * nocturno puede correrlo completo cada noche e ingiere solo lo nuevo.
 */
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { embedTexts } from './lib/openai';
import { FAQ_INITIAL_SEED } from './lib/faqSeed';
import { SITUATION_SEED } from './lib/situationSeed';

/**
 * Tipos de retorno explicitos: Convex exige anotarlos cuando una action
 * llama funciones declaradas en el MISMO archivo (referencia circular).
 */
type ConversationForCuration = {
  conversationId: Id<'conversations'>;
  contactId: string;
  phone: string;
  operationalState: string | null;
};

type CurationMessage = {
  sender: 'user' | 'assistant' | 'system';
  content: string;
  humanAuthored: boolean;
};

type ConversationMessages = {
  conversationId: string;
  messages: CurationMessage[];
};

const COMPLAINT_RE =
  /\b(queja|reclamo|reclamar|p[eé]sim\w*|horrible|terrible|estaf\w*|enga[ñn]\w*|demand\w*|abogado|devoluci[oó]n|reembolso|mal\s+servicio|muy\s+mal|decepcion\w*|indignad\w*|denunci\w*|no\s+me\s+respond\w*)\b/i;
const GRATITUDE_RE =
  /\b(gracias|perfecto|excelente|genial|muy\s+amable|buen[ií]simo|de\s+acuerdo|listo)\b|🙏|👍|❤️/i;
const MEDIA_PLACEHOLDER_RE = /^\[(imagen|nota de voz|video|documento)\]/i;

const MAX_PAIRS_VENTA = 4;
const MAX_PAIRS_POSITIVA = 2;

// ---------------------------------------------------------------------------
// Lecturas de apoyo
// ---------------------------------------------------------------------------

/** Conversaciones con telefono del contacto y si ya fueron curadas. */
export const listConversationsForCuration = internalQuery({
  args: {},
  handler: async (ctx): Promise<ConversationForCuration[]> => {
    const labeled = new Set(
      (await ctx.db.query('conversationLabels').collect()).map((l) =>
        String(l.conversationId),
      ),
    );
    const conversations = await ctx.db.query('conversations').collect();
    const out: ConversationForCuration[] = [];
    for (const c of conversations) {
      if (labeled.has(String(c._id))) continue;
      const contact = await ctx.db.get(c.contactId);
      out.push({
        conversationId: c._id,
        contactId: String(c.contactId),
        phone: contact?.phone ?? '',
        operationalState: c.operationalState ?? null,
      });
    }
    return out;
  },
});

/** Senales de venta: contactos y telefonos con reserva. */
export const getBookingSignals = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ contactIds: string[]; phones: string[] }> => {
    const bookings = await ctx.db.query('bookings').collect();
    const contactIds = new Set<string>();
    const phones = new Set<string>();
    for (const b of bookings) {
      if (b.status === 'CANCELLED') continue;
      if (b.userId) contactIds.add(String(b.userId));
      const digits = (b.celular ?? '').replace(/\D+/g, '');
      if (digits.length >= 10) phones.add(digits.slice(-10));
    }
    return { contactIds: [...contactIds], phones: [...phones] };
  },
});

export const getMessagesForConversations = internalQuery({
  args: { conversationIds: v.array(v.id('conversations')) },
  handler: async (ctx, { conversationIds }): Promise<ConversationMessages[]> => {
    const out: ConversationMessages[] = [];
    for (const id of conversationIds) {
      const docs = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', id))
        .collect();
      out.push({
        conversationId: String(id),
        messages: docs
          .filter((m) => !m.deletedAt)
          .map((m) => ({
            sender: m.sender,
            content: m.content,
            humanAuthored: Boolean(m.sentByUserId),
          })),
      });
    }
    return out;
  },
});

export const saveLabels = internalMutation({
  args: {
    items: v.array(
      v.object({
        conversationId: v.id('conversations'),
        label: v.union(
          v.literal('venta'),
          v.literal('positiva'),
          v.literal('neutra'),
          v.literal('problematica'),
        ),
        reasons: v.array(v.string()),
        messageCount: v.number(),
        exemplarsCreated: v.number(),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    const now = Date.now();
    for (const item of items) {
      await ctx.db.insert('conversationLabels', { ...item, createdAt: now });
    }
  },
});

/** Claves de playbook ya importadas a exemplars (idempotencia). */
export const listPlaybookForImport = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      key: string;
      situation: string;
      clientExamples: string[];
      response: string;
    }>
  > => {
    const playbook = await ctx.db.query('playbookExemplars').collect();
    const existing = new Set<string>();
    for (const e of await ctx.db.query('exemplars').collect()) {
      if (e.source === 'playbook' && e.sourceConversationId) {
        existing.add(e.sourceConversationId);
      }
    }
    return playbook
      .filter((p) => p.enabled && !existing.has(`playbook:${p.key}`))
      .map((p) => ({
        key: p.key,
        situation: p.situation,
        clientExamples: p.clientExamples,
        response: p.response,
      }));
  },
});

/** FAQs oficiales (faqSeed.ts) que aun no estan en exemplars (idempotencia). */
export const listFaqsForImport = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<{ key: string; title: string; text: string }>> => {
    const existing = new Set<string>();
    for (const e of await ctx.db.query('exemplars').collect()) {
      if (e.source === 'faq' && e.sourceConversationId) {
        existing.add(e.sourceConversationId);
      }
    }
    return FAQ_INITIAL_SEED.filter((f) => !existing.has(f.key));
  },
});

/** Mensajes situacionales (situationSeed.ts) pendientes de importar. */
export const listSituationsForImport = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      key: string;
      situation: string;
      clientExamples: string[];
      response: string;
    }>
  > => {
    const existing = new Set<string>();
    for (const e of await ctx.db.query('exemplars').collect()) {
      if (e.source === 'situacion' && e.sourceConversationId) {
        existing.add(e.sourceConversationId);
      }
    }
    return SITUATION_SEED.filter((s) => !existing.has(s.key));
  },
});

// ---------------------------------------------------------------------------
// Curacion
// ---------------------------------------------------------------------------

type Label = 'venta' | 'positiva' | 'neutra' | 'problematica';

function labelConversation(args: {
  hasBooking: boolean;
  messages: Array<{ sender: string; content: string }>;
}): { label: Label; reasons: string[] } {
  const reasons: string[] = [];
  const userMsgs = args.messages.filter((m) => m.sender === 'user');
  const hasComplaint = userMsgs.some((m) => COMPLAINT_RE.test(m.content));
  if (hasComplaint) {
    return { label: 'problematica', reasons: ['queja detectada en mensajes del cliente'] };
  }
  if (args.hasBooking) {
    reasons.push('contacto con reserva no cancelada');
    return { label: 'venta', reasons };
  }
  const lastUser = [...userMsgs].reverse()[0];
  if (lastUser && GRATITUDE_RE.test(lastUser.content)) {
    reasons.push('cierre con agradecimiento y sin quejas');
    return { label: 'positiva', reasons };
  }
  return { label: 'neutra', reasons: ['sin senal de venta ni cierre positivo'] };
}

function extractPairs(
  messages: Array<{ sender: string; content: string; humanAuthored: boolean }>,
  maxPairs: number,
  seenResponses: Set<string>,
): Array<{ clientMessage: string; response: string; humanAuthored: boolean }> {
  const candidates: Array<{
    clientMessage: string;
    response: string;
    humanAuthored: boolean;
  }> = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const userMsg = messages[i];
    if (userMsg.sender !== 'user') continue;
    // siguiente mensaje no-system
    let j = i + 1;
    while (j < messages.length && messages[j].sender === 'system') j++;
    const reply = messages[j];
    if (!reply || reply.sender !== 'assistant') continue;
    const q = userMsg.content.trim();
    const a = reply.content.trim();
    if (q.length < 8 || q.length > 400) continue;
    if (a.length < 30 || a.length > 900) continue;
    if (MEDIA_PLACEHOLDER_RE.test(q) || MEDIA_PLACEHOLDER_RE.test(a)) continue;
    if (a.includes('[CONTRACT_PDF')) continue;
    const norm = a.toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
    if (seenResponses.has(norm)) continue; // bloque estatico repetido
    seenResponses.add(norm);
    candidates.push({ clientMessage: q, response: a, humanAuthored: reply.humanAuthored });
  }
  // humanos primero (mejor senal de calidad), luego el resto
  candidates.sort((x, y) => Number(y.humanAuthored) - Number(x.humanAuthored));
  return candidates.slice(0, maxPairs);
}

export const curateHistory = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    conversacionesNuevasCuradas: number;
    stats: Record<Label, number>;
    exemplarsTotal: number;
  }> => {
    const [pending, signals] = await Promise.all([
      ctx.runQuery(internal.curation.listConversationsForCuration, {}),
      ctx.runQuery(internal.curation.getBookingSignals, {}),
    ]);
    const bookingContacts = new Set(signals.contactIds);
    const bookingPhones = new Set(signals.phones);

    const stats: Record<Label, number> = {
      venta: 0,
      positiva: 0,
      neutra: 0,
      problematica: 0,
    };
    let exemplarsTotal = 0;
    const seenResponses = new Set<string>();

    const BATCH = 40;
    for (let offset = 0; offset < pending.length; offset += BATCH) {
      const batch = pending.slice(offset, offset + BATCH);
      const withMessages: ConversationMessages[] = await ctx.runQuery(
        internal.curation.getMessagesForConversations,
        {
          conversationIds: batch.map(
            (c: ConversationForCuration) => c.conversationId,
          ),
        },
      );
      const messagesByConv = new Map<string, CurationMessage[]>(
        withMessages.map((w: ConversationMessages) => [
          w.conversationId,
          w.messages,
        ]),
      );

      const labels: Array<{
        conversationId: Id<'conversations'>;
        label: Label;
        reasons: string[];
        messageCount: number;
        exemplarsCreated: number;
      }> = [];
      const exemplars: Array<{
        clientMessage: string;
        response: string;
        situation?: string;
        quality: string;
        source: string;
        humanAuthored: boolean;
        sourceConversationId?: string;
      }> = [];

      for (const conv of batch) {
        const messages: CurationMessage[] =
          messagesByConv.get(String(conv.conversationId)) ?? [];
        const phone10 = conv.phone.replace(/\D+/g, '').slice(-10);
        const hasBooking =
          bookingContacts.has(conv.contactId) ||
          (phone10.length === 10 && bookingPhones.has(phone10));
        const { label, reasons } = labelConversation({ hasBooking, messages });
        stats[label]++;

        let created = 0;
        if (label === 'venta' || label === 'positiva') {
          const pairs = extractPairs(
            messages,
            label === 'venta' ? MAX_PAIRS_VENTA : MAX_PAIRS_POSITIVA,
            seenResponses,
          );
          for (const pair of pairs) {
            exemplars.push({
              clientMessage: pair.clientMessage,
              response: pair.response,
              situation: conv.operationalState
                ? `Estado del deal: ${conv.operationalState}`
                : undefined,
              quality: label,
              source: 'historico',
              humanAuthored: pair.humanAuthored,
              sourceConversationId: String(conv.conversationId),
            });
            created++;
          }
        }
        exemplarsTotal += created;
        labels.push({
          conversationId: conv.conversationId,
          label,
          reasons,
          messageCount: messages.length,
          exemplarsCreated: created,
        });
      }

      if (exemplars.length > 0) {
        await ctx.runMutation(internal.exemplars.insertBatch, { items: exemplars });
      }
      await ctx.runMutation(internal.curation.saveLabels, { items: labels });
    }

    // Playbook del equipo (35 plantillas curadas a mano): oro directo al RAG.
    const playbook: Array<{
      key: string;
      situation: string;
      clientExamples: string[];
      response: string;
    }> = await ctx.runQuery(internal.curation.listPlaybookForImport, {});
    if (playbook.length > 0) {
      const items = playbook.map((p) => ({
        clientMessage:
          p.clientExamples.length > 0 ? p.clientExamples.join(' | ') : p.situation,
        response: p.response,
        situation: p.situation,
        quality: 'playbook',
        source: 'playbook',
        humanAuthored: true,
        sourceConversationId: `playbook:${p.key}`,
      }));
      await ctx.runMutation(internal.exemplars.insertBatch, { items });
      exemplarsTotal += items.length;
    }

    // FAQs oficiales del equipo: entran al RAG como CONTEXTO. Los datos
    // (tarifas, proceso de reserva, horarios) son exactos; la redaccion la
    // adapta la IA al hilo (regla en prompts.ts). UPSERT: si el copy cambio
    // en el codigo (ej. migracion a usted), se actualiza y se re-embebe.
    const faqItems = FAQ_INITIAL_SEED.map((f) => ({
      clientMessage: f.title,
      response: f.text,
      situation: `FAQ oficial: ${f.title}`,
      quality: 'faq',
      source: 'faq',
      humanAuthored: true,
      sourceConversationId: f.key,
    }));
    const faqsChanged: number = await ctx.runMutation(
      internal.exemplars.upsertByKey,
      { items: faqItems },
    );
    exemplarsTotal += faqsChanged;

    // Mensajes situacionales del flujo del equipo (contrato, temporadas
    // especiales, intro/cierre de catalogo, transiciones). UPSERT: si el
    // copy cambio en el codigo, se actualiza y se re-embebe.
    const situationItems = SITUATION_SEED.map((s) => ({
      clientMessage:
        s.clientExamples.length > 0 ? s.clientExamples.join(' | ') : s.situation,
      response: s.response,
      situation: s.situation,
      quality: 'situacion',
      source: 'situacion',
      humanAuthored: true,
      sourceConversationId: s.key,
    }));
    const situationsChanged: number = await ctx.runMutation(
      internal.exemplars.upsertByKey,
      { items: situationItems },
    );
    exemplarsTotal += situationsChanged;

    console.log('[curation] terminado', { stats, exemplarsTotal });
    return { conversacionesNuevasCuradas: pending.length, stats, exemplarsTotal };
  },
});

/** Calcula embeddings de los ejemplares pendientes (idempotente, por lotes). */
export const embedPending = internalAction({
  args: {},
  handler: async (ctx): Promise<{ embedded: number }> => {
    let total = 0;
    for (;;) {
      const pending: Array<{
        _id: Id<'exemplars'>;
        clientMessage: string;
        situation?: string;
      }> = await ctx.runQuery(internal.exemplars.listUnembedded, {
        limit: 100,
      });
      if (pending.length === 0) break;
      const embeddings = await embedTexts(pending.map((p) => p.clientMessage));
      await ctx.runMutation(internal.exemplars.saveEmbeddings, {
        items: pending.map((p, i) => ({ id: p._id, embedding: embeddings[i] })),
      });
      total += pending.length;
    }
    console.log('[curation] embeddings calculados', { total });
    return { embedded: total };
  },
});

/** Cron nocturno: cura lo nuevo del dia y reindexa. */
export const nightly = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    await ctx.runAction(internal.curation.curateHistory, {});
    await ctx.runAction(internal.curation.embedPending, {});
  },
});
