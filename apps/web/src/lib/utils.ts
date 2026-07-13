import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rating estable 4.5–4.9 sembrado por id (port de FincasYaWeb lib/utils). */
export const getSeededRating = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const pseudoRandom = (Math.abs(hash) % 5) / 10;
  const rating = 4.5 + pseudoRandom;
  return rating.toFixed(1);
};

/** Slug URL-safe desde un título (port de FincasYaWeb lib/utils). */
export type FincaListingUrlInput = {
  slug?: string | null;
  title: string;
  id?: string;
  _id?: string;
};

export function fincaListingSlugSegment(finca: FincaListingUrlInput): string {
  const raw = (
    finca.slug?.trim() ||
    slugify(finca.title || '') ||
    finca.id ||
    finca._id ||
    ''
  ).trim();
  return encodeURIComponent(raw);
}

/** URL HTTPS canónica de la ficha pública (WhatsApp / OG). */
export function absoluteFincaListingUrl(
  finca: FincaListingUrlInput,
  options?: { origin?: string; modo?: 'venta' },
): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const fromEnv =
    env && !/localhost|127\.0\.0\.1/i.test(env) ? env : 'https://fincasya.com';
  const origin = (options?.origin ?? fromEnv).replace(/\/$/, '');
  const path = `/fincas/${fincaListingSlugSegment(finca)}`;
  const query = options?.modo === 'venta' ? '?modo=venta' : '';
  return `${origin}${path}${query}`;
}

export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export const formatCOP = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\D/g, '')) : value;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatPriceInput = (value: number | string) => {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/\D/g, "")) : value;
  if (isNaN(num) || num === 0) return "";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(num);
};

export const parseCOP = (value: string) => {
  const cleanValue =
    typeof value === "string" ? value.replace(/\D/g, "") : String(value);
  return cleanValue ? parseInt(cleanValue, 10) : 0;
};

export const tidyDescriptionText = (text: string) => {
  if (!text) return "";

  let normalized = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Keep punctuation flow, but only add a break before emoji-led clauses.
  // Never split "emoji + text" into separate lines.
  normalized = normalized
    .replace(
      /([.!?])\s+(?=\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s+\p{L})/gu,
      "$1\n",
    )
    .replace(
      /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)(?=\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s+\p{L})/gu,
      "$1\n",
    );

  normalized = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, arr) => line.length > 0 || arr[index - 1] !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.includes("\n")) return normalized;

  const sentences = normalized.split(/(?<=[.!?])\s+/u).filter(Boolean);
  if (sentences.length <= 1) return normalized;

  const grouped: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    grouped.push(sentences.slice(i, i + 2).join(" "));
  }

  return grouped.join("\n\n");
};
