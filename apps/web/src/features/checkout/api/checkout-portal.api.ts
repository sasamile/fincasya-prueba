const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "https://modest-husky-871.convex.site";

export type CheckoutBankAccount = {
  titular?: string;
  tipo?: string;
  numero?: string;
  banco?: string;
  documento?: string;
  observaciones?: string;
};

export type CheckoutRefund = {
  valor: number | null;
  fecha: string | null;
  medio: string | null;
  comprobanteUrl: string | null;
  observaciones: string | null;
};

export type CheckoutData = {
  ok?: boolean;
  reference: string;
  propertyTitle: string;
  propertyLocation: string | null;
  nombreTitular: string | null;
  fechaSalida: number;
  horaSalida: string | null;
  reglas: string;
  depositoGarantia: number;
  depositoRegistradoEn: number;
  depositoEstado: string;
  depositoEstadoLabel: string;
  cuenta: CheckoutBankAccount | null;
  devolucion: CheckoutRefund | null;
  valorRetenido: number | null;
};

export type CheckoutPortalSummary = {
  reference: string;
  propertyTitle: string;
  propertyLocation: string | null;
};

/** URL del endpoint Convex para una referencia dada. */
export function checkoutEndpoint(reference: string): string {
  return `${CONVEX_SITE_URL}/api/checkout/${encodeURIComponent(reference)}`;
}

/** Fetch server-side para metadata; devuelve null si no existe (404). */
export async function fetchCheckoutPortalSummary(
  reference: string,
): Promise<CheckoutPortalSummary | null> {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  try {
    const response = await fetch(checkoutEndpoint(trimmed), {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as CheckoutData;
    return {
      reference: data.reference,
      propertyTitle: data.propertyTitle,
      propertyLocation: data.propertyLocation ?? null,
    };
  } catch {
    return null;
  }
}
