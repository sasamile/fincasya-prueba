"use client";

import { useId, useState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { sileo } from "sileo";
import { uploadInternalPageImage } from "@/features/admin/api/internal-pages-media.api";

type InternalPageImageUploadProps = {
  value?: string;
  onChange: (url: string) => void;
  previewAlt?: string;
};

export function InternalPageImageUpload({
  value,
  onChange,
  previewAlt = "Vista previa",
}: InternalPageImageUploadProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div className="space-y-4">
      {value ? (
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-muted/20">
          <div className="relative aspect-video w-full">
            <img
              src={value}
              alt={previewAlt}
              className="absolute inset-0 h-full w-full object-cover opacity-95"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-background/95 text-muted-foreground shadow-xl transition-all hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="group relative">
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";

            void (async () => {
              setIsUploading(true);
              try {
                onChange(await uploadInternalPageImage(file));
              } catch {
                sileo.error({
                  title: "Error al subir la imagen",
                  description: "Intentá nuevamente",
                  fill: "#fee2e2",
                });
              } finally {
                setIsUploading(false);
              }
            })();
          }}
        />
        <label
          htmlFor={inputId}
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-[32px] border-2 border-dashed border-border/50 p-8 text-muted-foreground transition-all duration-500 hover:border-primary/50 hover:bg-primary/5 hover:text-primary ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="rounded-[24px] bg-muted/50 p-5 shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
            {isUploading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <ImageIcon className="h-7 w-7" />
            )}
          </div>
          <div className="text-center">
            <span className="block text-base font-bold tracking-tight text-foreground group-hover:text-primary">
              Subir imagen destacada
            </span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-widest opacity-60">
              JPG, PNG, WEBP — Máx 10MB
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}
