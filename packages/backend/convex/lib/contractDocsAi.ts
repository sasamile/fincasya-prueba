/**
 * Lectura con IA del documento que devuelve el cliente: ¿es EL contrato que le
 * enviamos, y está firmado?
 *
 * Dos caminos según lo que mande el cliente:
 * - Foto (lo más común) → visión, igual que la validación de cédulas.
 * - PDF → se manda como archivo a la API de OpenAI, que lo rasteriza; así
 *   funciona incluso si es un escaneo sin capa de texto.
 *
 * Nunca da por firmado lo dudoso: ante cualquier duda responde `coincide:false`
 * y el asesor decide. Es preferible que revise a mano a archivar el documento
 * equivocado como contrato firmado.
 */

export type VeredictoFirma = {
  coincide: boolean;
  motivo: string;
  contratoDetectado?: string;
  nombreDetectado?: string;
};

/** Nombre de carpeta a partir de la codificación (seguro para rutas S3). */
export function carpetaDeContrato(contractNumber: string): string {
  const limpio = contractNumber
    .trim()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return limpio || 'sin-codificacion';
}

const PROMPT = `Eres el auxiliar de archivo de una empresa de alquiler de fincas.
Recibes un documento que un cliente envió por WhatsApp y debes decir si es EL
contrato de arrendamiento que le enviamos, ya firmado por él.

Responde SOLO un JSON con esta forma exacta:
{"coincide": boolean, "motivo": "...", "contratoDetectado": "...", "nombreDetectado": "..."}

"coincide" es true SOLO si se cumple TODO:
1. Es un contrato de arrendamiento de finca (no una cédula, un comprobante de
   pago, una foto de la finca ni otro documento).
2. El número de contrato del documento es el esperado (o el documento no lo
   muestra legible pero el nombre del cliente sí coincide).
3. Se ve al menos una FIRMA del arrendatario (manuscrita o imagen de firma).

Si el documento está borroso, incompleto o no puedes verificar la firma,
responde coincide:false y explica por qué en "motivo". Ante la duda, false.
"motivo" va en español, en una frase corta y clara para un asesor.`;

async function fetchAsBase64(
  url: string,
): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`no se pudo descargar el archivo (${res.status})`);
  }
  const mime = res.headers.get('Content-Type') || 'application/octet-stream';
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return { base64: btoa(binary), mime };
}

function parseVeredicto(raw: string): VeredictoFirma {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { coincide: false, motivo: 'La IA no devolvió un veredicto legible.' };
  }
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      coincide: parsed.coincide === true,
      motivo:
        typeof parsed.motivo === 'string' && parsed.motivo.trim()
          ? parsed.motivo.trim()
          : 'Sin detalle.',
      contratoDetectado:
        typeof parsed.contratoDetectado === 'string'
          ? parsed.contratoDetectado.trim() || undefined
          : undefined,
      nombreDetectado:
        typeof parsed.nombreDetectado === 'string'
          ? parsed.nombreDetectado.trim() || undefined
          : undefined,
    };
  } catch {
    return { coincide: false, motivo: 'La IA no devolvió un veredicto legible.' };
  }
}

export async function validarDocumentoFirmado(args: {
  fileUrl: string;
  mimeType?: string;
  contractNumber: string;
  clienteNombre: string;
  clienteCedula: string;
}): Promise<VeredictoFirma> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const { base64, mime } = await fetchAsBase64(args.fileUrl);
  const tipo = (args.mimeType || mime).toLowerCase();
  const esPdf = tipo.includes('pdf') || /\.pdf$/i.test(args.fileUrl);

  const contexto = `Contrato esperado: ${args.contractNumber}
Cliente esperado: ${args.clienteNombre || '(sin nombre registrado)'}
Cédula esperada: ${args.clienteCedula || '(sin cédula registrada)'}`;

  // El PDF va como archivo (la API lo rasteriza y así sirve con escaneos);
  // la foto va como imagen.
  const content = esPdf
    ? [
        { type: 'text', text: `${PROMPT}\n\n${contexto}` },
        {
          type: 'file',
          file: {
            filename: 'documento.pdf',
            file_data: `data:application/pdf;base64,${base64}`,
          },
        },
      ]
    : [
        { type: 'text', text: `${PROMPT}\n\n${contexto}` },
        {
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${base64}` },
        },
      ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 400,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `la IA no pudo revisar el documento (${res.status}) ${detail.slice(0, 140)}`.trim(),
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseVeredicto(data.choices?.[0]?.message?.content ?? '');
}
