/**
 * ARCHIVO DE DOCUMENTOS POR CONTRATO (Adriana, 22-jul).
 *
 * Cada contrato es una carpeta con el nombre de su codificación y dentro dos
 * subcarpetas: `contratos` y `confirmaciones`. Un archivo entra al archivo
 * cuando se ENVÍA al cliente, no cuando se genera.
 *
 * Ciclo del contrato:
 *   se envía por WhatsApp        → `contrato` / enviado
 *   el cliente devuelve el firmado → `contrato_firmado` / firmado  (lo valida la IA)
 *   el cliente nunca firmó         → el asesor lo marca `nulo`
 *
 * Las confirmaciones de pago (CR) se archivan igual, con el abono con el que
 * se emitieron.
 */
import { v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import { normalizeContractLookupQueryConvex } from './lib/contractLookup';
import {
  carpetaDeContrato,
  validarDocumentoFirmado,
  type VeredictoFirma,
} from './lib/contractDocsAi';
import { authComponent } from './betterAuth/auth';
import { isSuperAdminRole } from './lib/roles';

const tipoValidator = v.union(
  v.literal('contrato'),
  /** El .docx editable del mismo contrato, por si hay que corregirlo. */
  v.literal('contrato_word'),
  v.literal('contrato_firmado'),
  v.literal('confirmacion'),
);

const estadoValidator = v.union(
  v.literal('enviado'),
  v.literal('firmado'),
  v.literal('nulo'),
);

/** Registra un archivo en la carpeta del contrato. Idempotente por URL. */
export const registerDocument = mutation({
  args: {
    contractNumber: v.string(),
    tipo: tipoValidator,
    estado: estadoValidator,
    url: v.string(),
    filename: v.string(),
    conversationId: v.optional(v.string()),
    montoAbonado: v.optional(v.number()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const contractNumber = args.contractNumber.trim();
    const url = args.url.trim();
    if (!contractNumber || !url) return { ok: false };

    const yaEsta = await ctx.db
      .query('contractDocuments')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', contractNumber),
      )
      .collect();
    const now = Date.now();
    const dup = yaEsta.find((d) => d.url === url);
    if (dup) {
      await ctx.db.patch(dup._id, { estado: args.estado, updatedAt: now });
      return { ok: true };
    }

    // VERSIONADO (Adriana, 22-jul): cada contrato nuevo o corregido sube una
    // versión. El PDF y su Word de la misma tanda comparten número: se agrupan
    // por el instante de creación cuando entran juntos.
    let version: number | undefined;
    if (args.tipo === 'contrato' || args.tipo === 'contrato_word') {
      const versiones = yaEsta
        .filter((d) => d.tipo === 'contrato' || d.tipo === 'contrato_word')
        .map((d) => d.version ?? 1);
      const maxVersion = versiones.length ? Math.max(...versiones) : 0;
      // El Word y el PDF de la MISMA generación comparten versión: si el otro
      // formato acaba de registrarse (menos de 2 min), se reutiliza su número.
      const gemelo = yaEsta.find(
        (d) =>
          (d.tipo === 'contrato' || d.tipo === 'contrato_word') &&
          d.tipo !== args.tipo &&
          now - d.createdAt < 120_000,
      );
      version = gemelo?.version ?? maxVersion + 1;
    }

    await ctx.db.insert('contractDocuments', {
      contractNumber,
      version,
      tipo: args.tipo,
      estado: args.estado,
      url,
      filename: args.filename.trim() || 'documento.pdf',
      conversationId: args.conversationId?.trim() || undefined,
      montoAbonado: args.montoAbonado,
      messageId: args.messageId?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Enlaza el archivo con el registro del contrato para que el Gestor lo
    // refleje (Adriana, 22-jul): la confirmación del inbox se archivaba en su
    // carpeta pero el contrato no la mostraba, así que no aparecía en la
    // pestaña Confirmaciones.
    if (args.tipo === 'confirmacion') {
      const contrato = await ctx.db
        .query('contracts')
        .withIndex('by_contract_number', (q) =>
          q.eq('contractNumber', contractNumber),
        )
        .first();
      if (contrato && !contrato.confirmationPdfUrl) {
        await ctx.db.patch(contrato._id, {
          confirmationPdfUrl: url,
          confirmationPdfFilename: args.filename.trim() || undefined,
          updatedAt: now,
        });
      }
    }
    return { ok: true };
  },
});

/**
 * LAS CARPETAS. Una por contrato que tenga al menos un archivo enviado.
 *
 * Devuelve solo lo justo para pintar el explorador: el nombre de la carpeta
 * (la codificación) y cuántos archivos tiene cada subcarpeta.
 */
export const listFolders = query({
  args: { buscar: v.optional(v.string()) },
  handler: async (ctx, { buscar }) => {
    const docs = await ctx.db.query('contractDocuments').collect();

    const porCarpeta = new Map<
      string,
      { contratos: number; confirmaciones: number; ultimoAt: number }
    >();
    for (const d of docs) {
      const actual = porCarpeta.get(d.contractNumber) ?? {
        contratos: 0,
        confirmaciones: 0,
        ultimoAt: 0,
      };
      if (d.tipo === 'confirmacion') actual.confirmaciones += 1;
      else actual.contratos += 1;
      actual.ultimoAt = Math.max(actual.ultimoAt, d.createdAt);
      porCarpeta.set(d.contractNumber, actual);
    }

    const needle = (buscar ?? '').trim().toLowerCase();
    return [...porCarpeta.entries()]
      .filter(([contractNumber]) =>
        needle ? contractNumber.toLowerCase().includes(needle) : true,
      )
      .map(([contractNumber, info]) => ({ contractNumber, ...info }))
      .sort((a, b) => b.ultimoAt - a.ultimoAt);
  },
});

/**
 * ÚLTIMA VERSIÓN del contrato de una carpeta (Adriana, 22-jul).
 *
 * El CR debe emitirse contra la versión más reciente: si el contrato se
 * corrigió y quedó una v2, la confirmación va sobre la v2, no sobre la v1.
 */
export const getLatestContractVersion = query({
  args: { contractNumber: v.string() },
  handler: async (ctx, { contractNumber }) => {
    const raw = contractNumber.trim();
    if (!raw) return null;
    const normalized = normalizeContractLookupQueryConvex(raw) || raw;

    const docs = [];
    for (const key of [...new Set([normalized, raw])]) {
      const rows = await ctx.db
        .query('contractDocuments')
        .withIndex('by_contract_number', (q) => q.eq('contractNumber', key))
        .collect();
      docs.push(...rows);
    }

    const contratos = docs.filter(
      (d) => d.tipo === 'contrato' || d.tipo === 'contrato_word',
    );
    if (contratos.length === 0) return null;

    const maxVersion = Math.max(...contratos.map((d) => d.version ?? 1));
    const deLaVersion = contratos
      .filter((d) => (d.version ?? 1) === maxVersion)
      .sort((a, b) => b.createdAt - a.createdAt);

    const pdf = deLaVersion.find((d) => d.tipo === 'contrato');
    const word = deLaVersion.find((d) => d.tipo === 'contrato_word');
    return {
      version: maxVersion,
      totalVersiones: maxVersion,
      pdfUrl: pdf?.url ?? null,
      pdfFilename: pdf?.filename ?? null,
      wordUrl: word?.url ?? null,
      wordFilename: word?.filename ?? null,
      createdAt: deLaVersion[0]?.createdAt ?? null,
    };
  },
});

/** Borra un archivo de la carpeta (el asesor lo elimina si no sirve). */
export const deleteDocument = mutation({
  args: { documentId: v.id('contractDocuments') },
  handler: async (ctx, { documentId }): Promise<{ ok: boolean }> => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return { ok: false };
    await ctx.db.delete(documentId);

    // Si era la confirmación enlazada al contrato, se limpia esa referencia
    // para que el Gestor no apunte a un archivo que ya no existe.
    if (doc.tipo === 'confirmacion') {
      const contrato = await ctx.db
        .query('contracts')
        .withIndex('by_contract_number', (q) =>
          q.eq('contractNumber', doc.contractNumber),
        )
        .first();
      if (contrato && contrato.confirmationPdfUrl === doc.url) {
        await ctx.db.patch(contrato._id, {
          confirmationPdfUrl: undefined,
          confirmationPdfFilename: undefined,
          updatedAt: Date.now(),
        });
      }
    }
    return { ok: true };
  },
});

/**
 * Borra TODA la carpeta de un contrato (todos los archivos archivados).
 * Solo `superadmin` — no lo ve/usa el resto del equipo.
 */
export const deleteFolder = mutation({
  args: { contractNumber: v.string() },
  handler: async (
    ctx,
    { contractNumber },
  ): Promise<{ ok: boolean; deleted: number }> => {
    const user = (await authComponent.safeGetAuthUser(ctx)) as {
      role?: string | null;
    } | null;
    if (!isSuperAdminRole(user?.role)) {
      throw new Error('Solo el superadmin puede eliminar carpetas.');
    }

    const raw = contractNumber.trim();
    if (!raw) return { ok: false, deleted: 0 };
    const normalized = normalizeContractLookupQueryConvex(raw) || raw;
    const keys = [...new Set([normalized, raw])];

    const seen = new Set<string>();
    const docs = [];
    for (const key of keys) {
      const rows = await ctx.db
        .query('contractDocuments')
        .withIndex('by_contract_number', (q) => q.eq('contractNumber', key))
        .collect();
      for (const row of rows) {
        const id = String(row._id);
        if (seen.has(id)) continue;
        seen.add(id);
        docs.push(row);
      }
    }

    const confirmationUrls = new Set(
      docs.filter((d) => d.tipo === 'confirmacion').map((d) => d.url),
    );

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    if (confirmationUrls.size > 0) {
      for (const key of keys) {
        const contrato = await ctx.db
          .query('contracts')
          .withIndex('by_contract_number', (q) =>
            q.eq('contractNumber', key),
          )
          .first();
        if (
          contrato?.confirmationPdfUrl &&
          confirmationUrls.has(contrato.confirmationPdfUrl)
        ) {
          await ctx.db.patch(contrato._id, {
            confirmationPdfUrl: undefined,
            confirmationPdfFilename: undefined,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return { ok: true, deleted: docs.length };
  },
});

/** Los archivos de un contrato, agrupados por subcarpeta. */
export const listByContract = query({
  args: { contractNumber: v.string() },
  handler: async (ctx, { contractNumber }) => {
    const raw = contractNumber.trim();
    if (!raw) return { carpeta: '', contratos: [], confirmaciones: [] };
    const normalized = normalizeContractLookupQueryConvex(raw) || raw;

    const keys = [...new Set([normalized, raw])];
    const docs = [];
    for (const key of keys) {
      const rows = await ctx.db
        .query('contractDocuments')
        .withIndex('by_contract_number', (q) => q.eq('contractNumber', key))
        .collect();
      docs.push(...rows);
    }
    docs.sort((a, b) => a.createdAt - b.createdAt);

    return {
      carpeta: carpetaDeContrato(normalized),
      contratos: docs.filter((d) => d.tipo !== 'confirmacion'),
      confirmaciones: docs.filter((d) => d.tipo === 'confirmacion'),
    };
  },
});

/** Marca un documento (ej. el asesor lo declara nulo porque no lo firmaron). */
export const setEstado = mutation({
  args: {
    documentId: v.id('contractDocuments'),
    estado: estadoValidator,
  },
  handler: async (ctx, { documentId, estado }): Promise<{ ok: boolean }> => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return { ok: false };
    await ctx.db.patch(documentId, { estado, updatedAt: Date.now() });

    // El contrato sigue al documento: si su contrato quedó nulo, el registro
    // del contrato también, para que la lista no lo muestre como vigente.
    if (doc.tipo === 'contrato' && estado === 'nulo') {
      const contrato = await ctx.db
        .query('contracts')
        .withIndex('by_contract_number', (q) =>
          q.eq('contractNumber', doc.contractNumber),
        )
        .first();
      if (contrato) {
        await ctx.db.patch(contrato._id, {
          estado: 'anulado',
          updatedAt: Date.now(),
        });
      }
    }
    return { ok: true };
  },
});

/**
 * Contrato enviado por un chat, para saber contra qué comparar el documento
 * que devuelve el cliente.
 */
export const getSentContractForConversation = internalQuery({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const docs = await ctx.db
      .query('contractDocuments')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', conversationId),
      )
      .collect();
    const enviados = docs
      .filter((d) => d.tipo === 'contrato' && d.estado === 'enviado')
      .sort((a, b) => b.createdAt - a.createdAt);
    const doc = enviados[0];
    if (!doc) return null;

    const contrato = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', doc.contractNumber),
      )
      .first();

    return {
      documentId: doc._id,
      contractNumber: doc.contractNumber,
      clienteNombre: contrato?.clienteNombre ?? '',
      clienteCedula: contrato?.clienteCedula ?? '',
    };
  },
});

/** Guarda el firmado validado y mueve el contrato a `firmado`. */
export const saveSignedContract = internalMutation({
  args: {
    contractNumber: v.string(),
    url: v.string(),
    filename: v.string(),
    conversationId: v.string(),
    messageId: v.optional(v.string()),
    veredicto: v.object({
      coincide: v.boolean(),
      motivo: v.string(),
      contratoDetectado: v.optional(v.string()),
      nombreDetectado: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const now = Date.now();
    await ctx.db.insert('contractDocuments', {
      contractNumber: args.contractNumber,
      tipo: 'contrato_firmado',
      estado: 'firmado',
      url: args.url,
      filename: args.filename,
      conversationId: args.conversationId,
      messageId: args.messageId,
      validacionIa: { ...args.veredicto, revisadaAt: now },
      createdAt: now,
      updatedAt: now,
    });

    // El contrato original pasa de "enviado" a "firmado".
    const enviados = await ctx.db
      .query('contractDocuments')
      .withIndex('by_contract_and_tipo', (q) =>
        q.eq('contractNumber', args.contractNumber).eq('tipo', 'contrato'),
      )
      .collect();
    for (const d of enviados) {
      if (d.estado === 'enviado') {
        await ctx.db.patch(d._id, { estado: 'firmado', updatedAt: now });
      }
    }

    const contrato = await ctx.db
      .query('contracts')
      .withIndex('by_contract_number', (q) =>
        q.eq('contractNumber', args.contractNumber),
      )
      .first();
    if (contrato) {
      await ctx.db.patch(contrato._id, { estado: 'firmado', updatedAt: now });
    }
    return { ok: true };
  },
});

/** Aviso al asesor en el chat (lo escribe el sistema, no el bot). */
export const notifyAdvisor = internalMutation({
  args: { conversationId: v.string(), content: v.string() },
  handler: async (ctx, { conversationId, content }): Promise<void> => {
    const convId = ctx.db.normalizeId('conversations', conversationId);
    if (!convId) return;
    await ctx.db.insert('messages', {
      conversationId: convId,
      sender: 'system',
      content,
      type: 'text',
      createdAt: Date.now(),
      metadata: { kind: 'contract_signed_check' },
    });
  },
});

/**
 * El cliente mandó un documento/foto al chat: ¿es el contrato firmado?
 *
 * Lo lee la IA y lo compara con el contrato que se le envió a ESE chat. Si
 * coincide, se archiva y el contrato pasa a `firmado`. Si no, no se archiva
 * nada y queda un aviso para el asesor — nunca se da por firmado a la fuerza.
 */
export const checkIncomingSignedContract = internalAction({
  args: {
    conversationId: v.string(),
    fileUrl: v.string(),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ archivado: boolean; motivo: string }> => {
    const esperado: {
      documentId: string;
      contractNumber: string;
      clienteNombre: string;
      clienteCedula: string;
    } | null = await ctx.runQuery(
      internal.contractDocuments.getSentContractForConversation,
      { conversationId: args.conversationId },
    );
    if (!esperado) {
      return {
        archivado: false,
        motivo: 'A este chat no se le ha enviado ningún contrato.',
      };
    }

    let veredicto: VeredictoFirma;
    try {
      veredicto = await validarDocumentoFirmado({
        fileUrl: args.fileUrl,
        mimeType: args.mimeType,
        contractNumber: esperado.contractNumber,
        clienteNombre: esperado.clienteNombre,
        clienteCedula: esperado.clienteCedula,
      });
    } catch (err) {
      const motivo =
        err instanceof Error ? err.message : 'No se pudo leer el documento.';
      await ctx.runMutation(internal.contractDocuments.notifyAdvisor, {
        conversationId: args.conversationId,
        content: `📄 El cliente envió un documento y no se pudo revisar automáticamente (${motivo}). Revísalo a mano: si es el contrato *${esperado.contractNumber}* firmado, archívalo desde el detalle del contrato.`,
      });
      return { archivado: false, motivo };
    }

    if (!veredicto.coincide) {
      await ctx.runMutation(internal.contractDocuments.notifyAdvisor, {
        conversationId: args.conversationId,
        content: `📄 El cliente envió un documento que NO parece el contrato *${esperado.contractNumber}* firmado (${veredicto.motivo}). No se archivó: revísalo a mano.`,
      });
      return { archivado: false, motivo: veredicto.motivo };
    }

    await ctx.runMutation(internal.contractDocuments.saveSignedContract, {
      contractNumber: esperado.contractNumber,
      url: args.fileUrl,
      // El nombre que trae WhatsApp suele ser un id sin extensión
      // ("1474962754386177"): en ese caso se guarda con un nombre legible.
      filename: /\.\w{3,4}$/.test(args.filename.trim())
        ? args.filename.trim()
        : `Contrato_${esperado.contractNumber}_firmado.pdf`,
      conversationId: args.conversationId,
      messageId: args.messageId,
      veredicto,
    });
    await ctx.runMutation(internal.contractDocuments.notifyAdvisor, {
      conversationId: args.conversationId,
      content: `✅ Contrato *${esperado.contractNumber}* FIRMADO recibido y archivado en su carpeta.`,
    });
    return { archivado: true, motivo: veredicto.motivo };
  },
});
