/**
 * CAPA 4 — Orquestador del agente + CAPA 1 (tools de fuente de verdad).
 *
 * Flujo por turno: mensaje entrante (http.ts) -> runAgentTurn:
 *   1. contexto de la conversacion (historial + contacto)
 *   2. RAG: embedding del mensaje -> ejemplares curados mas parecidos (capa 2)
 *   3. system prompt con identidad + politicas + ejemplos (capa 3)
 *   4. LLM con tools; las tools consultan la base en tiempo real (capa 1)
 *   5. guarda la respuesta y la envia por YCloud
 */
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import {
  chatCompletion,
  embedTexts,
  type ChatMessage,
  type ToolDef,
} from './lib/openai';
import { buildSystemPrompt } from './lib/prompts';
import {
  buildWelcomeMessage,
  DATOS_CONTRATO,
  isPureGreeting,
  PROCESO_RESERVA,
  respectfulGreetingName,
} from './lib/copys';
import { detectPriceLoopEscalation, isPriceDeflection, isPriceQuestion } from './lib/agentEscalation';
import { sendWhatsappText } from './lib/ycloud';
import {
  formatCop,
  MAX_CATALOG_CANDIDATES,
  sendCatalogCards,
} from './lib/catalogSend';

const HISTORY_LIMIT = 24;
const MAX_TOOL_ROUNDS = 4;

/**
 * Tipos de retorno explicitos: Convex exige anotarlos cuando una action
 * llama funciones declaradas en el MISMO archivo (referencia circular).
 */
type AgentContext = {
  status: 'ai' | 'human' | 'resolved';
  contactPhone: string;
  contactName: string;
  history: Array<{ sender: 'user' | 'assistant'; content: string }>;
  lastUserMessageId: Id<'messages'> | null;
  catalogSent: boolean;
};

type FincaResult = {
  finca: string;
  codigo: string | null;
  ubicacion: string;
  capacidad: number;
  capacidadEvento: number | null;
  categoria: string;
  precioTemporadaBaja: number;
  precioTemporadaMedia: number;
  precioTemporadaAlta: number;
  rating: number | null;
};

type DisponibilidadResult =
  | { encontrada: false }
  | { encontrada: true; finca: string; disponible: boolean };

type CatalogPickResult =
  | { ok: false; motivo: string }
  | {
      ok: true;
      catalogMetaId: string;
      items: Array<{
        propertyId: string;
        retailerId: string;
        title: string;
        bodyText: string;
      }>;
    };

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

export const getAgentContext = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<AgentContext | null> => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(HISTORY_LIMIT);
    const ordered = recent.reverse();
    const history: AgentContext['history'] = [];
    let lastUserMessageId: Id<'messages'> | null = null;
    for (const m of ordered) {
      if (m.sender === 'user' && !m.deletedAt) lastUserMessageId = m._id;
      if (m.sender === 'system' || m.deletedAt || !m.content.trim()) continue;
      history.push({ sender: m.sender, content: m.content });
    }
    return {
      status: conversation.status,
      contactPhone: contact?.phone ?? '',
      contactName: contact?.baseName ?? contact?.name ?? '',
      history,
      lastUserMessageId,
      catalogSent: (conversation.lastSentCatalogPropertyIds?.length ?? 0) > 0,
    };
  },
});

/** Ultimo mensaje del cliente (para re-verificar tras generar la respuesta). */
export const getLastUserMessageId = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<string | null> => {
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(10);
    for (const m of recent) {
      if (m.sender === 'user' && !m.deletedAt) return String(m._id);
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// CAPA 1 — tools sobre la fuente de verdad (consultas en tiempo real)
// ---------------------------------------------------------------------------

export const toolBuscarFincas = internalQuery({
  args: {
    personas: v.optional(v.number()),
    zona: v.optional(v.string()),
  },
  handler: async (ctx, { personas, zona }): Promise<FincaResult[]> => {
    const all = await ctx.db.query('properties').collect();
    const zonaLower = zona?.toLowerCase();
    const matches = all
      .filter((p) => (personas ? (p.eventCapacity ?? p.capacity) >= personas : true))
      .filter((p) =>
        zonaLower
          ? p.location.toLowerCase().includes(zonaLower) ||
            (p.departamentos ?? []).some((d) => d.toLowerCase().includes(zonaLower))
          : true,
      )
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8);
    return matches.map((p) => ({
      finca: p.title,
      codigo: p.code ?? null,
      ubicacion: p.location,
      capacidad: p.capacity,
      capacidadEvento: p.eventCapacity ?? null,
      categoria: p.category,
      precioTemporadaBaja: p.priceBaja,
      precioTemporadaMedia: p.priceMedia,
      precioTemporadaAlta: p.priceAlta,
      rating: p.rating ?? null,
    }));
  },
});

export const toolDisponibilidad = internalQuery({
  args: {
    finca: v.string(),
    /** ms epoch */
    fechaEntrada: v.number(),
    fechaSalida: v.number(),
  },
  handler: async (
    ctx,
    { finca, fechaEntrada, fechaSalida },
  ): Promise<DisponibilidadResult> => {
    const all = await ctx.db.query('properties').collect();
    const fincaLower = finca.toLowerCase();
    const property = all.find(
      (p) =>
        p.title.toLowerCase().includes(fincaLower) ||
        (p.code ?? '').toLowerCase() === fincaLower,
    );
    if (!property) return { encontrada: false as const };
    const blocks = await ctx.db
      .query('propertyAvailability')
      .withIndex('by_property', (q) => q.eq('propertyId', property._id))
      .collect();
    const overlap = blocks.some(
      (b) => b.fechaEntrada < fechaSalida && b.fechaSalida > fechaEntrada,
    );
    return {
      encontrada: true as const,
      finca: property.title,
      disponible: !overlap,
    };
  },
});

/**
 * Techo de capacidad a recomendar (politica del equipo, portada del bot
 * anterior): evita ofrecer fincas gigantes a grupos pequenos.
 * cupo ≤6 → +4 · ≤15 → +6 · ≤25 → +8 · >25 → +10.
 */
function capacityCeilForCupo(cupo: number): number {
  if (cupo <= 6) return cupo + 4;
  if (cupo <= 15) return cupo + 6;
  if (cupo <= 25) return cupo + 8;
  return cupo + 10;
}

/** Techo RELAJADO (pasada intermedia cuando el rango estricto da pocas). */
function capacityCeilRelaxedForCupo(cupo: number): number {
  if (cupo <= 6) return cupo + 6;
  if (cupo <= 15) return cupo + 10;
  if (cupo <= 25) return Math.ceil(cupo * 1.7);
  return Math.ceil(cupo * 1.5);
}

/**
 * Selecciona fincas para el catalogo con las REGLAS DEL EQUIPO (portadas de
 * fincasya-new/convex/whatsappCatalogs.ts):
 *   - min: capacity >= cupo; techo estricto (capacityCeilForCupo) y, si hay
 *     pocas, pasada relajada — nunca fincas absurdamente grandes.
 *   - Orden por tiers: municipio exacto primero (si dio zona) → FAVORITAS
 *     (isFavorite) → proximidad al cupo (5 → 5,6,7,8...) → precio asc.
 *   - Sin zona: se intercalan municipios distintos (variedad de favoritas).
 *   - Excluye las ya enviadas (paginacion "otras opciones") y las no
 *     visibles en el catalogo WhatsApp.
 */
export const toolCatalogPick = internalQuery({
  args: {
    conversationId: v.id('conversations'),
    personas: v.optional(v.number()),
    zona: v.optional(v.string()),
    mascotas: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { conversationId, personas, zona, mascotas },
  ): Promise<CatalogPickResult> => {
    const conversation = await ctx.db.get(conversationId);
    const exclude = new Set(
      (conversation?.lastSentCatalogPropertyIds ?? []).map(String),
    );
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    if (!catalog) return { ok: false, motivo: 'no hay catalogo WhatsApp configurado' };

    const all = await ctx.db.query('properties').collect();
    const zonaLower = zona?.trim().toLowerCase() || undefined;

    const base = all
      .filter((p) => !exclude.has(String(p._id)))
      .filter((p) => p.visible !== false && p.visibleInWhatsAppCatalog !== false)
      .filter((p) =>
        zonaLower
          ? p.location.toLowerCase().includes(zonaLower) ||
            (p.departamentos ?? []).some((d) => d.toLowerCase().includes(zonaLower))
          : true,
      )
      .filter((p) => (mascotas ? p.allowsPets === true : true));

    // Pasadas de capacidad: estricta → relajada → solo minimo.
    let matches = base;
    if (personas && personas > 0) {
      // Minimo por capacidad de HOSPEDAJE (el cupo de evento solo aplicaria
      // si supieramos que es evento; el bot viejo hace lo mismo).
      const min = (p: (typeof all)[number]) => p.capacity >= personas;
      const strict = base.filter(
        (p) => min(p) && p.capacity <= capacityCeilForCupo(personas),
      );
      const relaxed = base.filter(
        (p) => min(p) && p.capacity <= capacityCeilRelaxedForCupo(personas),
      );
      const minOnly = base.filter(min);
      matches = strict.length >= 6 ? strict : relaxed.length >= 4 ? relaxed : minOnly;
    }

    // Orden por tiers (politica comercial del equipo).
    matches = [...matches].sort((a, b) => {
      if (zonaLower) {
        const aExact = a.location.toLowerCase().includes(zonaLower) ? 0 : 1;
        const bExact = b.location.toLowerCase().includes(zonaLower) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
      }
      const aFav = a.isFavorite === true ? 0 : 1;
      const bFav = b.isFavorite === true ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      if (personas && personas > 0) {
        const aDist = Math.abs(a.capacity - personas);
        const bDist = Math.abs(b.capacity - personas);
        if (aDist !== bDist) return aDist - bDist;
      }
      return (a.priceBase ?? 0) - (b.priceBase ?? 0);
    });

    // Sin zona: intercalar municipios (variedad — favoritas de varios sitios).
    if (!zonaLower) {
      const byTown = new Map<string, typeof matches>();
      for (const p of matches) {
        const town = p.location.toLowerCase();
        const bucket = byTown.get(town) ?? [];
        bucket.push(p);
        byTown.set(town, bucket);
      }
      const interleaved: typeof matches = [];
      let added = true;
      while (added) {
        added = false;
        for (const bucket of byTown.values()) {
          const next = bucket.shift();
          if (next) {
            interleaved.push(next);
            added = true;
          }
        }
      }
      matches = interleaved;
    }

    const items: Extract<CatalogPickResult, { ok: true }>['items'] = [];
    for (const p of matches) {
      if (items.length >= MAX_CATALOG_CANDIDATES) break;
      const mapping = await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_property_and_catalog', (q) =>
          q.eq('propertyId', p._id).eq('catalogId', catalog._id),
        )
        .first();
      if (!mapping) continue; // finca sin ficha en el catalogo Meta
      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const desde = prices.length > 0 ? Math.min(...prices) : 0;
      const parts: string[] = [];
      if (desde > 0) parts.push(`💰 Desde ${formatCop(desde)} por noche`);
      parts.push(`👥 Hasta ${p.capacity} personas`);
      if (mascotas && p.allowsPets) parts.push('🐶 Pet friendly');
      items.push({
        propertyId: String(p._id),
        retailerId: mapping.productRetailerId,
        title: p.title,
        bodyText: parts.join(' · '),
      });
    }
    return { ok: true, catalogMetaId: catalog.whatsappCatalogId, items };
  },
});

/** Registra las fichas enviadas: mensajes tipo product + memoria de paginacion. */
export const recordCatalogSend = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    sent: v.array(
      v.object({
        propertyId: v.id('properties'),
        title: v.string(),
        retailerId: v.string(),
        wamid: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { conversationId, sent }): Promise<void> => {
    const now = Date.now();
    for (const card of sent) {
      await ctx.db.insert('messages', {
        conversationId,
        sender: 'assistant',
        content: `🏡 Ficha de catálogo: ${card.title}`,
        type: 'product',
        wamid: card.wamid,
        whatsappStatus: card.wamid ? 'sent' : undefined,
        metadata: { productRetailerId: card.retailerId, source: 'agent_catalog' },
        createdAt: now,
      });
    }
    const conversation = await ctx.db.get(conversationId);
    const prev = conversation?.lastSentCatalogPropertyIds ?? [];
    const merged = [...prev];
    for (const card of sent) {
      if (!merged.some((id) => String(id) === String(card.propertyId))) {
        merged.push(card.propertyId);
      }
    }
    await ctx.db.patch(conversationId, {
      lastSentCatalogPropertyIds: merged,
      lastMessageAt: now,
    });
  },
});

/**
 * Minimos/maximos de noches por temporada (respuesta rapida oficial
 * "/NOCHES DISPONIBLES" + regla de Santiago: fin de año maximo 7 dias).
 */
const REGLAS_NOCHES: Record<string, { min: number; max?: number }> = {
  'Fin de año': { min: 6, max: 7 },
  Navidad: { min: 4 },
  'Puente Reyes': { min: 3 },
  'Semana Santa': { min: 3 },
};

/**
 * Consulta las REGLAS GLOBALES de temporadas (tabla globalPricing, las mismas
 * del panel admin del sistema anterior) para un rango de fechas: dice en que
 * temporada(s) caen las fechas y si cumplen el minimo/maximo de noches.
 */
export const toolConsultarTemporada = internalQuery({
  args: {
    /** YYYY-MM-DD */
    fechaEntrada: v.string(),
    /** YYYY-MM-DD */
    fechaSalida: v.string(),
  },
  handler: async (
    ctx,
    { fechaEntrada, fechaSalida },
  ): Promise<{
    noches: number;
    temporadas: string[];
    reglas: Array<{ temporada: string; minimoNoches: number; maximoNoches?: number; cumple: boolean }>;
    nota: string;
  }> => {
    const start = Date.parse(`${fechaEntrada}T12:00:00-05:00`);
    const end = Date.parse(`${fechaSalida}T12:00:00-05:00`);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return {
        noches: 0,
        temporadas: [],
        reglas: [],
        nota: 'fechas invalidas (usa YYYY-MM-DD y salida posterior a entrada)',
      };
    }
    const noches = Math.round((end - start) / 86_400_000);

    // Dias del rango en formato MM-DD (sin año, como las reglas del panel).
    const dias: string[] = [];
    for (let t = start; t <= end; t += 86_400_000) {
      const d = new Date(t);
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dias.push(`${mm}-${dd}`);
    }

    const rules = await ctx.db.query('globalPricing').collect();
    const temporadas: string[] = [];
    for (const r of rules) {
      if (r.activa === false) continue;
      let match = false;
      if (r.fechas && r.fechas.length > 0) {
        match = dias.some((d) => r.fechas!.includes(d));
      } else if (r.fechaDesde && r.fechaHasta) {
        // Rango MM-DD (puede cruzar año, ej 12-28 → 01-03).
        const desde = r.fechaDesde;
        const hasta = r.fechaHasta;
        match = dias.some((d) =>
          desde <= hasta ? d >= desde && d <= hasta : d >= desde || d <= hasta,
        );
      }
      if (match) temporadas.push(r.nombre);
    }

    const reglasOut = temporadas
      .filter((t) => REGLAS_NOCHES[t])
      .map((t) => ({
        temporada: t,
        minimoNoches: REGLAS_NOCHES[t].min,
        maximoNoches: REGLAS_NOCHES[t].max,
        cumple:
          noches >= REGLAS_NOCHES[t].min &&
          (REGLAS_NOCHES[t].max === undefined || noches <= REGLAS_NOCHES[t].max!),
      }));

    return {
      noches,
      temporadas,
      reglas: reglasOut,
      nota:
        reglasOut.length > 0
          ? 'si alguna regla no se cumple, avisa al cliente el minimo/maximo y pide ajustar fechas ANTES de enviar catalogo'
          : temporadas.length > 0
            ? `fechas en ${temporadas.join(', ')}: los precios varian segun temporada`
            : 'fechas en temporada normal (fin de semana sin festivo: minimo 1 noche; con puente festivo: minimo 2)',
    };
  },
});

export const toolEscalar = internalMutation({
  args: { conversationId: v.id('conversations'), motivo: v.string() },
  handler: async (ctx, { conversationId, motivo }): Promise<{ escalado: boolean }> => {
    const now = Date.now();
    await ctx.db.patch(conversationId, {
      status: 'human',
      priority: 'urgent',
      aiManualOverride: false,
      lastMessageAt: now,
    });
    await ctx.db.insert('messages', {
      conversationId,
      sender: 'system',
      content: `⚠️ Escalado a humano por el agente. Motivo: ${motivo}`,
      type: 'text',
      createdAt: now,
    });
    return { escalado: true };
  },
});

const TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_fincas',
      description:
        'Busca fincas del inventario real por numero de personas y/o zona. Devuelve nombre, ubicacion, capacidad y precios por temporada (COP).',
      parameters: {
        type: 'object',
        properties: {
          personas: { type: 'number', description: 'Numero de personas' },
          zona: {
            type: 'string',
            description: 'Zona, municipio o departamento (ej: Melgar, Cundinamarca)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidad',
      description:
        'Verifica si una finca esta libre en un rango de fechas. Fechas en formato YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          finca: { type: 'string', description: 'Nombre o codigo de la finca' },
          fechaEntrada: { type: 'string', description: 'YYYY-MM-DD' },
          fechaSalida: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['finca', 'fechaEntrada', 'fechaSalida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_catalogo',
      description:
        'Envia al cliente las fichas del catalogo de WhatsApp (foto + precio por finca). Usar EN CUANTO tengas fechas + numero de personas — asi trabaja el equipo: no se describe en texto, se envian las fichas. La zona es OPCIONAL: sin zona se envian las favoritas de distintos municipios; con municipio, filtrado personalizado. Si el cliente pide "otras opciones", llamala de nuevo (excluye automaticamente las ya enviadas). Las fichas salen ANTES de tu mensaje final: tu texto las acompaña (aclara que el valor es por noche en temporada actual y ofrece ayudar a elegir), NO las describas una por una.',
      parameters: {
        type: 'object',
        properties: {
          personas: { type: 'number', description: 'Numero de personas' },
          zona: {
            type: 'string',
            description: 'Zona, municipio o departamento si el cliente lo dio',
          },
          mascotas: {
            type: 'boolean',
            description: 'true si el cliente lleva mascotas (filtra pet friendly)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_temporada',
      description:
        'Consulta las REGLAS GLOBALES de temporadas del panel (Fin de año, Navidad, Puente Reyes, Semana Santa, temporada media/baja) para un rango de fechas. Usala SIEMPRE que el cliente de fechas concretas, ANTES de enviar catalogo: te dice en que temporada caen, el minimo/maximo de noches y si las fechas cumplen. Si no cumplen, avisa al cliente y pide ajustar fechas antes de enviar opciones. OJO: el nombre de la temporada de PRECIOS (media/alta/baja) es informacion INTERNA — jamas se lo digas al cliente; al cliente solo se le dice que el valor varia segun la temporada. Las especiales (Navidad, Fin de año, Reyes, Semana Santa) si se mencionan por sus minimos.',
      parameters: {
        type: 'object',
        properties: {
          fechaEntrada: { type: 'string', description: 'YYYY-MM-DD' },
          fechaSalida: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['fechaEntrada', 'fechaSalida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'iniciar_reserva',
      description:
        'El cliente eligio una finca y quiere avanzar ("me gusto esta", "estamos interesados en esta finca", "cual es el paso a seguir", "quiero reservarla"). Envia los DOS bloques oficiales del equipo verbatim: el proceso de reserva (contrato, formas de pago, 50%) y la solicitud de datos del contrato. Usala EN EL MISMO TURNO en que el cliente muestra intencion de reservar — NUNCA preguntes "¿te gustaria seguir con la reserva?" ni "¿seguimos?": el equipo avanza de una.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalar_a_humano',
      description:
        'Pasa la conversacion a un asesor humano y apaga el agente. Usar ante emergencias, quejas serias, propietarios, reservas activas con problemas o peticion explicita de hablar con una persona.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo breve del escalado' },
        },
        required: ['motivo'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Persistencia de la respuesta
// ---------------------------------------------------------------------------

export const saveAssistantMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    wamid: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, content, wamid }): Promise<void> => {
    const now = Date.now();
    await ctx.db.insert('messages', {
      conversationId,
      sender: 'assistant',
      content,
      type: 'text',
      wamid,
      whatsappStatus: wamid ? 'sent' : undefined,
      createdAt: now,
    });
    await ctx.db.patch(conversationId, { lastMessageAt: now });
  },
});

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

function parseDateMs(iso: string): number {
  const ms = Date.parse(`${iso}T00:00:00-05:00`);
  return Number.isNaN(ms) ? 0 : ms;
}

// ---------------------------------------------------------------------------
// Escalacion automatica — precio sin respuesta concreta
// ---------------------------------------------------------------------------

function buildPriceHandoffReply(contactName: string): string {
  const name = respectfulGreetingName(contactName);
  return name
    ? `Listo ${name}, un asesor de nuestro equipo te confirma el valor exacto y los detalles de la finca 🤝✨`
    : `Listo, un asesor de nuestro equipo te confirma el valor exacto y los detalles de la finca 🤝✨`;
}

export const runAgentTurn = internalAction({
  args: {
    conversationId: v.id('conversations'),
    /** Mensaje que agendo este turno: si ya no es el ultimo del cliente, se
     * descarta (el turno del mensaje mas nuevo respondera TODO el burst). */
    triggerMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, { conversationId, triggerMessageId }) => {
    const context = await ctx.runQuery(internal.agent.getAgentContext, {
      conversationId,
    });
    if (!context) return;
    if (context.status !== 'ai') return;

    const last = context.history[context.history.length - 1];
    if (!last || last.sender !== 'user') return;
    // Encolado de rafagas: si llego un mensaje MAS NUEVO que el que agendo
    // este turno, este turno se descarta — el turno de ese mensaje respondera
    // una sola vez con todo el contexto.
    if (
      triggerMessageId &&
      context.lastUserMessageId &&
      String(context.lastUserMessageId) !== String(triggerMessageId)
    ) {
      console.log('[agent] turno descartado: hay mensaje mas nuevo del cliente');
      return;
    }

    const botHasSpoken = context.history.some((m) => m.sender === 'assistant');

    const priceLoopMotivo = detectPriceLoopEscalation(
      context.history,
      last.content,
      context.catalogSent,
    );
    if (priceLoopMotivo) {
      await ctx.runMutation(internal.agent.toolEscalar, {
        conversationId,
        motivo: priceLoopMotivo,
      });
      const handoff = buildPriceHandoffReply(context.contactName);
      let handoffWamid: string | undefined;
      if (context.contactPhone) {
        try {
          const sent = await sendWhatsappText({
            to: context.contactPhone,
            text: handoff,
          });
          handoffWamid = sent.wamid;
        } catch (err) {
          console.error('[agent] fallo el envio de escalacion por precio', err);
        }
      }
      await ctx.runMutation(internal.agent.saveAssistantMessage, {
        conversationId,
        content: handoff,
        wamid: handoffWamid,
      });
      console.log('[agent] escalado por bucle de precio', { conversationId, priceLoopMotivo });
      return;
    }

    // Primer turno + el ULTIMO mensaje es un saludo puro → welcome oficial
    // DETERMINISTICO (formato exacto aprobado por el equipo, con Señor/Señora).
    // Garantiza la bienvenida correcta aunque haya mensajes-ruido previos
    // (reenvios, documentos, invitaciones) que confundirian al LLM.
    if (!botHasSpoken && isPureGreeting(last.content)) {
      const welcome = buildWelcomeMessage(context.contactName);
      let welcomeWamid: string | undefined;
      if (context.contactPhone) {
        try {
          const sentWelcome = await sendWhatsappText({
            to: context.contactPhone,
            text: welcome,
          });
          welcomeWamid = sentWelcome.wamid;
        } catch (err) {
          console.error('[agent] fallo el envio del welcome por YCloud', err);
        }
      }
      await ctx.runMutation(internal.agent.saveAssistantMessage, {
        conversationId,
        content: welcome,
        wamid: welcomeWamid,
      });
      return;
    }

    // CAPA 2 — RAG sobre ejemplares curados.
    let exemplars: Array<{ clientMessage: string; response: string }> = [];
    try {
      const [queryEmbedding] = await embedTexts([last.content]);
      if (queryEmbedding) {
        const hits = await ctx.vectorSearch('exemplars', 'by_embedding', {
          vector: queryEmbedding,
          limit: 4,
          filter: (q) => q.eq('enabled', true),
        });
        exemplars = await ctx.runQuery(internal.exemplars.getByIds, {
          ids: hits.map((h) => h._id),
        });
      }
    } catch (err) {
      // RAG caido no debe tumbar la respuesta: seguimos sin ejemplos.
      console.error('[agent] RAG fallo, respondo sin ejemplos', err);
    }

    const todayIso = new Date().toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt({
          exemplars,
          contactName: context.contactName || undefined,
          todayIso,
          firstTurn: !botHasSpoken,
        }),
      },
      ...context.history.map((m): ChatMessage =>
        m.sender === 'user'
          ? { role: 'user', content: m.content }
          : { role: 'assistant', content: m.content },
      ),
    ];

    let escalated = false;
    let finalText: string | null = null;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const { content, toolCalls } = await chatCompletion({
        messages,
        tools: round < MAX_TOOL_ROUNDS ? TOOL_DEFS : [],
      });
      if (toolCalls.length === 0) {
        finalText = content;
        break;
      }
      messages.push({ role: 'assistant', content, tool_calls: toolCalls });
      for (const call of toolCalls) {
        let result: unknown;
        console.log('[agent] tool llamada', call.function.name, call.function.arguments);
        try {
          const args = JSON.parse(call.function.arguments || '{}') as Record<
            string,
            unknown
          >;
          if (call.function.name === 'buscar_fincas') {
            result = await ctx.runQuery(internal.agent.toolBuscarFincas, {
              personas: typeof args.personas === 'number' ? args.personas : undefined,
              zona: typeof args.zona === 'string' ? args.zona : undefined,
            });
          } else if (call.function.name === 'consultar_disponibilidad') {
            result = await ctx.runQuery(internal.agent.toolDisponibilidad, {
              finca: String(args.finca ?? ''),
              fechaEntrada: parseDateMs(String(args.fechaEntrada ?? '')),
              fechaSalida: parseDateMs(String(args.fechaSalida ?? '')),
            });
          } else if (call.function.name === 'enviar_catalogo') {
            const pick = await ctx.runQuery(internal.agent.toolCatalogPick, {
              conversationId,
              personas: typeof args.personas === 'number' ? args.personas : undefined,
              zona: typeof args.zona === 'string' ? args.zona : undefined,
              mascotas:
                typeof args.mascotas === 'boolean' ? args.mascotas : undefined,
            });
            if (!pick.ok) {
              result = { enviadas: [], error: pick.motivo };
            } else if (pick.items.length === 0) {
              result = {
                enviadas: [],
                nota: 'ninguna finca cumple esos filtros (o ya se enviaron todas las que aplican); ofrece ajustar zona/fechas/cupo',
              };
            } else {
              // Intro ANTES de las fichas (asi lo hace el equipo). SIN numero:
              // algunas fichas pueden fallar al enviarse y el conteo mentiria.
              const introText = 'Te comparto algunas de nuestras opciones de fincas:';
              let introWamid: string | undefined;
              try {
                const introSent = await sendWhatsappText({
                  to: context.contactPhone,
                  text: introText,
                });
                introWamid = introSent.wamid;
              } catch (err) {
                console.error('[agent] fallo el envio del intro de catalogo', err);
              }
              await ctx.runMutation(internal.agent.saveAssistantMessage, {
                conversationId,
                content: introText,
                wamid: introWamid,
              });

              const rows = await sendCatalogCards({
                to: context.contactPhone,
                catalogId: pick.catalogMetaId,
                cards: pick.items.map((i) => ({
                  productRetailerId: i.retailerId,
                  bodyText: i.bodyText,
                })),
              });
              const sent = [];
              for (const item of pick.items) {
                const row = rows.find(
                  (r) => r.productRetailerId === item.retailerId,
                );
                if (row?.ok) {
                  sent.push({
                    propertyId: item.propertyId as Id<'properties'>,
                    title: item.title,
                    retailerId: item.retailerId,
                    wamid: row.wamid,
                  });
                }
              }
              if (sent.length > 0) {
                await ctx.runMutation(internal.agent.recordCatalogSend, {
                  conversationId,
                  sent,
                });
                result = {
                  enviadas: sent.map((s) => s.title),
                  nota: 'Ya se envio el intro y las fichas. Ahora escribe SOLO el mensaje de CIERRE con el estilo del equipo, sin repetir las fincas ni sus precios. NO empieces con "Gracias" ni agradezcas. NO ofrezcas video ni fotos (las fichas YA traen fotos e informacion). PROHIBIDO nombrar la temporada de precios (media/alta/baja/actual): di SOLO que "el valor que muestra cada finca varia segun la temporada" — nunca des a entender que ese precio es el definitivo. Luego: "si alguna te llama la atencion, dinos cual y te ayudamos a gestionar el mejor precio 🤝" e invita a elegir o pedir mas opciones. Ejemplo del tono: "Estas son nuestras mejores opciones disponibles para ti! 🤩🏡 El valor que muestra cada finca varia segun la temporada. Si alguna te llama la atencion, dinos cual y te ayudamos a gestionar el mejor precio 🤝"',
                };
              } else {
                // Catalogo no conectado al numero / producto invalido: NO
                // decirle al modelo que se enviaron — fallback a texto.
                result = {
                  enviadas: [],
                  fichasFallaron: true,
                  opciones: pick.items.map((i) => `${i.title} — ${i.bodyText}`),
                  nota: 'las fichas NO salieron (error tecnico del catalogo). NO digas que enviaste fichas: comparte estas opciones en TEXTO (nombre + precio por noche + capacidad) y ofrece ayudar a elegir',
                };
              }
            }
          } else if (call.function.name === 'consultar_temporada') {
            result = await ctx.runQuery(internal.agent.toolConsultarTemporada, {
              fechaEntrada: String(args.fechaEntrada ?? ''),
              fechaSalida: String(args.fechaSalida ?? ''),
            });
          } else if (call.function.name === 'iniciar_reserva') {
            // Bloques oficiales verbatim, como mensajes separados (asi los
            // manda el equipo): proceso de reserva + datos del contrato.
            for (const bloque of [PROCESO_RESERVA, DATOS_CONTRATO]) {
              let bloqueWamid: string | undefined;
              try {
                const sentBlock = await sendWhatsappText({
                  to: context.contactPhone,
                  text: bloque,
                });
                bloqueWamid = sentBlock.wamid;
              } catch (err) {
                console.error('[agent] fallo el envio de bloque de reserva', err);
              }
              await ctx.runMutation(internal.agent.saveAssistantMessage, {
                conversationId,
                content: bloque,
                wamid: bloqueWamid,
              });
            }
            result = {
              enviado: true,
              nota: 'El proceso de reserva y la solicitud de datos del contrato YA se enviaron como mensajes oficiales. Tu texto final debe ser MUY corto (1 linea, ej: "Quedamos atentos a tus datos para elaborar el contrato ✅") o vacio de contenido nuevo. NO repitas el proceso ni los datos, NO des las gracias.',
            };
          } else if (call.function.name === 'escalar_a_humano') {
            result = await ctx.runMutation(internal.agent.toolEscalar, {
              conversationId,
              motivo: String(args.motivo ?? 'sin motivo'),
            });
            escalated = true;
          } else {
            result = { error: `tool desconocida: ${call.function.name}` };
          }
        } catch (err) {
          result = { error: String(err) };
        }
        console.log(
          '[agent] tool resultado',
          call.function.name,
          JSON.stringify(result).slice(0, 300),
        );
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    let reply = (finalText ?? '').trim();
    if (!reply) {
      console.error('[agent] el LLM no produjo texto final', { conversationId });
      return;
    }

    if (
      context.catalogSent &&
      isPriceQuestion(last.content) &&
      isPriceDeflection(reply) &&
      !escalated
    ) {
      await ctx.runMutation(internal.agent.toolEscalar, {
        conversationId,
        motivo: 'cliente pide precio y el bot no dio cifra concreta',
      });
      reply = buildPriceHandoffReply(context.contactName);
      escalated = true;
      console.log('[agent] escalado post-LLM: respuesta sin precio concreto', {
        conversationId,
      });
    }

    // Re-verificacion post-LLM: si el cliente escribio ALGO NUEVO mientras
    // generabamos, abortamos este envio — el turno del mensaje nuevo
    // respondera con el contexto completo (una sola respuesta por burst).
    const latestUserId = await ctx.runQuery(internal.agent.getLastUserMessageId, {
      conversationId,
    });
    if (
      context.lastUserMessageId &&
      latestUserId &&
      latestUserId !== String(context.lastUserMessageId)
    ) {
      console.log('[agent] respuesta descartada: el cliente escribio mientras generabamos');
      return;
    }

    let wamid: string | undefined;
    if (context.contactPhone) {
      try {
        const sent = await sendWhatsappText({
          to: context.contactPhone,
          text: reply,
        });
        wamid = sent.wamid;
      } catch (err) {
        console.error('[agent] fallo el envio por YCloud', err);
      }
    }
    await ctx.runMutation(internal.agent.saveAssistantMessage, {
      conversationId,
      content: reply,
      wamid,
    });
    if (escalated) {
      console.log('[agent] conversacion escalada a humano', { conversationId });
    }
  },
});
