"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getContractFileLabel,
  getContractViewUrl,
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
  const viewUrl = url ? getContractViewUrl(url, filename) : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[92vh] w-[min(960px,calc(100vw-1.5rem))] max-w-4xl flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
          <DialogTitle className="text-base font-semibold truncate pr-2">
            {docTitle} · {contractNumber}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({fileLabel})
            </span>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {url && (
              <>
                <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                  <a
                    href={url}
                    download={filename || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Descargar
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Nueva pestaña
                  </a>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden bg-muted/30">
          {viewUrl ? (
            <iframe
              src={viewUrl}
              title={`${docTitle} ${contractNumber}`}
              className="w-full h-[min(75vh,720px)] border-0 bg-white"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
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
