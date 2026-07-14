/**
 * Unfurl Open Graph / Twitter Card de una URL para el compositor del inbox.
 * Solo HTTP(S); bloquea hosts privados (SSRF).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const runtime = 'nodejs';
export const maxDuration = 15;

const MAX_BYTES = 1_200_000;
const FETCH_MS = 8_000;

export type LinkPreviewPayload = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  domain: string;
};

function stripTrailingPunctuation(raw: string) {
  return raw.replace(/[)\],.!?;:'"…]+$/g, '');
}

function parseCandidateUrl(raw: string): URL | null {
  try {
    const trimmed = stripTrailingPunctuation(raw.trim());
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.hostname.includes(' ')) return null;
    return url;
  } catch {
    return null;
  }
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80') ||
      lower.startsWith('::ffff:127.') ||
      lower.startsWith('::ffff:10.') ||
      lower.startsWith('::ffff:192.168.')
    );
  }
  return true;
}

async function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0'
  ) {
    throw new Error('Host no permitido');
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Host no permitido');
    return;
  }

  const records = await lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error('Host no resuelve');
  for (const rec of records) {
    if (isPrivateIp(rec.address)) throw new Error('Host no permitido');
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        'i',
      ),
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (match?.[1]) return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

function pageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function absoluteUrl(base: URL, maybeRelative: string | null): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: URL): Promise<{ finalUrl: URL; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; FincasYaLinkPreview/1.0; +https://fincasya.com)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ctype = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(ctype) && ctype && !ctype.includes('text/')) {
      throw new Error('No es HTML');
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('Respuesta muy grande');
    const html = new TextDecoder('utf-8').decode(buf);
    const finalUrl = new URL(res.url || url.toString());
    return { finalUrl, html };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'Falta url' }, { status: 400 });
  }

  const url = parseCandidateUrl(raw);
  if (!url) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  try {
    await assertPublicHost(url.hostname);
    const { finalUrl, html } = await fetchHtml(url);
    await assertPublicHost(finalUrl.hostname);

    const title =
      metaContent(html, ['og:title', 'twitter:title']) || pageTitle(html);
    const description = metaContent(html, [
      'og:description',
      'twitter:description',
      'description',
    ]);
    const image = absoluteUrl(
      finalUrl,
      metaContent(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']),
    );
    const siteName = metaContent(html, ['og:site_name']);
    const domain = finalUrl.hostname.replace(/^www\./i, '');

    const payload: LinkPreviewPayload = {
      url: finalUrl.toString(),
      title: title?.slice(0, 140) || null,
      description: description?.slice(0, 220) || null,
      image,
      siteName: siteName?.slice(0, 80) || null,
      domain,
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'No se pudo obtener la preview',
      },
      { status: 422 },
    );
  }
}
