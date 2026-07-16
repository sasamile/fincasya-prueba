"use client";

/**
 * Modal del certificado RNT — vista de solo lectura.
 * El PDF se renderiza como imágenes (sin toolbar ni descarga nativa).
 * Se aplican barreras razonables contra copiar/guardar/imprimir;
 * bloquear capturas de pantalla al 100% no es posible en el navegador.
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderPdfPagesFitWidth } from "@/lib/pdf-preview";

export const RNT_CERTIFICATE_PDF = "/docs/rnt-agencia-2026.pdf";
export const RNT_NUMBER = "163658";

type RntCertificateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RntCertificateModal({
  open,
  onOpenChange,
}: RntCertificateModalProps) {
  const pdfUrl = encodeURI(RNT_CERTIFICATE_PDF);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** Difumina el certificado si la pestaña pierde foco (disuade capturas). */
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    if (!open) {
      setPages([]);
      setLoadError(false);
      setLoading(false);
      setObscured(false);
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setLoadError(false);

      try {
        const width =
          scrollRef.current?.clientWidth ??
          Math.min(window.innerWidth - 24, 920);
        const rendered = await renderPdfPagesFitWidth(pdfUrl, width);
        if (!cancelled) setPages(rendered);
      } catch (err) {
        console.error("[rnt-modal] render falló:", err);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(loadPreview, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, pdfUrl]);

  useEffect(() => {
    if (!open) return;

    const syncObscure = () => {
      setObscured(document.hidden || !document.hasFocus());
    };

    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      // Impresión, guardar, copiar, ver código, PrintScreen
      if (
        key === "printscreen" ||
        (mod && (key === "p" || key === "s" || key === "c" || key === "u")) ||
        (mod && e.shiftKey && (key === "s" || key === "i"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setObscured(true);
      }
    };

    const blockContext = (e: Event) => {
      e.preventDefault();
    };

    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const blockDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    syncObscure();
    document.addEventListener("visibilitychange", syncObscure);
    window.addEventListener("blur", syncObscure);
    window.addEventListener("focus", syncObscure);
    window.addEventListener("keydown", blockKeys, true);
    document.addEventListener("contextmenu", blockContext, true);
    document.addEventListener("copy", blockCopy, true);
    document.addEventListener("cut", blockCopy, true);
    document.addEventListener("dragstart", blockDrag, true);

    return () => {
      document.removeEventListener("visibilitychange", syncObscure);
      window.removeEventListener("blur", syncObscure);
      window.removeEventListener("focus", syncObscure);
      window.removeEventListener("keydown", blockKeys, true);
      document.removeEventListener("contextmenu", blockContext, true);
      document.removeEventListener("copy", blockCopy, true);
      document.removeEventListener("cut", blockCopy, true);
      document.removeEventListener("dragstart", blockDrag, true);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "fixed z-110 flex max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden p-0",
          "inset-0 top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0",
          "sm:inset-auto sm:top-[50%] sm:left-[50%] sm:max-h-[92vh] sm:w-[min(960px,calc(100vw-1.5rem))] sm:max-w-4xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border",
          "select-none",
        )}
        overlayClassName="z-110 bg-black/70 backdrop-blur-sm"
        onContextMenu={(e) => e.preventDefault()}
      >
        <DialogHeader className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background px-4 py-3 pr-14 text-left sm:px-6 sm:py-4">
          <DialogTitle className="text-base font-bold tracking-tight sm:text-lg">
            Registro Nacional de Turismo
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-primary">
              RNT {RNT_NUMBER}
            </span>
            <span className="text-xs text-muted-foreground">
              Certificado de la agencia FincasYa
            </span>
          </DialogDescription>

          <DialogClose asChild>
            <button
              type="button"
              className="absolute top-3 right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors hover:bg-muted sm:top-4 sm:right-4"
              aria-label="Cerrar certificado RNT"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto bg-muted/30 p-3 sm:p-4"
          onContextMenu={(e) => e.preventDefault()}
        >
          {loading ? (
            <div className="flex min-h-[45dvh] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Cargando certificado...</p>
            </div>
          ) : loadError ? (
            <div className="flex min-h-[45dvh] flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                No pudimos mostrar la vista previa. Cierra e inténtalo de nuevo
                en unos momentos.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "relative mx-auto flex w-full max-w-3xl flex-col gap-3 transition-[filter] duration-150",
                obscured && "blur-xl brightness-75",
              )}
            >
              {pages.map((src, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- data-URL de pdfjs, no apto para next/image
                <img
                  key={`rnt-page-${index + 1}`}
                  src={src}
                  alt={`Certificado RNT página ${index + 1}`}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="pointer-events-none h-auto w-full select-none rounded-xl border border-border/60 bg-white shadow-inner"
                  style={{
                    WebkitUserSelect: "none",
                    userSelect: "none",
                    WebkitTouchCallout: "none",
                  }}
                />
              ))}
              {obscured ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/40 px-6 text-center backdrop-blur-[2px]">
                  <p className="max-w-xs text-sm font-medium text-foreground">
                    Vista protegida · vuelve a esta ventana para ver el
                    certificado
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-border/60 bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground sm:max-w-[65%]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Solo lectura · sin descarga. Verifica que FincasYa está inscrita
              en el RNT {RNT_NUMBER}.
            </p>
            <DialogClose asChild>
              <Button
                variant="secondary"
                className="h-11 w-full cursor-pointer rounded-xl sm:w-auto sm:min-w-32"
              >
                Cerrar
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
