/**
 * AUDIOS DEL BOT (/admin/audios-bot): casos con respuesta OFICIAL que el bot
 * envía cuando la conversación cae en la situación configurada (ej. el
 * cliente pregunta "¿es seguro? ¿son confiables?" → audio de confianza).
 * Cada caso puede tener nota de voz, texto oficial (sale TAL CUAL, el modelo
 * no lo reescribe) o ambos.
 *
 * - El equipo crea el caso (título + situación), carga audio/texto y lo habilita.
 * - El agente recibe una tool dinámica (`enviar_respuesta_oficial`) con los
 *   casos habilitados y decide cuándo aplica; el audio sale como NOTA DE VOZ.
 * - Candado: máximo UN envío por caso por conversación (no bombardear).
 */
import { v } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import type { Id } from './_generated/dataModel';

// ============ PANEL (CRUD) ============

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('botAudios').collect();
    const out = [];
    for (const r of rows) {
      out.push({
        id: r._id,
        titulo: r.titulo,
        situacion: r.situacion,
        texto: r.texto ?? null,
        enabled: r.enabled,
        sentCount: r.sentCount ?? 0,
        filename: r.filename ?? null,
        mimeType: r.mimeType ?? null,
        url: r.storageId ? await ctx.storage.getUrl(r.storageId) : null,
        createdAt: r.createdAt,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const create = mutation({
  args: {
    titulo: v.string(),
    situacion: v.string(),
    storageId: v.optional(v.id('_storage')),
    mimeType: v.optional(v.string()),
    filename: v.optional(v.string()),
    texto: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const titulo = args.titulo.trim();
    const situacion = args.situacion.trim();
    const texto = args.texto?.trim() || undefined;
    if (!titulo) throw new Error('El título del caso es obligatorio.');
    if (!situacion) {
      throw new Error(
        'Describe la situación en la que el bot debe enviar esta respuesta.',
      );
    }
    if (!args.storageId && !texto) {
      throw new Error('El caso necesita al menos un audio o un texto oficial.');
    }
    const now = Date.now();
    return await ctx.db.insert('botAudios', {
      titulo,
      situacion,
      storageId: args.storageId,
      mimeType: args.mimeType,
      filename: args.filename,
      texto,
      enabled: true,
      sentCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('botAudios'),
    titulo: v.optional(v.string()),
    situacion: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    /** Texto oficial ('' = quitarlo; siempre debe quedar audio o texto). */
    texto: v.optional(v.string()),
    /** Reemplazo/carga del archivo: se borra el audio anterior del storage. */
    storageId: v.optional(v.id('_storage')),
    mimeType: v.optional(v.string()),
    filename: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error('Caso no encontrado.');
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.titulo !== undefined) {
      const t = args.titulo.trim();
      if (!t) throw new Error('El título no puede quedar vacío.');
      patch.titulo = t;
    }
    if (args.situacion !== undefined) {
      const s = args.situacion.trim();
      if (!s) throw new Error('La situación no puede quedar vacía.');
      patch.situacion = s;
    }
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (args.texto !== undefined) {
      const tx = args.texto.trim();
      const tendraAudio = args.storageId !== undefined || !!row.storageId;
      if (!tx && !tendraAudio) {
        throw new Error('El caso necesita al menos un audio o un texto oficial.');
      }
      patch.texto = tx || undefined;
    }
    if (args.storageId !== undefined) {
      if (row.storageId) await ctx.storage.delete(row.storageId);
      patch.storageId = args.storageId;
      patch.mimeType = args.mimeType;
      patch.filename = args.filename;
    }
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id('botAudios') },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return { ok: false };
    if (row.storageId) await ctx.storage.delete(row.storageId);
    await ctx.db.delete(id);
    return { ok: true };
  },
});

// ============ AGENTE ============

export type BotAudioForAgent = {
  id: Id<'botAudios'>;
  titulo: string;
  situacion: string;
  storageId: Id<'_storage'> | null;
  mimeType: string | null;
  filename: string | null;
  texto: string | null;
};

/** Casos habilitados, para armar la tool dinámica del agente. */
export const listEnabledInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<BotAudioForAgent[]> => {
    const rows = await ctx.db
      .query('botAudios')
      .withIndex('by_enabled', (q) => q.eq('enabled', true))
      .collect();
    return rows.map((r) => ({
      id: r._id,
      titulo: r.titulo,
      situacion: r.situacion,
      storageId: r.storageId ?? null,
      mimeType: r.mimeType ?? null,
      filename: r.filename ?? null,
      texto: r.texto ?? null,
    }));
  },
});

/** ¿Este audio ya se envió en esta conversación? (candado anti-repetición). */
export const yaEnviadoEnConversacion = internalQuery({
  args: { conversationId: v.id('conversations'), audioId: v.id('botAudios') },
  handler: async (ctx, { conversationId, audioId }): Promise<boolean> => {
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .collect();
    const key = String(audioId);
    return msgs.some(
      (m) =>
        !m.deletedAt &&
        (m.metadata as { botAudioId?: string } | null)?.botAudioId === key,
    );
  },
});

/** Persiste el envío en el inbox (sin sentByUserId → no cuenta como Experto). */
export const recordSent = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    audioId: v.id('botAudios'),
    audioSent: v.boolean(),
    audioWamid: v.optional(v.string()),
    textoSent: v.boolean(),
    textoWamid: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { conversationId, audioId, audioSent, audioWamid, textoSent, textoWamid },
  ): Promise<void> => {
    const audio = await ctx.db.get(audioId);
    if (!audio) return;
    const now = Date.now();
    if (audioSent && audio.storageId) {
      await ctx.db.insert('messages', {
        conversationId,
        sender: 'assistant',
        content: `🎙️ Nota de voz: ${audio.titulo}`,
        type: 'audio',
        mediaUrl: (await ctx.storage.getUrl(audio.storageId)) ?? undefined,
        mediaFilename: audio.filename ?? undefined,
        mediaMime: audio.mimeType ?? undefined,
        wamid: audioWamid,
        whatsappStatus: audioWamid ? 'sent' : undefined,
        metadata: { source: 'bot_audio', botAudioId: String(audioId) },
        createdAt: now,
      });
    }
    if (textoSent && audio.texto) {
      await ctx.db.insert('messages', {
        conversationId,
        sender: 'assistant',
        content: audio.texto,
        type: 'text',
        wamid: textoWamid,
        whatsappStatus: textoWamid ? 'sent' : undefined,
        metadata: { source: 'bot_audio', botAudioId: String(audioId) },
        createdAt: now + 1, // el texto va DESPUÉS de la nota de voz
      });
    }
    await ctx.db.patch(audioId, {
      sentCount: (audio.sentCount ?? 0) + 1,
      updatedAt: now,
    });
    await ctx.db.patch(conversationId, { lastMessageAt: now });
  },
});
