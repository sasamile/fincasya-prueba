/**
 * Convierte HEIC/HEIF a JPEG en el servidor de subida.
 * El navegador (Chrome) a menudo no puede decodificar HEIC del iPhone.
 */
import convert from 'heic-convert';

const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'mif1',
  'msf1',
  'heif',
]);

export function looksLikeHeic(
  buffer: Buffer,
  contentType: string,
  ext: string,
): boolean {
  const mime = contentType.toLowerCase();
  if (mime.includes('heic') || mime.includes('heif')) return true;
  if (ext === 'heic' || ext === 'heif') return true;
  // ISO BMFF: bytes 4..7 = "ftyp", 8..11 = brand
  if (buffer.length < 12) return false;
  if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buffer.toString('ascii', 8, 12).toLowerCase();
  return HEIC_BRANDS.has(brand);
}

export async function convertHeicBufferToJpeg(
  buffer: Buffer,
): Promise<Buffer> {
  const output = await convert({
    buffer,
    format: 'JPEG',
    quality: 0.85,
  });
  return Buffer.from(output);
}
