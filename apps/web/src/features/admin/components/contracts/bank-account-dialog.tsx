"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { ImagePlus, Trash2, QrCode, Loader2, KeyRound } from "lucide-react";
import { uploadPaymentImages } from "@/features/admin/api/payment-images.api";
import { sileo } from "sileo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BANK_OTHER_VALUE,
  COLOMBIAN_BANKS,
  defaultAccountTypeForBank,
  getAccountTypesForBank,
  isCustomBankValue,
  normalizeAccountTypeForBank,
  resolveBankSelectValue,
} from "@/features/admin/constants/colombian-banks";
import {
  type BankAccount,
  getBankAccountImages,
} from "@/features/admin/store/contract-settings.store";
import { cn } from "@/lib/utils";

export type BankAccountPrefill = {
  ownerName?: string;
  ownerCedula?: string;
  accountType?: string;
};

/** Titulares ya creados para sugerir al escribir el nombre. */
export type KnownBankHolder = {
  name: string;
  cedula?: string;
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export interface BankAccountDialogProps {
  open: boolean;
  onClose: () => void;
  initial?: BankAccount | null;
  prefill?: BankAccountPrefill | null;
  /** Bloquea titular/cédula al agregar cuenta a un titular existente. */
  lockHolderFields?: boolean;
  /** Personas ya creadas (sugerencias al escribir en Titular). */
  knownHolders?: KnownBankHolder[];
  onSave: (data: Omit<BankAccount, "id">) => void;
  /** Tema oscuro inbox, etc. */
  contentClassName?: string;
}

export function BankAccountDialog({
  open,
  onClose,
  initial,
  prefill,
  lockHolderFields = false,
  knownHolders = [],
  onSave,
  contentClassName,
}: BankAccountDialogProps) {
  const [form, setForm] = useState({
    bankName: "",
    accountType: "Cuenta de Ahorros",
    accountNumber: "",
    ownerName: "",
    ownerCedula: "",
    imageUrls: [] as string[],
    qrOnly: false,
    brebKey: false,
  });
  const [uploading, setUploading] = useState(false);
  const [holderSuggestOpen, setHolderSuggestOpen] = useState(false);
  const holderBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        bankName: initial.bankName,
        accountType: normalizeAccountTypeForBank(
          initial.bankName,
          initial.accountType,
        ),
        accountNumber: initial.accountNumber,
        ownerName: initial.ownerName,
        ownerCedula: initial.ownerCedula,
        imageUrls: getBankAccountImages(initial),
        qrOnly: initial.qrOnly ?? false,
        brebKey: initial.brebKey ?? false,
      });
    } else {
      const bankName = "";
      setForm({
        bankName,
        accountType: prefill?.accountType
          ? normalizeAccountTypeForBank(bankName, prefill.accountType)
          : defaultAccountTypeForBank(bankName),
        accountNumber: "",
        ownerName: prefill?.ownerName?.trim() || "",
        ownerCedula: prefill?.ownerCedula?.trim() || "",
        imageUrls: [],
        qrOnly: false,
        brebKey: false,
      });
    }
    setHolderSuggestOpen(false);
  }, [initial, open, prefill]);

  useEffect(() => {
    return () => {
      if (holderBlurTimer.current) clearTimeout(holderBlurTimer.current);
    };
  }, []);

  const holderSuggestions = useMemo(() => {
    if (lockHolderFields || initial) return [];
    const q = normalizeSearch(form.ownerName);
    if (q.length < 2) return [];

    const seen = new Set<string>();
    const matches: KnownBankHolder[] = [];
    for (const holder of knownHolders) {
      const name = holder.name.trim();
      if (!name) continue;
      const key = normalizeSearch(name);
      if (seen.has(key)) continue;
      if (!key.includes(q) && !q.includes(key)) continue;
      if (key === q) continue;
      seen.add(key);
      matches.push({ name, cedula: holder.cedula?.trim() || undefined });
      if (matches.length >= 8) break;
    }
    return matches;
  }, [form.ownerName, knownHolders, lockHolderFields, initial]);

  const pickHolder = (holder: KnownBankHolder) => {
    setForm((prev) => ({
      ...prev,
      ownerName: holder.name,
      ownerCedula: holder.cedula?.trim() || prev.ownerCedula,
    }));
    setHolderSuggestOpen(false);
  };

  const labelClass =
    "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block";
  const inputClass =
    "h-12 rounded-2xl border border-zinc-200 bg-zinc-50/90 text-sm text-zinc-900 shadow-sm focus-visible:ring-2 focus-visible:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500";

  const handleImageAdd = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      sileo.error({
        title: "Imagen no válida",
        description: "Solo se permiten imágenes.",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      sileo.error({
        title: "Imagen muy grande",
        description: "La imagen supera el máximo de 10 MB.",
      });
      return;
    }
    setUploading(true);
    try {
      // Subimos a S3 y guardamos la URL (no base64): el doc de configuración
      // tiene un límite de 1 MiB en Convex y las imágenes lo desbordaban.
      const [url] = await uploadPaymentImages([file]);
      if (!url) throw new Error("No se recibió la URL de la imagen.");
      setForm((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, url],
      }));
    } catch (err) {
      sileo.error({
        title: "No se pudo subir la imagen",
        description:
          err instanceof Error ? err.message : "Inténtalo de nuevo.",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImageAt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-md overflow-y-auto rounded-2xl",
          contentClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {initial
              ? "Editar cuenta"
              : prefill?.ownerName?.trim()
                ? `Nueva cuenta · ${prefill.ownerName.trim()}`
                : "Nueva cuenta bancaria"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <Label className="text-sm font-bold text-foreground">
                Solo QR (sin número de cuenta)
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                El cliente paga escaneando el QR. Sube la imagen del QR; el
                número de cuenta no es necesario.
              </p>
            </div>
            <Switch
              checked={form.qrOnly}
              onCheckedChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  qrOnly: value,
                  brebKey: value ? false : prev.brebKey,
                }))
              }
            />
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <Label className="text-sm font-bold text-foreground">
                Llave Bre-B
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                El cliente paga desde cualquier banco con la llave (alias:
                celular, correo, cédula o código). No requiere banco ni número.
              </p>
            </div>
            <Switch
              checked={form.brebKey}
              onCheckedChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  brebKey: value,
                  qrOnly: value ? false : prev.qrOnly,
                }))
              }
            />
          </div>

          {!form.brebKey ? (
          <div
            className={`grid gap-3 ${
              form.qrOnly ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            <div className="space-y-1">
              <Label className={labelClass}>
                {form.qrOnly ? "Banco (opcional)" : "Banco"}
              </Label>
              <Select
                value={resolveBankSelectValue(form.bankName)}
                onValueChange={(value) => {
                  const bankName = isCustomBankValue(value)
                    ? form.bankName &&
                      !COLOMBIAN_BANKS.some(
                        (bank) =>
                          bank.toLowerCase() === form.bankName.toLowerCase(),
                      )
                      ? form.bankName
                      : ""
                    : value;
                  setForm((prev) => ({
                    ...prev,
                    bankName,
                    accountType: normalizeAccountTypeForBank(
                      bankName,
                      prev.accountType,
                    ),
                  }));
                }}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Seleccionar banco..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-[280px]">
                  {COLOMBIAN_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                  <SelectItem value={BANK_OTHER_VALUE}>Otro</SelectItem>
                </SelectContent>
              </Select>
              {isCustomBankValue(resolveBankSelectValue(form.bankName)) ? (
                <Input
                  className={`${inputClass} mt-2`}
                  placeholder="Nombre del banco"
                  value={form.bankName}
                  onChange={(e) => {
                    const bankName = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      bankName,
                      accountType: normalizeAccountTypeForBank(
                        bankName,
                        prev.accountType,
                      ),
                    }));
                  }}
                />
              ) : null}
            </div>
            {!form.qrOnly ? (
              <div className="space-y-1">
                <Label className={labelClass}>Tipo de cuenta</Label>
                <Select
                  value={normalizeAccountTypeForBank(
                    form.bankName,
                    form.accountType,
                  )}
                  onValueChange={(value) =>
                    setForm({ ...form, accountType: value })
                  }
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Seleccionar tipo..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {getAccountTypesForBank(form.bankName).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          ) : null}
          {!form.qrOnly ? (
            <div className="space-y-1">
              <Label className={labelClass}>
                {form.brebKey ? "Llave Bre-B" : "Número de cuenta"}
              </Label>
              <Input
                className={inputClass}
                placeholder={
                  form.brebKey
                    ? "Ej: @MiLlave, 3001234567, correo@..."
                    : "Ej: 123-456789-00"
                }
                value={form.accountNumber}
                onChange={(e) =>
                  setForm({ ...form, accountNumber: e.target.value })
                }
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative space-y-1">
              <Label className={labelClass}>Titular</Label>
              <Input
                className={inputClass}
                placeholder="Nombre completo"
                value={form.ownerName}
                readOnly={lockHolderFields}
                disabled={lockHolderFields}
                autoComplete="off"
                onFocus={() => {
                  if (!lockHolderFields && !initial) setHolderSuggestOpen(true);
                }}
                onBlur={() => {
                  holderBlurTimer.current = setTimeout(
                    () => setHolderSuggestOpen(false),
                    150,
                  );
                }}
                onChange={(e) => {
                  setForm({ ...form, ownerName: e.target.value });
                  setHolderSuggestOpen(true);
                }}
              />
              {holderSuggestOpen && holderSuggestions.length > 0 ? (
                <ul className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-md">
                  {holderSuggestions.map((holder) => (
                    <li key={`${holder.name}-${holder.cedula ?? ""}`}>
                      <button
                        type="button"
                        className="hover:bg-muted flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickHolder(holder)}
                      >
                        <span className="text-sm font-medium text-foreground">
                          {holder.name}
                        </span>
                        {holder.cedula ? (
                          <span className="text-[11px] text-muted-foreground">
                            C.C. {holder.cedula}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!lockHolderFields &&
              !initial &&
              knownHolders.length > 0 &&
              form.ownerName.trim().length < 2 ? (
                <p className="text-[10px] text-muted-foreground">
                  Escribe al menos 2 letras para sugerir titulares existentes.
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className={labelClass}>Cédula titular</Label>
              <Input
                className={inputClass}
                placeholder="Ej: 12.345.678"
                value={form.ownerCedula}
                readOnly={lockHolderFields}
                disabled={lockHolderFields}
                onChange={(e) =>
                  setForm({ ...form, ownerCedula: e.target.value })
                }
              />
            </div>
          </div>
          {lockHolderFields ? (
            <p className="text-[10px] text-muted-foreground">
              Esta cuenta se agrega al titular existente. El banco y número son
              los únicos campos nuevos.
            </p>
          ) : null}

          {!form.brebKey ? (
          <div className="space-y-2">
            <Label className={labelClass}>
              {form.qrOnly
                ? "Imagen del QR * "
                : "Foto de esta cuenta (opcional) "}
              ({form.imageUrls.length})
            </Label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Solo si esta cuenta tiene QR u otra imagen propia. El flyer con
              todas las cuentas del titular va en la foto general de ese
              titular.
            </p>
            {form.imageUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {form.imageUrls.map((url, index) => (
                  <div
                    key={`${index}-${url.slice(0, 24)}`}
                    className="relative rounded-xl border border-border overflow-hidden bg-muted/20"
                  >
                    <img
                      src={url}
                      alt={`Medio de pago ${index + 1}`}
                      className="w-full max-h-32 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => removeImageAt(index)}
                      className="absolute top-2 right-2 rounded-lg bg-red-500/90 p-1.5 text-white hover:bg-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <label
              className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 p-4 ${
                uploading
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-muted/20"
              }`}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
              )}
              <span className="text-[11px] font-semibold text-muted-foreground">
                {uploading ? "Subiendo…" : "Agregar imagen"}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  void (async () => {
                    for (const file of files) {
                      await handleImageAdd(file);
                    }
                  })();
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (form.brebKey) {
                if (!form.ownerName || !form.accountNumber.trim()) {
                  sileo.error({
                    title: "Faltan campos",
                    description:
                      "Para una llave Bre-B: agrega el titular y la llave.",
                  });
                  return;
                }
              } else if (form.qrOnly) {
                if (!form.ownerName || form.imageUrls.length === 0) {
                  sileo.error({
                    title: "Faltan campos",
                    description:
                      "Para una cuenta solo QR: agrega el titular y al menos una imagen de QR.",
                  });
                  return;
                }
              } else if (
                !form.bankName ||
                !form.accountNumber ||
                !form.ownerName
              ) {
                sileo.error({
                  title: "Faltan campos",
                  description: "Completa banco, número y titular.",
                });
                return;
              }
              onSave({
                bankName: form.brebKey ? "Bre-B" : form.bankName,
                accountType: form.qrOnly || form.brebKey ? "" : form.accountType,
                accountNumber: form.qrOnly ? "" : form.accountNumber,
                ownerName: form.ownerName,
                ownerCedula: form.ownerCedula,
                imageUrls: form.brebKey ? [] : form.imageUrls,
                imageUrl: form.brebKey ? undefined : form.imageUrls[0],
                qrOnly: form.qrOnly,
                brebKey: form.brebKey,
              });
              onClose();
            }}
            disabled={uploading}
            className="rounded-xl"
          >
            {initial ? "Guardar cambios" : "Agregar cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
