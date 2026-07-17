import "server-only";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type DocxToPdfResult = {
  pdf: Buffer | null;
  /** Motivo real cuando falla (útil en logs / respuesta 503). */
  error?: string;
};

function isPdf(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString() === "%PDF";
}

/**
 * Conversión in-process con iLovePDF.
 * En Vercel no hay LibreOffice: esto es la ruta principal de producción.
 */
async function convertWithILovePdfInProcess(
  docx: Buffer,
): Promise<DocxToPdfResult> {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY?.trim();
  const secretKey = process.env.ILOVEPDF_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    return {
      pdf: null,
      error:
        "Faltan ILOVEPDF_PUBLIC_KEY / ILOVEPDF_SECRET_KEY en el runtime del servidor (Vercel → Environment Variables → Production).",
    };
  }

  const tmpDir = mkdtempSync(path.join(tmpdir(), "fy-ilove-"));
  const tmpFile = path.join(tmpDir, `contract_${Date.now()}.docx`);
  try {
    // Resolver desde package.json del app evita rutas rotas en el bundle de Next.
    const require = createRequire(path.join(process.cwd(), "package.json"));
    const ILovePDFApi = require("@ilovepdf/ilovepdf-nodejs");
    const ILovePDFFile = require("@ilovepdf/ilovepdf-nodejs/ILovePDFFile.js");

    const instance = new ILovePDFApi(publicKey, secretKey);
    const task = instance.newTask("officepdf");
    await task.start();

    writeFileSync(tmpFile, docx);
    await task.addFile(new ILovePDFFile(tmpFile));
    await task.process();
    const out = await task.download();
    const pdf = Buffer.isBuffer(out) ? out : Buffer.from(out);

    if (!isPdf(pdf)) {
      return {
        pdf: null,
        error: "iLovePDF respondió pero el archivo no es un PDF válido.",
      };
    }
    return { pdf };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[docx-to-pdf] iLovePDF:", message);
    return { pdf: null, error: `iLovePDF: ${message}` };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Fallback local (Mac/dev): script + LibreOffice. En Vercel casi nunca aplica. */
function convertViaChildScript(docx: Buffer): Promise<DocxToPdfResult> {
  const scriptPath = path.join(process.cwd(), "scripts", "docx-to-pdf.mjs");
  if (!existsSync(scriptPath)) {
    return Promise.resolve({
      pdf: null,
      error: "No está el script scripts/docx-to-pdf.mjs en el deploy.",
    });
  }

  return new Promise<DocxToPdfResult>((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", (e) =>
      resolve({ pdf: null, error: `spawn: ${e.message}` }),
    );
    child.on("close", (code) => {
      if (code === 0 && out.length > 0) {
        const pdf = Buffer.concat(out);
        resolve(
          isPdf(pdf)
            ? { pdf }
            : { pdf: null, error: "El script no devolvió un PDF válido." },
        );
        return;
      }
      const message = Buffer.concat(err).toString().trim();
      if (message) console.error("[docx-to-pdf] child:", message);
      resolve({
        pdf: null,
        error: message || `Script docx-to-pdf salió con código ${code}.`,
      });
    });

    child.stdin.write(docx);
    child.stdin.end();
  });
}

/**
 * Convierte un .docx a PDF conservando el formato de la plantilla Word.
 * 1) iLovePDF in-process (producción / Vercel)
 * 2) Script hijo + LibreOffice (desarrollo local)
 */
export async function convertDocxToPdfDetailed(
  docx: Buffer,
): Promise<DocxToPdfResult> {
  const cloud = await convertWithILovePdfInProcess(docx);
  if (cloud.pdf) return cloud;

  const viaChild = await convertViaChildScript(docx);
  if (viaChild.pdf) return viaChild;

  return {
    pdf: null,
    error: [cloud.error, viaChild.error].filter(Boolean).join(" · "),
  };
}

/** Compat: solo el buffer (o null). */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer | null> {
  const { pdf } = await convertDocxToPdfDetailed(docx);
  return pdf;
}
