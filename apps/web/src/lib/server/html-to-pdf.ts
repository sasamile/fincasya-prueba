import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Genera un PDF a partir de HTML con Puppeteer. Dos caminos, según dónde corra:
 *
 * - SERVERLESS (Vercel/Lambda): puppeteer-core + @sparticuz/chromium EN
 *   PROCESO. El proceso hijo no sirve allá: la función solo lleva lo que Next
 *   rastrea del bundle, así que `scripts/html-to-pdf.mjs` no encontraba el
 *   paquete `puppeteer` ("Cannot find package 'puppeteer' imported from
 *   /var/task/apps/web/scripts/html-to-pdf.mjs" al generar un CR) — y aunque
 *   estuviera, el Chromium completo de puppeteer no cabe en la función.
 * - LOCAL (bun dev): proceso hijo con el runtime real, porque Turbopack no
 *   logra externalizar puppeteer/puppeteer-core en este monorepo bun.
 */

/** Ajustes del documento — iguales en los dos caminos. */
const PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
};

/** ¿Estamos dentro de una función serverless (Vercel/AWS Lambda)? */
function isServerless(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL === "1",
  );
}

/** Camino serverless: Chromium empaquetado para Lambda, sin proceso hijo. */
async function htmlToPdfInProcess(html: string): Promise<Buffer> {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);

  // Sin WebGL: el CR es HTML plano y así no se extrae swiftshader (arranque
  // más rápido y menos disco en la función).
  chromium.setGraphicsMode = false;

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Espera imágenes pendientes (firma, logos), con tope de 5 s.
    await Promise.race([
      page.evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.addEventListener("load", resolve, { once: true });
                  img.addEventListener("error", resolve, { once: true });
                }),
          ),
        );
      }),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);

    return Buffer.from(await page.pdf(PDF_OPTIONS));
  } finally {
    await browser.close();
  }
}

/**
 * Camino local: el HTML va por stdin al proceso hijo y el PDF vuelve por
 * stdout. Chromium se resuelve vía PUPPETEER_EXECUTABLE_PATH/CHROME_BIN si
 * están definidos; si no, el que trae puppeteer.
 */
function htmlToPdfChildProcess(html: string): Promise<Buffer> {
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

export function htmlToPdf(html: string): Promise<Buffer> {
  return isServerless() ? htmlToPdfInProcess(html) : htmlToPdfChildProcess(html);
}
