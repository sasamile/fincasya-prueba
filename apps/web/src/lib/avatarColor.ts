/**
 * Colores del avatar por defecto de WhatsApp. Cada contacto recibe un par
 * (círculo, silueta) determinístico según su nombre, como asigna WhatsApp.
 */
export type AvatarColor = { bg: string; fg: string };

const PALETTE: AvatarColor[] = [
  { bg: '#0e3b31', fg: '#45c8a6' }, // teal
  { bg: '#2a2153', fg: '#9d8bf0' }, // violeta
  { bg: '#3d2030', fg: '#ec6a9c' }, // rosa
  { bg: '#123047', fg: '#6fb0e8' }, // azul
  { bg: '#3a2a12', fg: '#e0a24e' }, // ámbar
  { bg: '#123a1e', fg: '#57c76a' }, // verde
  { bg: '#3a1a1a', fg: '#e8776f' }, // rojo
  { bg: '#152f39', fg: '#5ec2d4' }, // cian
  { bg: '#2e2440', fg: '#c58af0' }, // magenta
  { bg: '#13323a', fg: '#4fb8c9' }, // turquesa
];

export function avatarColorFor(seed: string): AvatarColor {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}
