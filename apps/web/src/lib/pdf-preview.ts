// @ts-nocheck — port de FincasYaWeb; tipos de pdfjs-dist v6 difieren del original v3.

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF preview is only available in the browser");
  }

  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

export interface PdfPreviewResult {
  thumbnail: string;
  pageCount: number;
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
    const loadingTask = getDocument(fileUrl);
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { thumbnail: dataUrl, pageCount };
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

  const loadingTask = getDocument(fetchUrl);
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

  const loadingTask = getDocument(fetchUrl);
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
