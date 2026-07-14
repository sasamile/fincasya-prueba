/**
 * Lee comprobantes de pago (imagen) con visión OpenAI y extrae monto / banco.
 * PDFs u otros tipos: se omiten (la UI deja el campo manual).
 */

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar el comprobante (${imgRes.status})`);
  }
  const mime = imgRes.headers.get('Content-Type') || 'image/jpeg';
  if (
    mime.includes('pdf') ||
    mime.includes('octet-stream') ||
    imageUrl.toLowerCase().includes('.pdf')
  ) {
    throw new Error('pdf_not_supported');
  }
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return `data:${mime.split(';')[0] || 'image/jpeg'};base64,${btoa(binary)}`;
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
  // Evita basura tipo OCR de NIT/cuenta larguísimos
  if (n > 500_000_000) return undefined;
  return Math.floor(n);
}

export type ReceiptAiExtraction = {
  amount?: number;
  bankName?: string;
  confidence?: number;
  note?: string;
};

/** Extrae monto (COP) y banco de un comprobante vía gpt-4o-mini vision. */
export async function extractPaymentReceiptFields(
  receiptUrl: string,
): Promise<ReceiptAiExtraction> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const dataUrl = await imageUrlToDataUrl(receiptUrl);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 220,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres un extractor de datos de comprobantes de pago colombianos (transferencias Davivienda, Bancolombia, Nequi, Bre-B, PSE, vouchers Redeban/POS). Responde SOLO JSON válido.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Lee el comprobante y devuelve JSON con:
{
  "amount": number|null,       // monto transferido en pesos COP enteros (sin puntos ni comas)
  "bankName": string|null,     // banco/origen si se ve
  "confidence": number,        // 0 a 1
  "note": string|null          // breve si el monto es dudoso
}
Reglas: amount es el valor del pago (Valor, Monto, Total pagado), NO el saldo ni la cuenta. Si hay varios montos, usa el de la transferencia.`,
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
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('La IA no devolvió JSON válido');
  }

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
