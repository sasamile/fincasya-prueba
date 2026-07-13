export const COOKIE_CONSENT_KEY = 'fincasya:cookie-consent:v1';

export type CookieConsentChoice = 'accepted' | 'rejected';

export function getStoredCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw === 'accepted' || raw === 'rejected') return raw;
    return null;
  } catch {
    return null;
  }
}

export function storeCookieConsent(choice: CookieConsentChoice) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    /* private browsing */
  }
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function injectScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Carga Meta Pixel y Google Analytics solo tras consentimiento explícito. */
export function loadMarketingScripts() {
  if (typeof window === 'undefined') return;

  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (metaPixelId && !window.fbq) {
    const n = (window.fbq = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n as any).callMethod ? (n as any).callMethod(...args) : (n as any).queue.push(args);
    }) as typeof window.fbq & { queue: unknown[]; loaded?: boolean; version?: string };
    if (!window._fbq) window._fbq = n;
    n.queue = [];
    n.loaded = true;
    n.version = '2.0';
    injectScript('meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq?.('init', metaPixelId);
    window.fbq?.('track', 'PageView');
  }

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (gaId && !window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    injectScript('google-analytics', `https://www.googletagmanager.com/gtag/js?id=${gaId}`);
    window.gtag('js', new Date());
    window.gtag('config', gaId, { anonymize_ip: true });
  }
}
