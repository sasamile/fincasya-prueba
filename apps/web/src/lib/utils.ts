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
