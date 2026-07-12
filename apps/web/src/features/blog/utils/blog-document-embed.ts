function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildBlogDocumentEmbedHtml(url: string, fileName: string): string {
  const safeUrl = escapeHtmlAttr(url);
  const safeName = escapeHtmlAttr(fileName);
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return `<div class="blog-document blog-document-pdf my-4 overflow-hidden rounded-xl border border-border" data-document-type="pdf" data-pdf-url="${safeUrl}">
  <div class="blog-pdf-thumbnail-slot relative aspect-[4/3] w-full overflow-hidden bg-muted/30" data-pdf-thumbnail-slot></div>
  <iframe src="${safeUrl}#toolbar=0&navpanes=0" class="blog-pdf-embed h-[min(60vh,480px)] w-full border-0 border-t border-border" title="${safeName}"></iframe>
  <div class="border-t border-border bg-muted/30 px-4 py-2.5">
    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold text-primary hover:underline">Descargar ${safeName}</a>
  </div>
</div>`;
  }

  return `<div class="blog-document blog-document-file my-4 overflow-hidden rounded-xl border border-border bg-muted/20" data-document-type="doc">
  <div class="flex items-center gap-4 px-4 py-5">
    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg" aria-hidden="true">📄</div>
    <div class="min-w-0">
      <p class="truncate text-sm font-bold text-foreground">${safeName}</p>
      <p class="text-xs text-muted-foreground">Documento descargable</p>
    </div>
  </div>
  <div class="border-t border-border bg-muted/30 px-4 py-2.5">
    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" download class="text-sm font-semibold text-primary hover:underline">Descargar ${safeName}</a>
  </div>
</div>`;
}

export const BLOG_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const BLOG_CONTENT_PROSE_CLASSES =
  "prose prose-sm dark:prose-invert max-w-none [&_video]:w-full [&_video]:rounded-xl [&_iframe:not(.blog-pdf-embed)]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-xl [&_.blog-document]:my-6 [&_.blog-pdf-embed]:aspect-auto [&_.blog-pdf-embed]:rounded-none [&_.blog-pdf-thumbnail-slot]:rounded-t-xl";
