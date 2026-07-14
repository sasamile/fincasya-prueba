/**
 * Plantillas HTML de correo. Todas usan un layout de marca común (`wrap`) y
 * formato colombiano (es-CO / COP / America/Bogota).
 */
import { brandLogoUrl } from './email';

const BRAND = '#f97316'; // orange-500 (acento)
const BRAND_DARK = '#ea580c'; // orange-600 (degradado / hover)
const HEADER_BG = '#0f172a'; // slate-900 (encabezado premium)
const INK = '#0f172a'; // texto principal
const MUTED = '#64748b'; // texto secundario
const HAIRLINE = '#e2e8f0'; // bordes suaves
const CANVAS = '#eef1f5'; // fondo del correo

export function formatCOP(value?: number | null): string {
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(ts?: number | null): string {
  if (typeof ts !== 'number') return '—';
  return new Date(ts).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(ts?: number | null): string {
  if (typeof ts !== 'number') return '—';
  return new Date(ts).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Layout base: logo, título, cuerpo y pie. */
export function wrap(opts: {
  title: string;
  intro?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  accent?: string;
}): string {
  const accent = opts.accent || BRAND;
  const accentDark = opts.accent ? opts.accent : BRAND_DARK;
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<tr><td style="padding:20px 0 4px">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:linear-gradient(180deg,${accent} 0%,${accentDark} 100%);background-color:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:.2px;padding:14px 30px;border-radius:10px;box-shadow:0 6px 16px rgba(234,88,12,0.28)">${esc(
             opts.ctaLabel,
           )}</a>
         </td></tr>`
      : '';
  return `
  <div style="background:${CANVAS};padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS}">
      <tr><td align="center" style="padding:0 16px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${HAIRLINE};box-shadow:0 12px 40px rgba(15,23,42,0.08)">
          <tr><td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,${accent} 0%,${accentDark} 100%)">&nbsp;</td></tr>
          <tr><td style="background:${HEADER_BG};padding:26px 32px" align="left">
            <img src="${brandLogoUrl()}" alt="FincasYa" height="30" style="height:30px;display:block"/>
          </td></tr>
          <tr><td style="padding:34px 32px 0">
            <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${INK};letter-spacing:-0.2px">${esc(opts.title)}</h1>
            ${opts.intro ? `<p style="margin:12px 0 0;font-size:15px;color:${MUTED};line-height:1.6">${esc(opts.intro)}</p>` : ''}
          </td></tr>
          <tr><td style="padding:22px 32px 0;font-size:14px;color:#334155;line-height:1.6">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td>${opts.bodyHtml}</td></tr>
              ${cta}
            </table>
          </td></tr>
          <tr><td style="padding:28px 32px 30px">
            <hr style="border:none;border-top:1px solid ${HAIRLINE};margin:0 0 14px"/>
            <p style="margin:0;font-size:12px;color:${INK};font-weight:600">FincasYa</p>
            <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;line-height:1.5">Los expertos en alquiler</p>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:11px;color:#94a3b8">© ${new Date().getFullYear()} FincasYa. Todos los derechos reservados.</p>
      </td></tr>
    </table>
  </div>`;
}

/** Filas "clave: valor" para el cuerpo, presentadas como tarjeta con separadores. */
export function rows(pairs: Array<[string, string | undefined]>): string {
  const visible = pairs.filter(([, v]) => v != null && v !== '');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${HAIRLINE};border-radius:12px;font-size:14px">
    ${visible
      .map(
        ([k, v], i) =>
          `<tr>
             <td style="padding:12px 16px;color:${MUTED};width:40%;vertical-align:top;${i > 0 ? `border-top:1px solid ${HAIRLINE};` : ''}">${esc(k)}</td>
             <td style="padding:12px 16px;color:${INK};font-weight:600;text-align:right;${i > 0 ? `border-top:1px solid ${HAIRLINE};` : ''}">${esc(v)}</td>
           </tr>`,
      )
      .join('')}
  </table>`;
}
