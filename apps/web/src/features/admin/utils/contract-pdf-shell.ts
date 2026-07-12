/**
 * Marca y envoltura HTML para contratos exportados a PDF (Puppeteer).
 * Logo: `public/image.png` (identidad oficial) con fallback a marca vectorial.
 */
import fs from "node:fs";
import path from "node:path";

let logoDataUriMemo: string | false | undefined;

function readOfficialLogoDataUri(): string | null {
  if (logoDataUriMemo === false) return null;
  if (logoDataUriMemo !== undefined) return logoDataUriMemo;
  try {
    const filePath = path.join(process.cwd(), "public", "image.png");
    if (!fs.existsSync(filePath)) {
      logoDataUriMemo = false;
      return null;
    }
    const buf = fs.readFileSync(filePath);
    logoDataUriMemo = `data:image/png;base64,${buf.toString("base64")}`;
    return logoDataUriMemo;
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
    width="120"
    height="120"
    style="display:block;width:120px;height:120px;object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact;"
  />
</div>`.trim();
  }
  return buildFincasyaCircularLogoSvgFallback();
}

/** Estilos globales del documento: cuerpo justificado, títulos respetan centrado inline. */
export const CONTRACT_PDF_DOCUMENT_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif;
    font-size: 11pt;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .contract-doc-root {
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
    -webkit-hyphens: auto;
  }
  .contract-doc-root p {
    text-align: justify;
    text-justify: inter-word;
    margin: 0 0 10pt 0;
    line-height: 1.45;
  }
  .contract-doc-root p[style*="text-align: center"],
  .contract-doc-root p[align="center"] {
    text-align: center !important;
  }
  .contract-doc-root div {
    text-align: inherit;
  }
  .contract-doc-root ol,
  .contract-doc-root ul,
  .contract-doc-root li {
    text-align: left;
    text-justify: auto;
  }
  .contract-doc-root .contract-amenities,
  .contract-doc-root .contract-amenities div {
    text-align: left !important;
    text-justify: none !important;
    font-weight: 700 !important;
  }
  .contract-doc-root strong {
    font-weight: 700;
  }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 4pt 8pt; }
`;

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
