import { siteUrl } from './publicSiteUrl';

/** Chat oficial FincasYa (abre WhatsApp al número de la empresa). */
export const FINCASYA_WHATSAPP_E164 = '573157773937';

export function fincasYaWhatsAppUrl(prefill?: string): string {
  const text =
    prefill?.trim() ||
    'Hola FincasYa! Me interesa esta finca y quiero que un experto me atienda 🏡';
  return `https://wa.me/${FINCASYA_WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}

const WHATSAPP_FALLBACK = fincasYaWhatsAppUrl();

/** Links a fincasya.com en texto libre (bot / plantillas). */
const FINCASYA_URL_RE =
  /https?:\/\/(?:www\.)?fincasya\.com(\/[^\s<>"'）)\]]*)/gi;

const FINCAS_SLUG_IN_TEXT_RE =
  /(?:https?:\/\/(?:www\.)?fincasya\.com)?\/fincas\/([a-z0-9-]+)/gi;

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * URL pública canónica de una finca.
 * Formato correcto: https://www.fincasya.com/fincas/{slug}
 * (nunca /finca-{nombre} suelto en la raíz).
 */
export function publicPropertyUrl(slug: string): string {
  const s = normalizeSlug(slug).replace(/^\/+/, '');
  return `${siteUrl()}/fincas/${encodeURIComponent(s)}`;
}

/** Extrae el primer slug `/fincas/{slug}` válido de un texto (caption del post). */
export function extractPropertySlugFromText(text: string): string | null {
  if (!text) return null;
  FINCAS_SLUG_IN_TEXT_RE.lastIndex = 0;
  const m = FINCAS_SLUG_IN_TEXT_RE.exec(text);
  return m?.[1] ? normalizeSlug(m[1]) : null;
}

/**
 * Respuesta corta a comentarios: link de la finca + WhatsApp FincasYa.
 */
export function buildPropertyCommentReply(opts: {
  propertyUrl?: string | null;
  propertyTitle?: string | null;
}): string {
  const wa = fincasYaWhatsAppUrl(
    opts.propertyTitle
      ? `Hola FincasYa! Me interesa ${opts.propertyTitle} y quiero que un experto me atienda 🏡`
      : undefined,
  );
  const url = opts.propertyUrl?.trim();
  if (url) {
    return [
      '¡Hola! 🏡 Aquí puedes ver la finca:',
      url,
      '',
      'Escríbenos por WhatsApp y un experto te atiende 📲',
      wa,
    ].join('\n');
  }
  return [
    '¡Hola! 🏡 Gracias por tu comentario.',
    'Escríbenos por WhatsApp y un experto te atiende 📲',
    wa,
  ].join('\n');
}

/**
 * Corrige o elimina URLs inventadas de fincas en respuestas de comentarios.
 * - `/fincas/{slug}` válido → normaliza a www
 * - `/finca-…` u otros paths inventados → intenta mapear a un slug real;
 *   si no existe, sustituye por WhatsApp.
 */
export function sanitizeFincasYaUrlsInText(
  text: string,
  knownSlugs: Iterable<string>,
): string {
  const slugs = new Set(
    [...knownSlugs].map((s) => normalizeSlug(s)).filter(Boolean),
  );
  if (!text.includes('fincasya.com')) return text;

  return text.replace(FINCASYA_URL_RE, (_full, pathWithQuery: string) => {
    const pathOnly = String(pathWithQuery).split(/[?#]/)[0] ?? '';
    const pathname = pathOnly.replace(/\/+$/, '') || '/';

    const fincasMatch = /^\/fincas\/([a-z0-9-]+)$/i.exec(pathname);
    if (fincasMatch) {
      const slug = normalizeSlug(fincasMatch[1]!);
      if (slugs.has(slug)) return publicPropertyUrl(slug);
      return WHATSAPP_FALLBACK;
    }

    // Formato incorrecto típico del bot: /finca-casa-campestre-…
    const bare = pathname.replace(/^\//, '');
    const candidates = [
      bare,
      bare.replace(/^finca-/, ''),
      bare.startsWith('finca-') ? bare : `finca-${bare}`,
    ]
      .map(normalizeSlug)
      .filter(Boolean);

    for (const c of candidates) {
      if (slugs.has(c)) return publicPropertyUrl(c);
    }

    return WHATSAPP_FALLBACK;
  });
}
