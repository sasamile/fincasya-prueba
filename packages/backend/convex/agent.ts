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
import type { ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { formatScheduleText, isOutOfHours } from './lib/businessHours';
import { sendAudioToYcloud } from './lib/ycloud/senders';
import type { BotAudioForAgent } from './botAudios';
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
  PROCESO_RESERVA_MSG,
  prependGreetingIfNeeded,
  stripRedundantHolaPrefix,
  timeOfDayGreeting,
  fixTimeGreetingSlot,
} from './lib/copys';
import { isAppAutoReply } from './lib/appAutoReply';
import {
  detectPriceLoopEscalation,
  detectQuestionOverload,
  isPriceDeflection,
  isPriceQuestion,
} from './lib/agentEscalation';
import { detectPuenteFestivo, humanHolidayEs } from './lib/colombiaPublicHolidays';
import {
  isCoastalProperty,
  propertyMatchesZone,
  resolveZoneKeywords,
  normZoneText,
  splitZoneParts,
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
import {
  fetchPropertyImages,
  getPrimaryPropertyImageUrl,
  sortPropertyImages,
} from './lib/propertyImages';

const HISTORY_LIMIT = 24;
const MAX_TOOL_ROUNDS = 4;

/**
 * Tipos de retorno explicitos: Convex exige anotarlos cuando una action
 * llama funciones declaradas en el MISMO archivo (referencia circular).
 */
type AgentContext = {
  status: 'ai' | 'human' | 'resolved';
  /** 'whatsapp' o 'web' (widget del sitio). En web los envíos por YCloud se
   * omiten y las fichas se guardan como fichas web para el widget. */
  channel: 'whatsapp' | 'web';
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
  /**
   * El equipo ACTIVÓ el bot A PROPÓSITO con el toggle del panel (handoff
   * humano → bot). Si es true, el candado humanHandling NO aplica: el Experto
   * ya atendió y ahora quiere que el bot continúe la conversación.
   */
  aiManualOverride: boolean;
  /**
   * FINCA DE REFERENCIA: el cliente llegó (o preguntó) desde la ficha de UNA
   * finca puntual (mensaje tipo product con productRetailerId). Mientras
   * exista, la venta gira alrededor de ESA finca: nada de catálogo de otras
   * opciones, salvo que el cliente las pida o su grupo no quepa.
   */
  fincaConsultada: {
    finca: string;
    capacidad: number;
    /** DESPUÉS de la ficha, el cliente pidió ver otras/más opciones. */
    pidioOtrasOpciones: boolean;
  } | null;
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
  | { encontrada: true; finca: string; disponible: boolean; nota?: string };

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
        /** Imagen principal (para la ficha del widget web). */
        image?: string | null;
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

/**
 * ¿El cliente pidió ver OTRAS/MÁS opciones? (después de llegar por una finca
 * puntual). Incluye "más barato/económico": pedir algo más barato es pedir
 * alternativas.
 */
function pideMasOpciones(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return /(otra finca|otras fincas|otra opcion|otras opciones|opciones|alternativ|diferente|mas fincas|mas casas|mas propiedades|que mas (tienes|hay|manejan)|ver mas|muestrame|muestreme|ensename|mas barat|mas economic)/.test(
    t,
  );
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

    // FINCA DE REFERENCIA: el mensaje MÁS RECIENTE del cliente que vino de una
    // ficha (metadata.productRetailerId) manda. Si después de esa ficha pidió
    // "otras opciones", el candado del catálogo se levanta. Fallback: el campo
    // pegajoso de la conversación (por si la ficha ya salió de la ventana de
    // historial).
    let fincaConsultada: AgentContext['fincaConsultada'] = null;
    let refRetailerId: string | null = null;
    let refCreatedAt = 0;
    for (const m of ordered) {
      if (m.sender !== 'user' || m.deletedAt) continue;
      const rid = (m.metadata as { productRetailerId?: string } | null)
        ?.productRetailerId;
      if (rid?.trim()) {
        refRetailerId = rid.trim();
        refCreatedAt = m.createdAt;
      }
    }
    if (!refRetailerId && conversation.lastReferredRetailerId) {
      refRetailerId = conversation.lastReferredRetailerId;
      refCreatedAt = conversation.lastReferredAt ?? 0;
    }
    if (refRetailerId) {
      const mapping = await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_retailer', (q) =>
          q.eq('productRetailerId', refRetailerId),
        )
        .first();
      const prop = mapping ? await ctx.db.get(mapping.propertyId) : null;
      if (prop) {
        const pidioOtrasOpciones = ordered.some(
          (m) =>
            m.sender === 'user' &&
            !m.deletedAt &&
            m.createdAt > refCreatedAt &&
            pideMasOpciones(m.content),
        );
        fincaConsultada = {
          finca: prop.title,
          capacidad: prop.capacity,
          pidioOtrasOpciones,
        };
      }
    }
    return {
      status: conversation.status,
      channel: conversation.channel,
      contactPhone: contact?.phone ?? '',
      contactName: contact?.baseName ?? contact?.name ?? '',
      history,
      lastUserMessageId,
      catalogSent: (conversation.lastSentCatalogPropertyIds?.length ?? 0) > 0,
      returning,
      lastRequestedZone: conversation.lastRequestedZone ?? null,
      humanHandling,
      aiManualOverride: conversation.aiManualOverride === true,
      fincaConsultada,
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
    // COSTA SOLO SI LA PIDEN: misma regla comercial que el catálogo — el bot
    // hablaba de Santa Marta/Cartagena en TEXTO porque esta tool no filtraba.
    const quiereCosta = zoneRequestsCoast(zona);
    const matches = all
      // No ofrecer fincas inhabilitadas (active) ni ocultas del catálogo (visible).
      .filter((p) => p.active !== false && p.visible !== false)
      .filter((p) => quiereCosta || !isCoastalProperty(p.location, p.departamentos))
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
    // Evento del calendario del equipo SIN finca confirmada que podría ser
    // esta ("TOCAIMA OCUPADA" y la finca es de Tocaima): se trata como ocupada
    // hasta que el operador lo resuelva en la pantalla de revisión.
    let pendienteRevision = false;
    if (!overlap) {
      const pendientes = await ctx.db
        .query('googleCalendarPendingEvents')
        .collect();
      pendienteRevision = pendientes.some(
        (e) =>
          e.startMs < fechaSalida &&
          e.endMs > fechaEntrada &&
          e.candidatePropertyIds.includes(String(property._id)),
      );
    }
    return {
      encontrada: true as const,
      finca: property.title,
      disponible: !overlap && !pendienteRevision,
      ...(pendienteRevision
        ? {
            nota: 'En el calendario del equipo hay una reserva SIN confirmar que puede ser de esta finca en esas fechas. Trátala como ocupada: dile al cliente que un experto confirma la disponibilidad y ofrece otras opciones.',
          }
        : {}),
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
 * Baraja DETERMINISTA por semilla (Math.random no se permite en queries de
 * Convex). Mismo seed → mismo orden; seeds distintas → órdenes distintos. Sirve
 * para ROTAR qué fincas salen primero en cada envío (variedad).
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    // xorshift32: PRNG barato y estable.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Selecciona fincas para el catalogo con las REGLAS DEL EQUIPO (portadas de
 * fincasya-new/convex/whatsappCatalogs.ts):
 *   - min: capacity >= cupo; techo estricto (capacityCeilForCupo) y, si hay
 *     pocas, pasada relajada — nunca fincas absurdamente grandes.
 *   - Tiers: municipio exacto primero (si dio zona) → FAVORITAS (isFavorite)
 *     → el resto. La ROTACIÓN (seed) baraja dentro de cada tier y decide
 *     CUÁLES entran al lote; el lote que sale se presenta ordenado por
 *     proximidad al cupo (14 → 14,15,16…) y precio asc (Vane, 21-jul).
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
    /**
     * Semilla de ROTACIÓN (la pone runAgentTurn, que sí puede usar Date.now).
     * Baraja el orden dentro de cada tier para que distintos clientes vean
     * fincas DISTINTAS — antes salían siempre las mismas 12 favoritas.
     */
    seed: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { conversationId, personas, zona, mascotas, fechaEntradaMs, fechaSalidaMs, seed },
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

    // FINCAS DE LA SEMANA / FIN DE AÑO (Vane 21-jul): el equipo las selecciona
    // en el inbox para IMPULSARLAS. Saltan el filtro de zona y de costa
    // (elección explícita del equipo) pero CUPO (mínimo Y techo de tamaño),
    // mascotas y disponibilidad se respetan SIEMPRE — una finca de la semana
    // de 20 pax jamás se ofrece a un grupo de 4 (corrección Vane, 21-jul
    // tarde). En la zona pedida van primero; de otras zonas van al final del
    // lote como recomendación extra.
    // ¿Qué lista aplica? Si las fechas pedidas tocan la temporada de fin de
    // año (15-dic → 15-ene, de cualquier año), la lista 'findeano'; si no, la
    // 'semana'. Sin fechas → 'semana'.
    const tocaFinDeAno = (() => {
      if (typeof fechaEntradaMs !== 'number' || typeof fechaSalidaMs !== 'number') {
        return false;
      }
      const y = new Date(fechaEntradaMs).getUTCFullYear();
      // Ventanas candidatas alrededor del año de la entrada (cubre estadías
      // de diciembre y de enero).
      for (const base of [y - 1, y]) {
        const desde = Date.UTC(base, 11, 15); // 15-dic
        const hasta = Date.UTC(base + 1, 0, 16); // 15-ene inclusive
        if (fechaEntradaMs < hasta && fechaSalidaMs > desde) return true;
      }
      return false;
    })();
    const listaActiva = tocaFinDeAno ? 'findeano' : 'semana';
    const picksEnabled = new Set(
      (await ctx.db.query('weeklyPicks').collect())
        .filter((w) => w.enabled && (w.lista ?? 'semana') === listaActiva)
        .map((w) => String(w.propertyId)),
    );
    const esPick = (p: (typeof all)[number]) => picksEnabled.has(String(p._id));

    const zonaTrim = zona?.trim() || undefined;
    const zoneKw = zonaTrim ? resolveZoneKeywords(zonaTrim).keywords : [];
    // Municipios EXACTOS pedidos (para el tier 1 del orden). Soporta varios:
    // "la Vega o Villeta" → ['la vega','villeta'] — antes se comparaba la
    // frase completa y el tier nunca aplicaba con dos municipios.
    const zonaParts = zonaTrim ? splitZoneParts(zonaTrim) : [];

    // COSTA SOLO SI LA PIDEN (regla comercial): Santa Marta, Cartagena, Islas
    // del Rosario… jamás se mezclan en las favoritas sin zona ni en la
    // ampliación a municipios cercanos — solo salen cuando la zona pedida por
    // el cliente ES costa.
    const clienteQuiereCosta = zoneRequestsCoast(zonaTrim);

    // EMBUDO CON CONTEO DE RAZONES (pedido de Vane, 21-jul): cuando llegan
    // pocas fichas, el log dice exactamente dónde se cayó cada finca.
    const razones = {
      yaEnviadas: 0, // ya salieron en este chat (paginación "más opciones")
      apagadas: 0, // active/visible/visibleInWhatsAppCatalog en false
      costa: 0, // costa sin que el cliente la pidiera
      fueraDeZona: 0, // no coincide con la zona pedida
      sinMascotas: 0, // pidieron mascotas y la finca no acepta
      capacidad: 0, // fuera del rango de cupo del grupo
      ocupadas: 0, // reserva/bloqueo se cruza con las fechas
      retenidasCalendario: 0, // evento de calendario sin resolver
      sinFichaMeta: 0, // sin producto registrado en el catálogo Meta
    };
    const base: typeof all = [];
    for (const p of all) {
      if (exclude.has(String(p._id))) {
        razones.yaEnviadas++;
        continue;
      }
      // El bot SOLO envía fincas habilitadas (active), visibles en catálogo
      // (visible) y con el Catálogo Meta/WhatsApp encendido. Si cualquiera de
      // los tres está apagado, la finca NO se envía.
      if (
        p.active === false ||
        p.visible === false ||
        p.visibleInWhatsAppCatalog === false
      ) {
        razones.apagadas++;
        continue;
      }
      // Las fincas de la semana saltan costa y zona (el equipo las eligió).
      if (
        !esPick(p) &&
        !clienteQuiereCosta &&
        isCoastalProperty(p.location, p.departamentos)
      ) {
        razones.costa++;
        continue;
      }
      if (!esPick(p) && !propertyMatchesZone(p.location, p.departamentos, zoneKw)) {
        razones.fueraDeZona++;
        continue;
      }
      if (mascotas && p.allowsPets !== true) {
        razones.sinMascotas++;
        continue;
      }
      base.push(p);
    }

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
      // TECHO SIEMPRE (Vane, 21-jul tarde): jamás se ofrecen casas
      // absurdamente grandes para el grupo. Antes había un último recurso sin
      // techo (minOnly) y las fincas de la semana también lo saltaban — un
      // grupo de 4 recibía mansiones de 40 pax. Ahora el techo relajado es el
      // límite DURO para todas (incluidas las de la semana): si ni así hay
      // opciones, mejor pocas o ninguna — el agente amplía zona o escala a un
      // experto, que ya es el flujo existente para cero resultados.
      matches = strict.length >= 6 ? strict : relaxed;
      razones.capacidad = base.length - matches.length;
    }

    // ORDEN POR TIERS con ROTACIÓN. Antes el orden era fijo (favoritas por
    // capacidad/precio) → cada cliente veía SIEMPRE las mismas 12. Ahora se
    // baraja DENTRO de cada tier con la semilla del turno, así distintos
    // clientes ven fincas distintas y con el tiempo rotan las 97 enviables.
    // Los tiers preservan las reglas buenas:
    //   0. fincas de la SEMANA en la zona pedida (o sin zona) — impulso manual
    //   1. municipio EXACTO pedido (comparación sin tildes)
    //   2. favoritas (política del equipo) — pero rotando CUÁL favorita lidera
    //   3. el resto
    //   4. fincas de la SEMANA de otras zonas — cierran el lote
    const rotSeed = typeof seed === 'number' && seed !== 0 ? seed : 1;
    const inExactZone = (location: string): boolean => {
      if (zonaParts.length === 0) return false;
      const loc = normZoneText(location);
      return zonaParts.some((p) => loc.includes(p));
    };
    // Tiers (0 primero): fincas de la SEMANA en la zona pedida (o sin zona) →
    // municipio exacto → favoritas → resto → fincas de la SEMANA de OTRAS
    // zonas (cierran el lote como recomendación extra — decisión Vane 21-jul).
    const zonaGiven = zonaParts.length > 0;
    const tierPickFirst = matches.filter(
      (p) => esPick(p) && (!zonaGiven || inExactZone(p.location)),
    );
    const tierPickLast = matches.filter(
      (p) => esPick(p) && zonaGiven && !inExactZone(p.location),
    );
    const noPick = matches.filter((p) => !esPick(p));
    const tierExact = noPick.filter((p) => inExactZone(p.location));
    const rest = noPick.filter((p) => !inExactZone(p.location));
    const tierFav = rest.filter((p) => p.isFavorite === true);
    const tierRest = rest.filter((p) => p.isFavorite !== true);
    matches = [
      ...seededShuffle(tierPickFirst, rotSeed),
      ...seededShuffle(tierExact, rotSeed),
      ...seededShuffle(tierFav, rotSeed),
      ...seededShuffle(tierRest, rotSeed),
      ...seededShuffle(tierPickLast, rotSeed),
    ];
    // Tier de cada finca (para ordenar la presentación sin romper los tiers).
    const tierIndex = new Map<string, number>();
    for (const p of tierPickFirst) tierIndex.set(String(p._id), 0);
    for (const p of tierExact) tierIndex.set(String(p._id), 1);
    for (const p of tierFav) tierIndex.set(String(p._id), 2);
    for (const p of tierRest) tierIndex.set(String(p._id), 3);
    for (const p of tierPickLast) tierIndex.set(String(p._id), 4);

    // ¿Filtramos por disponibilidad? Solo si vienen fechas válidas.
    const checkAvailability =
      typeof fechaEntradaMs === 'number' &&
      typeof fechaSalidaMs === 'number' &&
      fechaSalidaMs > fechaEntradaMs;

    // Fincas retenidas por eventos del calendario del equipo SIN finca
    // confirmada ("TOCAIMA OCUPADA" → las fincas de Tocaima): mientras el
    // operador no los resuelva en la revisión, no se ofrecen esas fechas.
    let retenidasPorPendientes: Set<string> | null = null;
    if (checkAvailability) {
      const pendientes = await ctx.db
        .query('googleCalendarPendingEvents')
        .collect();
      retenidasPorPendientes = new Set(
        pendientes
          .filter(
            (e) =>
              e.startMs < (fechaSalidaMs as number) &&
              e.endMs > (fechaEntradaMs as number),
          )
          .flatMap((e) => e.candidatePropertyIds),
      );
    }

    type CatalogItem = Extract<CatalogPickResult, { ok: true }>['items'][number];
    const candidatos: Array<{
      tier: number;
      capacity: number;
      desde: number;
      item: CatalogItem;
    }> = [];
    for (const p of matches) {
      // Los picks de la semana no se cortan en el tope de candidatos: van al
      // final de `matches` (tier 4) y el break se los comería.
      if (candidatos.length >= MAX_CATALOG_CANDIDATES && !esPick(p)) continue;
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
        if (ocupada) {
          razones.ocupadas++;
          continue; // ocupada esas fechas → no se ofrece
        }
        if (retenidasPorPendientes?.has(String(p._id))) {
          razones.retenidasCalendario++;
          continue; // posible ocupada sin confirmar
        }
      }
      const mapping = await ctx.db
        .query('propertyWhatsAppCatalog')
        .withIndex('by_property_and_catalog', (q) =>
          q.eq('propertyId', p._id).eq('catalogId', catalog._id),
        )
        .first();
      if (!mapping) {
        razones.sinFichaMeta++;
        continue; // finca sin ficha en el catalogo Meta
      }
      const prices = [p.priceBase, p.priceBaja, p.priceMedia, p.priceAlta].filter(
        (x): x is number => typeof x === 'number' && x > 0,
      );
      const desde = prices.length > 0 ? Math.min(...prices) : 0;
      const parts: string[] = [];
      if (desde > 0) parts.push(`💰 Desde ${formatCop(desde)} por noche`);
      parts.push(`👥 Hasta ${p.capacity} personas`);
      if (mascotas && p.allowsPets) parts.push('🐶 Pet friendly');
      // Imagen principal (solo la usa el widget web; en WhatsApp la pone Meta).
      const imgs = await fetchPropertyImages(ctx, p._id);
      const image = getPrimaryPropertyImageUrl(sortPropertyImages(imgs));
      candidatos.push({
        tier: tierIndex.get(String(p._id)) ?? 3,
        capacity: p.capacity,
        desde,
        item: {
          propertyId: String(p._id),
          retailerId: mapping.productRetailerId,
          title: p.title,
          bodyText: parts.join(' · '),
          image,
          alternateRetailerIds: p.code?.trim() ? [p.code.trim()] : undefined,
        },
      });
    }

    // LOTE FINAL: hasta 3 puestos GARANTIZADOS al cierre para fincas de la
    // semana de OTRAS zonas (tier 4) — sin la reserva, el lote se llenaría con
    // las de la zona pedida y las de la semana jamás saldrían. La rotación ya
    // decidió CUÁLES 3 (si hay más, entran otras en el próximo envío).
    const MAX_PICKS_FUERA_DE_ZONA = 3;
    const pickFuera = candidatos
      .filter((c) => c.tier === 4)
      .slice(0, MAX_PICKS_FUERA_DE_ZONA);
    const enPickFuera = new Set(pickFuera.map((c) => c.item.propertyId));
    const principal = candidatos.filter((c) => !enPickFuera.has(c.item.propertyId));
    const cupoPrincipal = Math.max(MAX_CATALOG_CARDS - pickFuera.length, 0);
    const lote = [...principal.slice(0, cupoPrincipal), ...pickFuera];
    const repuesto = principal.slice(cupoPrincipal);

    // PRESENTACIÓN ORDENADA SIN MATAR LA ROTACIÓN (pedido de Vane, 21-jul):
    // la rotación (shuffle por seed) ya decidió CUÁLES ~12 fincas entran al
    // lote; aquí ese lote se presenta de la MÁS AJUSTADA al grupo hacia
    // arriba (14 personas → 14,15,16…20) y, a igual cupo, la más económica.
    // Solo se ordena el LOTE que sale (primeras MAX_CATALOG_CARDS): si se
    // ordenaran los 30 candidatos, el envío tomaría siempre las 12 más
    // pequeñas y volveríamos al bug de "siempre las mismas fincas". El resto
    // queda detrás en orden de rotación como repuesto si Meta rechaza alguna.
    // El tier manda primero, así que tier 0 (semana en zona) abre y tier 4
    // (semana fuera de zona) cierra el lote siempre.
    if (personas && personas > 0) {
      lote.sort(
        (a, b) =>
          a.tier - b.tier ||
          a.capacity - b.capacity ||
          (a.desde || Number.MAX_SAFE_INTEGER) - (b.desde || Number.MAX_SAFE_INTEGER),
      );
    }
    const items = [...lote, ...repuesto].map((c) => c.item);

    console.log('[catalogo] embudo', {
      totalFincas: all.length,
      ...razones,
      listaImpulso: listaActiva,
      impulsadasActivas: picksEnabled.size,
      candidatas: matches.length,
      fichasEnviables: items.length,
      personas: personas ?? null,
      zona: zonaTrim ?? null,
      conFechas: checkAvailability,
    });
    return { ok: true, catalogMetaId: catalog.whatsappCatalogId, items };
  },
});

/** Guarda los filtros del último catálogo (prefill del modal del Experto). */
export const saveCatalogSearch = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    location: v.optional(v.string()),
    fechaEntradaMs: v.optional(v.number()),
    fechaSalidaMs: v.optional(v.number()),
    minCapacity: v.optional(v.number()),
    hasPets: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return;
    const prev = conv.lastCatalogSearch;
    const fe =
      typeof args.fechaEntradaMs === 'number' && args.fechaEntradaMs > 0
        ? args.fechaEntradaMs
        : prev?.fechaEntrada;
    const fs =
      typeof args.fechaSalidaMs === 'number' && args.fechaSalidaMs > 0
        ? args.fechaSalidaMs
        : prev?.fechaSalida;
    if (!fe || !fs) return;
    const location = (args.location ?? conv.lastRequestedZone ?? prev?.location ?? '').trim();
    await ctx.db.patch(args.conversationId, {
      lastCatalogSearch: {
        location,
        fechaEntrada: fe,
        fechaSalida: fs,
        minCapacity:
          typeof args.minCapacity === 'number' && args.minCapacity > 0
            ? args.minCapacity
            : prev?.minCapacity,
        hasPets: args.hasPets === true || prev?.hasPets === true ? true : undefined,
        sortByPrice: prev?.sortByPrice,
      },
      ...(args.location?.trim()
        ? { lastRequestedZone: args.location.trim() }
        : {}),
    });
  },
});

/**
 * Resuelve NOMBRES/códigos de finca (los que el equipo escribió en la situación
 * de un audio, ej. "Acacías 330", "Villa Herrera") a fichas de catálogo. Es un
 * OVERRIDE del operador: ignora capacidad, zona y disponibilidad — se envían
 * porque el equipo dijo que son las que quedan. Solo exige que la finca exista,
 * esté activa y tenga ficha en el catálogo Meta.
 */
export const toolResolveFincas = internalQuery({
  args: { nombres: v.array(v.string()) },
  handler: async (
    ctx,
    { nombres },
  ): Promise<{
    catalogMetaId: string | null;
    items: Array<{
      propertyId: string;
      retailerId: string;
      title: string;
      bodyText: string;
      image: string | null;
      alternateRetailerIds?: string[];
    }>;
    noEncontradas: string[];
  }> => {
    const catalog =
      (await ctx.db
        .query('whatsappCatalogs')
        .withIndex('by_is_default', (q) => q.eq('isDefault', true))
        .first()) ?? (await ctx.db.query('whatsappCatalogs').first());
    const all = await ctx.db
      .query('properties')
      .collect()
      .then((ps) => ps.filter((p) => p.active !== false));

    const norm = (s: string) =>
      (s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // Palabras genéricas que NO identifican (para que "Villa Herrera" no
    // matchee cualquier "Villa"). Igual que el matcher del calendario.
    const GENERIC = new Set([
      'VILLA', 'VILLAS', 'CASA', 'CASAS', 'QUINTA', 'HOME', 'HOUSE', 'LUXURY',
      'LUJO', 'FINCA', 'APTO', 'APARTAMENTO', 'CABANA', 'DELUXE', 'DELUX',
      'PAX', 'CAMPESTRE', 'BOUTIQUE', 'PREMIUM', 'DE', 'DEL', 'LA', 'EL', 'LOS',
    ]);
    const tokens = (s: string) =>
      norm(s)
        .split(' ')
        .filter((w) => w.length >= 3 && !GENERIC.has(w));

    const items: Array<{
      propertyId: string;
      retailerId: string;
      title: string;
      bodyText: string;
      image: string | null;
      alternateRetailerIds?: string[];
    }> = [];
    const noEncontradas: string[] = [];
    const usados = new Set<string>();

    for (const nombreRaw of nombres) {
      const wanted = tokens(nombreRaw);
      if (wanted.length === 0) {
        noEncontradas.push(nombreRaw);
        continue;
      }
      // La finca hace match si TODOS los tokens distintivos aparecen en su
      // título o código.
      const candidatos = all.filter((p) => {
        if (usados.has(String(p._id))) return false;
        const hay = norm(`${p.title} ${p.code ?? ''}`);
        return wanted.every((t) => hay.includes(t));
      });
      // Ante empate, la más pequeña primero (título más específico).
      candidatos.sort((a, b) => a.title.length - b.title.length);
      let picked: (typeof all)[number] | null = null;
      let mapping: { productRetailerId: string } | null = null;
      for (const p of candidatos) {
        const m = catalog
          ? await ctx.db
              .query('propertyWhatsAppCatalog')
              .withIndex('by_property_and_catalog', (q) =>
                q.eq('propertyId', p._id).eq('catalogId', catalog._id),
              )
              .first()
          : null;
        if (m) {
          picked = p;
          mapping = m;
          break;
        }
      }
      if (!picked || !mapping) {
        noEncontradas.push(nombreRaw);
        continue;
      }
      usados.add(String(picked._id));
      const prices = [
        picked.priceBase,
        picked.priceBaja,
        picked.priceMedia,
        picked.priceAlta,
      ].filter((x): x is number => typeof x === 'number' && x > 0);
      const desde = prices.length > 0 ? Math.min(...prices) : 0;
      const parts: string[] = [];
      if (desde > 0) parts.push(`💰 Desde ${formatCop(desde)} por noche`);
      parts.push(`👥 Hasta ${picked.capacity} personas`);
      const imgs = await fetchPropertyImages(ctx, picked._id);
      items.push({
        propertyId: String(picked._id),
        retailerId: mapping.productRetailerId,
        title: picked.title,
        bodyText: parts.join(' · '),
        image: getPrimaryPropertyImageUrl(sortPropertyImages(imgs)),
        alternateRetailerIds: picked.code?.trim() ? [picked.code.trim()] : undefined,
      });
    }
    return {
      catalogMetaId: catalog?.whatsappCatalogId ?? null,
      items,
      noEncontradas,
    };
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
        /** Ficha WEB: datos para renderizar la tarjeta en el widget. */
        image: v.optional(v.union(v.string(), v.null())),
        bodyText: v.optional(v.string()),
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
        metadata: {
          productRetailerId: card.retailerId,
          source,
          // Solo el widget web usa esto (imagen/título/precio de la ficha).
          ...(card.image !== undefined || card.bodyText !== undefined
            ? {
                webFicha: {
                  title: card.title,
                  image: card.image ?? null,
                  bodyText: card.bodyText ?? '',
                  retailerId: card.retailerId,
                },
              }
            : {}),
        },
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
              'Zona, municipio o departamento que pidio el cliente (ej. "cerca a bogota", "Melgar"). OBLIGATORIA siempre que el cliente haya NOMBRADO algun lugar en la conversacion — incluso si nombro VARIOS: pasa la frase tal cual ("la Vega o Villeta") y el sistema busca en todos. PERSISTENTE: si el cliente la dio ANTES en el chat, PASALA IGUAL aunque en este mensaje solo actualice fechas o personas — NO la omitas. Solo cambia si el cliente pide OTRA zona; si dice "cualquier lugar / donde sea", pasa exactamente eso.',
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
      name: 'enviar_proceso_reserva',
      description:
        'Envia al cliente el mensaje OFICIAL del proceso de reserva TAL CUAL (validacion de documentos, contrato, 50% de anticipo, el experto genera el link) y ESCALA a un experto en el mismo turno. Usala cuando el cliente pregunte como reservar, como separar, los pasos, el proceso, el anticipo o como se paga. PROHIBIDO redactar el proceso tu mismo o dar medios de pago/numeros de cuenta.',
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

/**
 * FUERA DE HORARIO: las despedidas de escalado prometen "en breve" o "de
 * inmediato" — de noche eso es falso (queja real: interés de compra a las
 * 8:19 p.m. respondido con "un Experto te atenderá en breve"). Si el
 * comportamiento de fuera de horario está activo y aplica, la despedida se
 * REEMPLAZA por el cierre oficial de fuera de servicio (promete la próxima
 * jornada laboral) y se marca como enviado para que no se duplique después.
 * En horario normal devuelve null y la despedida sale tal cual.
 */
async function outOfHoursHandoffOverride(
  ctx: ActionCtx,
  conversationId: Id<'conversations'>,
): Promise<string | null> {
  try {
    const s = await ctx.runQuery(internal.businessHours.getSettingsInternal, {});
    if (!s.enabled || !isOutOfHours(Date.now(), s.schedule)) return null;
    await ctx.runMutation(internal.businessHours.markClosingSent, {
      conversationId,
    });
    return `${s.newClosingMsg}\n\n${formatScheduleText(s.schedule)}`;
  } catch (err) {
    // Si la config falla, mejor la despedida normal que dejar sin respuesta.
    console.error('[agent] fallo el override de fuera de horario', err);
    return null;
  }
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
    // haya carrera de debounce). Además apaga el bot en esta conversación para
    // que quede en manos del humano. EXCEPCIÓN: si el equipo activó el bot A
    // PROPÓSITO con el toggle (aiManualOverride), es un handoff humano → bot y
    // el bot SÍ continúa la conversación.
    if (context.humanHandling && !context.aiManualOverride) {
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
      const handoff =
        (await outOfHoursHandoffOverride(ctx, conversationId)) ??
        buildPriceHandoffReply(context.contactName);
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

    // INTERROGATORIO LARGO (candado determinista): si el bot ya respondió
    // varias preguntas y el cliente sigue preguntando, se corta con cortesía
    // y se escala — la atención personalizada la continúa un Experto.
    const overloadMotivo = detectQuestionOverload(context.history, last.content);
    if (overloadMotivo) {
      const formal = formalSalutationName(context.contactName ?? undefined);
      const overloadText =
        (await outOfHoursHandoffOverride(ctx, conversationId)) ??
        (formal
          ? `¡Listo, ${formal}! Para brindarte una atención más personalizada, te vamos a escalar con un Experto del equipo para que continúe contigo y resuelva todas tus dudas 🤝✨`
          : `¡Listo! Para brindarte una atención más personalizada, te vamos a escalar con un Experto del equipo para que continúe contigo y resuelva todas tus dudas 🤝✨`);
      let overloadWamid: string | undefined;
      if (context.contactPhone) {
        try {
          const sent = await sendWhatsappText({
            to: context.contactPhone,
            text: overloadText,
          });
          overloadWamid = sent.wamid;
        } catch (err) {
          console.error('[agent] fallo el envio de escalacion por interrogatorio', err);
        }
      }
      await ctx.runMutation(internal.agent.saveAssistantMessage, {
        conversationId,
        content: overloadText,
        wamid: overloadWamid,
      });
      await ctx.runMutation(internal.agent.toolEscalar, {
        conversationId,
        motivo: overloadMotivo,
      });
      console.log('[agent] escalado por interrogatorio largo', {
        conversationId,
        overloadMotivo,
      });
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
      const handoffText =
        (await outOfHoursHandoffOverride(ctx, conversationId)) ??
        buildPropertySelectionHandoff(context.contactName);
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
      const reservaHandoff =
        (await outOfHoursHandoffOverride(ctx, conversationId)) ??
        `Un Experto de nuestro equipo revisará tu reserva y te atenderá de inmediato. ⏳🙏`;
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

    const nowBogota = new Date();
    const todayIso = nowBogota.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    // Hora + franja YA calculadas: el modelo NO puede adivinar la hora (solo
    // recibe la fecha). Sin esto, escogia el saludo al azar y erraba la franja
    // (ej. "Buenas tardes" a las 10:27 a.m.). Ver buildSystemPrompt.
    const horaBogota = nowBogota.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const saludoFranja = timeOfDayGreeting(nowBogota);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt({
          exemplars,
          contactName: context.contactName || undefined,
          todayIso,
          horaBogota,
          saludoFranja,
          firstTurn: !botHasSpoken,
        }),
      },
      ...context.history.map((m): ChatMessage =>
        m.sender === 'user'
          ? { role: 'user', content: m.content }
          : { role: 'assistant', content: m.content },
      ),
    ];
    // FINCA DE REFERENCIA: el cliente vino por UNA finca (ficha del catálogo).
    // Regla situacional DURA — el flujo genérico de "fechas+personas → catálogo"
    // NO aplica: la venta gira alrededor de esa finca (queja real del equipo:
    // el bot mandaba otras opciones a quien ya sabía qué finca quería).
    if (context.fincaConsultada && !context.fincaConsultada.pidioOtrasOpciones) {
      const fc = context.fincaConsultada;
      messages.splice(1, 0, {
        role: 'system',
        content: `FINCA DE REFERENCIA — EL CLIENTE VINO POR UNA FINCA PUNTUAL: «${fc.finca}» (capacidad máxima ${fc.capacidad} personas). TODO gira alrededor de ESA finca:
- Perfila fechas y personas normal, pero SIEMPRE hablando de esa finca; PROHIBIDO ofrecer "opciones para tu grupo" o enviar catálogo de otras fincas.
- Si pregunta PRECIO, TARIFA o DISPONIBILIDAD: NO des cifras ni promesas — llama escalar_a_humano EN ESE MISMO TURNO (motivo: "cliente vino por ${fc.finca} — experto cotiza y confirma disponibilidad") y cierra con calidez: un Experto le confirma el valor exacto para sus fechas.
- SOLO se envían otras opciones (enviar_catalogo) si el cliente las pide expresamente o si su grupo NO cabe (más de ${fc.capacidad} personas) o sus fechas no cumplen — y en ese caso explícale primero el porqué.`,
      });
    }

    // AUDIOS DEL BOT (/admin/audios-bot): si el equipo tiene notas de voz
    // habilitadas, el agente recibe una tool dinámica con los casos y decide
    // cuándo aplica (ej. "¿es seguro?" → audio de confianza).
    let botAudios: BotAudioForAgent[] = [];
    try {
      botAudios = await ctx.runQuery(internal.botAudios.listEnabledInternal, {});
    } catch (err) {
      console.error('[agent] fallo cargando audios del bot', err);
    }
    const audioToolDefs: ToolDef[] =
      botAudios.length > 0
        ? [
            {
              type: 'function',
              function: {
                name: 'enviar_respuesta_oficial',
                description:
                  'Envía la RESPUESTA OFICIAL pregrabada del equipo para una situación específica: nota de voz, texto oficial o ambos (salen como mensajes aparte, TAL CUAL los grabó/escribió el equipo). La situación de cada caso es una INSTRUCCIÓN del equipo: si el mensaje del cliente encaja, DEBES usar este caso en vez de escribir tu propio texto. PROHIBIDO parafrasear o adelantar el contenido de un caso (ej. decir tú mismo que "no hay disponibilidad"): esa información SOLO la comunica la respuesta oficial. NUNCA la uses en tu PRIMER mensaje de la conversación — ahí va el saludo normal del ritual; cuando el cliente confirme o repita en su siguiente mensaje, envíala. Si la situación te ordena ENVIAR fincas puntuales (ej. "envíale estas fincas: Acacías 330 y Villa Herrera"), pasa esos nombres en el parámetro `fincas` y se enviarán como fichas de catálogo (son las que el equipo dejó disponibles: se envían AUNQUE parezcan grandes u ocupadas). Usala UNA sola vez por conversación por caso. Casos disponibles:\n' +
                  botAudios
                    .map(
                      (a) =>
                        `- casoId "${String(a.id)}" (${a.titulo}${
                          a.storageId && a.texto
                            ? ', nota de voz + texto'
                            : a.storageId
                              ? ', nota de voz'
                              : ', texto oficial'
                        }): usar cuando ${a.situacion}`,
                    )
                    .join('\n'),
                parameters: {
                  type: 'object',
                  properties: {
                    casoId: {
                      type: 'string',
                      description: 'casoId exacto de la lista de casos disponibles',
                    },
                    fincas: {
                      type: 'array',
                      items: { type: 'string' },
                      description:
                        'SOLO si la situación del caso ordena enviar fincas puntuales: los nombres/códigos de esas fincas tal como aparecen en la instrucción (ej. ["Acacías 330", "Villa Herrera"]). Si la situación no menciona fincas, omítelo.',
                    },
                  },
                  required: ['casoId'],
                },
              },
            },
          ]
        : [];

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
        tools: round < MAX_TOOL_ROUNDS ? [...TOOL_DEFS, ...audioToolDefs] : [],
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
          if (
            call.function.name === 'enviar_catalogo' &&
            context.fincaConsultada &&
            !context.fincaConsultada.pidioOtrasOpciones &&
            (typeof args.personas !== 'number' ||
              args.personas <= context.fincaConsultada.capacidad)
          ) {
            // CANDADO FINCA DE REFERENCIA: vino por una finca puntual, cabe su
            // grupo y NO ha pedido otras opciones → el catálogo NO sale (el
            // modelo no puede saltarse la regla).
            const fc = context.fincaConsultada;
            result = {
              enviado: false,
              nota: `CANDADO: el cliente vino por la finca puntual «${fc.finca}» y NO ha pedido otras opciones — NO se envió ningún catálogo. NO digas que enviaste opciones. Responde SOLO sobre esa finca; si su pregunta es de precio/tarifa/disponibilidad, llama escalar_a_humano AHORA (motivo: "cliente vino por ${fc.finca} — experto cotiza y confirma disponibilidad") y cierra con calidez. Solo si pide expresamente MÁS opciones, o su grupo supera las ${fc.capacidad} personas de la finca, se envía catálogo.`,
            };
            console.log('[agent] enviar_catalogo bloqueado: finca de referencia', {
              conversationId,
              finca: fc.finca,
            });
          } else if (call.function.name === 'buscar_fincas') {
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

            // FINDE AGOTADO 18-20 jul 2026 (temporal): no enviar fichas que
            // luego haya que desdecir. Quitar tras el 20-jul-2026.
            // NOTA: el fin de semana agotado (ej. 18-20 jul) ya NO se maneja
            // aquí con fechas quemadas. Ahora es DINÁMICO desde "Audios del
            // bot": el equipo configura la situación + audio + fincas y el bot
            // lo aplica (enviar_respuesta_oficial). Sin candado hardcodeado.

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
            // CANDADO DE FECHAS: sin fechas válidas NO hay filtro de
            // disponibilidad, y sin ese filtro se ofrecían fincas YA reservadas
            // (queja real del equipo). El catálogo SOLO sale con fechas
            // concretas — el modelo no puede saltarse la regla.
            if (!feMs || !fsMs || fsMs <= feMs) {
              result = {
                enviadas: [],
                error: 'faltan las fechas exactas de entrada y salida',
                nota: 'NO se enviaron fichas: sin fechas exactas no se puede validar qué fincas están libres. Pide al cliente la fecha de entrada y la de salida (una pregunta corta y cálida) y cuando las tengas vuelve a llamar enviar_catalogo con fechaEntrada y fechaSalida (YYYY-MM-DD). PROHIBIDO decir que enviaste opciones.',
              };
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
              console.log('[agent] catalogo bloqueado: sin fechas validas', {
                conversationId,
                fechaEntrada,
                fechaSalida,
              });
              continue;
            }
            // Semilla de rotación: cambia por turno (Date.now solo se puede en
            // la action, no en la query) → cada cliente/envío ve fincas
            // distintas. Misma semilla para el intento principal y el ampliado.
            const catalogSeed = Date.now() % 2147483647;
            let pick = await ctx.runQuery(internal.agent.toolCatalogPick, {
              conversationId,
              personas: typeof args.personas === 'number' ? args.personas : undefined,
              zona: effectiveZona,
              mascotas:
                typeof args.mascotas === 'boolean' ? args.mascotas : undefined,
              fechaEntradaMs: feMs,
              fechaSalidaMs: fsMs,
              seed: catalogSeed,
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
                seed: catalogSeed,
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
                // WEB: no hay catálogo Meta; la ficha se guarda con imagen y
                // precio para que el widget la pinte como tarjeta. WhatsApp:
                // se envía el producto Meta como siempre.
                if (context.channel === 'web') {
                  okCount++;
                  const card = {
                    propertyId: item.propertyId as Id<'properties'>,
                    title: item.title,
                    retailerId: item.retailerId,
                    image: item.image ?? null,
                    bodyText: item.bodyText,
                  };
                  sent.push({ ...card, wamid: undefined });
                  await ctx.runMutation(internal.agent.recordCatalogSend, {
                    conversationId,
                    sent: [card],
                  });
                  continue;
                }
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
                await ctx.runMutation(internal.agent.saveCatalogSearch, {
                  conversationId,
                  location: effectiveZona,
                  fechaEntradaMs: feMs,
                  fechaSalidaMs: fsMs,
                  minCapacity:
                    typeof args.personas === 'number' ? args.personas : undefined,
                  hasPets:
                    typeof args.mascotas === 'boolean' ? args.mascotas : undefined,
                });
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
          } else if (call.function.name === 'enviar_proceso_reserva') {
            let procesoWamid: string | undefined;
            try {
              const sentProceso = await sendWhatsappText({
                to: context.contactPhone,
                text: PROCESO_RESERVA_MSG,
              });
              procesoWamid = sentProceso.wamid;
            } catch (err) {
              console.error('[agent] fallo el envio del proceso de reserva', err);
            }
            await ctx.runMutation(internal.agent.saveAssistantMessage, {
              conversationId,
              content: PROCESO_RESERVA_MSG,
              wamid: procesoWamid,
            });
            await ctx.runMutation(internal.agent.toolEscalar, {
              conversationId,
              motivo:
                'cliente pregunta el proceso de reserva — experto genera contrato y link oficial',
            });
            escalated = true;
            skipFinalReply = true;
            result = {
              enviado: true,
              escalado: true,
              nota: 'El mensaje oficial del proceso de reserva YA se envio TAL CUAL y la conversacion fue escalada a un experto. NO escribas texto final — el mensaje oficial ya cubre todo.',
            };
          } else if (call.function.name === 'iniciar_reserva') {
            const handoffText =
              (await outOfHoursHandoffOverride(ctx, conversationId)) ??
              buildPropertySelectionHandoff(context.contactName);
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
          } else if (call.function.name === 'enviar_respuesta_oficial') {
            const casoIdArg = String(args.casoId ?? args.audioId ?? '').trim();
            const caso =
              botAudios.find((a) => String(a.id) === casoIdArg) ??
              botAudios.find((a) => a.titulo === casoIdArg);
            if (!botHasSpoken) {
              // CANDADO PRIMER MENSAJE (regla del equipo): en el primer turno
              // va el saludo normal del ritual; la respuesta oficial sale
              // cuando el cliente confirme en su siguiente mensaje.
              result = {
                enviado: false,
                nota: 'AÚN NO: este es tu PRIMER mensaje de la conversación. Saluda con el ritual normal y pide/confirma los datos de siempre. PROHIBIDO afirmar que no hay disponibilidad o adelantar el contenido del caso: cuando el cliente responda confirmando la situación, llama enviar_respuesta_oficial de nuevo y ahí sale la respuesta oficial completa.',
              };
              console.log(
                '[agent] respuesta oficial pospuesta: primer mensaje de la conversación',
                { conversationId },
              );
            } else if (!caso) {
              result = {
                enviado: false,
                nota: 'casoId inválido: usa un casoId EXACTO de la lista de la tool.',
              };
            } else if (
              await ctx.runQuery(internal.botAudios.yaEnviadoEnConversacion, {
                conversationId,
                audioId: caso.id,
              })
            ) {
              result = {
                enviado: false,
                nota: `La respuesta oficial «${caso.titulo}» YA se envió antes en esta conversación. NO la repitas: responde en texto normal.`,
              };
            } else if (!context.contactPhone) {
              result = {
                enviado: false,
                nota: 'No hay teléfono del cliente. Responde normal en texto.',
              };
            } else {
              // 1) Nota de voz (si el caso la tiene).
              let audioSent = false;
              let audioWamid: string | undefined;
              if (caso.storageId) {
                try {
                  const blob = await ctx.storage.get(caso.storageId);
                  if (blob) {
                    const sent = await sendAudioToYcloud({
                      to: context.contactPhone,
                      audioBuffer: new Uint8Array(await blob.arrayBuffer()),
                      mimeType: caso.mimeType ?? 'audio/ogg',
                      filename: caso.filename ?? 'nota-de-voz.ogg',
                    });
                    audioSent = true;
                    audioWamid = sent.wamid;
                  }
                } catch (err) {
                  console.error('[agent] fallo el envio de la nota de voz', err);
                }
              }
              // 2) Texto oficial (si el caso lo tiene): sale TAL CUAL, después
              //    de la nota de voz.
              let textoSent = false;
              let textoWamid: string | undefined;
              if (caso.texto) {
                try {
                  const sent = await sendWhatsappText({
                    to: context.contactPhone,
                    text: caso.texto,
                  });
                  textoSent = true;
                  textoWamid = sent.wamid;
                } catch (err) {
                  console.error('[agent] fallo el envio del texto oficial', err);
                }
              }
              if (!audioSent && !textoSent) {
                result = {
                  enviado: false,
                  nota: 'La respuesta oficial NO se pudo enviar (error técnico). Responde normal en texto, sin mencionarla.',
                };
              } else {
                await ctx.runMutation(internal.botAudios.recordSent, {
                  conversationId,
                  audioId: caso.id,
                  audioSent,
                  audioWamid,
                  textoSent,
                  textoWamid,
                });
                // 3) FINCAS PUNTUALES: si la situación ordena enviar fincas
                //    concretas, se resuelven por nombre y salen como fichas
                //    (override del operador: sin filtro de capacidad/dispon.).
                const fincasArg = Array.isArray(args.fincas)
                  ? (args.fincas as unknown[])
                      .map((x) => String(x ?? '').trim())
                      .filter(Boolean)
                  : [];
                const fincasEnviadas: string[] = [];
                if (fincasArg.length > 0) {
                  const resolved = await ctx.runQuery(
                    internal.agent.toolResolveFincas,
                    { nombres: fincasArg },
                  );
                  for (const item of resolved.items) {
                    if (context.channel === 'web') {
                      await ctx.runMutation(internal.agent.recordCatalogSend, {
                        conversationId,
                        sent: [
                          {
                            propertyId: item.propertyId as Id<'properties'>,
                            title: item.title,
                            retailerId: item.retailerId,
                            image: item.image ?? null,
                            bodyText: item.bodyText,
                          },
                        ],
                      });
                      fincasEnviadas.push(item.title);
                      continue;
                    }
                    if (!resolved.catalogMetaId) continue;
                    await new Promise((r) =>
                      setTimeout(r, BETWEEN_CATALOG_SENDS_MS),
                    );
                    const row = await sendCatalogCard({
                      to: context.contactPhone,
                      catalogId: resolved.catalogMetaId,
                      card: {
                        productRetailerId: item.retailerId,
                        bodyText: item.bodyText,
                        alternateRetailerIds: item.alternateRetailerIds,
                      },
                    });
                    if (row.ok) {
                      await ctx.runMutation(internal.agent.recordCatalogSend, {
                        conversationId,
                        sent: [
                          {
                            propertyId: item.propertyId as Id<'properties'>,
                            title: item.title,
                            retailerId: item.retailerId,
                            wamid: row.wamid,
                          },
                        ],
                      });
                      fincasEnviadas.push(item.title);
                    }
                  }
                  if (resolved.noEncontradas.length > 0) {
                    console.warn(
                      '[agent] respuesta oficial: fincas no resueltas',
                      resolved.noEncontradas,
                    );
                  }
                }
                console.log('[agent] respuesta oficial enviada', {
                  conversationId,
                  caso: caso.titulo,
                  audioSent,
                  textoSent,
                  fincas: fincasEnviadas.length,
                });
                const canal =
                  audioSent && textoSent
                    ? 'nota de voz + texto oficial'
                    : audioSent
                      ? 'nota de voz'
                      : 'texto oficial';
                result = {
                  enviado: true,
                  nota:
                    `La respuesta oficial «${caso.titulo}» YA se envió (${canal})` +
                    (fincasEnviadas.length > 0
                      ? ` junto con las fichas de: ${fincasEnviadas.join(', ')}. NO envíes más fincas ni llames enviar_catalogo.`
                      : '.') +
                    ' NO repitas su contenido en texto: acompáñala máximo con UNA línea corta y natural.',
                };
              }
            }
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
      // Garantia de franja: en el PRIMER turno el modelo SIEMPRE abre con
      // saludo (aunque el cliente no haya dicho "hola" — ej. "30 de diciembre").
      // prependGreetingIfNeeded solo corrige si el cliente saludo, asi que aqui
      // forzamos la franja correcta segun la hora real en Colombia.
      reply = fixTimeGreetingSlot(reply);
    } else {
      // Candado anti "Hola" doble: si ya saludamos y el LLM abre con
      // "¡Hola...!" otra vez, se recorta el prefijo (el resto queda intacto).
      const stripped = stripRedundantHolaPrefix(reply);
      if (stripped) reply = stripped;
    }

    // ESCALADO FUERA DE HORARIO: la respuesta del LLM promete "un Experto te
    // atenderá en breve" — de noche eso es falso. Se reemplaza por el cierre
    // oficial de fuera de servicio (en horario normal sale la respuesta tal cual).
    if (escalated) {
      const override = await outOfHoursHandoffOverride(ctx, conversationId);
      if (override) {
        reply = override;
        console.log(
          '[agent] despedida de escalado reemplazada por cierre de fuera de horario',
          { conversationId },
        );
      }
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

    const nowBogota = new Date();
    const todayIso = nowBogota.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    const horaBogota = nowBogota.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt({
          exemplars,
          contactName: args.contactName,
          todayIso,
          horaBogota,
          saludoFranja: timeOfDayGreeting(nowBogota),
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
    // Misma garantia de franja que produccion cuando es primer turno.
    const response =
      content && (args.firstTurn ?? false)
        ? fixTimeGreetingSlot(content, nowBogota)
        : content;
    return { response };
  },
});
