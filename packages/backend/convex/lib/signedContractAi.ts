/**
 * Visión OpenAI: ¿el archivo es el contrato de arrendamiento firmado por el cliente?
 * Bloquea listas de invitados, comprobantes, cédulas, contratos en blanco, etc.
 */

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`No se pudo descargar el documento (${imgRes.status})`);
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

export type SignedContractAiCheck = {
  isContract: boolean;
  hasClientSignature: boolean;
  contractProbability: number;
  note?: string;
};

export type SignedContractVerdict = {
  allow: boolean;
  needsReview: boolean;
  reason?: string;
  check?: SignedContractAiCheck;
};

/** Debe parecer claramente un contrato de arrendamiento. */
export const CONTRACT_PROBABILITY_MIN = 0.72;

/**
 * Decide si el cliente puede avanzar al CR.
 * Exportado para tests unitarios.
 */
export function decideSignedContractVerdict(
  check: SignedContractAiCheck,
): SignedContractVerdict {
  if (
    !check.isContract ||
    check.contractProbability < CONTRACT_PROBABILITY_MIN
  ) {
    return {
      allow: false,
      needsReview: true,
      reason: 'not_a_contract',
      check,
    };
  }
  if (!check.hasClientSignature) {
    return {
      allow: false,
      needsReview: true,
      reason: 'missing_signature',
      check,
    };
  }
  const needsReview = check.contractProbability < 0.9;
  return { allow: true, needsReview, check };
}

async function callSignedContractVision(
  dataUrls: string[],
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const prompt = `Analiza la(s) imagen(es) y responde SOLO JSON:
{
  "isLeaseContract": boolean,
  "contractProbability": number,  // 0 a 1: qué tan seguro estás de que es un contrato de arrendamiento / alquiler de finca o inmueble
  "hasClientSignature": boolean,  // true SOLO si hay firma manuscrita o firma digital clara del arrendatario/cliente (no solo línea en blanco ni solo sello del arrendador)
  "note": string|null
}

Es contrato de arrendamiento SOLO si se ve documento contractual (cláusulas, partes arrendador/arrendatario, fechas, valor, finca/inmueble, o título de contrato de arrendamiento).

hasClientSignature = true SOLO si hay evidencia de firma del cliente/arrendatario: trazo manuscrito, rúbrica, o firma electrónica visible en el bloque de firmas del arrendatario. NO cuenta: solo el nombre tipografiado, solo la línea de firma vacía, solo firma del arrendador/empresa, ni un checkmark.

NO es contrato firmado (isLeaseContract=false y/o hasClientSignature=false): lista de invitados, comprobante de pago, cédula, selfie, chat, factura, inventario suelto, catálogo, foto de finca, memes, documento en blanco sin firma, o cualquier archivo que no sea el contrato firmado.`;

  const images = dataUrls.map((url) => ({
    type: 'image_url' as const,
    image_url: { url },
  }));

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 320,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres un verificador de contratos de arrendamiento firmados (Colombia, fincas/inmuebles). Responde SOLO JSON válido. Sé estricto: sin firma del cliente no apruebes.',
        },
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...images],
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

/**
 * Verifica que la(s) imagen(es) sean el contrato firmado por el cliente.
 * Ante fallo de IA o duda, bloquea.
 */
export async function verifySignedContractPhoto(
  imageUrls: string | string[],
): Promise<SignedContractVerdict> {
  const urls = (Array.isArray(imageUrls) ? imageUrls : [imageUrls])
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) {
    return { allow: false, needsReview: true, reason: 'unreadable' };
  }

  let parsed: Record<string, unknown>;
  try {
    const dataUrls = await Promise.all(urls.map((u) => imageUrlToDataUrl(u)));
    parsed = await callSignedContractVision(dataUrls);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('pdf_not_supported')) {
      return { allow: false, needsReview: true, reason: 'pdf_not_allowed' };
    }
    console.error('[signedContractAi] verificación falló', msg);
    return { allow: false, needsReview: true, reason: 'ai_unavailable' };
  }

  const isContract =
    parsed.isLeaseContract === true ||
    parsed.isContract === true ||
    (typeof parsed.contractProbability === 'number' &&
      parsed.contractProbability >= CONTRACT_PROBABILITY_MIN &&
      parsed.isLeaseContract !== false);

  const hasClientSignature = parsed.hasClientSignature === true;

  const contractProbability = (() => {
    const p = parsed.contractProbability;
    if (typeof p === 'number' && Number.isFinite(p)) {
      return Math.max(0, Math.min(1, p));
    }
    return isContract ? 0.75 : 0.1;
  })();

  const check: SignedContractAiCheck = {
    isContract,
    hasClientSignature,
    contractProbability,
    note:
      typeof parsed.note === 'string' && parsed.note.trim()
        ? parsed.note.trim().slice(0, 200)
        : undefined,
  };

  return decideSignedContractVerdict(check);
}
