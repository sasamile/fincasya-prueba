/**
 * Convierte .docx → PDF fuera del bundle de Next/Turbopack.
 * stdin: docx binario · stdout: PDF binario · stderr: errores
 *
 * 1) iLovePDF (officepdf) si hay keys en el entorno
 * 2) LibreOffice headless local
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readStdinBuffer() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function candidateBinaries() {
  const envBin =
    process.env.LIBREOFFICE_PATH?.trim() || process.env.SOFFICE_PATH?.trim();
  return [
    envBin,
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/opt/homebrew/bin/soffice",
    "soffice",
    "libreoffice",
  ].filter(Boolean);
}

async function convertWithILovePdf(docx) {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  const secretKey = process.env.ILOVEPDF_SECRET_KEY;
  if (!publicKey || !secretKey) return null;

  const tmpDir = mkdtempSync(join(tmpdir(), "fy-ilove-"));
  const tmpFile = join(tmpDir, `contract_${Date.now()}.docx`);
  try {
    const ILovePDFApi = (await import("@ilovepdf/ilovepdf-nodejs")).default;
    const ILovePDFFile = (
      await import("@ilovepdf/ilovepdf-nodejs/ILovePDFFile")
    ).default;

    const instance = new ILovePDFApi(publicKey, secretKey);
    const task = instance.newTask("officepdf");
    await task.start();

    writeFileSync(tmpFile, docx);
    await task.addFile(new ILovePDFFile(tmpFile));
    await task.process();
    const out = await task.download();
    const pdf = Buffer.isBuffer(out) ? out : Buffer.from(out);
    return pdf.length >= 4 && pdf.subarray(0, 4).toString() === "%PDF"
      ? pdf
      : null;
  } catch (err) {
    process.stderr.write(
      `iLovePDF: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function convertWithLibreOffice(docx) {
  const tmpDir = mkdtempSync(join(tmpdir(), "fy-lo-"));
  const inputPath = join(tmpDir, "contract.docx");
  const outputPath = join(tmpDir, "contract.pdf");

  try {
    writeFileSync(inputPath, docx);
    let converted = false;
    let lastErr = "";

    for (const bin of candidateBinaries()) {
      try {
        await execFileAsync(
          bin,
          [
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            "--outdir",
            tmpDir,
            inputPath,
          ],
          { timeout: 90_000 },
        );
        converted = true;
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
    }

    if (!converted) {
      if (lastErr) process.stderr.write(`LibreOffice: ${lastErr}\n`);
      return null;
    }

    const pdf = readFileSync(outputPath);
    return pdf.length >= 4 && pdf.subarray(0, 4).toString() === "%PDF"
      ? pdf
      : null;
  } catch (err) {
    process.stderr.write(
      `LibreOffice: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const docx = await readStdinBuffer();
  if (!docx.length) {
    process.stderr.write("DOCX vacío.");
    process.exit(2);
  }

  const viaCloud = await convertWithILovePdf(docx);
  if (viaCloud) {
    process.stdout.write(viaCloud);
    return;
  }

  const viaLo = await convertWithLibreOffice(docx);
  if (viaLo) {
    process.stdout.write(viaLo);
    return;
  }

  process.stderr.write(
    "No se pudo convertir a PDF (revisa ILOVEPDF_* o instala LibreOffice).",
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(String(err?.message ?? err));
  process.exit(1);
});
