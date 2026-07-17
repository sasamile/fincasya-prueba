/**
 * Convierte .docx → PDF fuera del bundle de Next/Turbopack.
 * stdin: docx binario · stdout: PDF binario · stderr: errores
 *
 * 1) iLovePDF REST (sin SDK) si hay keys en el entorno
 * 2) LibreOffice headless local
 */
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ILOVE_API = "https://api.ilovepdf.com/v1";

async function readStdinBuffer() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function isPdf(buf) {
  return buf.length >= 4 && buf.subarray(0, 4).toString() === "%PDF";
}

function base64url(data) {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

function signJwt(publicKey, secretKey) {
  const timeNow = Date.now() / 1000;
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      jti: publicKey,
      iss: "api.ilovepdf.com",
      iat: timeNow - 5,
    }),
  );
  const sig = createHmac("sha256", secretKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
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
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY?.trim();
  const secretKey = process.env.ILOVEPDF_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) return null;

  try {
    const token = signJwt(publicKey, secretKey);
    const auth = { Authorization: `Bearer ${token}` };

    const startRes = await fetch(`${ILOVE_API}/start/officepdf`, {
      method: "GET",
      headers: auth,
    });
    const start = await startRes.json().catch(() => ({}));
    if (!startRes.ok || !start.server || !start.task) {
      process.stderr.write(
        `iLovePDF start: ${JSON.stringify(start).slice(0, 200)}\n`,
      );
      return null;
    }

    const serverBase = `https://${start.server}/v1`;
    const form = new FormData();
    form.append("task", start.task);
    form.append(
      "file",
      new Blob([docx], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "contract.docx",
    );

    const uploadRes = await fetch(`${serverBase}/upload`, {
      method: "POST",
      headers: auth,
      body: form,
    });
    const uploaded = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploaded.server_filename) {
      process.stderr.write(
        `iLovePDF upload: ${JSON.stringify(uploaded).slice(0, 200)}\n`,
      );
      return null;
    }

    const processRes = await fetch(`${serverBase}/process`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        task: start.task,
        tool: "officepdf",
        files: [
          {
            server_filename: uploaded.server_filename,
            filename: "contract.docx",
          },
        ],
      }),
    });
    if (!processRes.ok) {
      const body = await processRes.text().catch(() => "");
      process.stderr.write(`iLovePDF process: ${body.slice(0, 200)}\n`);
      return null;
    }

    const downloadRes = await fetch(
      `${serverBase}/download/${encodeURIComponent(start.task)}`,
      { method: "GET", headers: auth },
    );
    if (!downloadRes.ok) {
      process.stderr.write(`iLovePDF download: ${downloadRes.status}\n`);
      return null;
    }
    const pdf = Buffer.from(await downloadRes.arrayBuffer());
    return isPdf(pdf) ? pdf : null;
  } catch (err) {
    process.stderr.write(
      `iLovePDF: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
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
    return isPdf(pdf) ? pdf : null;
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
