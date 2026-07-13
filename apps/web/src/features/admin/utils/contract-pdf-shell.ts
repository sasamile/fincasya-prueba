/**
 * Marca y envoltura HTML para contratos exportados a PDF (Puppeteer).
 * Logo: `public/contracts/contract-logo.jpg` (mismo de la plantilla Word).
 */
import fs from "node:fs";
import path from "node:path";
import { CONTRACT_PDF_DOCUMENT_CSS } from "@/features/admin/utils/contract-document-styles";

const LOGO_CANDIDATES = [
  "contracts/contract-logo.jpg",
  "contracts/contract-logo.jpeg",
  "image.png",
  "fincas-ya-logo.png",
] as const;

let logoDataUriMemo: string | false | undefined;

function readOfficialLogoDataUri(): string | null {
  if (logoDataUriMemo === false) return null;
  if (logoDataUriMemo !== undefined) return logoDataUriMemo;
  try {
    for (const name of LOGO_CANDIDATES) {
      const filePath = path.join(process.cwd(), "public", name);
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      const mime = name.endsWith(".png")
        ? "image/png"
        : name.endsWith(".jpg") || name.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/png";
      logoDataUriMemo = `data:${mime};base64,${buf.toString("base64")}`;
      return logoDataUriMemo;
    }
    logoDataUriMemo = false;
    return null;
  } catch {
    logoDataUriMemo = false;
    return null;
  }
}

function buildFincasyaCircularLogoSvgFallback(): string {
  return `
<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e8e8;display:flex;align-items:flex-start;">
  <div
    role="img"
    aria-label="FincasYa"
    style="flex-shrink:0;width:92px;height:92px;border-radius:50%;background:#1f1f1f;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;font-family:Arial,Helvetica,sans-serif;text-align:center;padding:8px 10px;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;"
  >
    <svg width="36" height="30" viewBox="0 0 36 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:5px;display:block;">
      <path d="M4 16c3-8 10-13 18-13 2.5 0 5 .6 6.5 1.8C24 6 20 8.5 17 13c2.2-.8 4.5-1.2 7-1 4 .3 6.5 2.8 6.5 6.5 0 3-1.8 5.8-4.5 7.5-5 3-12 2.5-17-.5-1.2 2.2-3.5 4-6.5 5 2-1.8 3.8-4 5-6.5z" fill="#ffffff"/>
      <path d="M22 6c2.5 1.2 4.2 3 5 5.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.9"/>
    </svg>
    <div style="font-size:8.5px;font-weight:800;letter-spacing:0.2px;line-height:1.05;">
      FINCAS<span style="color:#f97316">YA</span>.COM
    </div>
    <div style="font-size:6.5px;opacity:0.88;margin-top:4px;letter-spacing:0.4px;font-weight:600;">
      VIVE EL LLANO
    </div>
  </div>
</div>`.trim();
}

export function buildFincasyaCircularLogoHtml(): string {
  const dataUri = readOfficialLogoDataUri();
  if (dataUri) {
    return `
<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e8e8;">
  <img
    src="${dataUri}"
    alt="FincasYa"
    width="97"
    height="97"
    style="display:block;width:97px;height:97px;object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact;"
  />
</div>`.trim();
  }
  return buildFincasyaCircularLogoSvgFallback();
}

export { CONTRACT_PDF_DOCUMENT_CSS };

export function wrapContractHtmlForPdf(innerHtml: string): string {
  const header = buildFincasyaCircularLogoHtml();
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>${CONTRACT_PDF_DOCUMENT_CSS}</style>
</head>
<body>
${header}
<div class="contract-doc-root">
${innerHtml}
</div>
</body>
</html>`;
}
