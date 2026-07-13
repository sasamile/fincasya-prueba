import Script from "next/script";

/**
 * Inicializa Google Consent Mode v2 con **todo denegado por defecto**.
 *
 * Debe inyectarse ANTES de que carguen Google Analytics o Meta Pixel para que
 * los pings iniciales respeten el consent.
 *
 * Funcionamiento:
 * - Si el usuario ya tenía consent guardado (accepted/rejected), lee de
 *   localStorage y aplica los valores correctos.
 * - Si no hay decisión guardada, deja todo denegado. GA hace "cookieless pings"
 *   (sin cookies, sin user_id) y Pixel se inicializa sin cookies de tracking.
 * - Cuando el usuario decida, el hook useCookieConsent llama a gtag/fbq con
 *   los valores actualizados.
 *
 * IMPORTANTE: este componente NO es client component porque next/script con
 * strategy="beforeInteractive" sólo funciona en server components.
 */
export function ConsentBootstrap() {
  const initScript = `
(function() {
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Default: todo denegado (Consent Mode v2)
  var defaults = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  };

  // Si ya hay decisión guardada, aplicarla antes de cargar trackers
  try {
    var raw = window.localStorage.getItem('fincasya_cookie_consent_v1');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.status === 'accepted' && parsed.policyVersion === '1.0.0') {
        defaults.ad_storage = 'granted';
        defaults.ad_user_data = 'granted';
        defaults.ad_personalization = 'granted';
        defaults.analytics_storage = 'granted';
      }
    }
  } catch (e) { /* localStorage puede fallar — quedan los defaults denegados */ }

  gtag('consent', 'default', defaults);
})();
`;

  return (
    <Script
      id="fincasya-consent-bootstrap"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: initScript }}
    />
  );
}
