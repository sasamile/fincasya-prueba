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
import {
  Download,
  FileWarning,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadSuperDocModules,
  preloadSuperDoc,
} from "@/features/admin/utils/preload-superdoc";
import { justifySuperDocContract } from "@/features/admin/utils/superdoc-justify-contract";
import "@harbour-enterprises/superdoc/style.css";

// SuperDoc se carga dinámico (solo cliente); su API no está tipada aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperDocInstance = any;

const ZOOM_MIN = 50;
const ZOOM_MAX = 150;
const ZOOM_STEP = 10;
/** Ancho aproximado de página Letter en CSS px (96dpi). */
const PAGE_WIDTH_CSS_PX = 816;

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
  /**
   * Al abrir, ajusta el zoom para que la página quepa en el ancho del panel
   * (el selector nativo de SuperDoc suele quedar cortado por overflow).
   */
  fitZoomOnReady?: boolean;
};

type LoadPhase = "idle" | "docx" | "editor" | "ready" | "error";

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
      fitZoomOnReady = false,
    },
    ref,
  ) {
    const uid = useId().replace(/:/g, "");
    const editorId = `admin-superdoc-editor-${uid}`;
    const toolbarId = `admin-superdoc-toolbar-${uid}`;

    const superdocRef = useRef<SuperDocInstance | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const payloadRef = useRef(payload);
    payloadRef.current = payload;
    const [ready, setReady] = useState(false);
    const [phase, setPhase] = useState<LoadPhase>("idle");
    const [error, setError] = useState<string | null>(null);
    const [baseName, setBaseName] = useState("contrato");
    const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
    const [manualReload, setManualReload] = useState(0);
    const [zoomPct, setZoomPct] = useState(100);

    const loading = phase === "docx" || phase === "editor";

    function applyZoom(pct: number) {
      const next = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, Math.round(pct / ZOOM_STEP) * ZOOM_STEP),
      );
      const sd = superdocRef.current;
      if (!sd || typeof sd.setZoom !== "function") {
        setZoomPct(next);
        return;
      }
      try {
        sd.setZoom(next);
        setZoomPct(next);
      } catch {
        try {
          // Algunas builds aceptan factor 0–1.
          sd.setZoom(next / 100);
          setZoomPct(next);
        } catch {
          toast.error("No se pudo cambiar el zoom.");
        }
      }
    }

    function fitZoomToViewport() {
      const width = viewportRef.current?.clientWidth ?? 0;
      if (width < 80) {
        applyZoom(75);
        return;
      }
      const fit = Math.floor(((width - 56) / PAGE_WIDTH_CSS_PX) * 100);
      applyZoom(Math.max(ZOOM_MIN, Math.min(100, fit)));
    }

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
      void preloadSuperDoc();
    }, []);

    useEffect(() => {
      if (!active || !propertyId) {
        setReady(false);
        setPhase("idle");
        setError(null);
        onReadyChange?.(false);
        return;
      }

      let cancelled = false;

      async function init() {
        setPhase("docx");
        setError(null);
        setReady(false);
        try {
          try {
            superdocRef.current?.destroy?.();
          } catch {
            /* noop */
          }
          superdocRef.current = null;

          const docxFetch = fetch(
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
          ).then(async (res) => {
            const data = (await res.json().catch(() => ({}))) as {
              fileBase64?: string;
              filename?: string;
              error?: string;
            };
            if (!res.ok || !data.fileBase64) {
              throw new Error(data.error || "No se pudo generar el contrato.");
            }
            return data;
          });

          const [data, { SuperDoc, fontsMod }] = await Promise.all([
            docxFetch,
            loadSuperDocModules(),
          ]);
          if (cancelled) return;

          setPhase("editor");
          const filename = data.filename || "contrato.docx";
          setBaseName(filename.replace(/\.docx$/i, ""));
          const bytes = Uint8Array.from(atob(data.fileBase64!), (c) =>
            c.charCodeAt(0),
          );
          const file = new File([bytes], filename, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });

          const fonts = fontsMod.createSuperDocFonts();
          (
            fonts as { resolveAssetUrl?: (c: { file: string }) => string }
          ).resolveAssetUrl = (c) => `/superdoc-fonts/${c.file}`;

          const instance = new SuperDoc({
            selector: `#${editorId}`,
            toolbar: `#${toolbarId}`,
            documentMode: "editing",
            fonts,
            zoom: { initial: fitZoomOnReady ? 75 : 100 },
            documents: [{ id: "contract", type: "docx", data: file }],
            onReady: (sd) => {
              if (cancelled) return;
              const live = sd ?? instance;
              justifySuperDocContract(live);
              superdocRef.current = live;
              setReady(true);
              setPhase("ready");
              if (fitZoomOnReady) {
                requestAnimationFrame(() => {
                  if (cancelled) return;
                  fitZoomToViewport();
                });
              } else {
                try {
                  // getZoom no está en el tipo del payload de SuperDoc; se
                  // consulta de forma defensiva.
                  const getZoom = (live as { getZoom?: () => number }).getZoom;
                  const z =
                    typeof getZoom === "function" ? Number(getZoom()) : 100;
                  if (Number.isFinite(z) && z > 0) {
                    setZoomPct(z > 1 ? Math.round(z) : Math.round(z * 100));
                  }
                } catch {
                  setZoomPct(100);
                }
              }
            },
          });
          superdocRef.current = instance;
        } catch (e) {
          if (!cancelled) {
            setPhase("error");
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      active,
      propertyId,
      documentKey,
      manualReload,
      editorId,
      toolbarId,
      fitZoomOnReady,
    ]);

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

    const phaseLabel =
      phase === "docx"
        ? "Generando el contrato desde la plantilla…"
        : phase === "editor"
          ? "Abriendo el editor Word…"
          : "Abriendo el contrato en el editor Word…";

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
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                title="Alejar"
                disabled={!ready || busy !== null || zoomPct <= ZOOM_MIN}
                onClick={() => applyZoom(zoomPct - ZOOM_STEP)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                className="min-w-12 px-1 text-center text-[11px] font-bold tabular-nums text-foreground hover:underline disabled:opacity-50"
                title="Ajustar al ancho"
                disabled={!ready || busy !== null}
                onClick={() => fitZoomToViewport()}
              >
                {zoomPct}%
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                title="Acercar"
                disabled={!ready || busy !== null || zoomPct >= ZOOM_MAX}
                onClick={() => applyZoom(zoomPct + ZOOM_STEP)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
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
          ref={viewportRef}
          className={cn("relative min-h-0 overflow-auto bg-muted/40", heightClassName)}
        >
          <div
            id={editorId}
            className="superdoc-contract-surface min-h-full"
          />

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{phaseLabel}</p>
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
