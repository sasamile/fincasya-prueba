const PROOF_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "heic",
  "heif",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export function proofExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase().trim() ?? "";
}

/** Nombre ASCII seguro para cabeceras HTTP (S3 Content-Disposition). */
export function safeProofFilename(fileName: string): string {
  const base = (fileName.split(/[/\\]/).pop() || "comprobante")
    .replace(/[\r\n\x00-\x1f"]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim();
  return base.slice(0, 180) || "comprobante";
}

export function guessProofMimeType(fileName: string, mimeType: string): string {
  const mime = mimeType.trim().toLowerCase();
  if (mime.startsWith("image/") || mime === "application/pdf") return mime;
  const fromExt = EXT_TO_MIME[proofExtension(fileName)];
  return fromExt ?? mime;
}

export function isAllowedProofUpload(fileName: string, mimeType: string): boolean {
  const mime = guessProofMimeType(fileName, mimeType);
  if (mime.startsWith("image/") || mime === "application/pdf") return true;
  return PROOF_EXTENSIONS.has(proofExtension(fileName));
}

export type ProofMediaKind = "image" | "pdf" | "unknown";

export function resolveProofMediaKind(
  fileName?: string | null,
  mimeType?: string | null,
): ProofMediaKind {
  const mime = guessProofMimeType(fileName ?? "", mimeType ?? "");
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "unknown";
}
