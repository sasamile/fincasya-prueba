import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { WordFirmaImage } from "@/lib/server/contract-docx";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET_NAME || "";

let s3: S3Client | null = null;
function getS3(): S3Client | null {
  if (!BUCKET || !process.env.AWS_ACCESS_KEY_ID) return null;
  if (!s3) {
    s3 = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3;
}

/** Extrae bucket/key de URLs S3 típicas de FincasYa. */
function parseS3ObjectUrl(
  url: string,
): { bucket: string; key: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    // https://bucket.s3.region.amazonaws.com/key
    const virtual = host.match(
      /^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i,
    );
    if (virtual) {
      const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
      if (key) return { bucket: virtual[1], key };
    }
    // https://s3.region.amazonaws.com/bucket/key
    const pathStyle = u.pathname.match(/^\/([^/]+)\/(.+)$/);
    if (
      pathStyle &&
      (/^s3[.-]/i.test(host) || host === "s3.amazonaws.com")
    ) {
      return {
        bucket: decodeURIComponent(pathStyle[1]),
        key: decodeURIComponent(pathStyle[2]),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function detectFirmaExt(
  bytes: Buffer,
  hintUrl = "",
  contentType = "",
): WordFirmaImage["ext"] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  // WebP: RIFF....WEBP — Word no lo embebe bien; rechazar.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45
  ) {
    return null;
  }
  const ct = contentType.toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g(\?|$)/i.test(hintUrl))
    return "jpg";
  if (ct.includes("png") || /\.png(\?|$)/i.test(hintUrl)) return "png";
  return null;
}

async function bufferFromS3(
  bucket: string,
  key: string,
): Promise<Buffer | null> {
  const client = getS3();
  if (!client) return null;
  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!out.Body) return null;
    const bytes = Buffer.from(await out.Body.transformToByteArray());
    return bytes.length >= 32 ? bytes : null;
  } catch (err) {
    console.warn("[firma] S3 GetObject falló", bucket, key, err);
    return null;
  }
}

/**
 * Descarga la imagen de firma (PNG/JPEG) desde URL pública, S3 autenticado
 * o data URL. Si falla, el contrato sigue sin firma (placeholder vacío).
 */
export async function fetchFirmaImage(
  url: string | undefined,
): Promise<WordFirmaImage | undefined> {
  const src = String(url ?? "").trim();
  if (!src) return undefined;

  try {
    // data:image/png;base64,...
    const dataMatch = src.match(
      /^data:image\/(png|jpe?g|jpeg);base64,(.+)$/i,
    );
    if (dataMatch) {
      const bytes = Buffer.from(dataMatch[2], "base64");
      if (bytes.length < 32 || bytes.length > 4_000_000) return undefined;
      const ext: WordFirmaImage["ext"] =
        dataMatch[1].toLowerCase().startsWith("png") ? "png" : "jpg";
      return { bytes, ext };
    }

    if (!/^https?:\/\//i.test(src)) {
      console.warn("[firma] URL no http(s)", src.slice(0, 80));
      return undefined;
    }

    let bytes: Buffer | null = null;
    let contentType = "";

    const s3obj = parseS3ObjectUrl(src);
    if (s3obj && (!BUCKET || s3obj.bucket === BUCKET)) {
      bytes = await bufferFromS3(s3obj.bucket, s3obj.key);
    }

    if (!bytes) {
      const res = await fetch(src, {
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!res.ok) {
        console.warn("[firma] fetch HTTP", res.status, src.slice(0, 120));
        // Reintento S3 aunque el bucket no coincida exactamente.
        if (s3obj) {
          bytes = await bufferFromS3(s3obj.bucket, s3obj.key);
        }
        if (!bytes) return undefined;
      } else {
        bytes = Buffer.from(await res.arrayBuffer());
        contentType = res.headers.get("content-type") || "";
      }
    }

    if (!bytes || bytes.length < 32 || bytes.length > 4_000_000) {
      console.warn("[firma] bytes inválidos", bytes?.length);
      return undefined;
    }

    const ext = detectFirmaExt(bytes, src, contentType);
    if (!ext) {
      console.warn(
        "[firma] formato no soportado (usa PNG o JPG, no WebP)",
        src.slice(0, 120),
      );
      return undefined;
    }
    return { bytes, ext };
  } catch (err) {
    console.warn("[firma] error descargando", err);
    return undefined;
  }
}
