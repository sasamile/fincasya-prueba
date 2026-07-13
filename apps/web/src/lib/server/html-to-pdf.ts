import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Genera un PDF a partir de HTML con Puppeteer.
 *
 * La generación corre en un PROCESO HIJO (scripts/html-to-pdf.mjs) con el
 * runtime real (bun/node), no dentro del bundle de Next. Turbopack en dev no
 * logra externalizar puppeteer/puppeteer-core en este monorepo bun (falla la
 * resolución del shim), así que se ejecuta fuera de su alcance: se pasa el HTML
 * por stdin y se recibe el PDF binario por stdout.
 *
 * Chromium se resuelve vía PUPPETEER_EXECUTABLE_PATH/CHROME_BIN si están
 * definidos; si no, el que trae puppeteer.
 */
export function htmlToPdf(html: string): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "html-to-pdf.mjs");

  return new Promise<Buffer>((resolve, reject) => {
    // process.execPath = el runtime que corre Next (bun en este proyecto).
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && out.length > 0) {
        resolve(Buffer.concat(out));
      } else {
        const message =
          Buffer.concat(err).toString().trim() ||
          `El generador de PDF terminó con código ${code}.`;
        reject(new Error(message));
      }
    });

    child.stdin.write(html);
    child.stdin.end();
  });
}
