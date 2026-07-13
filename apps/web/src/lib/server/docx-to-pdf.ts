import "server-only";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Convierte un .docx a PDF con LibreOffice en modo headless (igual que el
 * fallback de fincasya-new). Conserva el formato de la plantilla Word.
 *
 * Devuelve el PDF, o `null` si LibreOffice no está disponible o la conversión
 * falla (el llamador entrega entonces el .docx).
 */

function candidateBinaries(): string[] {
  const envBin =
    process.env.LIBREOFFICE_PATH?.trim() || process.env.SOFFICE_PATH?.trim();
  return [
    envBin,
    "/Applications/LibreOffice.app/Contents/MacOS/soffice", // macOS
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/opt/homebrew/bin/soffice",
    "soffice",
    "libreoffice",
  ].filter(Boolean) as string[];
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 60_000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function convertDocxToPdf(docx: Buffer): Promise<Buffer | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fy-contract-"));
  const inputPath = path.join(tmpDir, "contract.docx");
  const outputPath = path.join(tmpDir, "contract.pdf");

  try {
    await fs.writeFile(inputPath, docx);

    let converted = false;
    for (const bin of candidateBinaries()) {
      try {
        await run(bin, [
          "--headless",
          "--nologo",
          "--nofirststartwizard",
          "--convert-to",
          "pdf",
          "--outdir",
          tmpDir,
          inputPath,
        ]);
        converted = true;
        break;
      } catch {
        // probar el siguiente binario
      }
    }
    if (!converted) return null;

    const pdf = await fs.readFile(outputPath).catch(() => null);
    if (!pdf || pdf.subarray(0, 4).toString() !== "%PDF") return null;
    return pdf;
  } catch {
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
