"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileWarning, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  contractDocumentPreviewSrc,
  getContractFileLabel,
  getContractViewUrl,
  isContractDocx,
} from "@/features/admin/utils/contract-file-utils";

export type ContractPreviewTarget = {
  contractNumber: string;
  url: string;
  filename?: string;
  documentKind?: "contract" | "confirmation";
};

type Props = {
  target: ContractPreviewTarget | null;
  open: boolean;
  onClose: () => void;
};

export function ContractPreviewModal({ target, open, onClose }: Props) {
  const url = target?.url ?? "";
  const filename = target?.filename;
  const contractNumber = target?.contractNumber ?? "";
  const documentKind = target?.documentKind ?? "contract";
  const fileLabel = getContractFileLabel(url, filename);
  const docTitle =
    documentKind === "confirmation" ? "Confirmación de reserva" : "Contrato";
  const directViewUrl = url ? getContractViewUrl(url, filename) : "";
  const isDocx = isContractDocx(url, filename);
  const iframeSrc =
    url && contractNumber && !isDocx
      ? contractDocumentPreviewSrc(contractNumber, documentKind)
      : directViewUrl;

  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (!open) {
      setLoadState("idle");
      return;
    }
    if (!iframeSrc) {
      setLoadState("error");
      return;
    }
    setLoadState("loading");
  }, [open, iframeSrc]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[92vh] w-[min(960px,calc(100vw-1.5rem))] max-w-4xl flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <DialogTitle className="truncate pr-2 text-base font-semibold">
            {docTitle} · {contractNumber}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({fileLabel})
            </span>
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {url ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  asChild
                >
                  <a
                    href={url}
                    download={filename || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Descargar
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  asChild
                >
                  <a href={directViewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Nueva pestaña
                  </a>
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/30">
          {iframeSrc ? (
            <>
              {loadState === "loading" ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/30">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : null}
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                title={`${docTitle} ${contractNumber}`}
                className="h-[min(75vh,720px)] w-full border-0 bg-white"
                allowFullScreen
                onLoad={() => setLoadState("ready")}
                onError={() => setLoadState("error")}
              />
              {loadState === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 px-6 text-center">
                  <FileWarning className="h-10 w-10 text-muted-foreground/60" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    No se pudo previsualizar el documento aquí. Usa Descargar o
                    Nueva pestaña.
                  </p>
                  {directViewUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={directViewUrl}
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <FileWarning className="h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                No hay documento disponible para previsualizar.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
