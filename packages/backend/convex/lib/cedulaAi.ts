/**
 * Verifica con visión OpenAI que la foto subida en el link de venta sea de
 * verdad un documento de identidad, y extrae número y nombre para contrastarlos
 * con lo que el cliente escribió en el formulario.
 *
 * Filosofía: solo bloquea cuando la IA está CONFIADA de que no es un documento
 * (un selfie, un recibo, una pantalla). Ante la duda deja pasar y marca la venta
 * para revisión del asesor: un falso positivo frena una venta real.
 */

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar la foto (${imgRes.status})`);
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

/** Deja solo dígitos: "1.020.304-5" -> "10203045". */
export function normalizeCedulaNumber(raw: unknown): string | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return String(Math.floor(raw));
  }
  if (typeof raw !== 'string') return undefined;
  const digits = raw.replace(/[^\d]/g, '');
  // Las cédulas colombianas van de 6 a 10 dígitos; NUIP hasta 11.
  if (digits.length < 6 || digits.length > 11) return undefined;
  return digits;
}

export type CedulaAiCheck = {
  /**
   * Probabilidad 0..1 de que la imagen SEA un documento de identidad.
   * Un solo número monótono a propósito: pedirle al modelo un booleano MÁS una
   * "confianza" es ambiguo (¿confianza en qué? ¿en el sí o en el veredicto?) y
   * se presta a leer al revés el rechazo más claro.
   */
  cedulaProbability: number;
  /** Número leído en el documento, solo dígitos. */
  number?: string;
  /** Nombre completo leído en el documento. */
  name?: string;
  note?: string;
};

export type CedulaVerdict = {
  /** false = el cliente NO puede continuar. */
  allow: boolean;
  /** true = pasa, pero el asesor debe mirarla. */
  needsReview: boolean;
  /** Código estable para que la UI escoja el mensaje. */
  reason?:
    | 'not_a_document'
    | 'number_mismatch'
    | 'unreadable'
    | 'ai_unavailable';
  check?: CedulaAiCheck;
};

/**
 * Solo se bloquea cuando la IA está confiada de que NO es un documento. Entre
 * medias se deja pasar marcado: un falso positivo frena una venta real.
 */
const NOT_A_DOCUMENT_MAX = 0.2;
/** Por encima de esto la lectura es lo bastante firme para no marcar revisión. */
const CLEARLY_A_DOCUMENT_MIN = 0.8;

/** Lee la foto vía gpt-4o-mini vision. */
export async function inspectCedulaPhoto(
  photoUrl: string,
): Promise<CedulaAiCheck> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const dataUrl = await imageUrlToDataUrl(photoUrl);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 260,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres un verificador de documentos de identidad colombianos (cédula de ciudadanía amarilla o digital, cédula de extranjería, pasaporte, tarjeta de identidad). Responde SOLO JSON válido.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Mira la imagen y devuelve JSON con:
{
  "cedulaProbability": number,  // 0 a 1: probabilidad de que la imagen SEA un documento de identidad
  "number": string|null,        // número del documento tal como se ve
  "name": string|null,          // nombre completo del titular
  "note": string|null           // breve, en español, si algo impide leerlo
}
Escala de cedulaProbability (es lo único que decide; sé literal):
- 1.0 = sin duda un documento de identidad, se lee bien.
- 0.9 = es un documento: el reverso, una cédula digital en pantalla, o algo borrosa/cortada pero reconocible.
- 0.5 = genuinamente ambiguo, no logras decidir.
- 0.1 = casi seguro que NO es un documento.
- 0.0 = sin duda NO es un documento: un selfie sin documento, un comprobante de pago o transferencia bancaria, un paisaje, una captura de chat, una imagen en blanco.

Reglas:
- Si SÍ es un documento pero no logras leer number o name, devuelve cedulaProbability alta (0.9-1.0) con number/name en null. No bajes la probabilidad por no poder leer el número.
- cedulaProbability mide SOLO si es un documento de identidad. No mide si el número es correcto ni si la foto es nítida.`,
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

  // Si la IA no devuelve un número usable, asumimos ambigüedad (0.5): ni
  // bloquea ni pasa limpio. Nunca 0, que bloquearía por un fallo de formato.
  const cedulaProbability =
    typeof parsed.cedulaProbability === 'number' &&
    Number.isFinite(parsed.cedulaProbability)
      ? Math.max(0, Math.min(1, parsed.cedulaProbability))
      : 0.5;
  const name =
    typeof parsed.name === 'string' && parsed.name.trim()
      ? parsed.name.trim().slice(0, 120)
      : undefined;
  const note =
    typeof parsed.note === 'string' && parsed.note.trim()
      ? parsed.note.trim().slice(0, 200)
      : undefined;

  return {
    cedulaProbability,
    number: normalizeCedulaNumber(parsed.number),
    name,
    note,
  };
}

/**
 * Traduce la lectura de la IA en un veredicto. Pura y exportada aparte para
 * poder testear el criterio de bloqueo sin llamar a OpenAI.
 *
 * `typedCedula` es lo que el cliente escribió en el formulario; si no coincide
 * con el documento, bloquea (el número es un dato duro: o coincide o no).
 */
export function decideCedulaVerdict(
  check: CedulaAiCheck,
  typedCedula: string,
): CedulaVerdict {
  if (check.cedulaProbability <= NOT_A_DOCUMENT_MAX) {
    return { allow: false, needsReview: true, reason: 'not_a_document', check };
  }

  const typed = normalizeCedulaNumber(typedCedula);
  if (check.number && typed && check.number !== typed) {
    return { allow: false, needsReview: true, reason: 'number_mismatch', check };
  }

  // Parece documento pero la IA dudó, o no pudo leer el número: pasa marcado.
  const needsReview =
    check.cedulaProbability < CLEARLY_A_DOCUMENT_MIN || !check.number;

  return { allow: true, needsReview, check };
}

/** Lee la foto y decide si el cliente puede continuar. */
export async function verifyCedulaPhoto(
  photoUrl: string,
  typedCedula: string,
): Promise<CedulaVerdict> {
  let check: CedulaAiCheck;
  try {
    check = await inspectCedulaPhoto(photoUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    // La IA caída no puede frenar ventas: pasa y que el asesor revise.
    console.error('[cedulaAi] inspección falló', msg);
    return {
      allow: true,
      needsReview: true,
      reason: msg === 'pdf_not_supported' ? 'unreadable' : 'ai_unavailable',
    };
  }

  return decideCedulaVerdict(check, typedCedula);
}
