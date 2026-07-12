import type { VentaDraftPhase } from "./venta-draft-storage";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "https://adventurous-octopus-651.convex.site";

export type VentaServerDraftPayload = {
  clientPortalUiStep?: number;
  clientDraftPhase?: VentaDraftPhase;
  nombre?: string;
  cedula?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  fechaNacimiento?: string;
  paymentAmount?: number;
};

/** Sincroniza el borrador del portal con Convex (mismo link en otro navegador/dispositivo). */
export async function syncVentaDraftToServer(
  token: string,
  payload: VentaServerDraftPayload,
) {
  try {
    await fetch(
      `${CONVEX_SITE_URL}/api/venta/${encodeURIComponent(token)}/save-draft`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    // El borrador local sigue disponible si falla la red.
  }
}
