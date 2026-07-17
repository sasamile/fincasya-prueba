/**
 * Lee la imagen de firma desde URL (mismo origen / S3 público) y la
 * convierte a data-URL para mandarla en el POST del contrato. Así el
 * servidor no depende de que el bucket sea fetchable sin auth.
 */
export async function firmaUrlToDataUrl(
  url: string | undefined | null,
): Promise<string | undefined> {
  const src = String(url ?? "").trim();
  if (!src) return undefined;
  if (src.startsWith("data:image/")) return src;

  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (blob.size < 32 || blob.size > 4_000_000) return undefined;

    const mime = (blob.type || "image/png").toLowerCase();
    if (!mime.startsWith("image/")) return undefined;
    // Word solo embebe PNG/JPEG de forma fiable.
    if (
      !mime.includes("png") &&
      !mime.includes("jpeg") &&
      !mime.includes("jpg")
    ) {
      console.warn("[firma] formato no PNG/JPG:", mime);
      return undefined;
    }

    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    const outMime = mime.includes("png") ? "image/png" : "image/jpeg";
    return `data:${outMime};base64,${b64}`;
  } catch (err) {
    console.warn("[firma] no se pudo leer la imagen en el cliente", err);
    return undefined;
  }
}
