"use client";

import { normalizeLegalHtml } from "@/lib/legal/normalize-legal-html";

export function LegalHtmlPreview({ html }: { html: string }) {
  const normalized = normalizeLegalHtml(html);
  if (!normalized || normalized.trim().length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: normalized }}
      />
    </div>
  );
}

