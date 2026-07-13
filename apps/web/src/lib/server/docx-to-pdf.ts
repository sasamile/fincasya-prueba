import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Convierte un .docx a PDF conservando el formato de la plantilla Word.
 * Igual que fincasya-new: iLovePDF (nube) y, si falla, LibreOffice local.
 *
 * La conversión corre en un proceso hijo (`scripts/docx-to-pdf.mjs`) para evitar
 * que Turbopack rompa `@ilovepdf/ilovepdf-nodejs` dentro del route handler.
 */
export function convertDocxToPdf(docx: Buffer): Promise<Buffer | null> {
  const scriptPath = path.join(process.cwd(), "scripts", "docx-to-pdf.mjs");

  return new Promise<Buffer | null>((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code === 0 && out.length > 0) {
        const pdf = Buffer.concat(out);
        resolve(
          pdf.subarray(0, 4).toString() === "%PDF" ? pdf : null,
        );
        return;
      }
      const message = Buffer.concat(err).toString().trim();
      if (message) {
        console.error("[docx-to-pdf]", message);
      }
      resolve(null);
    });

    child.stdin.write(docx);
    child.stdin.end();
  });
}
