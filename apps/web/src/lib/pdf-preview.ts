// @ts-nocheck — port de FincasYaWeb; tipos de pdfjs-dist v6 difieren del original v3.
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
// Set the workerSrc to a public URL to avoid issues with Webpack/Next.js
// We use unpkg as a reliable CDN for the worker
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
export interface PdfPreviewResult {
  thumbnail: string;
  pageCount: number;
}
/**
 * Generates a base64 image preview and page count from a PDF File.
 *
 * @param file The PDF File object
 * @returns A promise that resolves to an object with thumbnail and page count.
 */
export async function generatePdfPreview(
  file: File,
): Promise<PdfPreviewResult> {
  if (file.type !== "application/pdf") {
    throw new Error("File is not a PDF");
  }
  // Create a URL for the file to pass to pdf.js
  const fileUrl = URL.createObjectURL(file);
  try {
    const loadingTask = getDocument(fileUrl);
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    // Get the first page
    const page = await pdf.getPage(1);
    // Set scale to a reasonable value for thumbnails to save memory but keep quality
    const viewport = page.getViewport({ scale: 1.5 });
    // Create a canvas to render the page onto
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context");
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // Render the page on the canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
    // Convert canvas to base64 image
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { thumbnail: dataUrl, pageCount };
  } finally {
    // Always cleanup the object URL
    URL.revokeObjectURL(fileUrl);
  }
}
/**
 * Generates a base64 image preview and page count from a PDF URL.
 *
 * @param url The PDF URL string
 * @returns A promise that resolves to an object with thumbnail and page count.
 */
export async function generatePdfPreviewFromUrl(
  url: string,
): Promise<PdfPreviewResult> {
  try {
    // Determine if we need to proxy the request to bypass CORS
    let fetchUrl = url;
    if (url.startsWith("http")) {
      fetchUrl = `/api/cors-proxy?url=${encodeURIComponent(url)}`;
    }
    const loadingTask = getDocument(fetchUrl);
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    // Get the first page
    const page = await pdf.getPage(1);
    // Set scale
    const viewport = page.getViewport({ scale: 1.5 });
    // Create canvas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context");
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // Render on canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
    // Convert to base64
    const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
    return { thumbnail, pageCount };
  } catch (error) {
    throw error;
  }
}

/**
 * Renderiza todas las páginas de un PDF como imágenes ajustadas al ancho dado.
 * Útil en móvil, donde el visor nativo del iframe suele hacer zoom excesivo.
 */
export async function renderPdfPagesFitWidth(
  url: string,
  maxWidth: number,
): Promise<string[]> {
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
