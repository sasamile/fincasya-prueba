"use client";

import { useState } from "react";
import {
  Search,
  ListChecks,
  Plus,
  X,
  Check,
  Pencil,
  GripVertical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { IconographyItem } from "../../types/features.types";
import { PropertyFeature } from "@/features/fincas/types/fincas.types";
import { cn } from "@/lib/utils";

function normalizedQuantity(value: number | undefined): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Solo dígitos; permite vacío mientras el usuario edita. */
function quantityDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function quantityFromInput(s: string): number {
  const n = Math.floor(Number.parseInt(s, 10));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

interface FeaturePickerProps {
  features: PropertyFeature[];
  onChange: (features: PropertyFeature[]) => void;
  catalog: IconographyItem[];
  isLoading?: boolean;
}

export function FeaturePicker({
  features = [],
  onChange,
  catalog,
  isLoading,
}: FeaturePickerProps) {
  const [search, setSearch] = useState("");
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [addQuantityInput, setAddQuantityInput] = useState("1");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantityInput, setEditQuantityInput] = useState("1");
  // Reordenamiento por arrastre
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const moveFeature = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...features];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const handleDrop = (target: number) => {
    if (dragIndex !== null) moveFeature(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  };

  const filteredCatalog = catalog.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAddFeature = () => {
    if (!customName.trim()) return;

    const newFeature: PropertyFeature = {
      name: customName.trim(),
      iconId: selectedIconId ?? undefined,
      quantity: quantityFromInput(addQuantityInput),
    };

    const catalogItem = catalog.find((c) => c._id === selectedIconId);
    if (catalogItem) {
      newFeature.iconUrl = catalogItem.iconUrl;
      newFeature.emoji = catalogItem.emoji;
    }

    onChange([...features, newFeature]);
    setCustomName("");
    setSelectedIconId(null);
    setSearch("");
    setAddQuantityInput("1");
  };

  const handleRemoveFeature = (index: number) => {
    const newFeatures = [...features];
    newFeatures.splice(index, 1);
    onChange(newFeatures);
  };

  const openEditFeature = (index: number) => {
    const f = features[index];
    if (!f) return;
    setEditIndex(index);
    setEditName(f.name);
    setEditQuantityInput(String(normalizedQuantity(f.quantity)));
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (editIndex === null || !trimmed) return;
    const next = features.map((f, i) =>
      i === editIndex
        ? {
            ...f,
            name: trimmed,
            quantity: quantityFromInput(editQuantityInput),
          }
        : f,
    );
    onChange(next);
    setEditDialogOpen(false);
    setEditIndex(null);
    setEditName("");
    setEditQuantityInput("1");
  };

  return (
    <div className="space-y-4">
      {/* Selected Features Summary */}
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {features.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2 px-1">
            No hay características agregadas aún.
          </p>
        ) : (
          features.map((feature, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDragLeave={() => {
                if (overIndex === index) setOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                "group relative flex flex-col items-center justify-center p-2 rounded-xl border border-border bg-muted/50 text-foreground min-w-[70px] max-w-[100px] transition-all hover:bg-muted/70 hover:border-primary/30 animate-in fade-in zoom-in-95 duration-200 shadow-sm cursor-grab active:cursor-grabbing",
                dragIndex === index && "opacity-40",
                overIndex === index &&
                  dragIndex !== null &&
                  dragIndex !== index &&
                  "ring-2 ring-primary border-primary",
              )}
            >
              <div
                aria-hidden
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-4 w-5 items-center justify-center rounded-full bg-background border border-border text-muted-foreground shadow-sm md:opacity-0 md:group-hover:opacity-100 transition-all"
              >
                <GripVertical className="w-3 h-3" />
              </div>
              <button
                type="button"
                aria-label="Editar nombre de la amenidad"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditFeature(index);
                }}
                className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-background border border-border text-primary shadow-sm flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-primary hover:text-white hover:border-primary z-10"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                aria-label="Quitar amenidad"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFeature(index);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border text-primary shadow-sm flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white hover:border-destructive z-10"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1.5 mb-1 shadow-xs ring-1 ring-primary/20 overflow-hidden">
                {(() => {
                  const url =
                    feature.iconUrl ||
                    catalog.find((c) => c._id === feature.iconId)?.iconUrl;
                  const emoji =
                    feature.emoji ||
                    catalog.find((c) => c._id === feature.iconId)?.emoji;

                  if (url) {
                    return (
                      <img
                        src={url}
                        alt={feature.name}
                        className="w-full h-full object-contain"
                      />
                    );
                  }
                  if (emoji) {
                    return (
                      <span className="text-xl selection:bg-transparent">
                        {emoji}
                      </span>
                    );
                  }
                  return <div className="w-full h-full bg-muted" />;
                })()}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-center leading-tight truncate w-full px-1">
                {feature.name}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground">
                Cant. {normalizedQuantity(feature.quantity)}
              </span>
              {/* Flechas para reordenar (táctil / accesible) */}
              <div className="mt-1 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-all">
                <button
                  type="button"
                  aria-label="Mover a la izquierda"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveFeature(index, index - 1);
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded border border-border bg-background text-[10px] leading-none text-muted-foreground hover:bg-primary hover:text-white disabled:opacity-30 disabled:hover:bg-background disabled:hover:text-muted-foreground"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Mover a la derecha"
                  disabled={index === features.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveFeature(index, index + 1);
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded border border-border bg-background text-[10px] leading-none text-muted-foreground hover:bg-primary hover:text-white disabled:opacity-30 disabled:hover:bg-background disabled:hover:text-muted-foreground"
                >
                  ›
                </button>
              </div>
            </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {feature.name} · Cant. {normalizedQuantity(feature.quantity)}
              </TooltipContent>
            </Tooltip>
          ))
        )}
      </div>

      {/* Main Trigger Button */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSearch("");
            setAddQuantityInput("1");
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all group"
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-black text-[11px] uppercase tracking-widest">
                Agregar Amenidad ({features.length})
              </span>
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[32px] border-none shadow-2xl bg-background flex flex-col max-h-[90vh]">
          <DialogHeader className="bg-primary p-8">
            <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-lg shadow-black/10">
                <ListChecks className="w-6 h-6" />
              </div>
              Seleccionar Amenidades
            </DialogTitle>
            <div className="flex gap-2 mt-4">
              <div className="relative group flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-white transition-colors" />
                <Input
                  placeholder="Buscar ícono..."
                  className="pl-11 h-12 bg-white/10 border-white/20 text-white rounded-2xl focus-visible:ring-white/30 transition-all placeholder:text-white/60"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </DialogHeader>

          {/* Create custom feature section */}
          <div className="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-end shrink-0">
            <div className="flex-1 w-full space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                Nombre de la amenidad <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Ej: Piscina para niños"
                className="h-12 bg-background rounded-2xl border-border focus-visible:ring-primary"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customName.trim()) {
                    e.preventDefault();
                    handleAddFeature();
                  }
                }}
              />
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                Cantidad
              </label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 max-w-[140px] bg-background rounded-2xl border-border focus-visible:ring-primary"
                value={addQuantityInput}
                onChange={(e) =>
                  setAddQuantityInput(quantityDigitsOnly(e.target.value))
                }
                onBlur={() => {
                  if (addQuantityInput.trim() === "")
                    setAddQuantityInput("1");
                }}
              />
            </div>
            <Button
              type="button"
              className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold tracking-wide w-full sm:w-auto shadow-lg shadow-primary/20"
              disabled={!customName.trim()}
              onClick={handleAddFeature}
            >
              Agregar Amenidad
            </Button>
          </div>

          <div className="flex-1 overflow-hidden min-h-0 w-full relative">
            <ScrollArea className="w-full h-[calc(100vh-400px)] bg-background">
              <div className="p-6">
                {isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-28 rounded-2xl bg-muted animate-pulse border border-border"
                      />
                    ))}
                  </div>
                ) : filteredCatalog.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredCatalog.map((feature) => {
                      const isSelected = selectedIconId === feature._id;
                      return (
                        <button
                          key={feature._id}
                          type="button"
                          onClick={() => {
                            setSelectedIconId(isSelected ? null : feature._id);
                            if (!customName && !isSelected) {
                              setCustomName(feature.name); // Autofill name if empty
                            }
                          }}
                          className={`relative flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all duration-300 text-center gap-2 group
                            ${
                              isSelected
                                ? "bg-primary/5 border-primary text-primary shadow-lg shadow-primary/10 scale-100 ring-4 ring-primary/10"
                                : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary hover:scale-[1.02]"
                            }
                          `}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center p-2.5 transition-all duration-500 overflow-hidden bg-white shadow-sm ring-1 ring-black/5
                            ${isSelected ? "ring-primary/20" : ""}
                          `}
                          >
                            {feature.iconUrl ? (
                              <img
                                src={feature.iconUrl}
                                alt={feature.name}
                                className="w-full h-full object-contain"
                              />
                            ) : feature.emoji ? (
                              <span className="text-2xl selection:bg-transparent">
                                {feature.emoji}
                              </span>
                            ) : (
                              <div className="w-full h-full bg-muted/20" />
                            )}
                          </div>
                          <span className="font-black text-[10px] uppercase tracking-wider leading-tight">
                            {feature.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground/30">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="font-black text-muted-foreground uppercase tracking-widest text-xs">
                      No se encontraron resultados para "{search}"
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="mt-4 text-primary font-bold text-sm hover:underline"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditIndex(null);
            setEditName("");
            setEditQuantityInput("1");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">
              Editar amenidad
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Nombre <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              placeholder="Nombre de la amenidad"
              className="h-11 rounded-xl"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editName.trim()) {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
            />
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Cantidad
            </label>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="h-11 max-w-[140px] rounded-xl"
              value={editQuantityInput}
              onChange={(e) =>
                setEditQuantityInput(quantityDigitsOnly(e.target.value))
              }
              onBlur={() => {
                if (editQuantityInput.trim() === "")
                  setEditQuantityInput("1");
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditIndex(null);
                  setEditName("");
                  setEditQuantityInput("1");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={!editName.trim()}
                onClick={handleSaveEdit}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
