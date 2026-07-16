/**
 * Verifica con visión OpenAI que la foto subida en el link de venta sea de
 * verdad un documento de identidad, y extrae número y nombre para contrastarlos
 * con lo que el cliente escribió en el formulario.
 *
 * Política: el portal NO deja continuar hasta que la IA confirme documento
 * claro + número legible que coincida con lo tipado. Ante fallo de IA o duda,
 * se bloquea (mejor pedir otra foto que aceptar un selfie/recibo).
 */

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Detecta PDF por magic bytes; NO trata octet-stream como PDF (S3 lo usa mucho). */
function assertNotPdf(buf: Uint8Array, headerMime: string, imageUrl: string) {
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
}

function sniffImageMime(buf: Uint8Array, headerMime: string): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
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
    return 'image/webp';
  }
  const clean = (headerMime.split(';')[0] || '').trim().toLowerCase();
  if (clean.startsWith('image/') && clean !== 'application/octet-stream') {
    return clean;
  }
  return 'image/jpeg';
}

function uint8ToBase64(buf: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x2000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, buf.length);
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(buf[j]!);
    }
  }
  return btoa(binary);
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar la foto (${imgRes.status})`);
  }
  const headerMime = imgRes.headers.get('Content-Type') || '';
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  assertNotPdf(buf, headerMime, imageUrl);
  const mime = sniffImageMime(buf, headerMime);
  return `data:${mime};base64,${uint8ToBase64(buf)}`;
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

/** Normaliza nombre para comparar (mayúsculas, sin tildes ni basura). */
export function normalizePersonName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * true = coinciden lo bastante; false = claramente distintos;
 * undefined = no hay datos para decidir.
 */
export function namesLikelyMatch(
  typedName: string | undefined,
  documentName: string | undefined,
): boolean | undefined {
  const a = normalizePersonName(typedName);
  const b = normalizePersonName(documentName);
  if (!a || !b) return undefined;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const tokensA = a.split(' ').filter((t) => t.length >= 3);
  const tokensB = new Set(b.split(' ').filter((t) => t.length >= 3));
  if (tokensA.length === 0 || tokensB.size === 0) return undefined;
  const shared = tokensA.filter((t) => tokensB.has(t)).length;
  // Al menos 2 apellidos/nombres en común, o el único token largo tipado.
  if (shared >= 2) return true;
  if (tokensA.length === 1 && shared === 1) return true;
  if (shared === 0) return false;
  // Un solo token en común con nombres largos: dudoso → no bloquea.
  return undefined;
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
    | 'name_mismatch'
    | 'unreadable'
    | 'pdf_not_allowed'
    | 'ai_unavailable';
  check?: CedulaAiCheck;
};

/** Solo bloquea por “no es documento” por debajo de este umbral. */
const NOT_A_DOCUMENT_MAX = 0.2;
/** Por debajo de esto no se deja continuar: hace falta documento claro. */
const CLEARLY_A_DOCUMENT_MIN = 0.8;

async function visionInspect(
  apiKey: string,
  imageUrl: string,
): Promise<CedulaAiCheck> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres un verificador de documentos de identidad colombianos (cédula de ciudadanía amarilla o digital, cédula de extranjería, pasaporte, tarjeta de identidad). Responde SOLO JSON válido. Lee el NUIP dígito a dígito: los puntos (1.127.722.413) son solo formato, no forman parte del número.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Mira la imagen y devuelve JSON con:
{
  "cedulaProbability": number,  // 0 a 1: probabilidad de que la imagen SEA un documento de identidad
  "number": string|null,        // NUIP / número del documento SOLO dígitos, sin puntos ni espacios
  "name": string|null,          // nombres + apellidos del titular
  "note": string|null           // breve, en español, si algo impide leerlo
}
Escala de cedulaProbability (es lo único que decide; sé literal):
- 1.0 = sin duda un documento de identidad, se lee bien.
- 0.9 = es un documento: el reverso, una cédula digital en pantalla, o algo borrosa/cortada pero reconocible.
- 0.5 = genuinamente ambiguo, no logras decidir.
- 0.1 = casi seguro que NO es un documento.
- 0.0 = sin duda NO es un documento: un selfie sin documento, un comprobante de pago o transferencia bancaria, un paisaje, una captura de chat, una imagen en blanco, un meme, una captura cualquiera.

Reglas del número (NUIP colombiano):
- Suele verse arriba como "NÚMERO" / "NUIP" con formato 1.XXX.XXX.XXX (puntos de miles). Quita los puntos: "1.127.722.413" → "1127722413".
- Cuenta dígito por dígito de izquierda a derecha. No inventes ni reordenes.
- Si la foto está rotada, lee igual el NUIP completo.
- Si SÍ es un documento pero no logras leer number o name, devuelve cedulaProbability alta (0.9-1.0) con number/name en null. No bajes la probabilidad por no poder leer el número.
- cedulaProbability mide SOLO si es un documento de identidad.`,
            },
            { type: 'image_url', image_url: { url: imageUrl } },
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
 * Segunda pasada cuando el NUIP no coincide: confirma si el número tipado
 * aparece en la foto (evita falsos mismatch por un dígito mal leído).
 */
async function visionConfirmTypedNumber(
  apiKey: string,
  imageUrl: string,
  typedDigits: string,
): Promise<{ matchesTyped: boolean; number?: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 160,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Verificas el NUIP de cédulas colombianas. Los puntos son solo formato. Responde SOLO JSON.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `En la imagen, localiza el NUIP / NÚMERO de la cédula (ej. "1.127.722.413").
El usuario escribió exactamente estos dígitos: ${typedDigits}

¿Esos dígitos aparecen en el documento (ignorando puntos y espacios)?

JSON:
{
  "matchesTyped": boolean,
  "number": string|null
}

- matchesTyped = true solo si ${typedDigits} está literalmente en la cédula.
- number = los dígitos del NUIP que lees tú, sin puntos.
- Cuenta dígito a dígito. No inventes.`,
            },
            { type: 'image_url', image_url: { url: imageUrl } },
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
    return { matchesTyped: false };
  }

  return {
    matchesTyped: parsed.matchesTyped === true,
    number: normalizeCedulaNumber(parsed.number),
  };
}

async function resolveImageRef(photoUrl: string): Promise<string> {
  if (isHttpUrl(photoUrl)) return photoUrl;
  return imageUrlToDataUrl(photoUrl);
}

/** Lee la foto vía gpt-4o-mini vision. */
export async function inspectCedulaPhoto(
  photoUrl: string,
): Promise<CedulaAiCheck> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  if (isHttpUrl(photoUrl)) {
    try {
      return await visionInspect(apiKey, photoUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.startsWith('Vision ')) throw err;
      console.warn('[cedulaAi] URL pública falló, reintento con data URL', msg);
    }
  }

  const dataUrl = await imageUrlToDataUrl(photoUrl);
  return visionInspect(apiKey, dataUrl);
}

export type DecideCedulaOptions = {
  typedCedula: string;
  typedName?: string;
};

/**
 * Traduce la lectura de la IA en un veredicto. Pura y exportada aparte para
 * poder testear el criterio de bloqueo sin llamar a OpenAI.
 */
export function decideCedulaVerdict(
  check: CedulaAiCheck,
  typedCedulaOrOpts: string | DecideCedulaOptions,
): CedulaVerdict {
  const opts: DecideCedulaOptions =
    typeof typedCedulaOrOpts === 'string'
      ? { typedCedula: typedCedulaOrOpts }
      : typedCedulaOrOpts;

  if (check.cedulaProbability <= NOT_A_DOCUMENT_MAX) {
    return { allow: false, needsReview: true, reason: 'not_a_document', check };
  }

  if (check.cedulaProbability < CLEARLY_A_DOCUMENT_MIN) {
    return { allow: false, needsReview: true, reason: 'unreadable', check };
  }

  // Documento claro: hay que poder leer el número (si no, cualquiera pasa).
  if (!check.number) {
    return { allow: false, needsReview: true, reason: 'unreadable', check };
  }

  const typed = normalizeCedulaNumber(opts.typedCedula);
  if (typed && check.number !== typed) {
    return { allow: false, needsReview: true, reason: 'number_mismatch', check };
  }

  const nameMatch = namesLikelyMatch(opts.typedName, check.name);
  if (nameMatch === false) {
    return { allow: false, needsReview: true, reason: 'name_mismatch', check };
  }

  // Sin cédula tipada aún: documento OK, pero el portal debe exigir el número
  // tipado después. Marcamos revisión si el nombre no se pudo contrastar.
  const needsReview = !typed || nameMatch === undefined;

  return { allow: true, needsReview, check };
}

/** Traduce fallos de inspección (red, PDF, etc.) a un veredicto. Pura para tests. */
export function verdictFromInspectError(message: string): CedulaVerdict {
  if (message === 'pdf_not_supported') {
    return {
      allow: false,
      needsReview: true,
      reason: 'pdf_not_allowed',
    };
  }
  // Sin IA no hay forma de saber si es cédula → no dejar pasar.
  return {
    allow: false,
    needsReview: true,
    reason: 'ai_unavailable',
  };
}

/** Lee la foto y decide si el cliente puede continuar. */
export async function verifyCedulaPhoto(
  photoUrl: string,
  typedCedula: string,
  typedName?: string,
): Promise<CedulaVerdict> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  let check: CedulaAiCheck;
  try {
    check = await inspectCedulaPhoto(photoUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    console.error('[cedulaAi] inspección falló', msg);
    return verdictFromInspectError(msg);
  }

  let verdict = decideCedulaVerdict(check, { typedCedula, typedName });

  // Falso mismatch frecuente: la IA cambia un dígito del NUIP. Segunda pasada
  // pregunta si el número tipado aparece en la foto.
  const typed = normalizeCedulaNumber(typedCedula);
  if (
    verdict.reason === 'number_mismatch' &&
    typed &&
    apiKey &&
    check.cedulaProbability >= CLEARLY_A_DOCUMENT_MIN
  ) {
    try {
      const imageRef = await resolveImageRef(photoUrl).catch(async () => {
        // Si la URL pública falló en la 1ª pasada ya tenemos data vía inspect;
        // aquí reintentamos data URL explícita.
        return imageUrlToDataUrl(photoUrl);
      });
      // Preferir data URL si la confirmación por URL falla.
      let confirm: { matchesTyped: boolean; number?: string };
      try {
        confirm = await visionConfirmTypedNumber(apiKey, imageRef, typed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (!isHttpUrl(photoUrl) || !msg.startsWith('Vision ')) throw err;
        const dataUrl = await imageUrlToDataUrl(photoUrl);
        confirm = await visionConfirmTypedNumber(apiKey, dataUrl, typed);
      }

      if (confirm.matchesTyped || confirm.number === typed) {
        check = {
          ...check,
          number: typed,
          note: check.note
            ? `${check.note} · NUIP confirmado en 2ª lectura`
            : 'NUIP confirmado en 2ª lectura',
        };
        verdict = decideCedulaVerdict(check, { typedCedula, typedName });
      } else if (
        confirm.number &&
        confirm.number !== check.number &&
        confirm.number === typed
      ) {
        check = { ...check, number: confirm.number };
        verdict = decideCedulaVerdict(check, { typedCedula, typedName });
      } else if (confirm.number && confirm.number !== check.number) {
        // Segunda lectura distinta: reevaluar con ese número.
        check = { ...check, number: confirm.number };
        verdict = decideCedulaVerdict(check, { typedCedula, typedName });
      }
    } catch (err) {
      console.warn(
        '[cedulaAi] confirmación de NUIP falló',
        err instanceof Error ? err.message : err,
      );
    }
  }

  return verdict;
}
