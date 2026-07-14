/**
 * Cliente de Siigo API (contabilidad + facturación electrónica DIAN).
 *
 * Librería PURA (sin acceso a `ctx.db`): solo auth, fetch tipado, wrappers de
 * configuración y builders de payloads. Las actions de `siigo.ts` la llaman y
 * se encargan de la persistencia del token / filas. Espejo de `lib/ycloud.ts`.
 *
 * SEGURIDAD FISCAL: ninguna función aquí timbra a la DIAN. Los builders de
 * factura NO incluyen `stamp`/`mail`: todo se crea como borrador en Siigo.
 */
import type { Doc } from '../_generated/dataModel';
import {
  computeBreakdown,
  isRefundableDepositRow,
  type BreakdownRow,
} from './bookingBreakdown';

// ---------------------------------------------------------------------------
// Entorno + auth
// ---------------------------------------------------------------------------

export type SiigoEnv = {
  username: string;
  accessKey: string;
  partnerId: string;
  baseUrl: string;
};

export function requireSiigoEnv(): SiigoEnv {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID;
  if (!username || !accessKey || !partnerId) {
    throw new Error(
      'Configura SIIGO_USERNAME, SIIGO_ACCESS_KEY y SIIGO_PARTNER_ID en Convex',
    );
  }
  const baseUrl = (process.env.SIIGO_BASE_URL || 'https://api.siigo.com').replace(
    /\/+$/,
    '',
  );
  return { username, accessKey, partnerId, baseUrl };
}

export type SiigoToken = { accessToken: string; expiresAt: number };

/** POST /auth → token Bearer. `expiresAt` con margen de 60s. */
export async function siigoAuthenticate(env: SiigoEnv): Promise<SiigoToken> {
  const res = await fetch(`${env.baseUrl}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Partner-Id': env.partnerId,
    },
    body: JSON.stringify({
      username: env.username,
      access_key: env.accessKey,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Siigo auth ${res.status}: ${bodyText.slice(0, 600)}`);
  }
  let parsed: { access_token?: string; expires_in?: number };
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error('Siigo auth: respuesta no es JSON válido');
  }
  if (!parsed.access_token) {
    throw new Error('Siigo auth: no vino access_token en la respuesta');
  }
  const expiresInMs = (Number(parsed.expires_in) || 86400) * 1000;
  return {
    accessToken: parsed.access_token,
    expiresAt: Date.now() + expiresInMs - 60_000,
  };
}

// ---------------------------------------------------------------------------
// Fetch tipado
// ---------------------------------------------------------------------------

export async function siigoFetch<T>(args: {
  env: Pick<SiigoEnv, 'partnerId' | 'baseUrl'>;
  token: string;
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}): Promise<T> {
  const qs = args.query
    ? `?${new URLSearchParams(args.query).toString()}`
    : '';
  const res = await fetch(`${args.env.baseUrl}${args.path}${qs}`, {
    method: args.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.token}`,
      'Partner-Id': args.env.partnerId,
    },
    ...(args.body !== undefined
      ? { body: JSON.stringify(args.body) }
      : {}),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `Siigo ${args.method} ${args.path} ${res.status}: ${bodyText.slice(0, 600)}`,
    );
  }
  if (!bodyText) return undefined as T;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return undefined as T;
  }
}

// ---------------------------------------------------------------------------
// Wrappers de configuración (descubrir ids de la cuenta Siigo)
// ---------------------------------------------------------------------------

type FetchDeps = { env: Pick<SiigoEnv, 'partnerId' | 'baseUrl'>; token: string };

export type SiigoDocumentType = {
  id: number;
  code?: string;
  name?: string;
  type?: string;
  electronic?: boolean;
};
export type SiigoPaymentType = { id: number; name?: string; type?: string };
export type SiigoUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  active?: boolean;
};
export type SiigoTax = {
  id: number;
  name?: string;
  type?: string;
  percentage?: number;
};
export type SiigoAccountGroup = { id: number; name?: string };
export type SiigoProduct = { id?: string; code?: string; name?: string };
export type SiigoCustomer = {
  id?: string;
  identification?: string;
  name?: string[];
};

export function siigoGetDocumentTypes(
  d: FetchDeps,
  type: 'FV' | 'FC',
): Promise<SiigoDocumentType[]> {
  return siigoFetch<SiigoDocumentType[]>({
    ...d,
    method: 'GET',
    path: '/v1/document-types',
    query: { type },
  });
}

export function siigoGetPaymentTypes(
  d: FetchDeps,
  documentType: 'FV' | 'FC',
): Promise<SiigoPaymentType[]> {
  return siigoFetch<SiigoPaymentType[]>({
    ...d,
    method: 'GET',
    path: '/v1/payment-types',
    query: { document_type: documentType },
  });
}

export function siigoGetUsers(d: FetchDeps): Promise<SiigoUser[]> {
  return siigoFetch<SiigoUser[]>({ ...d, method: 'GET', path: '/v1/users' });
}

export function siigoGetTaxes(d: FetchDeps): Promise<SiigoTax[]> {
  return siigoFetch<SiigoTax[]>({ ...d, method: 'GET', path: '/v1/taxes' });
}

export function siigoGetAccountGroups(
  d: FetchDeps,
): Promise<SiigoAccountGroup[]> {
  return siigoFetch<SiigoAccountGroup[]>({
    ...d,
    method: 'GET',
    path: '/v1/account-groups',
  });
}

export function siigoGetProducts(d: FetchDeps): Promise<{ results?: SiigoProduct[] } | SiigoProduct[]> {
  return siigoFetch<{ results?: SiigoProduct[] } | SiigoProduct[]>({
    ...d,
    method: 'GET',
    path: '/v1/products',
  });
}

/** Busca un tercero por identificación. Devuelve el primero o null. */
export async function siigoFindCustomerByIdentification(
  d: FetchDeps,
  identification: string,
): Promise<SiigoCustomer | null> {
  const resp = await siigoFetch<{ results?: SiigoCustomer[] } | SiigoCustomer[]>(
    {
      ...d,
      method: 'GET',
      path: '/v1/customers',
      query: { identification },
    },
  );
  const list = Array.isArray(resp) ? resp : (resp?.results ?? []);
  return list[0] ?? null;
}

// ---------------------------------------------------------------------------
// Builders de payloads (núcleo fiscal — testeable con `bun test`)
// ---------------------------------------------------------------------------

export type SiigoItem = {
  code: string;
  description: string;
  quantity: number;
  price: number;
  taxes?: Array<{ id: number }>;
};

export type SiigoSettingsResolved = {
  invoiceModel: 'total' | 'comision';
  comisionType?: 'percent' | 'fixed';
  comisionValue?: number;
  defaultProductCode?: string;
  comisionProductCode?: string;
  taxIds?: number[];
};

export type SiigoCustomerPayload = {
  type: string;
  person_type: 'Person' | 'Company';
  id_type: string;
  identification: string;
  name: string[];
  address: {
    address: string;
    city: { country_code: string; state_code: string; city_code: string };
  };
  phones: Array<{ number: string }>;
  contacts: Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone?: { number: string };
  }>;
};

function digitsOnly(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

/** Divide "Juan Carlos Pérez" en [nombres, apellidos] de forma razonable. */
export function splitName(fullName: string | undefined | null): [string, string] {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return ['Cliente', '.'];
  if (parts.length === 1) return [parts[0], '.'];
  if (parts.length === 2) return [parts[0], parts[1]];
  // 3+: primeras 2 palabras = nombres, resto = apellidos.
  return [parts.slice(0, 2).join(' '), parts.slice(2).join(' ')];
}

/**
 * Dirección para el tercero. Siigo exige `city` con códigos DANE. Cuando no los
 * tenemos, se usa un default (Bogotá) — suficiente para SANDBOX; en producción
 * el contador ajusta la ciudad correcta del cliente.
 */
function buildAddress(
  address: string | undefined,
  _city: string | undefined,
): SiigoCustomerPayload['address'] {
  return {
    address: String(address ?? '').trim() || 'No registra',
    city: { country_code: 'Co', state_code: '11', city_code: '11001' },
  };
}

export function buildCustomerPayloadFromBooking(
  booking: Pick<
    Doc<'bookings'>,
    'nombreCompleto' | 'cedula' | 'celular' | 'correo' | 'address' | 'city'
  >,
): SiigoCustomerPayload {
  const [first, last] = splitName(booking.nombreCompleto);
  const phone = digitsOnly(booking.celular);
  return {
    type: 'Customer',
    person_type: 'Person',
    id_type: '13', // Cédula de ciudadanía
    identification: digitsOnly(booking.cedula),
    name: [first, last],
    address: buildAddress(booking.address, booking.city),
    phones: phone ? [{ number: phone }] : [],
    contacts: [
      {
        first_name: first,
        last_name: last,
        email: String(booking.correo ?? '').trim(),
        ...(phone ? { phone: { number: phone } } : {}),
      },
    ],
  };
}

/**
 * Tercero PROVEEDOR (propietario) para facturas de compra. Se crea vía el mismo
 * endpoint /v1/customers; el `type` se marca como 'Supplier' para que Siigo lo
 * habilite como proveedor. (Ajustable según la config de la cuenta.)
 */
export function buildSupplierPayloadFromOwner(
  owner: Pick<
    Doc<'propertyOwnerInfo'>,
    | 'propietarioNombre'
    | 'propietarioCedula'
    | 'propietarioTelefono'
    | 'propietarioCorreo'
  >,
): SiigoCustomerPayload {
  const [first, last] = splitName(owner.propietarioNombre);
  const phone = digitsOnly(owner.propietarioTelefono);
  return {
    type: 'Supplier',
    person_type: 'Person',
    id_type: '13',
    identification: digitsOnly(owner.propietarioCedula),
    name: [first, last],
    address: buildAddress(undefined, undefined),
    phones: phone ? [{ number: phone }] : [],
    contacts: [
      {
        first_name: first,
        last_name: last,
        email: String(owner.propietarioCorreo ?? '').trim(),
        ...(phone ? { phone: { number: phone } } : {}),
      },
    ],
  };
}

/** Total facturable de una reserva = desglose SIN el depósito reembolsable. */
export function facturableTotalFromRows(rows: BreakdownRow[]): number {
  const sum = rows
    .filter((r) => !isRefundableDepositRow(r))
    .reduce((acc, r) => acc + r.amount, 0);
  return Math.round(sum);
}

/**
 * Convierte una reserva en ítems de factura de venta, aplicando el modelo
 * configurado y EXCLUYENDO siempre el depósito reembolsable.
 *  - modelo 'total'    → un ítem con el total facturable.
 *  - modelo 'comision' → un ítem con la comisión (% o valor fijo).
 */
export function buildInvoiceItemsFromBooking(args: {
  booking: Doc<'bookings'>;
  settings: SiigoSettingsResolved;
}): SiigoItem[] {
  const rows = computeBreakdown(args.booking);
  const facturableTotal = facturableTotalFromRows(rows);
  const taxes = (args.settings.taxIds ?? []).map((id) => ({ id }));
  const ref = args.booking.reference ? ` ${args.booking.reference}` : '';

  if (args.settings.invoiceModel === 'comision') {
    const value = Number(args.settings.comisionValue) || 0;
    const price =
      args.settings.comisionType === 'fixed'
        ? Math.round(value)
        : Math.round(facturableTotal * (value / 100));
    return [
      {
        code:
          args.settings.comisionProductCode ??
          args.settings.defaultProductCode ??
          'COMISION',
        description: `Comisión FincasYA reserva${ref}`.trim(),
        quantity: 1,
        price,
        ...(taxes.length ? { taxes } : {}),
      },
    ];
  }

  return [
    {
      code: args.settings.defaultProductCode ?? 'ARRIENDO',
      description: `Alquiler reserva${ref}`.trim(),
      quantity: 1,
      price: facturableTotal,
      ...(taxes.length ? { taxes } : {}),
    },
  ];
}

/** Ítems de factura de compra a partir del valor acordado con el propietario. */
export function buildPurchaseItemsFromOwnerPayout(args: {
  valorAcordado: number;
  reference?: string;
  settings: SiigoSettingsResolved;
}): SiigoItem[] {
  const ref = args.reference ? ` ${args.reference}` : '';
  const taxes = (args.settings.taxIds ?? []).map((id) => ({ id }));
  return [
    {
      code: args.settings.defaultProductCode ?? 'ARRIENDO',
      description: `Pago a propietario reserva${ref}`.trim(),
      quantity: 1,
      price: Math.round(Number(args.valorAcordado) || 0),
      ...(taxes.length ? { taxes } : {}),
    },
  ];
}
