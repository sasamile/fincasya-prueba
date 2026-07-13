import "server-only";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Convierte un .docx a PDF conservando el formato de la plantilla Word.
 * Igual que fincasya-new: primero iLovePDF (nube), y si falla o no hay keys,
 * LibreOffice headless local.
 *
 * Devuelve el PDF, o `null` si ninguna vía está disponible (el llamador entrega
 * entonces el .docx).
 */

/** Conversión vía iLovePDF (task 'officepdf'). Requiere las keys en el entorno. */
async function convertWithILovePdf(docx: Buffer): Promise<Buffer | null> {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  const secretKey = process.env.ILOVEPDF_SECRET_KEY;
  if (!publicKey || !secretKey) return null;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fy-ilove-"));
  const tmpFile = path.join(tmpDir, `contract_${Date.now()}.docx`);
  try {
    const ILovePDFApi = (await import("@ilovepdf/ilovepdf-nodejs")).default;
    const ILovePDFFile = (
      await import("@ilovepdf/ilovepdf-nodejs/ILovePDFFile")
    ).default;

    const instance = new ILovePDFApi(publicKey, secretKey);
    const task = instance.newTask("officepdf");
    await task.start();

    await fs.writeFile(tmpFile, docx);
    const file = new ILovePDFFile(tmpFile);
    await task.addFile(file);
    await task.process();
    const out = (await task.download()) as unknown;
    let pdf: Buffer;
    if (Buffer.isBuffer(out)) pdf = out;
    else if (out instanceof ArrayBuffer) pdf = Buffer.from(out);
    else pdf = Buffer.from(out as Uint8Array);
    return pdf.length >= 4 && pdf.subarray(0, 4).toString() === "%PDF"
      ? pdf
      : null;
  } catch {
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

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
  // 1) iLovePDF (nube) — primario, como en fincasya-new.
  const viaCloud = await convertWithILovePdf(docx);
  if (viaCloud) return viaCloud;

  // 2) LibreOffice local — fallback.
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
