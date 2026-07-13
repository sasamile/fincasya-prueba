/**
 * Estilos compartidos entre la vista previa del panel y el PDF (Puppeteer).
 * Mantener en sync para WYSIWYG.
 */
export const CONTRACT_DOCUMENT_CSS = `
  .contract-document-preview {
    background: #f4f4f5;
    padding: 1.25rem 1rem 1.5rem;
  }
  .contract-document-page {
    box-sizing: border-box;
    width: 100%;
    max-width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 20mm;
    background: #fff;
    color: #111;
    font-family: Verdana, Arial, Helvetica, "Segoe UI", sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.08),
      0 8px 24px rgba(0, 0, 0, 0.06);
  }
  .contract-document-page--compact {
    min-height: 0;
    padding: 16mm;
  }
  .contract-document-header {
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid #e8e8e8;
  }
  .contract-document-header img {
    display: block;
    width: 97px;
    height: 97px;
    object-fit: contain;
  }
  .contract-document-page--compact .contract-document-header img {
    width: 80px;
    height: 80px;
  }
  .contract-document-preview .contract-doc-root {
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
    -webkit-hyphens: auto;
  }
  .contract-document-preview .contract-doc-root p {
    text-align: justify;
    text-justify: inter-word;
    margin: 0 0 10pt 0;
    line-height: 1.45;
    font-size: 11pt;
  }
  .contract-document-preview .contract-doc-root p[style*="text-align: center"],
  .contract-document-preview .contract-doc-root p[align="center"] {
    text-align: center !important;
  }
  .contract-document-preview .contract-doc-root div {
    text-align: inherit;
  }
  .contract-document-preview .contract-doc-root ol,
  .contract-document-preview .contract-doc-root ul,
  .contract-document-preview .contract-doc-root li {
    text-align: left;
    text-justify: auto;
    font-size: 11pt;
  }
  .contract-document-preview .contract-doc-root .contract-amenities,
  .contract-document-preview .contract-doc-root .contract-amenities div {
    text-align: left !important;
    text-justify: none !important;
    font-weight: 700 !important;
  }
  .contract-document-preview .contract-doc-root strong {
    font-weight: 700;
  }
  .contract-document-preview .contract-doc-root table {
    border-collapse: collapse;
    width: 100%;
  }
  .contract-document-preview .contract-doc-root td,
  .contract-document-preview .contract-doc-root th {
    padding: 4pt 8pt;
  }
`;

/** CSS embebido en el HTML completo que consume Puppeteer. */
export const CONTRACT_PDF_DOCUMENT_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    font-family: Verdana, Arial, Helvetica, "Segoe UI", sans-serif;
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
