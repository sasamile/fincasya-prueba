'use client';

import { normalizeLegalHtml } from '@/lib/legal/normalize-legal-html';

export function LegalContent({ html }: { html: string }) {
  const normalized = normalizeLegalHtml(html);
  if (!normalized?.trim()) return null;

  return (
    <div
      className="prose prose-sm md:prose-base max-w-none prose-headings:text-foreground prose-p:text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: normalized }}
    />
  );
}
