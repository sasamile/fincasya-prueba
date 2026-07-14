/**
 * Parseo ligero de User-Agent → navegador + SO (sin dependencias).
 */

export type DeviceInfo = {
  browser: string;
  os: string;
  device: string;
  /** Una línea corta para la tabla, ej. "Chrome · macOS". */
  label: string;
};

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const raw = (ua ?? '').trim();
  if (!raw) {
    return { browser: 'Desconocido', os: '—', device: '—', label: 'Sin datos' };
  }

  let browser = 'Navegador';
  if (/Edg\//i.test(raw)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(raw)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(raw)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(raw) && !/Chromium/i.test(raw)) browser = 'Chrome';
  else if (/Firefox\//i.test(raw)) browser = 'Firefox';
  else if (/Safari\//i.test(raw) && !/Chrome/i.test(raw)) browser = 'Safari';
  else if (/CriOS\//i.test(raw)) browser = 'Chrome';
  else if (/FxiOS\//i.test(raw)) browser = 'Firefox';

  let os = '—';
  if (/Windows NT 10/i.test(raw)) os = 'Windows';
  else if (/Windows/i.test(raw)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(raw)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(raw)) os = 'iOS';
  else if (/Android/i.test(raw)) os = 'Android';
  else if (/CrOS/i.test(raw)) os = 'ChromeOS';
  else if (/Linux/i.test(raw)) os = 'Linux';

  let device = 'PC';
  if (/iPhone/i.test(raw)) device = 'iPhone';
  else if (/iPad/i.test(raw)) device = 'iPad';
  else if (/Android/i.test(raw) && /Mobile/i.test(raw)) device = 'Android';
  else if (/Android/i.test(raw)) device = 'Tablet';
  else if (/Mobile/i.test(raw)) device = 'Móvil';

  const label =
    device === 'PC' || device === '—'
      ? `${browser} · ${os}`
      : `${browser} · ${device}`;

  return { browser, os, device, label };
}
