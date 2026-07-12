"use client";

import { useRef, useState } from "react";
import { Pen, Plus, Trash2, Upload, Loader2, Star, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSection } from "../shared/form-section";
import { useContractSettingsStore } from "@/features/admin/store/contract-settings.store";
import { uploadPaymentImages } from "@/features/admin/api/payment-images.api";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";

const EMPTY = { nombre: "", cargo: "", cedula: "", ciudad: "", firmaUrl: "" };

/**
 * Gestión de firmantes del contrato (Hernán, esposa, etc.). Al generar un
 * contrato se elige cuál firma: su nombre/cédula/ciudad llenan el bloque
 * ARRENDADOR y su imagen de firma se incrusta en el PDF.
 */
export function ContractFirmantesSection() {
  const firmantes = useContractSettingsStore((s) => s.firmantes);
  const addFirmante = useContractSettingsStore((s) => s.addFirmante);
  const updateFirmante = useContractSettingsStore((s) => s.updateFirmante);
  const removeFirmante = useContractSettingsStore((s) => s.removeFirmante);
  const setDefaultFirmante = useContractSettingsStore(
    (s) => s.setDefaultFirmante,
  );

  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const labelClass =
    "text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400";
  const inputClass =
    "h-10 rounded-xl border-zinc-200 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900";

  const handleUploadFirma = async (file: File) => {
    setUploading(true);
    try {
      const [url] = await uploadPaymentImages([file]);
      if (url) {
        setForm((f) => ({ ...f, firmaUrl: url }));
        sileo.success({ title: "Firma cargada", fill: "#f0fdf4" });
      } else {
        sileo.error({ title: "No se pudo subir la firma", fill: "#fee2e2" });
      }
    } catch {
      sileo.error({ title: "Error al subir la firma", fill: "#fee2e2" });
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = () => {
    if (!form.nombre.trim()) {
      sileo.error({ title: "El nombre del firmante es obligatorio", fill: "#fee2e2" });
      return;
    }
    addFirmante({
      nombre: form.nombre.trim(),
      cargo: form.cargo.trim(),
      cedula: form.cedula.trim(),
      ciudad: form.ciudad.trim(),
      firmaUrl: form.firmaUrl || undefined,
    });
    setForm({ ...EMPTY });
    sileo.success({ title: "Firmante agregado", fill: "#f0fdf4" });
  };

  return (
    <FormSection
      title="Firmantes del contrato"
      description="Quiénes firman a nombre de Fincas Ya. Al generar un contrato eliges cuál va."
      icon={Pen}
      gradientFrom="from-emerald-500/10"
      iconBg="bg-emerald-600 text-white"
      iconShadow="shadow-emerald-500/20"
      textColor="text-emerald-600 dark:text-emerald-200"
      defaultOpen={false}
    >
      <div className="space-y-4 p-1">
        {firmantes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 py-8 text-center dark:border-zinc-600">
            <Pen className="mx-auto mb-2 h-7 w-7 text-zinc-400 dark:text-zinc-500" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-100">
              No hay firmantes
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Agrega al menos uno para poder elegirlo al generar contratos.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {firmantes.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  f.esDefault
                    ? "border-emerald-300 bg-emerald-50/80 dark:border-emerald-600 dark:bg-emerald-950/40"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {f.nombre}
                    {f.esDefault ? (
                      <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Por defecto
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {[f.cargo, f.cedula ? `C.C. ${f.cedula}` : "", f.ciudad]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {f.firmaUrl ? (
                  <div className="relative h-12 w-28 shrink-0 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700">
                    <Image
                      src={f.firmaUrl}
                      alt={`Firma de ${f.nombre}`}
                      fill
                      sizes="112px"
                      className="object-contain p-1"
                    />
                  </div>
                ) : (
                  <span className="shrink-0 rounded-lg border border-dashed border-amber-300 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-700 dark:text-amber-300">
                    Sin imagen
                  </span>
                )}
                {!f.esDefault ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDefaultFirmante(f.id)}
                    className="h-8 gap-1 px-2 text-[11px]"
                    title="Marcar por defecto"
                  >
                    <Star className="h-3.5 w-3.5" /> Por defecto
                  </Button>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeFirmante(f.id)}
                  className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                  title="Eliminar firmante"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-600">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200">
            <Plus className="h-3.5 w-3.5" /> Agregar firmante
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            <div className="space-y-1.5">
              <Label className={labelClass}>Cédula</Label>
              <Input
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                placeholder="Ej: 81.720.077"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Ciudad</Label>
              <Input
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Ej: Chía (Cund)"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadFirma(file);
                e.target.value = "";
              }}
            />
            {form.firmaUrl ? (
              <div className="relative h-14 w-32 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700">
                <Image
                  src={form.firmaUrl}
                  alt="Vista previa de la firma"
                  fill
                  sizes="128px"
                  className="object-contain p-1"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, firmaUrl: "" })}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
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
                className="h-10 gap-2 rounded-xl text-xs"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Subir imagen de la firma (PNG)
              </Button>
            )}
            <Button
              type="button"
              onClick={handleAdd}
              className="ml-auto h-10 gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" /> Guardar firmante
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Usa un PNG con fondo transparente. La firma elegida se incrusta en el
            PDF del contrato.
          </p>
        </div>
      </div>
    </FormSection>
  );
}
