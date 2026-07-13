"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadConsent,
  saveConsent,
  clearConsent,
  syncGoogleConsent,
  syncMetaPixelConsent,
  type CookieConsentRecord,
  type CookieConsentStatus,
} from "../lib/consent";

interface UseCookieConsentReturn {
  /** Estado actual del consentimiento. "pending" si el usuario aún no decide. */
  status: CookieConsentStatus;
  /** Registro completo (null si no hay decisión guardada). */
  record: CookieConsentRecord | null;
  /** true si todavía estamos hidratando desde localStorage (evita flashes). */
  isLoading: boolean;
  /** Acepta cookies. Persiste, dispara evento, y sincroniza GA/Pixel. */
  accept: () => void;
  /** Rechaza cookies. Persiste, dispara evento, y sincroniza GA/Pixel. */
  reject: () => void;
  /** Borra la decisión (vuelve a "pending"). Útil para "Cambiar preferencias". */
  reset: () => void;
}

/**
 * Hook reactivo que observa el estado de consentimiento de cookies.
 *
 * - Devuelve "pending" hasta que el usuario decide (banner se muestra entonces).
 * - Sincroniza GA + Meta Pixel automáticamente al cambiar el consent.
 * - Escucha el evento 'fincasya:consent-change' para mantenerse en sync entre
 *   pestañas/tabs y entre componentes que comparten el estado.
 */
export function useCookieConsent(): UseCookieConsentReturn {
  const [record, setRecord] = useState<CookieConsentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hidratación inicial desde localStorage
  useEffect(() => {
    const loaded = loadConsent();
    setRecord(loaded);
    setIsLoading(false);
    // Sincroniza GA/Pixel con el estado cargado al montar
    syncGoogleConsent(loaded?.status ?? "pending");
    syncMetaPixelConsent(loaded?.status ?? "pending");
  }, []);

  // Listener de cambios desde otros componentes/tabs
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<CookieConsentRecord | null>).detail;
      setRecord(detail ?? null);
    }
    window.addEventListener("fincasya:consent-change", handler);
    return () => window.removeEventListener("fincasya:consent-change", handler);
  }, []);

  const accept = useCallback(() => {
    const saved = saveConsent("accepted");
    setRecord(saved);
    syncGoogleConsent("accepted");
    syncMetaPixelConsent("accepted");
  }, []);

  const reject = useCallback(() => {
    const saved = saveConsent("rejected");
    setRecord(saved);
    syncGoogleConsent("rejected");
    syncMetaPixelConsent("rejected");
  }, []);

  const reset = useCallback(() => {
    clearConsent();
    setRecord(null);
    syncGoogleConsent("pending");
    syncMetaPixelConsent("pending");
  }, []);

  return {
    status: record?.status ?? "pending",
    record,
    isLoading,
    accept,
    reject,
    reset,
  };
}
