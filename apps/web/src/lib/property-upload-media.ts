/**
 * Fotos de ficha: redimensiona (borde largo), marca de agua centrada (40% ancho, 50% opacidad), JPEG.
 * GIF no se toca (animación). El archivo que llega al API ya lleva la marca incrustada en los píxeles.
 */
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.78;
const WATERMARK_PATH = "/marca/fincasya logo png.png";
const WATERMARK_WIDTH_RATIO = 0.4;
const WATERMARK_OPACITY = 0.5;

let watermarkImagePromise: Promise<HTMLImageElement | null> | null = null;

function loadWatermarkOnce(): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!watermarkImagePromise) {
    watermarkImagePromise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        watermarkImagePromise = null;
        resolve(null);
      };
      img.src = encodeURI(WATERMARK_PATH);
    });
  }
  return watermarkImagePromise;
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  cw: number,
  ch: number,
) {
  const lw = logo.naturalWidth || logo.width;
  const lh = logo.naturalHeight || logo.height;
  if (lw <= 0 || lh <= 0) return;

  const ww = cw * WATERMARK_WIDTH_RATIO;
  const wh = ww * (lh / lw);
  const wx = (cw - ww) / 2;
  const wy = (ch - wh) / 2;

  ctx.save();
  ctx.globalAlpha = WATERMARK_OPACITY;
  ctx.drawImage(logo, wx, wy, ww, wh);
  ctx.restore();
}

export async function compressImageFileForPropertyUpload(
  file: File,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const logo = await loadWatermarkOnce();

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const maxEdge = Math.max(width, height);
    if (maxEdge > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / maxEdge;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }

    if (file.type === "image/png" || file.type === "image/webp") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    if (logo) {
      drawWatermark(ctx, logo, width, height);
    }

    const mime = "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, JPEG_QUALITY);
    });
    if (!blob) return file;

    const watermarked = Boolean(logo);
    if (!watermarked && blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.jpg`, {
      type: mime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function compressImageFilesForPropertyUpload(
  files: File[],
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImageFileForPropertyUpload(f)));
}
