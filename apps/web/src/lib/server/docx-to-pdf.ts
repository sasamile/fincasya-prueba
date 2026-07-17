import "server-only";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type DocxToPdfResult = {
  pdf: Buffer | null;
  /** Motivo real cuando falla (útil en logs / respuesta 503). */
  error?: string;
};

const ILOVE_API = "https://api.ilovepdf.com/v1";

function isPdf(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString() === "%PDF";
}

function base64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

/** JWT local igual que el SDK oficial (sin depender de node_modules). */
function signILovePdfJwt(publicKey: string, secretKey: string): string {
  const timeNow = Date.now() / 1000;
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      jti: publicKey,
      iss: "api.ilovepdf.com",
      // El servidor rechaza tokens “recién hechos”; el SDK resta 5s.
      iat: timeNow - 5,
    }),
  );
  const sig = createHmac("sha256", secretKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function getILovePdfToken(
  publicKey: string,
  secretKey: string,
): Promise<string> {
  // Preferir JWT local (server-side). Si falla, /auth con public_key.
  try {
    return signILovePdfJwt(publicKey, secretKey);
  } catch {
    /* fall through */
  }
  const res = await fetch(`${ILOVE_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!res.ok || !data.token) {
    throw new Error(
      `auth falló (${res.status}): ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return data.token;
}

/**
 * DOCX → PDF vía REST de iLovePDF (sin @ilovepdf/ilovepdf-nodejs).
 * Esto es lo que funciona en Vercel: el SDK CJS no entra en el bundle serverless.
 */
async function convertWithILovePdfRest(
  docx: Buffer,
): Promise<DocxToPdfResult> {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY?.trim();
  const secretKey = process.env.ILOVEPDF_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    return {
      pdf: null,
      error:
        "Faltan ILOVEPDF_PUBLIC_KEY / ILOVEPDF_SECRET_KEY en el runtime (Vercel → Environment Variables → Production).",
    };
  }

  try {
    const token = await getILovePdfToken(publicKey, secretKey);
    const auth = { Authorization: `Bearer ${token}` };

    const startRes = await fetch(`${ILOVE_API}/start/officepdf`, {
      method: "GET",
      headers: auth,
    });
    const start = (await startRes.json().catch(() => ({}))) as {
      server?: string;
      task?: string;
      error?: { message?: string };
      message?: string;
    };
    if (!startRes.ok || !start.server || !start.task) {
      throw new Error(
        `start: ${start.error?.message || start.message || JSON.stringify(start).slice(0, 200)}`,
      );
    }

    const serverBase = `https://${start.server}/v1`;
    const form = new FormData();
    form.append("task", start.task);
    form.append(
      "file",
      new Blob([new Uint8Array(docx)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "contract.docx",
    );

    const uploadRes = await fetch(`${serverBase}/upload`, {
      method: "POST",
      headers: auth,
      body: form,
    });
    const uploaded = (await uploadRes.json().catch(() => ({}))) as {
      server_filename?: string;
      error?: { message?: string };
      message?: string;
    };
    if (!uploadRes.ok || !uploaded.server_filename) {
      throw new Error(
        `upload: ${uploaded.error?.message || uploaded.message || JSON.stringify(uploaded).slice(0, 200)}`,
      );
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
    const processed = (await processRes.json().catch(() => ({}))) as {
      status?: string;
      error?: { message?: string };
      message?: string;
    };
    if (!processRes.ok) {
      throw new Error(
        `process: ${processed.error?.message || processed.message || JSON.stringify(processed).slice(0, 200)}`,
      );
    }

    const downloadRes = await fetch(
      `${serverBase}/download/${encodeURIComponent(start.task)}`,
      { method: "GET", headers: auth },
    );
    if (!downloadRes.ok) {
      const errText = await downloadRes.text().catch(() => "");
      throw new Error(
        `download (${downloadRes.status}): ${errText.slice(0, 200)}`,
      );
    }
    const pdf = Buffer.from(await downloadRes.arrayBuffer());
    if (!isPdf(pdf)) {
      return {
        pdf: null,
        error: "iLovePDF respondió pero el archivo no es un PDF válido.",
      };
    }
    return { pdf };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[docx-to-pdf] iLovePDF REST:", message);
    return { pdf: null, error: `iLovePDF: ${message}` };
  }
}

/** Fallback local (Mac/dev): script + LibreOffice. */
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
 * Convierte un .docx a PDF.
 * 1) iLovePDF REST (producción / Vercel)
 * 2) Script hijo + LibreOffice (desarrollo local)
 */
export async function convertDocxToPdfDetailed(
  docx: Buffer,
): Promise<DocxToPdfResult> {
  const cloud = await convertWithILovePdfRest(docx);
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
