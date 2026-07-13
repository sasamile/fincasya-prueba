/**
 * Gestión del consentimiento de cookies para FincasYa.
 *
 * Cumple con Ley 1581 Colombia (Habeas Data) y Decreto 1377 de 2013.
 *
 * Estrategia: "anonimizar, no bloquear".
 * - Cuando el usuario aún NO decide: trackers cargan en modo anonimizado
 *   (Consent Mode v2 con todo denegado por defecto). GA pinguea cookieless,
 *   Pixel no inicializa cookies de tracking.
 * - Cuando ACEPTA: actualizamos consent a granted; trackers operan con
 *   funcionalidad completa.
 * - Cuando RECHAZA: el consent se queda denegado pero registramos la decisión
 *   para no volver a mostrar el banner.
 *
 * El consentimiento se guarda en localStorage (no en cookies) para evitar
 * la paradoja de "necesitar consent para guardar el consent".
 */

export type CookieConsentStatus = "pending" | "accepted" | "rejected";

export interface CookieConsentRecord {
  status: Exclude<CookieConsentStatus, "pending">;
  /** ISO timestamp en el que se tomó la decisión. */
  decidedAt: string;
  /** Versión de la política vigente cuando aceptó/rechazó (para invalidar si cambia). */
  policyVersion: string;
}

/** Cambia este valor cuando la política de cookies cambie sustancialmente —
 *  el banner volverá a aparecer para reconfirmar. */
export const COOKIE_POLICY_VERSION = "1.0.0";

const STORAGE_KEY = "fincasya_cookie_consent_v1";

const isBrowser = (): boolean => typeof window !== "undefined";

export function loadConsent(): CookieConsentRecord | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentRecord;
    if (parsed.policyVersion !== COOKIE_POLICY_VERSION) {
      // Política cambió → invalidar consent previo, mostrar banner de nuevo
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.status !== "accepted" && parsed.status !== "rejected") {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(status: "accepted" | "rejected"): CookieConsentRecord {
  const record: CookieConsentRecord = {
    status,
    decidedAt: new Date().toISOString(),
    policyVersion: COOKIE_POLICY_VERSION,
  };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      // Notifica a hooks que están escuchando
      window.dispatchEvent(
        new CustomEvent<CookieConsentRecord>("fincasya:consent-change", {
          detail: record,
        }),
      );
    } catch {
      // localStorage puede fallar en modo incógnito o si está bloqueado
    }
  }
  return record;
}

export function clearConsent(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("fincasya:consent-change", { detail: null }));
  } catch {
    /* noop */
  }
}

/**
 * Actualiza Google Consent Mode v2 según el estado de consentimiento.
 * Llamar después de cambios de consent o al cargar la página.
 */
export function syncGoogleConsent(status: CookieConsentStatus): void {
  if (!isBrowser()) return;
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  };
  // Asegura que dataLayer y gtag existan aunque GA aún no se haya inyectado
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  const granted = status === "accepted";
  w.gtag("consent", "update", {
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
    analytics_storage: granted ? "granted" : "denied",
  });
}

/**
 * Actualiza el consentimiento de Meta Pixel.
 * El Pixel soporta fbq('consent', 'grant'|'revoke').
 * Por default debe estar revoked hasta que el usuario acepte.
 */
export function syncMetaPixelConsent(status: CookieConsentStatus): void {
  if (!isBrowser()) return;
  const w = window as unknown as {
    fbq?: (...args: unknown[]) => void;
  };
  if (typeof w.fbq !== "function") return;
  w.fbq("consent", status === "accepted" ? "grant" : "revoke");
}
