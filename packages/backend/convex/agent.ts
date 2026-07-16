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
  buildMinimoNochesMessage,
  buildPropertySelectionHandoff,
  buildWelcomeMessage,
  burstHasOnlyGreeting,
  buildCatalogoIntro,
  formalSalutationName,
  getUserBurstSinceLastBot,
  MASCOTAS_POLITICA,
  prependGreetingIfNeeded,
  stripRedundantHolaPrefix,
} from './lib/copys';
import { isAppAutoReply } from './lib/appAutoReply';
import { detectPriceLoopEscalation, isPriceDeflection, isPriceQuestion } from './lib/agentEscalation';
import { detectPuenteFestivo, humanHolidayEs } from './lib/colombiaPublicHolidays';
import {
  isCoastalProperty,
  propertyMatchesZone,
  resolveZoneKeywords,
  zoneRequestsCoast,
} from './lib/zoneProximity';
import { sendWhatsappText } from './lib/ycloud';
import {
  BETWEEN_CATALOG_SENDS_MS,
  formatCop,
  MAX_CATALOG_CANDIDATES,
  MAX_CATALOG_CARDS,
  sendCatalogCard,
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
  /** El contacto ya tuvo conversaciones anteriores ("gusto saludarte nuevamente"). */
  returning: boolean;
  /** Zona persistente que el cliente pidió (ej. "cerca a bogotá"). */
  lastRequestedZone: string | null;
  /**
   * El ÚLTIMO mensaje del equipo (lado assistant) lo envió un HUMANO (Experto),
   * no el bot. Si es true, un humano está atendiendo → el bot NO debe responder
   * (evita que el bot hable encima del asesor, aunque el toggle esté encendido).
   */
  humanHandling: boolean;
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
        /** Códigos / IDs alternativos si Meta no reconoce el retailer principal. */
        alternateRetailerIds?: string[];
      }>;
    };

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

/** Suma días a una fecha "YYYY-MM-DD" (UTC, sin drift de zona). */
function addDaysIso(iso: string, days: number): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → "martes 21 de julio" (es-CO). */
function formatFechaLarga(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

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
    // ¿El último mensaje real del equipo (assistant) lo escribió un humano?
    // Recorremos en orden cronológico: gana el más reciente.
    let humanHandling = false;
    for (const m of ordered) {
      if (m.sender === 'user' && !m.deletedAt) lastUserMessageId = m._id;
      if (m.sender === 'assistant' && !m.deletedAt && m.content.trim()) {
        const src2 = (m.metadata as { source?: string } | null)?.source;
        const isAutoNoise =
          src2 === 'ycloud_smb_echo_auto' ||
          src2 === 'whatsapp_temporal' ||
          isAppAutoReply(m.content);
        if (!isAutoNoise) humanHandling = Boolean(m.sentByUserId);
      }
      if (m.sender === 'system' || m.deletedAt || !m.content.trim()) continue;
      // Respuestas automáticas de la app de WhatsApp (mensaje de ausencia,
      // echo de coexistencia): NO van al hilo del agente — son ruido y
      // dejaban al bot sin responder (el guard exige que el último mensaje
      // sea del cliente y el auto-mensaje quedaba de último). El chequeo por
      // contenido cubre los capturados antes de marcar la fuente.
      const metaSource = (m.metadata as { source?: string } | null)?.source;
      if (metaSource === 'ycloud_smb_echo_auto') continue;
      if (metaSource === 'whatsapp_temporal') continue;
      if (m.sender === 'assistant' && isAppAutoReply(m.content)) continue;
      history.push({ sender: m.sender, content: m.content });
    }
    // Cliente recurrente: el contacto tiene OTRAS conversaciones (cerradas o
    // eliminadas del panel) ademas de esta.
    const allConvs = await ctx.db
      .query('conversations')
      .withIndex('by_contact', (q) => q.eq('contactId', conversation.contactId))
      .collect();
    const returning = allConvs.some((c) => c._id !== conversationId);
    return {
      status: conversation.status,
      contactPhone: contact?.phone ?? '',
      contactName: contact?.baseName ?? contact?.name ?? '',
      history,
      lastUserMessageId,
      catalogSent: (conversation.lastSentCatalogPropertyIds?.length ?? 0) > 0,
      returning,
      lastRequestedZone: conversation.lastRequestedZone ?? null,
      humanHandling,
    };
  },
});

/** Persiste la zona que pidió el cliente (sticky para el resto del chat). */
export const setRequestedZone = internalMutation({
  args: { conversationId: v.id('conversations'), zona: v.string() },
  handler: async (ctx, { conversationId, zona }): Promise<void> => {
    const z = zona.trim();
    if (!z) return;
    await ctx.db.patch(conversationId, { lastRequestedZone: z });
  },
});

/** Limpia la zona sticky (el cliente amplió a "cualquier lugar"). */
export const clearRequestedZone = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<void> => {
    await ctx.db.patch(conversationId, { lastRequestedZone: undefined });
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
    const zoneKw = zona ? resolveZoneKeywords(zona).keywords : [];
    const matches = all
      // No ofrecer fincas inhabilitadas (active) ni ocultas del catálogo (visible).
      .filter((p) => p.active !== false && p.visible !== false)
      .filter((p) => (personas ? (p.eventCapacity ?? p.capacity) >= personas : true))
      .filter((p) => propertyMatchesZone(p.location, p.departamentos, zoneKw))
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
    /** ms epoch — si vienen, solo se envian fincas LIBRES esas fechas. */
    fechaEntradaMs: v.optional(v.number()),
    fechaSalidaMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { conversationId, personas, zona, mascotas, fechaEntradaMs, fechaSalidaMs },
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
    const zonaTrim = zona?.trim() || undefined;
    const zoneKw = zonaTrim ? resolveZoneKeywords(zonaTrim).keywords : [];
    // Palabra clave "principal" (para el tier de coincidencia exacta del orden).
    const zonaLower = zonaTrim?.toLowerCase();

    // COSTA SOLO SI LA PIDEN (regla comercial): Santa Marta, Cartagena, Islas
    // del Rosario… jamás se mezclan en las favoritas sin zona ni en la
    // ampliación a municipios cercanos — solo salen cuando la zona pedida por
    // el cliente ES costa.
    const clienteQuiereCosta = zoneRequestsCoast(zonaTrim);

    const base = all
      .filter((p) => !exclude.has(String(p._id)))
      // El bot SOLO envía fincas habilitadas (active), visibles en catálogo
      // (visible) y con el Catálogo Meta/WhatsApp encendido. Si cualquiera de
      // los tres está apagado, la finca NO se envía.
      .filter(
        (p) =>
          p.active !== false &&
          p.visible !== false &&
          p.visibleInWhatsAppCatalog !== false,
      )
      .filter(
        (p) => clienteQuiereCosta || !isCoastalProperty(p.location, p.departamentos),
      )
      .filter((p) => propertyMatchesZone(p.location, p.departamentos, zoneKw))
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

    // FAVORITAS DE PRIMERAS (regla del equipo): sin romper la variedad/orden ya
    // calculado, se llevan las favoritas al frente de la lista.
    matches = [
      ...matches.filter((p) => p.isFavorite === true),
      ...matches.filter((p) => p.isFavorite !== true),
    ];

    // ¿Filtramos por disponibilidad? Solo si vienen fechas válidas.
    const checkAvailability =
      typeof fechaEntradaMs === 'number' &&
      typeof fechaSalidaMs === 'number' &&
      fechaSalidaMs > fechaEntradaMs;

    const items: Extract<CatalogPickResult, { ok: true }>['items'] = [];
    for (const p of matches) {
      if (items.length >= MAX_CATALOG_CANDIDATES) break;
      // DISPONIBILIDAD: no enviar fincas con reserva/bloqueo que se cruce con las
      // fechas pedidas (propertyAvailability incluye reservas + bloqueos manuales).
      if (checkAvailability) {
        const blocks = await ctx.db
          .query('propertyAvailability')
          .withIndex('by_property', (q) => q.eq('propertyId', p._id))
          .collect();
        const ocupada = blocks.some(
          (b) =>
            b.fechaEntrada < (fechaSalidaMs as number) &&
            b.fechaSalida > (fechaEntradaMs as number),
        );
        if (ocupada) continue; // ocupada esas fechas → no se ofrece
      }
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
        alternateRetailerIds: p.code?.trim() ? [p.code.trim()] : undefined,
      });
    }
    return { ok: true, catalogMetaId: catalog.whatsappCatalogId, items };
  },
});

/** Registra las fichas enviadas: mensajes tipo product + memoria de paginacion. */
export const recordCatalogSend = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    /** Si viene del panel (Experto), la burbuja muestra "Experto" en el inbox. */
    sentByUserId: v.optional(v.string()),
    sent: v.array(
      v.object({
        propertyId: v.id('properties'),
        title: v.string(),
        retailerId: v.string(),
        wamid: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { conversationId, sentByUserId, sent }): Promise<void> => {
    const now = Date.now();
    const source = sentByUserId ? 'advisor_catalog' : 'agent_catalog';
    for (const card of sent) {
      await ctx.db.insert('messages', {
        conversationId,
        sender: 'assistant',
        content: `🏡 Ficha de catálogo: ${card.title}`,
        type: 'product',
        wamid: card.wamid,
        whatsappStatus: card.wamid ? 'sent' : undefined,
        sentByUserId,
        metadata: { productRetailerId: card.retailerId, source },
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
        maximoNoches: REGLAS_NOCHES[t].max as number | undefined,
        cumple:
          noches >= REGLAS_NOCHES[t].min &&
          (REGLAS_NOCHES[t].max === undefined || noches <= REGLAS_NOCHES[t].max!),
      }));

    // Puente festivo (calendario real de Colombia): mínimo 2 noches. Se calcula
    // aunque no haya una regla de temporada de precios que coincida.
    const puente = detectPuenteFestivo(fechaEntrada, fechaSalida);
    let puenteNota = '';
    if (puente.puente) {
      const yaEsta = reglasOut.some((r) => r.temporada === 'Puente festivo');
      if (!yaEsta) {
        reglasOut.push({
          temporada: 'Puente festivo',
          minimoNoches: 2,
          maximoNoches: undefined,
          cumple: noches >= 2,
        });
      }
      const dia = puente.holidayYmd ? humanHolidayEs(puente.holidayYmd) : 'un día festivo';
      puenteNota =
        noches < 2
          ? `Estas fechas caen en PUENTE FESTIVO (${dia} es festivo en Colombia): la estancia mínima es de 2 noches. Avisa al cliente y pide ajustar la fecha de salida ANTES de enviar catálogo.`
          : `Estas fechas son puente festivo (${dia}); cumplen el mínimo de 2 noches.`;
    }

    const baseNota =
      reglasOut.length > 0
        ? 'si alguna regla no se cumple, avisa al cliente el minimo/maximo y pide ajustar fechas ANTES de enviar catalogo'
        : temporadas.length > 0
          ? `fechas en ${temporadas.join(', ')}: los precios varian segun temporada`
          : 'fechas en temporada normal (fin de semana sin festivo: minimo 1 noche; con puente festivo: minimo 2)';

    return {
      noches,
      temporadas,
      reglas: reglasOut,
      nota: puenteNota ? `${puenteNota} ${baseNota}` : baseNota,
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
      operationalState: 'requires_advisor',
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

/**
 * Envía un texto de handoff (p. ej. la respuesta inmediata de EMERGENCIA) y lo
 * registra en el hilo como mensaje del asistente. La conversación ya quedó
 * escalada a humano en el ingest.
 */
export const sendHandoffText = internalAction({
  args: {
    conversationId: v.id('conversations'),
    to: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { conversationId, to, text }): Promise<void> => {
    let wamid: string | undefined;
    try {
      const sent = await sendWhatsappText({ to, text });
      wamid = sent.wamid;
    } catch (err) {
      console.error('[agent] fallo el mensaje de handoff', err);
    }
    await ctx.runMutation(internal.agent.saveAssistantMessage, {
      conversationId,
      content: text,
      wamid,
    });
  },
});

/**
 * Envía el saludo especial a un PROPIETARIO y lo guarda como mensaje del
 * asistente. La conversación ya quedó escalada a humano en el ingest; esto
 * solo manda el "hola" cordial antes de que el Experto tome el chat.
 */
export const sendOwnerGreeting = internalAction({
  args: {
    conversationId: v.id('conversations'),
    to: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { conversationId, to, text }): Promise<void> => {
    let wamid: string | undefined;
    try {
      const sent = await sendWhatsappText({ to, text });
      wamid = sent.wamid;
    } catch (err) {
      console.error('[agent] fallo el saludo de propietario', err);
    }
    await ctx.runMutation(internal.agent.saveAssistantMessage, {
      conversationId,
      content: text,
      wamid,
    });
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
        'Verifica si una finca esta libre en un rango de fechas SEGUN NUESTRO CALENDARIO INTERNO. Fechas en formato YYYY-MM-DD. OJO: el resultado es PRELIMINAR — la disponibilidad REAL la confirma un Experto humano. PROHIBIDO afirmar al cliente "esta disponible" como hecho: di que segun nuestro calendario se ve libre y que un experto la confirma.',
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
        'Envia al cliente las fichas del catalogo de WhatsApp (foto + precio por finca). Usar EN CUANTO tengas fechas + numero de personas — asi trabaja el equipo: no se describe en texto, se envian las fichas. OBLIGATORIO pasar fechaEntrada y fechaSalida (YYYY-MM-DD) con las fechas que dio el cliente: la tool valida los minimos de noches (temporadas especiales y puentes festivos de Colombia) y NO envia fichas si las fechas no cumplen — en ese caso avisa al cliente y pide ajustar. La zona es OPCIONAL: sin zona se envian las favoritas de distintos municipios; con municipio, filtrado personalizado. Si el cliente pide "otras opciones", llamala de nuevo (excluye automaticamente las ya enviadas). Las fichas salen ANTES de tu mensaje final: tu texto las acompaña (aclara que el valor es por noche en temporada actual y ofrece ayudar a elegir), NO las describas una por una.',
      parameters: {
        type: 'object',
        properties: {
          personas: { type: 'number', description: 'Numero de personas' },
          zona: {
            type: 'string',
            description:
              'Zona, municipio o departamento que pidio el cliente (ej. "cerca a bogota", "Melgar"). PERSISTENTE: si el cliente la dio ANTES en el chat, PASALA IGUAL aunque en este mensaje solo actualice fechas o personas — NO la omitas. Solo cambia si el cliente pide OTRA zona; si dice "cualquier lugar / donde sea", pasa exactamente eso.',
          },
          mascotas: {
            type: 'boolean',
            description:
              'true si el cliente lleva mascotas (filtra fincas que aceptan mascotas)',
          },
          fechaEntrada: {
            type: 'string',
            description:
              'Fecha de entrada que dio el cliente (YYYY-MM-DD). OBLIGATORIA para validar minimos de noches.',
          },
          fechaSalida: {
            type: 'string',
            description:
              'Fecha de salida que dio el cliente (YYYY-MM-DD). OBLIGATORIA para validar minimos de noches.',
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
          personas: {
            type: 'number',
            description:
              'Numero de personas si el cliente ya lo dio (personaliza el aviso de minimo de noches)',
          },
        },
        required: ['fechaEntrada', 'fechaSalida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_politica_mascotas',
      description:
        'Envia al cliente el mensaje OFICIAL de mascotas del equipo (deposito de la primera, tarifas desde la 2da, recomendaciones) TAL CUAL, como mensaje aparte. Usala la PRIMERA vez que el cliente pregunte por mascotas o confirme que lleva. NO reemplaza el catalogo: si ya tienes fechas + personas, llama TAMBIEN enviar_catalogo (con mascotas:true) EN ESTE MISMO TURNO — las mascotas NUNCA frenan el envio de opciones. No la repitas si ya se envio en esta conversacion.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'iniciar_reserva',
      description:
        'SOLO cuando el cliente CONFIRMA que quiere reservar una finca y NO esta haciendo preguntas ("me gusto esta", "quiero reservarla", "esa me sirve", "sigamos con esa"). PROHIBIDO si el mensaje es una duda o pregunta (precio, disponibilidad, comodidades, que incluye, capacidad...): en ese caso responde primero con buscar_fincas o consultar_disponibilidad. Envia el mensaje oficial de confirmacion de interes y escala a un experto humano.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalar_a_humano',
      description:
        'Pasa la conversacion a un Experto humano y apaga el agente. Usar ante emergencias, quejas serias, propietarios, reservas activas con problemas o peticion explicita de hablar con una persona.',
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

/** Apaga el bot en una conversación (la deja en manos de un Experto humano). */
export const markConversationHuman = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<void> => {
    await ctx.db.patch(conversationId, {
      status: 'human',
      aiManualOverride: false,
    });
  },
});

// ---------------------------------------------------------------------------
// Seguimiento a los 10 min (uno solo) si el cliente no responde la bienvenida
// ---------------------------------------------------------------------------

const FOLLOWUP_DELAY_MS = 10 * 60 * 1000; // 10 minutos

function buildFollowupMessage(): string {
  return `¡Hola! 👋 Seguimos por aquí para ayudarte a encontrar la finca perfecta para tu plan 🏡✨\n\nApenas me digas las *fechas* y *cuántas personas*, te comparto las mejores opciones disponibles. ¿Damos el primer paso? 🤝`;
}

/** Decide si toca mandar el seguimiento (cliente sin responder la bienvenida). */
export const followupPrecheck = internalQuery({
  args: { conversationId: v.id('conversations'), sinceMs: v.number() },
  handler: async (ctx, { conversationId, sinceMs }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return { shouldSend: false as const };
    if (conv.status !== 'ai') return { shouldSend: false as const };
    if (conv.followupSent === true) return { shouldSend: false as const };
    const settings = await ctx.db
      .query('agentSettings')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .first();
    if (!(settings?.globalAiEnabled ?? false)) {
      return { shouldSend: false as const };
    }
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', conversationId),
      )
      .collect();
    // ¿El cliente respondió algo DESPUÉS de la bienvenida? → no molestar.
    const clientReplied = msgs.some(
      (m) => m.sender === 'user' && !m.deletedAt && m.createdAt > sinceMs,
    );
    if (clientReplied) return { shouldSend: false as const };
    // ¿Un Experto humano ya intervino? → el bot no manda seguimiento.
    const humanIntervino = msgs.some(
      (m) => m.sender === 'assistant' && m.sentByUserId && !m.deletedAt,
    );
    if (humanIntervino) return { shouldSend: false as const };
    const contact = await ctx.db.get(conv.contactId);
    if (!contact?.phone) return { shouldSend: false as const };
    return { shouldSend: true as const, phone: contact.phone };
  },
});

/** Guarda el mensaje de seguimiento y marca la conversación (nunca reenvía). */
export const recordFollowup = internalMutation({
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
      metadata: { source: 'followup_no_reply' },
      createdAt: now,
    });
    await ctx.db.patch(conversationId, { followupSent: true, lastMessageAt: now });
  },
});

/** Envía el ÚNICO seguimiento de 10 min si sigue sin respuesta. */
export const sendNoReplyFollowup = internalAction({
  args: { conversationId: v.id('conversations'), sinceMs: v.number() },
  handler: async (ctx, { conversationId, sinceMs }): Promise<void> => {
    const check = await ctx.runQuery(internal.agent.followupPrecheck, {
      conversationId,
      sinceMs,
    });
    if (!check.shouldSend) return;
    const text = buildFollowupMessage();
    let wamid: string | undefined;
    try {
      const sent = await sendWhatsappText({ to: check.phone, text });
      wamid = sent.wamid;
    } catch (err) {
      console.error('[agent] fallo el envio del seguimiento', err);
    }
    await ctx.runMutation(internal.agent.recordFollowup, {
      conversationId,
      content: text,
      wamid,
    });
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
  const name = formalSalutationName(contactName);
  return name
    ? `¡Claro que sí, ${name}! Un Experto de nuestro equipo te confirma el valor exacto y los detalles de la finca 🤝✨`
    : `¡Claro que sí! Un Experto de nuestro equipo te confirma el valor exacto y los detalles de la finca 🤝✨`;
}

export const runAgentTurn = internalAction({
  args: {
    conversationId: v.id('conversations'),
    /** Mensaje que agendo este turno: si ya no es el ultimo del cliente, se
     * descarta (el turno del mensaje mas nuevo respondera TODO el burst). */
    triggerMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, { conversationId, triggerMessageId }) => {
    const context: AgentContext | null = await ctx.runQuery(
      internal.agent.getAgentContext,
      {
        conversationId,
      },
    );
    if (!context) return;
    if (context.status !== 'ai') return;

    // CANDADO ANTI-COLISIÓN: si el último mensaje del equipo lo escribió un
    // HUMANO (Experto), un asesor está atendiendo → el bot NO responde (aunque
    // el toggle esté encendido o haya carrera de debounce). Además apaga el bot
    // en esta conversación para que quede en manos del humano.
    if (context.humanHandling) {
      await ctx.runMutation(internal.agent.markConversationHuman, {
        conversationId,
      });
      console.log('[agent] turno descartado: un Experto está atendiendo', {
        conversationId,
      });
      return;
    }

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
    const userBurst = getUserBurstSinceLastBot(context.history);

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

    // PICK DE CATÁLOGO (candado determinista): si el cliente tocó una finca en
    // el catálogo de WhatsApp, esa ES su elección → mensaje oficial de
    // "Excelente elección" + escalado a un Experto EN CÓDIGO (sin LLM). El bot
    // NO puede confirmar disponibilidad ni seguir la venta: eso lo hace el
    // experto de forma personalizada.
    const isCatalogPick =
      /product_retailer_id/i.test(last.content) ||
      /seleccion[oó].*(cat[aá]logo|finca)/i.test(last.content);
    if (isCatalogPick) {
      const handoffText = buildPropertySelectionHandoff(context.contactName);
      let handoffWamid: string | undefined;
      if (context.contactPhone) {
        try {
          const sent = await sendWhatsappText({
            to: context.contactPhone,
            text: handoffText,
          });
          handoffWamid = sent.wamid;
        } catch (err) {
          console.error('[agent] fallo el handoff de pick de catalogo', err);
        }
      }
      await ctx.runMutation(internal.agent.saveAssistantMessage, {
        conversationId,
        content: handoffText,
        wamid: handoffWamid,
      });
      await ctx.runMutation(internal.agent.toolEscalar, {
        conversationId,
        motivo:
          'cliente eligió finca del catálogo — experto confirma disponibilidad y continúa la reserva',
      });
      console.log('[agent] escalado por pick de catalogo', { conversationId });
      return;
    }

    // RESERVA / CONTRATO EXISTENTE (candado determinista): si el cliente menciona
    // un código de contrato ("Contrato: A0552"), ya tiene booking confirmado → NO
    // correr el flujo de venta. Escalar DURO a un Experto (post-venta / consulta).
    const isExistingBookingRef =
      /contrato\s*:?\s*[A-Z0-9]{3,}/i.test(last.content) ||
      /\bc[oó]digo\s+de\s+reserva\b/i.test(last.content) ||
      /\btengo\s+(mi\s+|una\s+)?reserva\s+(confirmada|lista|hecha|activa)\b/i.test(last.content);
    if (isExistingBookingRef) {
      const reservaHandoff = `Un Experto de nuestro equipo revisará tu reserva y te atenderá de inmediato. ⏳🙏`;
      let reservaWamid: string | undefined;
      if (context.contactPhone) {
        try {
          const sent = await sendWhatsappText({
            to: context.contactPhone,
            text: reservaHandoff,
          });
          reservaWamid = sent.wamid;
        } catch (err) {
          console.error('[agent] fallo handoff reserva existente', err);
        }
      }
      await ctx.runMutation(internal.agent.saveAssistantMessage, {
        conversationId,
        content: reservaHandoff,
        wamid: reservaWamid,
      });
      await ctx.runMutation(internal.agent.toolEscalar, {
        conversationId,
        motivo:
          'cliente con reserva/contrato existente — consulta post-venta o confirmación de booking',
      });
      console.log('[agent] escalado por reserva existente', { conversationId });
      return;
    }

    // Primer turno + rafaga solo saludos → welcome oficial determinista.
    if (!botHasSpoken && userBurst.length > 0 && burstHasOnlyGreeting(userBurst)) {
      const welcome = buildWelcomeMessage(
        context.contactName,
        undefined,
        new Date(),
        context.returning,
      );
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
      // Seguimiento a los 10 min si el cliente NO responde la bienvenida (uno
      // solo). Evita que se pierda el lead pensando que es un bot que no atiende.
      await ctx.scheduler.runAfter(
        FOLLOWUP_DELAY_MS,
        internal.agent.sendNoReplyFollowup,
        { conversationId, sinceMs: Date.now() },
      );
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
    let mascotasSentThisTurn = false;
    let avisoMinimoSentThisTurn = false;
    let skipFinalReply = false;
    let finalText: string | null = null;
    // ZONA STICKY: la zona que pidio el cliente sigue vigente todo el chat.
    // Arranca de lo persistido y se actualiza cuando CUALQUIER tool trae zona.
    let stickyZone: string | null = context.lastRequestedZone;
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
          // Captura de zona (cualquier tool que la traiga): se hace sticky para
          // que enviar_catalogo no pierda la zona aunque el modelo la omita
          // en un turno posterior. "cualquier lugar/donde sea" la limpia.
          if (typeof args.zona === 'string' && args.zona.trim()) {
            const z = args.zona.trim();
            const broaden =
              /^(cualquier|donde sea|no importa|todas? part|toda colombia|indiferente|el que sea)/.test(
                z.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''),
              );
            if (broaden) {
              if (stickyZone !== null) {
                stickyZone = null;
                await ctx.runMutation(internal.agent.clearRequestedZone, {
                  conversationId,
                });
              }
            } else if (z !== stickyZone) {
              stickyZone = z;
              await ctx.runMutation(internal.agent.setRequestedZone, {
                conversationId,
                zona: z,
              });
            }
          }
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
            // La zona ya se capturo/hizo sticky arriba (para toda tool). Se usa
            // la sticky aunque el modelo la omita en este turno.
            const effectiveZona = stickyZone ?? undefined;
            console.log('[agent] enviar_catalogo zona', { effectiveZona });

            // Candado de temporada: si el cliente dio fechas, se validan los
            // minimos de noches (temporadas especiales y puentes festivos)
            // ANTES de enviar fichas — el modelo no puede saltarse la regla.
            const fechaEntrada =
              typeof args.fechaEntrada === 'string' ? args.fechaEntrada : '';
            const fechaSalida =
              typeof args.fechaSalida === 'string' ? args.fechaSalida : '';

            // INICIO DE AÑO (regla del negocio): las fincas siguen ocupadas por
            // la temporada de fin de año hasta el 4 de enero; solo se ofrecen
            // fechas de llegada DESDE el 5 de enero. Candado determinista: no se
            // envia catalogo para llegadas del 1 al 4 de enero.
            const janMatch = fechaEntrada.match(/^\d{4}-01-(\d{2})$/);
            const janDay = janMatch ? Number(janMatch[1]) : 0;
            if (janDay >= 1 && janDay <= 4) {
              const aviso = `Para inicio de año las fincas están disponibles a partir del *5 de enero* 🗓️ — las fechas anteriores siguen ocupadas por la temporada de fin de año 🎄.\n\n¿Te sirve del 5 de enero en adelante? Con gusto te comparto las opciones 🏡`;
              let avisoWamid: string | undefined;
              if (context.contactPhone) {
                try {
                  const sent = await sendWhatsappText({
                    to: context.contactPhone,
                    text: aviso,
                  });
                  avisoWamid = sent.wamid;
                } catch (err) {
                  console.error('[agent] fallo el aviso de inicio de año', err);
                }
              }
              await ctx.runMutation(internal.agent.saveAssistantMessage, {
                conversationId,
                content: aviso,
                wamid: avisoWamid,
              });
              skipFinalReply = true;
              result = {
                enviadas: [],
                error: 'inicio de año: solo disponible desde el 5 de enero',
                nota: 'El aviso oficial de inicio de año YA se envio TAL CUAL como mensaje aparte. NO escribas mas texto este turno y NO envies catalogo hasta que el cliente de una fecha de llegada del 5 de enero o posterior.',
              };
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
              console.log('[agent] catalogo bloqueado: inicio de año antes del 5-ene', {
                fechaEntrada,
              });
              continue;
            }

            let bloqueo: {
              detalle: string;
              temporada: string;
              minNoches: number;
              esMinimo: boolean;
            } | null = null;
            if (fechaEntrada && fechaSalida) {
              const temp = await ctx.runQuery(
                internal.agent.toolConsultarTemporada,
                { fechaEntrada, fechaSalida },
              );
              const incumplidas = temp.reglas.filter((r) => !r.cumple);
              if (incumplidas.length > 0) {
                const dura = incumplidas.reduce((a, b) =>
                  b.minimoNoches > a.minimoNoches ? b : a,
                );
                bloqueo = {
                  detalle: incumplidas
                    .map(
                      (r) =>
                        `${r.temporada}: minimo ${r.minimoNoches} noches${
                          r.maximoNoches ? `, maximo ${r.maximoNoches}` : ''
                        } (el cliente pide ${temp.noches})`,
                    )
                    .join('; '),
                  temporada: dura.temporada,
                  minNoches: dura.minimoNoches,
                  esMinimo: temp.noches < dura.minimoNoches,
                };
              }
            }
            // AUTO-AJUSTE DE MÍNIMO DE NOCHES: si el cliente pidió MENOS noches
            // que el mínimo, en vez de preguntar "¿ajustamos?" y quedarnos
            // esperando (la gente no responde), extendemos la salida al mínimo y
            // enviamos las opciones DIRECTO con una nota corta — solo si la
            // nueva fecha cumple todas las reglas de temporada.
            let fechaSalidaEfectiva = fechaSalida;
            let notaAjusteMinimo: string | null = null;
            if (bloqueo && bloqueo.esMinimo && fechaEntrada && bloqueo.minNoches > 0) {
              const nuevaSalida = addDaysIso(fechaEntrada, bloqueo.minNoches);
              if (nuevaSalida) {
                const reval = await ctx.runQuery(
                  internal.agent.toolConsultarTemporada,
                  { fechaEntrada, fechaSalida: nuevaSalida },
                );
                if (reval.reglas.every((r) => r.cumple)) {
                  fechaSalidaEfectiva = nuevaSalida;
                  notaAjusteMinimo = `Para el ${bloqueo.temporada} la estadía mínima es de ${bloqueo.minNoches} noches, así que tomé la salida el ${formatFechaLarga(nuevaSalida)} 📅. Estas son las mejores opciones para tu grupo 🏡`;
                  bloqueo = null; // ya cumple: se envía el catálogo, sin preguntar
                }
              }
            }
            if (bloqueo) {
              if (avisoMinimoSentThisTurn) {
                result = {
                  enviadas: [],
                  error: `fechas NO validas para reservar: ${bloqueo.detalle}`,
                  nota: 'El aviso oficial de estadía mínima YA se envió en este turno. NO escribas más texto ni repitas el aviso; espera a que el cliente confirme fechas que cumplan.',
                };
                messages.push({
                  role: 'tool',
                  tool_call_id: call.id,
                  content: JSON.stringify(result),
                });
                continue;
              }
              if (bloqueo.esMinimo && context.contactPhone) {
                avisoMinimoSentThisTurn = true;
                // Aviso OFICIAL de estadía mínima: se envía tal cual (el LLM
                // lo comprimía y perdía el tono aprobado).
                const aviso = buildMinimoNochesMessage({
                  temporada: bloqueo.temporada,
                  minNoches: bloqueo.minNoches,
                  fechaEntrada,
                  personas:
                    typeof args.personas === 'number' ? args.personas : undefined,
                });
                let avisoWamid: string | undefined;
                try {
                  const sentAviso = await sendWhatsappText({
                    to: context.contactPhone,
                    text: aviso,
                  });
                  avisoWamid = sentAviso.wamid;
                } catch (err) {
                  console.error('[agent] fallo el envio del aviso de minimo', err);
                }
                await ctx.runMutation(internal.agent.saveAssistantMessage, {
                  conversationId,
                  content: aviso,
                  wamid: avisoWamid,
                });
                skipFinalReply = true;
                result = {
                  enviadas: [],
                  error: `fechas NO validas para reservar: ${bloqueo.detalle}`,
                  nota: 'El aviso oficial de estadía mínima YA se envió TAL CUAL como mensaje aparte. NO escribas más texto este turno, NO repitas el aviso y NO vuelvas a llamar enviar_catalogo hasta que el cliente confirme fechas que cumplan.',
                };
              } else {
                result = {
                  enviadas: [],
                  error: `fechas NO validas para reservar: ${bloqueo.detalle}`,
                  nota: 'NO se enviaron fichas. Explica con empatia la restriccion de noches de esas fechas y pide ajustar ANTES de enviar opciones. NO vuelvas a llamar enviar_catalogo hasta tener fechas que cumplan.',
                };
              }
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
              console.log('[agent] catalogo bloqueado por temporada', bloqueo.detalle);
              continue;
            }
            // Fechas en ms para filtrar por disponibilidad (solo fincas libres).
            // Usa la salida EFECTIVA (por si se auto-ajustó al mínimo de noches).
            const feMs = fechaEntrada ? parseDateMs(fechaEntrada) : undefined;
            const fsMs = fechaSalidaEfectiva
              ? parseDateMs(fechaSalidaEfectiva)
              : undefined;
            let pick = await ctx.runQuery(internal.agent.toolCatalogPick, {
              conversationId,
              personas: typeof args.personas === 'number' ? args.personas : undefined,
              zona: effectiveZona,
              mascotas:
                typeof args.mascotas === 'boolean' ? args.mascotas : undefined,
              fechaEntradaMs: feMs,
              fechaSalidaMs: fsMs,
            });
            // REGLA DEL EQUIPO: nunca dejar al cliente sin opciones. Si la zona
            // pedida no tiene fincas para ese grupo, se amplía SOLO a otros
            // municipios (favoritas de distintas zonas, hasta el Meta si toca)
            // y se envían esas fichas como alternativas cercanas.
            let zonaAmpliada = false;
            if (pick.ok && pick.items.length === 0 && effectiveZona) {
              const retry = await ctx.runQuery(internal.agent.toolCatalogPick, {
                conversationId,
                personas:
                  typeof args.personas === 'number' ? args.personas : undefined,
                zona: undefined,
                mascotas:
                  typeof args.mascotas === 'boolean' ? args.mascotas : undefined,
                fechaEntradaMs: feMs,
                fechaSalidaMs: fsMs,
              });
              if (retry.ok && retry.items.length > 0) {
                pick = retry;
                zonaAmpliada = true;
              }
            }
            if (!pick.ok) {
              result = { enviadas: [], error: pick.motivo };
            } else if (pick.items.length === 0) {
              result = {
                enviadas: [],
                nota: 'No se encontraron opciones NI AMPLIANDO a otros municipios. REGLA DURA: PROHIBIDO responder "no tenemos fincas/disponibilidad" — di con calidez que un experto del equipo va a buscar opciones para su grupo y fechas, y llama escalar_a_humano EN ESTE MISMO TURNO (motivo: "sin opciones de catálogo para zona/cupo — buscar con experto").',
              };
            } else {
              // Intro ANTES de las fichas (asi lo hace el equipo). SIN numero:
              // algunas fichas pueden fallar al enviarse y el conteo mentiria.
              // Si hubo auto-ajuste de mínimo de noches, la nota va al inicio.
              const introText =
                (notaAjusteMinimo ? `${notaAjusteMinimo}\n\n` : '') +
                buildCatalogoIntro(context.contactName);
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

              // Una ficha a la vez: el panel las muestra en vivo mientras salen
              // (antes se guardaban todas al final del lote).
              const sent = [];
              let okCount = 0;
              let sentAny = false;
              for (const item of pick.items) {
                if (okCount >= MAX_CATALOG_CARDS) break;
                if (sentAny) {
                  await new Promise((r) => setTimeout(r, BETWEEN_CATALOG_SENDS_MS));
                }
                sentAny = true;
                const row = await sendCatalogCard({
                  to: context.contactPhone,
                  catalogId: pick.catalogMetaId,
                  card: {
                    productRetailerId: item.retailerId,
                    bodyText: item.bodyText,
                    alternateRetailerIds: item.alternateRetailerIds,
                  },
                });
                if (row.ok) {
                  okCount++;
                  const card = {
                    propertyId: item.propertyId as Id<'properties'>,
                    title: item.title,
                    retailerId: item.retailerId,
                    wamid: row.wamid,
                  };
                  sent.push(card);
                  await ctx.runMutation(internal.agent.recordCatalogSend, {
                    conversationId,
                    sent: [card],
                  });
                }
              }
              if (sent.length > 0) {
                result = {
                  enviadas: sent.map((s) => s.title),
                  nota: zonaAmpliada
                    ? 'OJO: en la zona que pidio el cliente NO habia fincas para ese grupo, asi que se enviaron opciones de municipios CERCANOS/otras zonas (esto es lo correcto — PROHIBIDO decir "no tenemos fincas/disponibilidad"). El mensaje oficial YA salio completo con las fichas (valor por noche, invitacion a elegir, mas opciones) — NO repitas nada de eso. Escribe SOLO 1-2 lineas con empatia aclarando que estas opciones estan en zonas cercanas a la que pidio, y que si prefiere, un experto le busca en su zona exacta.'
                    : 'El mensaje oficial YA salio completo junto a las fichas (valor por noche, invitacion a decir cual le gusto, ayuda con la mejor tarifa y ver mas opciones). PROHIBIDO escribir un cierre que repita algo de eso. Solo escribe algo si el cliente pregunto algo puntual que aun NO se ha respondido; si no hay nada pendiente, no escribas nada este turno.',
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
            const fechaEntradaTemp = String(args.fechaEntrada ?? '');
            const temp = await ctx.runQuery(internal.agent.toolConsultarTemporada, {
              fechaEntrada: fechaEntradaTemp,
              fechaSalida: String(args.fechaSalida ?? ''),
            });
            // Si las fechas NO cumplen un mínimo de noches, el aviso oficial
            // sale TAL CUAL desde aquí (el LLM lo comprimía y perdía el tono
            // aprobado). Mismo candado que enviar_catalogo, sin duplicar.
            const incumplidasTemp = temp.reglas.filter((r) => !r.cumple);
            const duraTemp =
              incumplidasTemp.length > 0
                ? incumplidasTemp.reduce((a, b) =>
                    b.minimoNoches > a.minimoNoches ? b : a,
                  )
                : null;
            if (
              duraTemp &&
              temp.noches < duraTemp.minimoNoches &&
              context.contactPhone &&
              !avisoMinimoSentThisTurn
            ) {
              avisoMinimoSentThisTurn = true;
              const aviso = buildMinimoNochesMessage({
                temporada: duraTemp.temporada,
                minNoches: duraTemp.minimoNoches,
                fechaEntrada: fechaEntradaTemp,
                personas:
                  typeof args.personas === 'number' ? args.personas : undefined,
              });
              let avisoWamid: string | undefined;
              try {
                const sentAviso = await sendWhatsappText({
                  to: context.contactPhone,
                  text: aviso,
                });
                avisoWamid = sentAviso.wamid;
              } catch (err) {
                console.error('[agent] fallo el envio del aviso de minimo', err);
              }
              await ctx.runMutation(internal.agent.saveAssistantMessage, {
                conversationId,
                content: aviso,
                wamid: avisoWamid,
              });
              skipFinalReply = true;
              result = {
                ...temp,
                avisoEnviado: true,
                nota: 'Las fechas NO cumplen el mínimo de noches. El aviso oficial YA se envió TAL CUAL como mensaje aparte: NO escribas más texto este turno, NO repitas el aviso y NO llames enviar_catalogo con estas fechas.',
              };
            } else {
              result = temp;
            }
          } else if (call.function.name === 'enviar_politica_mascotas') {
            // Anti-duplicado: una sola vez por conversacion (y por turno,
            // por si el modelo la llama dos veces en la misma ronda).
            const yaEnviada =
              mascotasSentThisTurn ||
              context.history.some(
                (m) =>
                  m.sender === 'assistant' &&
                  m.content.startsWith('✨🐶 Tus mascotas son bienvenidas'),
              );
            if (yaEnviada) {
              result = {
                enviado: false,
                nota: 'La politica de mascotas YA se habia enviado en esta conversacion — NO se envio de nuevo. No la repitas ni la parafrasees: continua con el flujo (catalogo si ya tienes fechas + personas, o pide el dato que falte).',
              };
            } else {
              mascotasSentThisTurn = true;
              let mascotasWamid: string | undefined;
              try {
                const sentMascotas = await sendWhatsappText({
                  to: context.contactPhone,
                  text: MASCOTAS_POLITICA,
                });
                mascotasWamid = sentMascotas.wamid;
              } catch (err) {
                console.error(
                  '[agent] fallo el envio de la politica de mascotas',
                  err,
                );
              }
              await ctx.runMutation(internal.agent.saveAssistantMessage, {
                conversationId,
                content: MASCOTAS_POLITICA,
                wamid: mascotasWamid,
              });
              result = {
                enviado: true,
                nota: 'El mensaje oficial de mascotas YA se envio TAL CUAL como mensaje aparte. NO repitas la politica ni sus cifras ni sus recomendaciones. LIMITE OFICIAL: maximo 2 mascotas de raza pequeña — si el cliente menciono 3 o mas mascotas (o razas grandes), NO prometas cupo ni envies catalogo: di que un experto revisa su caso y llama escalar_a_humano AHORA (motivo: "N mascotas — validar excepcion"). Con 1-2 mascotas pequeñas continua el flujo: si ya tienes fechas + personas y no has enviado catalogo, llama enviar_catalogo (mascotas:true) AHORA MISMO; si falta un dato, pidelo en una linea corta. PROHIBIDO decir "pet friendly".',
              };
            }
          } else if (call.function.name === 'iniciar_reserva') {
            const handoffText = buildPropertySelectionHandoff(
              context.contactName,
            );
            let handoffWamid: string | undefined;
            try {
              const sentHandoff = await sendWhatsappText({
                to: context.contactPhone,
                text: handoffText,
              });
              handoffWamid = sentHandoff.wamid;
            } catch (err) {
              console.error(
                '[agent] fallo el envio del handoff de finca elegida',
                err,
              );
            }
            await ctx.runMutation(internal.agent.saveAssistantMessage, {
              conversationId,
              content: handoffText,
              wamid: handoffWamid,
            });
            await ctx.runMutation(internal.agent.toolEscalar, {
              conversationId,
              motivo: 'cliente eligio una finca — seguimiento de reserva',
            });
            escalated = true;
            skipFinalReply = true;
            result = {
              enviado: true,
              escalado: true,
              nota: 'El mensaje de confirmacion de interes YA se envio y la conversacion fue escalada a un experto. NO escribas texto final — el mensaje oficial ya cubre todo.',
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

    if (skipFinalReply) return;

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

    // El saludo completo con franja horaria solo va la PRIMERA vez que el bot
    // habla: re-saludar a mitad de conversacion suena robotico (regla del
    // equipo: "NO repitas saludos si ya saludaste").
    if (!botHasSpoken) {
      reply = prependGreetingIfNeeded(reply, context.contactName, userBurst);
    } else {
      // Candado anti "Hola" doble: si ya saludamos y el LLM abre con
      // "¡Hola...!" otra vez, se recorta el prefijo (el resto queda intacto).
      const stripped = stripRedundantHolaPrefix(reply);
      if (stripped) reply = stripped;
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

/**
 * PRUEBA DE TONO (solo dev): genera una respuesta con el MISMO prompt + RAG que
 * produccion, pero SIN enviar nada por WhatsApp ni escribir en la base. Sirve
 * para verificar el tuteo/emojis sin tocar clientes reales. Sin tools: el
 * modelo responde texto directo (no consulta catalogo ni escala).
 */
export const testTone = internalAction({
  args: {
    clientMessage: v.string(),
    contactName: v.optional(v.string()),
    firstTurn: v.optional(v.boolean()),
    history: v.optional(
      v.array(v.object({ sender: v.union(v.literal('user'), v.literal('assistant')), content: v.string() })),
    ),
  },
  handler: async (ctx, args): Promise<{ response: string | null }> => {
    // CAPA 2 — mismos ejemplares curados que produccion.
    let exemplars: Array<{ clientMessage: string; response: string }> = [];
    try {
      const [queryEmbedding] = await embedTexts([args.clientMessage]);
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
      console.error('[agent:testTone] RAG fallo, sigo sin ejemplos', err);
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
          contactName: args.contactName,
          todayIso,
          firstTurn: args.firstTurn ?? false,
        }),
      },
      ...(args.history ?? []).map((m): ChatMessage =>
        m.sender === 'user'
          ? { role: 'user', content: m.content }
          : { role: 'assistant', content: m.content },
      ),
      { role: 'user', content: args.clientMessage },
    ];
    const { content } = await chatCompletion({ messages });
    return { response: content };
  },
});
