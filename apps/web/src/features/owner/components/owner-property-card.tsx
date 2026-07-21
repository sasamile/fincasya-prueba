"use client";

import { Building2, Check, ExternalLink, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OWNER_DOC_FIELDS,
  countDocs,
  type OwnerDocKey,
  type OwnerDocuments,
} from "@/features/owner/lib/owner-format";

export type OwnerProperty = {
  propertyId: string;
  title: string;
  code?: string | null;
  location?: string | null;
  documents: OwnerDocuments;
};

/**
 * Ficha de una finca con su checklist de documentos legales. Cada fila muestra
 * el estado (cargado / pendiente) y permite subir o reemplazar el archivo.
 */
export function OwnerPropertyCard({
  property,
  uploadingKey,
  onUpload,
}: {
  property: OwnerProperty;
  /** `${propertyId}:${docKey}` en curso, o null. */
  uploadingKey: string | null;
  onUpload: (propertyId: string, field: OwnerDocKey, file: File) => void;
}) {
  const { done, total } = countDocs(property.documents);
  const complete = done === total;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight">
            {property.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[property.code, property.location].filter(Boolean).join(" · ") ||
              "Sin ubicación"}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            complete
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-amber-500/10 text-amber-600",
          )}
        >
          {done}/{total}
        </span>
      </header>

      <div className="flex-1 p-4">
        <h4 className="mb-3 text-xs font-semibold text-muted-foreground">
          Documentos legales
        </h4>
        <ul className="space-y-2">
          {OWNER_DOC_FIELDS.map((doc) => {
            const url = property.documents[doc.key];
            const busy = uploadingKey === `${property.propertyId}:${doc.key}`;
            const inputId = `doc-${property.propertyId}-${doc.key}`;
            return (
              <li
                key={doc.key}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                    url
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "border border-dashed border-border text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {doc.label}
                  </p>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Ver archivo
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {doc.hint}
                    </p>
                  )}
                </div>

                <label
                  htmlFor={inputId}
                  className={cn(
                    "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileUp className="h-3.5 w-3.5" />
                  )}
                  {url ? "Cambiar" : "Subir"}
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(property.propertyId, doc.key, file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}
