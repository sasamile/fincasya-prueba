"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PenLine, Upload, X } from "lucide-react";
import { uploadPaymentImages } from "@/features/admin/api/payment-images.api";
import { toast } from "sonner";
import type { Firmante } from "@/features/admin/store/contract-settings.store";
import { cn } from "@/lib/utils";

export type FirmanteFormData = Omit<Firmante, "id" | "esDefault">;

const EMPTY: FirmanteFormData = {
  nombre: "",
  cargo: "",
  cedula: "",
  ciudad: "",
  firmaUrl: undefined,
};

export function FirmanteDialog({
  open,
  onClose,
  initial,
  onSave,
  saving = false,
  contentClassName,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Firmante | null;
  onSave: (data: FirmanteFormData) => void | Promise<void>;
  saving?: boolean;
  contentClassName?: string;
}) {
  const [form, setForm] = useState<FirmanteFormData>({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        nombre: initial.nombre ?? "",
        cargo: initial.cargo ?? "",
        cedula: initial.cedula ?? "",
        ciudad: initial.ciudad ?? "",
        firmaUrl: initial.firmaUrl,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, initial]);

  const labelClass =
    "text-[11px] font-bold uppercase tracking-widest text-muted-foreground";
  const inputClass = "h-10 rounded-xl text-sm";

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const [url] = await uploadPaymentImages([file]);
      if (!url) {
        toast.error("No se pudo subir la firma");
        return;
      }
      setForm((f) => ({ ...f, firmaUrl: url }));
      toast.success("Firma cargada");
    } catch {
      toast.error("Error al subir la firma");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre del firmante es obligatorio");
      return;
    }
    void onSave({
      nombre: form.nombre.trim(),
      cargo: form.cargo.trim(),
      cedula: form.cedula.trim(),
      ciudad: form.ciudad.trim(),
      firmaUrl: form.firmaUrl || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={cn("sm:max-w-md", contentClassName)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-4 w-4 text-primary" />
            {isEdit ? "Editar firmante" : "Agregar firmante"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="space-y-1.5">
            <Label className={labelClass}>Nombre completo *</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Hernán Aguilera Gómez"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Cargo / rol</Label>
            <Input
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              placeholder="Ej: Representante legal"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={labelClass}>Cédula</Label>
              <Input
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                placeholder="81.720.077"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Ciudad</Label>
              <Input
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Chía (Cund)"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>Imagen de la firma (PNG)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const t = (file.type || "").toLowerCase();
                  if (!t.includes("png") && !t.includes("jpeg") && !t.includes("jpg")) {
                    toast.error("Usa PNG o JPG (Word no soporta WebP en firmas).");
                    e.target.value = "";
                    return;
                  }
                  void handleUpload(file);
                }
                e.target.value = "";
              }}
            />
            {form.firmaUrl ? (
              <div className="relative flex h-16 items-center justify-center rounded-xl border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.firmaUrl}
                  alt="Vista previa de la firma"
                  className="max-h-14 max-w-[200px] object-contain"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, firmaUrl: undefined })}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                  aria-label="Quitar firma"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-10 w-full gap-2 rounded-xl text-xs"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Subir imagen de la firma (PNG/JPG)
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              PNG con fondo transparente o JPG. Se incrusta en {"{{Firma}}"}.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="rounded-xl"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEdit ? "Guardar cambios" : "Agregar firmante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
