/**
 * Procesamiento de media entrante (audio/imagen) ANTES del turno del agente.
 *
 * - Nota de voz -> transcripcion con Whisper (es), el contenido del mensaje
 *   pasa a ser "🎙️ <texto>" para que el agente y el RAG trabajen con texto.
 * - Imagen -> descripcion breve con vision (gpt-4o-mini), contenido pasa a
 *   "[imagen] <descripcion>" (+ caption original si venia).
 *
 * Si el analisis falla, se conserva el placeholder y el agente responde
 * igual (sabra que llego un audio/imagen que no pudo procesar).
 */
import { action, internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

/** Espera del agente tras procesar media (agrupa rafagas, igual que texto). */
const AGENT_DEBOUNCE_MS = 7000;

export const getMessageForMedia = internalQuery({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }) => {
    const m = await ctx.db.get(messageId);
    if (!m) return null;
    return {
      type: m.type ?? 'text',
      mediaUrl: m.mediaUrl ?? null,
      content: m.content,
      transcription: m.transcription ?? null,
    };
  },
});

export const patchMessageContent = internalMutation({
  args: { messageId: v.id('messages'), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    await ctx.db.patch(messageId, { content });
  },
});

/** Guarda la transcripción de una nota de voz en el mensaje. */
export const patchMessageTranscription = internalMutation({
  args: { messageId: v.id('messages'), transcription: v.string() },
  handler: async (ctx, { messageId, transcription }) => {
    await ctx.db.patch(messageId, { transcription });
  },
});

/**
 * Transcribe la nota de voz de un mensaje BAJO DEMANDA (botón "Transcribir"
 * del inbox) y la guarda en `transcription`. Idempotente: si ya está, la
 * devuelve sin re-transcribir.
 */
export const transcribeMessageAudio = action({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }): Promise<{ ok: boolean; text?: string; motivo?: string }> => {
    const msg = await ctx.runQuery(internal.media.getMessageForMedia, { messageId });
    if (!msg) return { ok: false, motivo: 'Mensaje no existe' };
    if (msg.type !== 'audio' || !msg.mediaUrl) return { ok: false, motivo: 'No es una nota de voz' };
    try {
      const text = await transcribeAudio(msg.mediaUrl);
      const clean = text.trim();
      if (!clean) return { ok: false, motivo: 'No se pudo transcribir (audio vacío)' };
      await ctx.runMutation(internal.media.patchMessageTranscription, {
        messageId,
        transcription: clean,
      });
      return { ok: true, text: clean };
    } catch (err) {
      console.error('[media] transcripción bajo demanda falló', err);
      return { ok: false, motivo: err instanceof Error ? err.message : 'Error al transcribir' };
    }
  },
});

/**
 * Transcribe una nota de voz AUTOMÁTICAMENTE (asesor desde el teléfono o el
 * panel, o cliente cuando ya lo atiende un humano) y la guarda en
 * `transcription`, SIN disparar turno del agente. Idempotente: si ya está
 * transcrita, no re-transcribe. Así el RAG (curación nocturna) también aprende
 * de las respuestas por audio del equipo.
 */
export const autoTranscribeAudio = internalAction({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }): Promise<void> => {
    const msg = await ctx.runQuery(internal.media.getMessageForMedia, { messageId });
    if (!msg || msg.type !== 'audio' || !msg.mediaUrl) return;
    if (msg.transcription && msg.transcription.trim()) return; // ya transcrito
    try {
      const text = (await transcribeAudio(msg.mediaUrl)).trim();
      if (!text) return;
      await ctx.runMutation(internal.media.patchMessageTranscription, {
        messageId,
        transcription: text,
      });
    } catch (err) {
      console.error('[media] auto-transcripción falló', err);
    }
  },
});

async function transcribeAudio(audioUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Error al descargar el audio: ${audioRes.statusText}`);
  }
  const arrayBuffer = await (await audioRes.blob()).arrayBuffer();
  const formData = new FormData();
  const file = new File([arrayBuffer], 'audio.ogg', {
    type: audioRes.headers.get('Content-Type') || 'audio/ogg',
  });
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');
  // Vocabulario del negocio: mejora precision en nombres/terminos frecuentes.
  formData.append(
    'prompt',
    'Cliente de FincasYa preguntando por alquiler de fincas: fechas, personas, Melgar, Girardot, Anapoima, piscina, mascotas, reserva, abono.',
  );
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text.trim();
}

async function describeImage(imageUrl: string, caption: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
  // Descargamos y pasamos la imagen como data URL: el link de YCloud es
  // firmado/temporal y OpenAI a veces no puede descargarlo directo.
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Error al descargar la imagen: ${imgRes.statusText}`);
  }
  const mime = imgRes.headers.get('Content-Type') || 'image/jpeg';
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  const dataUrl = `data:${mime};base64,${btoa(binary)}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe brevemente (2-3 frases, espanol) esta imagen enviada por un cliente a una agencia de alquiler de fincas. Si es un comprobante de pago, di el valor, banco y fecha si se ven. Si es una captura de una finca/catalogo, di cual parece ser. Si es un documento, di de que tipo.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vision ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const desc = (json.choices?.[0]?.message?.content ?? '').trim();
  return caption && !caption.startsWith('[') ? `${desc}\nTexto del cliente: ${caption}` : desc;
}

/**
 * Analiza el media del mensaje, actualiza su contenido a texto util y agenda
 * el turno del agente (con el mismo debounce que un mensaje de texto).
 */
export const processInboundMedia = internalAction({
  args: { messageId: v.id('messages'), conversationId: v.id('conversations') },
  handler: async (ctx, { messageId, conversationId }): Promise<void> => {
    const message = await ctx.runQuery(internal.media.getMessageForMedia, {
      messageId,
    });
    if (message?.mediaUrl) {
      try {
        if (message.type === 'audio') {
          const text = await transcribeAudio(message.mediaUrl);
          if (text) {
            await ctx.runMutation(internal.media.patchMessageContent, {
              messageId,
              content: `🎙️ ${text}`,
            });
            // También en `transcription` para que la curación (RAG) lo lea.
            await ctx.runMutation(internal.media.patchMessageTranscription, {
              messageId,
              transcription: text.trim(),
            });
          }
        } else if (message.type === 'image') {
          const desc = await describeImage(message.mediaUrl, message.content);
          if (desc) {
            await ctx.runMutation(internal.media.patchMessageContent, {
              messageId,
              content: `[imagen] ${desc}`,
            });
          }
        }
      } catch (err) {
        // El agente respondera igual con el placeholder.
        console.error('[media] fallo el analisis, se conserva placeholder', err);
      }
    }
    await ctx.scheduler.runAfter(AGENT_DEBOUNCE_MS, internal.agent.runAgentTurn, {
      conversationId,
      triggerMessageId: messageId,
    });
  },
});
