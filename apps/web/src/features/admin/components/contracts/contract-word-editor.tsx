"use client";

/**
 * Editor Word (SuperDoc) de la plantilla oficial del contrato.
 * Misma experiencia que el inbox: editar como en Word, descargar .docx / PDF.
 */
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Download, FileWarning, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@harbour-enterprises/superdoc/style.css";

// SuperDoc se carga dinámico (solo cliente); su API no está tipada aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperDocInstance = any;

export type ContractWordEditorHandle = {
  isReady: () => boolean;
  exportDocx: () => Promise<Blob>;
  exportPdf: () => Promise<{ base64: string; filename: string }>;
};

type Props = {
  propertyId: string;
  /** Payload POST a `/api/fincas/{id}/direct-booking-contract` (sin outputFormat). */
  payload: Record<string, unknown>;
  /** Solo monta/carga el editor cuando es true (p. ej. paso Editar activo). */
  active?: boolean;
  /**
   * Clave estable de los datos del formulario. Si cambia, se regenera el .docx
   * desde la plantilla (las ediciones Word se pierden — esperado).
   */
  documentKey?: string;
  className?: string;
  /** Altura del área del documento. */
  heightClassName?: string;
  onReadyChange?: (ready: boolean) => void;
};

export const ContractWordEditor = forwardRef<ContractWordEditorHandle, Props>(
  function ContractWordEditor(
    {
      propertyId,
      payload,
      active = true,
      documentKey = "",
      className,
      heightClassName = "h-[min(62vh,720px)]",
      onReadyChange,
    },
    ref,
  ) {
    const uid = useId().replace(/:/g, "");
    const editorId = `admin-superdoc-editor-${uid}`;
    const toolbarId = `admin-superdoc-toolbar-${uid}`;

    const superdocRef = useRef<SuperDocInstance | null>(null);
    const payloadRef = useRef(payload);
    payloadRef.current = payload;
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [baseName, setBaseName] = useState("contrato");
    const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
    const [manualReload, setManualReload] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        isReady: () => ready && !!superdocRef.current,
        exportDocx: async () => {
          const sd = superdocRef.current;
          if (!sd) throw new Error("El editor no está listo.");
          const blob = await sd.export({
            exportType: ["docx"],
            exportedName: baseName,
          });
          if (!(blob instanceof Blob)) {
            throw new Error("No se pudo exportar el Word.");
          }
          return blob;
        },
        exportPdf: async () => {
          const sd = superdocRef.current;
          if (!sd) throw new Error("El editor no está listo.");
          const docxBlob = await sd.export({
            exportType: ["docx"],
            exportedName: baseName,
          });
          if (!(docxBlob instanceof Blob)) {
            throw new Error("No se pudo exportar el Word.");
          }
          const fd = new FormData();
          fd.append(
            "file",
            new File([docxBlob], `${baseName}.docx`, {
              type: docxBlob.type,
            }),
          );
          const res = await fetch("/api/fincas/contract-docx-to-pdf", {
            method: "POST",
            body: fd,
          });
          const data = (await res.json().catch(() => ({}))) as {
            fileBase64?: string;
            filename?: string;
            error?: string;
          };
          if (!res.ok || !data.fileBase64) {
            throw new Error(data.error || "No se pudo convertir a PDF.");
          }
          return {
            base64: data.fileBase64,
            filename: data.filename || `${baseName}.pdf`,
          };
        },
      }),
      [ready, baseName],
    );

    useEffect(() => {
      onReadyChange?.(ready);
    }, [ready, onReadyChange]);

    useEffect(() => {
      if (!active || !propertyId) {
        setReady(false);
        setLoading(false);
        setError(null);
        onReadyChange?.(false);
        return;
      }

      let cancelled = false;

      async function init() {
        setLoading(true);
        setError(null);
        setReady(false);
        try {
          try {
            superdocRef.current?.destroy?.();
          } catch {
            /* noop */
          }
          superdocRef.current = null;

          const res = await fetch(
            `/api/fincas/${propertyId}/direct-booking-contract`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                ...payloadRef.current,
                outputFormat: "docx",
                propertyId,
              }),
            },
          );
          const data = (await res.json().catch(() => ({}))) as {
            fileBase64?: string;
            filename?: string;
            error?: string;
          };
          if (!res.ok || !data.fileBase64) {
            throw new Error(data.error || "No se pudo generar el contrato.");
          }
          if (cancelled) return;

          const filename = data.filename || "contrato.docx";
          setBaseName(filename.replace(/\.docx$/i, ""));
          const bytes = Uint8Array.from(atob(data.fileBase64), (c) =>
            c.charCodeAt(0),
          );
          const file = new File([bytes], filename, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });

          const [{ SuperDoc }, fontsMod] = await Promise.all([
            import("@harbour-enterprises/superdoc"),
            import("@superdoc-dev/fonts"),
          ]);
          if (cancelled) return;
          setLoading(false);

          const fonts = fontsMod.createSuperDocFonts();
          (
            fonts as { resolveAssetUrl?: (c: { file: string }) => string }
          ).resolveAssetUrl = (c) => `/superdoc-fonts/${c.file}`;

          const instance = new SuperDoc({
            selector: `#${editorId}`,
            toolbar: `#${toolbarId}`,
            documentMode: "editing",
            fonts,
            documents: [{ id: "contract", type: "docx", data: file }],
            onReady: () => {
              if (!cancelled) setReady(true);
            },
          });
          superdocRef.current = instance;
        } catch (e) {
          if (!cancelled) {
            setLoading(false);
            setError(
              e instanceof Error ? e.message : "Error al abrir el contrato.",
            );
          }
        }
      }

      void init();
      return () => {
        cancelled = true;
        try {
          superdocRef.current?.destroy?.();
        } catch {
          /* noop */
        }
        superdocRef.current = null;
      };
      // payload se lee al montar; documentKey + manualReload controlan la regeneración.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, propertyId, documentKey, manualReload, editorId, toolbarId]);

    async function handleDownloadDocx() {
      if (!ready || !superdocRef.current) return;
      setBusy("docx");
      try {
        const blob = await superdocRef.current.export({
          exportType: ["docx"],
          exportedName: baseName,
        });
        if (!(blob instanceof Blob)) throw new Error("Exportación inválida.");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast.success("Word descargado.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al descargar Word.",
        );
      } finally {
        setBusy(null);
      }
    }

    async function handleDownloadPdf() {
      if (!ready || !superdocRef.current) return;
      setBusy("pdf");
      try {
        const docxBlob = await superdocRef.current.export({
          exportType: ["docx"],
          exportedName: baseName,
        });
        if (!(docxBlob instanceof Blob)) {
          throw new Error("No se pudo exportar el Word.");
        }
        const fd = new FormData();
        fd.append(
          "file",
          new File([docxBlob], `${baseName}.docx`, { type: docxBlob.type }),
        );
        const res = await fetch("/api/fincas/contract-docx-to-pdf", {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          fileBase64?: string;
          filename?: string;
          error?: string;
        };
        if (!res.ok || !data.fileBase64) {
          throw new Error(data.error || "No se pudo convertir a PDF.");
        }
        const bytes = Uint8Array.from(atob(data.fileBase64), (c) =>
          c.charCodeAt(0),
        );
        const url = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `${baseName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF descargado.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al generar PDF.",
        );
      } finally {
        setBusy(null);
      }
    }

    if (!active) return null;

    if (!propertyId) {
      return (
        <p className="text-sm text-muted-foreground">
          Selecciona una finca para armar la vista previa editable.
        </p>
      );
    }

    return (
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-border bg-background",
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              Contrato · editor Word
            </p>
            <p className="text-[11px] text-muted-foreground">
              Plantilla oficial · edita como en Word antes de generar o enviar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[11px] font-bold"
              onClick={() => setManualReload((n) => n + 1)}
              disabled={loading || busy !== null}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Regenerar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[11px] font-bold"
              onClick={() => void handleDownloadDocx()}
              disabled={!ready || busy !== null}
            >
              {busy === "docx" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Word
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[11px] font-bold"
              onClick={() => void handleDownloadPdf()}
              disabled={!ready || busy !== null}
            >
              {busy === "pdf" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              PDF
            </Button>
          </div>
        </div>

        <div
          id={toolbarId}
          className="shrink-0 overflow-x-auto border-b border-border bg-background"
        />

        <div
          className={cn(
            "relative overflow-auto bg-muted/40",
            heightClassName,
          )}
        >
          <div id={editorId} className="min-h-full" />

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Abriendo el contrato en el editor Word…
              </p>
            </div>
          )}
          {!loading && !ready && !error && (
            <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-background/70 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Cargando el documento…
              </span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <FileWarning className="h-7 w-7 text-destructive" />
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setManualReload((n) => n + 1)}
              >
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  },
);
