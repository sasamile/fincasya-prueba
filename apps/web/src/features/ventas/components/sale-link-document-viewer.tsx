"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileWarning, Loader2 } from "lucide-react";
import { resolveProofMediaKind } from "@/lib/proof-file-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  previewSrc?: string | null;
};

export function SaleLinkDocumentViewerDialog({
  open,
  onOpenChange,
  title,
  url,
  fileName,
  mimeType,
  previewSrc,
}: Props) {
  const safeUrl = url?.trim() ?? "";
  const displayUrl = previewSrc?.trim() || safeUrl;
  const mediaKind = useMemo(
    () => resolveProofMediaKind(fileName, mimeType),
    [fileName, mimeType],
  );
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!open) {
      setLoadState("idle");
      return;
    }
    if (!displayUrl) {
      setLoadState("error");
      return;
    }
    setLoadState(mediaKind === "image" ? "loading" : "ready");
  }, [open, displayUrl, mediaKind]);

  const openExternalHref = safeUrl || displayUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-200 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/20 px-5 py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {fileName ? (
            <p className="truncate text-xs text-muted-foreground">{fileName}</p>
          ) : null}
        </DialogHeader>

        {!displayUrl ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
            <FileWarning className="h-10 w-10 text-muted-foreground/60" />
            No hay documento disponible.
          </div>
        ) : (
          <>
            <div className="relative flex min-h-[45vh] max-h-[68vh] flex-1 items-center justify-center overflow-auto bg-zinc-950/95 p-4">
              {loadState === "loading" ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
              ) : null}

              {mediaKind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={displayUrl}
                  src={displayUrl}
                  alt={fileName ?? title}
                  className={`max-h-[62vh] max-w-full rounded-md object-contain shadow-lg ${
                    loadState === "loading" ? "hidden" : ""
                  }`}
                  onLoad={() => setLoadState("ready")}
                  onError={() => setLoadState("error")}
                />
              ) : (
                <iframe
                  src={displayUrl}
                  title={title}
                  className="h-[62vh] w-full rounded-md bg-white shadow-lg"
                  onLoad={() => setLoadState("ready")}
                />
              )}

              {loadState === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <FileWarning className="h-10 w-10 text-amber-400" />
                  <p className="max-w-sm text-sm text-white/80">
                    No se pudo previsualizar aquí. Puedes abrirlo en una pestaña
                    nueva.
                  </p>
                  {openExternalHref ? (
                    <Button variant="secondary" size="sm" asChild>
                      <a
                        href={openExternalHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir archivo
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end border-t bg-background px-5 py-3">
              {openExternalHref ? (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={openExternalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir en nueva pestaña
                  </a>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
