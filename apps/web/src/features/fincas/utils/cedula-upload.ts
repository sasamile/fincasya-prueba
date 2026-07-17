/**
 * Helpers de foto de cédula para reserva web (misma política que link de venta).
 */

export function isCedulaAcceptedFile(file: File) {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'application/pdf' || mime.includes('pdf')) return true;
  if (mime.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'].includes(ext);
}

function isPdfCedulaFile(file: File) {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'application/pdf' || mime.includes('pdf')) return true;
  return (file.name.split('.').pop()?.toLowerCase() ?? '') === 'pdf';
}

async function rasterizeImageToJpeg(file: File, maxEdge = 1600): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode_failed'));
      el.src = objectUrl;
    });
    const scale = Math.min(
      1,
      maxEdge / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob_failed'))),
        'image/jpeg',
        0.85,
      );
    });
    const name = file.name.replace(/\.[^.]+$/i, '') || 'cedula';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Prepara imagen/PDF para upload + IA (JPEG preferido). */
export async function prepareCedulaFileForAi(file: File): Promise<File> {
  if (isPdfCedulaFile(file)) {
    // El servidor/IA rechaza PDF crudo; pedimos imagen en UI.
    throw new Error('pdf_not_allowed');
  }
  try {
    return await rasterizeImageToJpeg(file);
  } catch {
    return file;
  }
}

export const CEDULA_REJECT_MESSAGES: Record<string, string> = {
  not_a_document:
    'La imagen no parece un documento de identidad. Sube una foto clara del frente de tu cédula.',
  number_mismatch:
    'El número de la cédula en la foto no coincide con el que escribiste. Revisa ambos.',
  name_mismatch:
    'El nombre en la cédula no coincide con el que escribiste. Revisa ambos.',
  pdf_not_allowed:
    'Sube una foto (JPG/PNG) del frente de tu cédula, no un PDF.',
  unreadable:
    'No pudimos leer esa imagen. Sube una foto más clara del frente de tu cédula.',
  ai_unavailable:
    'No pudimos validar tu cédula en este momento. Intenta de nuevo.',
};

export function cedulaRejectMessage(
  reason: string | undefined,
  aiNumber?: string,
): string {
  if (reason === 'number_mismatch' && aiNumber) {
    return `El número de la cédula que adjuntaste (${aiNumber}) no coincide con el que escribiste. Revisa ambos.`;
  }
  return (
    CEDULA_REJECT_MESSAGES[String(reason)] ??
    'No pudimos validar tu cédula. Intenta con otra foto.'
  );
}

export async function uploadCedulaToS3(file: File): Promise<{
  url: string;
  fileName: string;
}> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'documents');
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'No se pudo subir la foto de cédula.');
  }
  return { url: data.url, fileName: file.name };
}
