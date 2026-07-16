/**
 * Cliente Bold — API Link de pagos.
 * Docs: https://developers.bold.co/pagos-en-linea/api-link-de-pagos
 *
 * Env (Convex):
 * - BOLD_IDENTIDAD_KEY — llave de identidad (Authorization: x-api-key …)
 * - BOLD_SHARED_SECRET — secreto compartido (webhooks / integridad)
 * - BOLD_API_KEY — alias opcional de BOLD_IDENTIDAD_KEY
 */

const BOLD_BASE = 'https://integrations.api.bold.co';

export type BoldCreateLinkInput = {
  /** Monto cerrado en COP (enteros). */
  amountCop: number;
  description: string;
  /** Referencia única (alfanumérica, _ y -; máx 60). */
  reference: string;
  /** URL https de retorno opcional. */
  callbackUrl?: string;
  /** Días hasta expiración (default 7). */
  expiresInDays?: number;
};

export type BoldCreateLinkResult = {
  paymentLinkId: string;
  url: string;
};

/** Llave de identidad para crear links (header x-api-key). */
export function getBoldIdentidadKey(): string {
  const key =
    process.env.BOLD_IDENTIDAD_KEY?.trim() ||
    process.env.BOLD_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'BOLD_IDENTIDAD_KEY no configurada. Agrégala en Convex → Settings → Environment Variables.',
    );
  }
  return key;
}

/** Secreto compartido (webhooks / firma). */
export function getBoldSharedSecret(): string | undefined {
  return process.env.BOLD_SHARED_SECRET?.trim() || undefined;
}

function getApiKey(): string {
  return getBoldIdentidadKey();
}

/** Expira en N días, en nanosegundos desde epoch (formato Bold). */
function expirationNanos(days: number): number {
  const ms = Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000;
  return Math.floor(ms * 1e6);
}

/**
 * Crea un link de pago Bold con monto cerrado (CLOSE).
 * Devuelve la URL pública checkout.bold.co/...
 */
export async function createBoldPaymentLink(
  input: BoldCreateLinkInput,
): Promise<BoldCreateLinkResult> {
  const amount = Math.floor(Number(input.amountCop) || 0);
  if (amount < 1000) {
    throw new Error('El monto Bold mínimo es $1.000 COP.');
  }

  const description = input.description.trim().slice(0, 100);
  if (description.length < 2) {
    throw new Error('La descripción Bold debe tener al menos 2 caracteres.');
  }

  const reference = input.reference
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 60);
  if (!reference) {
    throw new Error('Referencia Bold inválida.');
  }

  const body: Record<string, unknown> = {
    amount_type: 'CLOSE',
    amount: {
      currency: 'COP',
      total_amount: amount,
    },
    description,
    reference,
    expiration_date: expirationNanos(input.expiresInDays ?? 7),
  };

  if (input.callbackUrl) {
    const trimmed = input.callbackUrl.trim();
    // Bold exige https. No forzar un dominio de env: el caller decide el origen.
    if (trimmed.startsWith('https://')) {
      body.callback_url = trimmed;
    }
  }

  const res = await fetch(`${BOLD_BASE}/online/link/v1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `x-api-key ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    payload?: { payment_link?: string; url?: string };
    errors?: Array<{ message?: string } | string>;
  };

  if (!res.ok) {
    const errMsg =
      json.errors
        ?.map((e) => (typeof e === 'string' ? e : e.message))
        .filter(Boolean)
        .join('; ') || `Bold HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const id = json.payload?.payment_link?.trim();
  const url =
    json.payload?.url?.trim() ||
    (id ? `https://checkout.bold.co/${id}` : '');

  if (!id || !url) {
    throw new Error('Bold no devolvió un link de pago válido.');
  }

  return { paymentLinkId: id, url };
}

export type BoldLinkStatus =
  | 'ACTIVE'
  | 'PROCESSING'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | string;

export type BoldLinkStatusResult = {
  status: BoldLinkStatus;
  transactionId?: string;
  total?: number;
  paymentMethod?: string;
  reference?: string;
};

/**
 * Consulta el estado de un link (sin webhook).
 * GET /online/link/v1/{payment_link}
 */
export async function getBoldPaymentLinkStatus(
  paymentLinkId: string,
): Promise<BoldLinkStatusResult> {
  const id = paymentLinkId.trim();
  if (!id) throw new Error('payment_link vacío.');

  const res = await fetch(
    `${BOLD_BASE}/online/link/v1/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `x-api-key ${getApiKey()}`,
      },
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    payload?: {
      status?: string;
      transaction_id?: string | null;
      total?: number;
      payment_method?: string | null;
      reference?: string;
    };
    status?: string;
    transaction_id?: string | null;
    total?: number;
    payment_method?: string | null;
    reference?: string;
    errors?: Array<{ message?: string } | string>;
  };

  if (!res.ok) {
    const errMsg =
      json.errors
        ?.map((e) => (typeof e === 'string' ? e : e.message))
        .filter(Boolean)
        .join('; ') || `Bold HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  // Bold a veces responde en raíz y a veces en payload.
  const body = json.payload ?? json;
  const status = String(body.status ?? '').trim().toUpperCase();
  if (!status) {
    throw new Error('Bold no devolvió status del link.');
  }

  return {
    status,
    transactionId: body.transaction_id?.trim() || undefined,
    total: typeof body.total === 'number' ? body.total : undefined,
    paymentMethod: body.payment_method?.trim() || undefined,
    reference: body.reference?.trim() || undefined,
  };
}
