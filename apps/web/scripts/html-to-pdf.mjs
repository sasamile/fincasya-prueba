/**
 * Generador de PDF standalone (fuera del bundle de Next/Turbopack).
 *
 * Se ejecuta como proceso hijo desde el route handler: recibe el HTML por
 * stdin y escribe el PDF binario por stdout. Al correr con el runtime real
 * (bun/node), puppeteer resuelve puppeteer-core y su Chromium sin los problemas
 * de bundling de Turbopack.
 *
 * Réplica de la lógica del PdfService de fincasya-new: A4, márgenes 20mm,
 * printBackground, espera breve de imágenes.
 */
import puppeteer from "puppeteer";
import fs from "node:fs";

function resolveChromeExecutable() {
  const fromEnv =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_BIN?.trim();
  if (fromEnv) return fromEnv;

  const macChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (process.platform === "darwin" && fs.existsSync(macChrome)) {
    return macChrome;
  }

  return undefined;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const html = await readStdin();
  if (!html.trim()) {
    process.stderr.write("HTML vacío.");
    process.exit(2);
  }

  const executablePath = resolveChromeExecutable();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
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

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });

    process.stdout.write(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.message ?? err));
  process.exit(1);
});
