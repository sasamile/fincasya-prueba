import "server-only";
import type { Browser } from "puppeteer";

/**
 * Genera un PDF a partir de HTML con Puppeteer. Réplica de la lógica del
 * PdfService de fincasya-new (A4, márgenes 20mm, printBackground), adaptada a
 * un route handler Next en runtime Node.
 *
 * Resuelve Chromium del sistema vía PUPPETEER_EXECUTABLE_PATH/CHROME_BIN si
 * están definidos; si no, usa el Chromium que trae puppeteer.
 */
async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined;
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);

    // `domcontentloaded` a propósito: `networkidle0` cuelga con fuentes/CDN.
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Espera a que carguen imágenes pendientes (firma, logos), con tope de 5 s.
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

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
