"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  CONTRACT_LOGO_HEIGHT,
  CONTRACT_LOGO_SRC,
  CONTRACT_LOGO_WIDTH,
} from "@/features/admin/utils/contract-logo";
import { CONTRACT_DOCUMENT_CSS } from "@/features/admin/utils/contract-document-styles";

type Props = {
  html: string;
  className?: string;
  /** Fragmento corto (p. ej. una cláusula): sin altura mínima de hoja A4. */
  compact?: boolean;
};

/**
 * Vista previa WYSIWYG del contrato: misma hoja A4, logo y tipografía que el PDF.
 */
export function ContractDocumentPreview({
  html,
  className,
  compact = false,
}: Props) {
  return (
    <div className={cn("contract-document-preview", className)}>
      <style dangerouslySetInnerHTML={{ __html: CONTRACT_DOCUMENT_CSS }} />
      <article
        className={cn(
          "contract-document-page",
          compact && "contract-document-page--compact",
        )}
      >
        <header className="contract-document-header">
          <Image
            src={CONTRACT_LOGO_SRC}
            alt="FincasYa"
            width={compact ? 80 : CONTRACT_LOGO_WIDTH}
            height={compact ? 80 : CONTRACT_LOGO_HEIGHT}
            priority
            unoptimized
            className="contract-document-logo"
          />
        </header>
        <div
          className="contract-doc-root"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
