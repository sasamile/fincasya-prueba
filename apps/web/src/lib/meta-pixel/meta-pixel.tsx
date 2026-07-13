"use client";

import Script from "next/script";

/**
 * Componente que inyecta el snippet base de Meta Pixel en el documento.
 *
 * - Carga `fbevents.js` con strategy `afterInteractive` (igual que GA del
 *   proyecto), para no bloquear el render inicial.
 * - Dispara `PageView` una sola vez al inicializar. Los cambios de ruta
 *   client-side se manejan desde `useMetaPixelPageView()` en el layout.
 * - El `<noscript>` con el pixel image permite tracking básico cuando JS está
 *   desactivado.
 *
 * Configuración:
 * - Requiere `NEXT_PUBLIC_FB_PIXEL_ID` definida en build time.
 * - En local: `.env.local` (ya gitignored).
 * - En CI/CD: secret de GitHub Actions pasado como `--build-arg` al
 *   `docker build` (ver `.github/workflows/deploy.yml` y `Dockerfile`).
 *
 * Si la variable no está definida, el componente NO carga el Pixel pero la
 * app sigue funcionando normal — esto evita romper el sitio si alguien
 * olvida configurar el secret.
 */
export function MetaPixel() {
  const pixelId =
    process.env.NEXT_PUBLIC_META_PIXEL_ID ?? process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  if (!pixelId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[MetaPixel] NEXT_PUBLIC_META_PIXEL_ID no está definido — el Pixel no se inicializará.",
      );
    }
    return null;
  }

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        // El snippet es el oficial de Meta. Mantenerlo idéntico facilita
        // que cualquier auditoría (Pixel Helper, Events Manager) lo reconozca.
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            // Ley 1581 / GDPR: revocar consent ANTES de init para que el Pixel
            // arranque sin cookies de tracking. Si el usuario tiene consent
            // 'accepted' guardado, el hook useCookieConsent lo regrant al
            // hidratar (ver features/legal/lib/consent.ts).
            try {
              var raw = window.localStorage.getItem('fincasya_cookie_consent_v1');
              var hasAccepted = false;
              if (raw) {
                var parsed = JSON.parse(raw);
                hasAccepted = parsed && parsed.status === 'accepted' && parsed.policyVersion === '1.0.0';
              }
              if (!hasAccepted) {
                fbq('consent', 'revoke');
              }
            } catch (e) {
              fbq('consent', 'revoke');
            }
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* Fallback sin JS: imagen 1x1 que registra el PageView */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
