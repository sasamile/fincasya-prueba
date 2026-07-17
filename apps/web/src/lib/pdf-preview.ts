// @ts-nocheck — port de FincasYaWeb; tipos de pdfjs-dist v6 difieren del original v3.
//
// Diferencias de pdfjs v6 vs el v3 de FincasYaWeb — no revertir al portar de allá:
//  1. getDocument exige un objeto: getDocument({ url }). Con un string suelto lanza
//     "getDocument - expected either `data`, `range`, or `url` parameter".
//  2. Los assets de runtime (worker, fuentes estándar, cmaps, wasm, iccs) se sirven
//     desde public/pdfjs/ — los copia scripts/copy-pdf-worker.mjs en postinstall.
//     Turbopack no emite el worker vía new URL(...) sobre un specifier de paquete.
//  3. standardFontDataUrl es OBLIGATORIO para PDFs con fuentes NO incrustadas
//     (ej. el certificado RNT): sin él, page.render() nunca resuelve — cuelga
//     en silencio, sin lanzar error.

/** Assets servidos desde public/pdfjs/ (ver scripts/copy-pdf-worker.mjs). */
const PDFJS_ASSETS = "/pdfjs";

/** Opciones que TODO getDocument debe pasar para que cualquier PDF renderice. */
const PDF_DOC_OPTIONS = {
  standardFontDataUrl: `${PDFJS_ASSETS}/standard_fonts/`,
  cMapUrl: `${PDFJS_ASSETS}/cmaps/`,
  cMapPacked: true,
  wasmUrl: `${PDFJS_ASSETS}/wasm/`,
  iccUrl: `${PDFJS_ASSETS}/iccs/`,
};

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF preview is only available in the browser");
  }

  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSETS}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

export interface PdfPreviewResult {
  thumbnail: string;
  pageCount: number;
}

async function renderPdfPageToJpeg(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  pageNumber: number,
  scale = 1.5,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create canvas context");
  }
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.8);
}

/**
 * Generates a base64 image preview and page count from a PDF File.
 */
export async function generatePdfPreview(
  file: File,
): Promise<PdfPreviewResult> {
  if (file.type !== "application/pdf") {
    throw new Error("File is not a PDF");
  }

  const { getDocument } = await loadPdfJs();
  const fileUrl = URL.createObjectURL(file);

  try {
    const loadingTask = getDocument({ url: fileUrl, ...PDF_DOC_OPTIONS });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const thumbnail = await renderPdfPageToJpeg(pdf, 1);
    return { thumbnail, pageCount };
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
}

export interface PdfPagesForAiResult {
  /** Primera página (cabecera del contrato). */
  firstPage: string;
  /** Última página (donde suele ir la firma). */
  lastPage: string;
  pageCount: number;
}

/**
 * Renderiza 1ª y última página del PDF para verificación por visión.
 * Si solo hay una página, firstPage === lastPage.
 */
export async function generatePdfPagesForAi(
  file: File,
): Promise<PdfPagesForAiResult> {
  if (file.type !== "application/pdf") {
    throw new Error("File is not a PDF");
  }

  const { getDocument } = await loadPdfJs();
  const fileUrl = URL.createObjectURL(file);

  try {
    const loadingTask = getDocument({ url: fileUrl, ...PDF_DOC_OPTIONS });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const firstPage = await renderPdfPageToJpeg(pdf, 1);
    const lastPage =
      pageCount > 1
        ? await renderPdfPageToJpeg(pdf, pageCount)
        : firstPage;
    return { firstPage, lastPage, pageCount };
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
}

/**
 * Generates a base64 image preview and page count from a PDF URL.
 */
export async function generatePdfPreviewFromUrl(
  url: string,
): Promise<PdfPreviewResult> {
  const { getDocument } = await loadPdfJs();

  let fetchUrl = url;
  if (url.startsWith("http")) {
    fetchUrl = `/api/cors-proxy?url=${encodeURIComponent(url)}`;
  }

  const loadingTask = getDocument({ url: fetchUrl, ...PDF_DOC_OPTIONS });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create canvas context");
  }
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: context, viewport }).promise;
  const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
  return { thumbnail, pageCount };
}

/**
 * Renderiza todas las páginas de un PDF como imágenes ajustadas al ancho dado.
 */
export async function renderPdfPagesFitWidth(
  url: string,
  maxWidth: number,
): Promise<string[]> {
  const { getDocument } = await loadPdfJs();

  let fetchUrl = url;
  if (url.startsWith("http")) {
    fetchUrl = `/api/cors-proxy?url=${encodeURIComponent(url)}`;
  }

  const loadingTask = getDocument({ url: fetchUrl, ...PDF_DOC_OPTIONS });
  const pdf = await loadingTask.promise;
  const safeWidth = Math.max(maxWidth, 280);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = safeWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context");
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    pages.push(canvas.toDataURL("image/jpeg", 0.92));
  }

  return pages;
}
