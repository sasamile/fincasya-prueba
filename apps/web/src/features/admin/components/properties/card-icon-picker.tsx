"use client";

import { useState } from "react";
import { Search, LayoutGrid, Check, Plus, X } from "lucide-react";
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
import { IconographyItem } from "../../types/features.types";
import { PropertyFeature } from "@/features/fincas/types/fincas.types";
import { cn } from "@/lib/utils";

interface CardIconPickerProps {
  selectedIconIds: string[];
  onChange: (ids: string[]) => void;
  catalog: IconographyItem[];
  availableFeatures?: PropertyFeature[]; // If provided, we are in EDIT mode
  onAddFeature?: (feature: PropertyFeature) => void; // Used in CREATE mode
  isLoading?: boolean;
}

export function CardIconPicker({
  selectedIconIds = [],
  onChange,
  catalog,
  availableFeatures, // From form.features in EDIT mode
  onAddFeature, // To add to form.features in CREATE mode
  isLoading,
}: CardIconPickerProps) {
  const [search, setSearch] = useState("");
  const [namingIconId, setNamingIconId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // We always show the full catalog now, as requested
  const displayIcons = catalog;

  const filteredIcons = displayIcons.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleIcon = (id: string) => {
    if (selectedIconIds.includes(id)) {
      onChange(selectedIconIds.filter((i) => i !== id));
      return;
    }

    if (selectedIconIds.length >= 4) return;

    if (onAddFeature) {
      // New icon selection: always open naming UI
      setNamingIconId(id);
      
      // Pre-fill name: existing feature name > catalog name
      const existing = availableFeatures?.find((f) => f.iconId === id);
      const catalogItem = catalog.find((c) => c._id === id);
      setNewName(existing?.name || catalogItem?.name || "");
    } else {
      // Fallback if onAddFeature is missing (shouldn't happen with current forms)
      onChange([...selectedIconIds, id]);
    }
  };

  const handleConfirmNewFeature = () => {
    if (!namingIconId || !newName.trim() || !onAddFeature) return;

    const catalogItem = catalog.find((c) => c._id === namingIconId);
    if (!catalogItem) return;

    // Check if we need to add a new feature to the main list
    const exists = availableFeatures?.some((f) => f.iconId === namingIconId);

    if (!exists) {
      const newFeature: PropertyFeature = {
        name: newName.trim(),
        iconId: namingIconId,
        iconUrl: catalogItem.iconUrl,
        emoji: catalogItem.emoji,
      };

      // 1. Add to main features list
      onAddFeature(newFeature);
    }

    // 2. Select for the card (if not already selected)
    if (!selectedIconIds.includes(namingIconId)) {
      onChange([...selectedIconIds, namingIconId]);
    }

    // 3. Reset
    setNamingIconId(null);
    setSearch(""); // Reset search to show all again
    setNewName("");
  };

  return (
    <div className="space-y-4">
      {/* Selected Icons Summary */}
      <div className="flex flex-wrap gap-3">
        {selectedIconIds.length === 0 ? (
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider italic py-2">
            No has seleccionado iconos para la card principal.
          </p>
        ) : (
          selectedIconIds.map((id) => {
            const catalogItem = catalog.find((c) => c._id === id);
            if (!catalogItem) return null;

            // Find the custom name if available in availableFeatures
            const feature = availableFeatures?.find((f) => f.iconId === id);
            const displayName = feature?.name || catalogItem.name;

            return (
              <div
                key={id}
                className="group relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/20 animate-in fade-in zoom-in-95 duration-200 min-w-[80px]"
              >
                <button
                  type="button"
                  onClick={() => toggleIcon(id)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-orange-600 border-2 border-orange-100 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-orange-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center p-2 mb-1.5 overflow-hidden ring-1 ring-white/30">
                  {catalogItem.iconUrl ? (
                    <img
                      src={catalogItem.iconUrl}
                      alt={displayName}
                      className="w-full h-full object-contain filter brightness-0 invert"
                    />
                  ) : catalogItem.emoji ? (
                    <span className="text-2xl">{catalogItem.emoji}</span>
                  ) : null}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-center truncate w-full px-1">
                  {displayName}
                </span>
              </div>
            );
          })
        )}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSearch("");
            setNamingIconId(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/10 hover:border-orange-500 hover:bg-orange-500 hover:text-white transition-all duration-500 group"
            disabled={isLoading}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-100 text-orange-600 group-hover:bg-white/20 group-hover:text-white transition-colors">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-black text-[11px] uppercase tracking-widest block">
                  Configurar Iconos de la Card
                </span>
                <span className="text-[10px] font-bold opacity-60 block mt-0.5">
                  Seleccionados: {selectedIconIds.length} / 4
                </span>
              </div>
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[32px] border-none shadow-2xl bg-white flex flex-col max-h-[90vh]">
          <DialogHeader className="bg-linear-to-br from-orange-600 to-orange-500 p-8">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shadow-lg">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                Iconos para la Card
              </DialogTitle>
              <div className="px-4 py-2 rounded-2xl bg-white/10 border border-white/20">
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  {selectedIconIds.length} / 4 Seleccionados
                </span>
              </div>
            </div>
            {!namingIconId && (
              <div className="relative group mt-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-white transition-colors" />
                <Input
                  placeholder="Buscar iconos..."
                  className="pl-11 h-12 bg-white/10 border-white/20 text-white rounded-2xl focus-visible:ring-orange-200 transition-all placeholder:text-white/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0 w-full relative">
            {namingIconId ? (
              /* CREATE MODE: NAMING VIEW */
              <div className="p-12 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-24 h-24 rounded-3xl bg-orange-500 text-white flex items-center justify-center p-5 shadow-2xl shadow-orange-500/20 ring-4 ring-orange-50">
                  {(() => {
                    const item = catalog.find((c) => c._id === namingIconId);
                    return item?.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt="icon"
                        className="w-full h-full object-contain filter brightness-0 invert"
                      />
                    ) : (
                      <span className="text-5xl">{item?.emoji}</span>
                    );
                  })()}
                </div>
                <div className="space-y-4 w-full max-w-sm">
                  <h3 className="font-black text-xl text-gray-900 tracking-tight">
                    ¿Qué nombre le darás?
                  </h3>
                  <div className="relative">
                    <Input
                      placeholder="Ej: Piscina Privada, Wifi..."
                      className="h-14 text-center font-bold text-lg rounded-2xl border-2 border-orange-100 focus-visible:ring-orange-500 focus-visible:border-orange-500 transition-all"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmNewFeature();
                      }}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex gap-3 w-full max-w-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-xs"
                    onClick={() => {
                      setNamingIconId(null);
                      setNewName("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-500/20"
                    onClick={handleConfirmNewFeature}
                    disabled={!newName.trim()}
                  >
                    Guardar y Usar
                  </Button>
                </div>
              </div>
            ) : (
              /* SELECTION VIEW */
              <ScrollArea className="w-full h-[500px]">
                <div className="p-8">
                  {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-28 rounded-3xl bg-gray-50 animate-pulse border border-gray-100"
                        />
                      ))}
                    </div>
                  ) : filteredIcons.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {filteredIcons.map((item) => {
                        const isSelected = selectedIconIds.includes(item._id);
                        const isDisabled =
                          !isSelected && selectedIconIds.length >= 4;
                        return (
                          <button
                            key={item._id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => toggleIcon(item._id)}
                            className={cn(
                              "relative flex flex-col items-center justify-center p-5 rounded-[28px] border-2 transition-all duration-300 text-center gap-3 group",
                              isSelected
                                ? "bg-orange-500 border-orange-500 text-white shadow-xl shadow-orange-500/20 scale-[1.02]"
                                : isDisabled
                                ? "bg-gray-50 border-gray-100 text-gray-300 opacity-50 cursor-not-allowed"
                                : "bg-white border-gray-100 text-gray-500 hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-600",
                            )}
                          >
                            {isSelected && (
                              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white text-orange-500 flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center p-3 transition-all duration-500 overflow-hidden",
                                isSelected
                                  ? "bg-white/20 ring-1 ring-white/30"
                                  : "bg-gray-50 group-hover:bg-white group-hover:shadow-inner",
                              )}
                            >
                              {item.iconUrl ? (
                                <img
                                  src={item.iconUrl}
                                  alt={item.name}
                                  className={cn(
                                    "w-full h-full object-contain",
                                    isSelected && "filter brightness-0 invert",
                                  )}
                                />
                              ) : item.emoji ? (
                                <span className="text-3xl selection:bg-transparent">
                                  {item.emoji}
                                </span>
                              ) : null}
                            </div>
                            <span className="font-black text-[10px] uppercase tracking-widest leading-none">
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mb-6 text-gray-300">
                        <Search className="w-10 h-10" />
                      </div>
                      <p className="font-black text-gray-400 uppercase tracking-widest text-sm text-balance">
                        No se encontraron iconos en el catálogo.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
          {!namingIconId && (
            <div className="p-8 border-t border-gray-50 bg-gray-50/20 flex justify-end">
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="px-10 h-14 rounded-2xl bg-gray-900 hover:bg-black text-white font-black uppercase tracking-widest shadow-xl transition-all"
                >
                  Confirmar Selección
                </Button>
              </DialogTrigger>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
