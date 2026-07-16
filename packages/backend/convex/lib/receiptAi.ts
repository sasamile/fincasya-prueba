/**
 * Visión OpenAI sobre comprobantes de pago colombianos.
 * - extractPaymentReceiptFields: monto/banco (admin / portal check-in).
 * - verifyPaymentReceiptPhoto: ¿es de verdad un comprobante? (link de venta).
 */

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar el comprobante (${imgRes.status})`);
  }
  const headerMime = imgRes.headers.get('Content-Type') || '';
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  const isPdfMagic =
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46;
  if (
    isPdfMagic ||
    headerMime.includes('pdf') ||
    imageUrl.toLowerCase().includes('.pdf')
  ) {
    throw new Error('pdf_not_supported');
  }

  let mime = 'image/jpeg';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    mime = 'image/jpeg';
  } else if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    mime = 'image/png';
  } else if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    mime = 'image/webp';
  } else {
    const clean = (headerMime.split(';')[0] || '').trim().toLowerCase();
    if (clean.startsWith('image/') && clean !== 'application/octet-stream') {
      mime = clean;
    }
  }

  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function parseCopAmount(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw !== 'string') return undefined;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n > 500_000_000) return undefined;
  return Math.floor(n);
}

export type ReceiptAiExtraction = {
  amount?: number;
  bankName?: string;
  confidence?: number;
  note?: string;
};

export type ReceiptAiCheck = {
  isReceipt: boolean;
  receiptProbability: number;
  amount?: number;
  bankName?: string;
  note?: string;
};

export type ReceiptVerdict = {
  allow: boolean;
  needsReview: boolean;
  reason?: string;
  check?: ReceiptAiCheck;
};

/** Umbral: debe parecer claramente un comprobante bancario / transferencia. */
export const RECEIPT_PROBABILITY_MIN = 0.72;

/**
 * Decide si el cliente puede enviar el soporte al asesor.
 * Exportado para tests unitarios.
 */
export function decideReceiptVerdict(check: ReceiptAiCheck): ReceiptVerdict {
  if (!check.isReceipt || check.receiptProbability < RECEIPT_PROBABILITY_MIN) {
    return {
      allow: false,
      needsReview: true,
      reason: 'not_a_receipt',
      check,
    };
  }
  // Sin monto legible: deja pasar pero marca revisión (el asesor valida).
  const needsReview = !check.amount || check.receiptProbability < 0.9;
  return { allow: true, needsReview, check };
}

async function callReceiptVision(
  dataUrl: string,
  mode: 'extract' | 'verify',
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const verifyPrompt = `Analiza la imagen y responde SOLO JSON:
{
  "isPaymentReceipt": boolean,
  "receiptProbability": number,  // 0 a 1: qué tan seguro estás de que es un comprobante de pago/transferencia
  "amount": number|null,         // monto transferido en COP enteros
  "bankName": string|null,       // banco/app (Bancolombia, Nequi, Davivienda, Bre-B, PSE, etc.)
  "note": string|null
}
Es un comprobante de pago SOLO si muestra evidencia de transferencia, consignación, PSE, Bre-B, Nequi, voucher POS o similar (monto, fecha, referencia o banco).
NO es comprobante: selfies, cédulas, capturas de chat, memes, paisajes, capturas de pantalla genéricas, documentos de identidad, facturas sin pago, fotos borrosas irreconocibles.`;

  const extractPrompt = `Lee el comprobante y devuelve JSON con:
{
  "amount": number|null,
  "bankName": string|null,
  "confidence": number,
  "note": string|null
}
Reglas: amount es el valor del pago (Valor, Monto, Total pagado), NO el saldo ni la cuenta.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: mode === 'verify' ? 280 : 220,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres un verificador de comprobantes de pago colombianos (Davivienda, Bancolombia, Nequi, Bre-B, PSE, Redeban/POS). Responde SOLO JSON válido.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: mode === 'verify' ? verifyPrompt : extractPrompt,
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
  const raw = (json.choices?.[0]?.message?.content ?? '').trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('La IA no devolvió JSON válido');
  }
}

/** Extrae monto (COP) y banco de un comprobante vía gpt-4o-mini vision. */
export async function extractPaymentReceiptFields(
  receiptUrl: string,
): Promise<ReceiptAiExtraction> {
  const dataUrl = await imageUrlToDataUrl(receiptUrl);
  const parsed = await callReceiptVision(dataUrl, 'extract');

  const amount = parseCopAmount(parsed.amount);
  const bankName =
    typeof parsed.bankName === 'string' && parsed.bankName.trim()
      ? parsed.bankName.trim().slice(0, 80)
      : undefined;
  const confidence =
    typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : amount
        ? 0.7
        : 0;
  const note =
    typeof parsed.note === 'string' && parsed.note.trim()
      ? parsed.note.trim().slice(0, 200)
      : undefined;

  return { amount, bankName, confidence, note };
}

/**
 * Verifica que la imagen sea un comprobante de pago real antes de enviarlo
 * al asesor. Ante fallo de IA o duda, bloquea (mejor pedir otro archivo).
 */
export async function verifyPaymentReceiptPhoto(
  receiptUrl: string,
): Promise<ReceiptVerdict> {
  let parsed: Record<string, unknown>;
  try {
    const dataUrl = await imageUrlToDataUrl(receiptUrl);
    parsed = await callReceiptVision(dataUrl, 'verify');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('pdf_not_supported')) {
      return { allow: false, needsReview: true, reason: 'pdf_not_allowed' };
    }
    console.error('[receiptAi] verificación falló', msg);
    return { allow: false, needsReview: true, reason: 'ai_unavailable' };
  }

  const isReceipt =
    parsed.isPaymentReceipt === true ||
    parsed.isReceipt === true ||
    (typeof parsed.receiptProbability === 'number' &&
      parsed.receiptProbability >= RECEIPT_PROBABILITY_MIN &&
      parsed.isPaymentReceipt !== false);

  const receiptProbability = (() => {
    const p = parsed.receiptProbability;
    if (typeof p === 'number' && Number.isFinite(p)) {
      return Math.max(0, Math.min(1, p));
    }
    return isReceipt ? 0.75 : 0.1;
  })();

  const check: ReceiptAiCheck = {
    isReceipt,
    receiptProbability,
    amount: parseCopAmount(parsed.amount),
    bankName:
      typeof parsed.bankName === 'string' && parsed.bankName.trim()
        ? parsed.bankName.trim().slice(0, 80)
        : undefined,
    note:
      typeof parsed.note === 'string' && parsed.note.trim()
        ? parsed.note.trim().slice(0, 200)
        : undefined,
  };

  return decideReceiptVerdict(check);
}
