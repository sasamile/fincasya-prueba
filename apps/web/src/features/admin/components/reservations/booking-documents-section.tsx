"use client";

/**
 * Pestaña Documentos del panel de reserva: subir/ver/eliminar archivos de la
 * reserva (comprobantes, cédulas, PDFs, fotos…). Sube al bucket S3 vía
 * `/api/admin/upload` y guarda la referencia en `bookings.multimedia` (Convex).
 * Diseño sobrio, pensado para no técnicos: una zona clara para arrastrar/subir
 * y una lista simple con acciones.
 */
import { useRef, useState } from "react";
import { useMutation as useConvexMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BookingDocFile {
  url: string;
  name: string;
  type: string;
  size?: number;
  uploadedAt?: number;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BookingDocumentsSection({
  bookingId,
  files,
  onChange,
}: {
  bookingId: string;
  files: BookingDocFile[];
  onChange: (files: BookingDocFile[]) => void;
}) {
  const appendMut = useConvexMutation(api.bookings.appendMultimedia);
  const removeMut = useConvexMutation(api.bookings.removeMultimedia);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const list = Array.from(fileList);
    if (list.length === 0) return;
    setUploading(true);
    try {
      const added: BookingDocFile[] = [];
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("folder", "documents");
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: fd,
        });
        const body = (await res.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null;
        if (!res.ok || !body?.url) {
          throw new Error(body?.error ?? "No se pudo subir el archivo");
        }
        const doc: BookingDocFile = {
          url: body.url,
          name: f.name,
          type: f.type || "application/octet-stream",
          size: f.size,
          uploadedAt: Date.now(),
        };
        await appendMut({
          bookingId: bookingId as Id<"bookings">,
          file: doc,
        });
        added.push(doc);
      }
      onChange([...(files ?? []), ...added]);
      toast.success(
        added.length === 1 ? "Documento cargado." : `${added.length} documentos cargados.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo cargar el documento.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = async (url: string) => {
    setRemoving(url);
    try {
      await removeMut({ bookingId: bookingId as Id<"bookings">, url });
      onChange((files ?? []).filter((f) => f.url !== url));
      toast.success("Documento eliminado.");
    } catch {
      toast.error("No se pudo eliminar el documento.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Documentos de la reserva
        </h3>
      </div>

      {/* Zona para subir */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver
            ? "border-foreground/40 bg-muted/40"
            : "border-border hover:border-foreground/25 hover:bg-muted/20",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
          }}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <p className="text-sm font-medium text-foreground">
          {uploading ? "Subiendo…" : "Cargar documento"}
        </p>
        <p className="text-xs text-muted-foreground">
          Arrastra un archivo aquí o haz clic para elegir · PDF, imágenes, Word
        </p>
      </div>

      {/* Lista de documentos */}
      {(files?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          {files.map((file) => {
            const isImage = file.type?.includes("image");
            return (
              <div
                key={file.url}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name || "Documento"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.type?.split("/")[1] || "archivo").toUpperCase()}
                    {file.size ? ` · ${formatSize(file.size)}` : ""}
                  </p>
                </div>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Ver / descargar"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => void removeFile(file.url)}
                  disabled={removing === file.url}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  title="Eliminar"
                >
                  {removing === file.url ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          Aún no hay documentos cargados en esta reserva.
        </p>
      )}
    </div>
  );
}
