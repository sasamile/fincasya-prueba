"use client";

import { useState, useRef } from "react";
import { sileo } from "sileo";
import {
  useIconography,
  useCreateIcon,
  useBulkUploadIcons,
  useUpdateIcon,
  useDeleteIcon,
} from "@/features/admin/queries/features.queries";
import type { IconographyItem } from "@/features/admin/types/features.types";
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  Loader2,
  Sparkles,
  Search,
  X,
  Image as ImageIcon,
  LayoutGrid,
  List,
  SortAsc,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function FeaturesManagement() {
  const { data: features, isLoading } = useIconography();
  const createMutation = useCreateIcon();
  const bulkMutation = useBulkUploadIcons();
  const updateMutation = useUpdateIcon();
  const deleteMutation = useDeleteIcon();

  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingFeature, setEditingFeature] = useState<IconographyItem | null>(
    null,
  );
  const [deletingFeature, setDeletingFeature] =
    useState<IconographyItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isGrouped, setIsGrouped] = useState(true);

  // Create form
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newIconFile, setNewIconFile] = useState<File | null>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editIconFile, setEditIconFile] = useState<File | null>(null);

  // Bulk
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const filteredFeatures = features?.filter((f) =>
    (f.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // Grouping logic
  const groupedFeatures =
    isGrouped && filteredFeatures
      ? Array.from(
          new Set(
            filteredFeatures
              .map((f) => (f.name?.[0] || "#").toUpperCase())
              .sort(),
          ),
        ).map((letter) => ({
          letter,
          items: filteredFeatures.filter(
            (f) => (f.name?.[0] || "#").toUpperCase() === letter,
          ),
        }))
      : null;

  // ────── Create ──────
  const handleCreate = async () => {
    if (!newName.trim() && !newEmoji.trim() && !newIconFile) {
      sileo.error({
        title: "Datos insuficientes",
        description: "Debes ingresar al menos un nombre, un emoji o un icono.",
        fill: "#fee2e2",
      });
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: newName.trim() || undefined,
        emoji: newEmoji.trim() || undefined,
        icon: newIconFile || undefined,
      });
      sileo.success({ title: "Feature creada exitosamente", fill: "#f0fdf4" });
      setShowCreateDialog(false);
      setNewName("");
      setNewEmoji("");
      setNewIconFile(null);
    } catch {
      sileo.error({ title: "Error al crear la feature", fill: "#fee2e2" });
    }
  };

  // ────── Bulk Upload ──────
  const handleBulk = async () => {
    if (bulkFiles.length === 0) {
      sileo.error({
        title: "Selecciona al menos un archivo SVG",
        fill: "#fee2e2",
      });
      return;
    }
    try {
      const result = await bulkMutation.mutateAsync(bulkFiles);
      sileo.success({
        title: `${Array.isArray(result) ? result.length : 0} features creadas`,
        fill: "#f0fdf4",
      });
      setShowBulkDialog(false);
      setBulkFiles([]);
    } catch {
      sileo.error({ title: "Error en la carga masiva", fill: "#fee2e2" });
    }
  };

  // ────── Update ──────
  const handleUpdate = async () => {
    if (!editingFeature) return;
    try {
      await updateMutation.mutateAsync({
        id: editingFeature._id,
        payload: {
          name: editName.trim(),
          emoji: editEmoji.trim() || undefined,
          icon: editIconFile || undefined,
        },
      });
      sileo.success({ title: "Feature actualizada", fill: "#f0fdf4" });
      setEditingFeature(null);
      setEditName("");
      setEditIconFile(null);
    } catch {
      sileo.error({ title: "Error al actualizar la feature", fill: "#fee2e2" });
    }
  };

  // ────── Delete ──────
  const handleDelete = async () => {
    if (!deletingFeature) return;
    try {
      await deleteMutation.mutateAsync(deletingFeature._id);
      sileo.success({ title: "Feature eliminada", fill: "#f0fdf4" });
      setDeletingFeature(null);
      setSelectedIds((prev) => prev.filter((id) => id !== deletingFeature._id));
    } catch {
      sileo.error({
        title: "No se pudo eliminar",
        description: "Puede estar vinculada a una finca.",
        fill: "#fee2e2",
      });
      setDeletingFeature(null);
    }
  };

  // ────── Bulk Delete ──────
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const id of selectedIds) {
        try {
          await deleteMutation.mutateAsync(id);
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        sileo.success({
          title: "Eliminación completada",
          description: `${successCount} features eliminadas.${failCount > 0 ? ` ${failCount} fallaron.` : ""}`,
          fill: "#f0fdf4",
        });
      } else if (failCount > 0) {
        sileo.error({
          title: "Error al eliminar",
          description: "Ninguna feature pudo ser eliminada.",
          fill: "#fee2e2",
        });
      }
      setSelectedIds([]);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (!filteredFeatures) return;
    const allVisibleIds = filteredFeatures.map((f) => f._id);
    const allSelected = allVisibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      // Unselect only the currently visible ones
      setSelectedIds((prev) =>
        prev.filter((id) => !allVisibleIds.includes(id)),
      );
    } else {
      // Add all visible ones to selection (avoiding duplicates)
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...allVisibleIds])),
      );
    }
  };

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-1";

  return (
    <div className="p-4 md:p-8 lg:p-10 bg-transparent min-h-[calc(100vh-4rem)] relative">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-linear-to-br from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent">
              Catálogo de Características
            </h1>
            <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
              {features?.length || 0} features registradas
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold text-sm hover:bg-red-500/20 transition-all shadow-sm disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Eliminar ({selectedIds.length})
              </button>
            )}
            {/* <button
              onClick={() => setShowBulkDialog(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Carga Masiva
            </button> */}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Feature</span>
              <span className="sm:hidden">Nueva</span>
            </button>
          </div>
        </div>

        {/* Search & Selection & View Toggles */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-background/50 backdrop-blur-md p-4 rounded-[32px] border border-border shadow-sm">
          <div className="relative flex-1 w-full box-border">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className={`${inputClass} pl-11`}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Toggles */}
            <div className="flex items-center bg-muted/50 p-1 rounded-2xl border border-border">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === "table"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Vista Tabla"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <div className="h-8 w-px bg-border mx-1 hidden sm:block" />

            <button
              onClick={() => setIsGrouped(!isGrouped)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border ${
                isGrouped
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-background text-muted-foreground border-border hover:border-border/80"
              }`}
            >
              <SortAsc className="w-4 h-4" />
              {isGrouped ? "Agrupado" : "Agrupar A-Z"}
            </button>

            <button
              onClick={handleSelectAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-background text-muted-foreground font-bold text-xs hover:border-primary/20 hover:text-primary transition-all border border-border"
            >
              {filteredFeatures &&
              filteredFeatures.length > 0 &&
              filteredFeatures.every((f) => selectedIds.includes(f._id))
                ? "Desmarcar"
                : "Todo"}
            </button>
          </div>
        </div>

        {/* Features Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-3xl bg-background border border-border animate-pulse flex items-center justify-center p-6 gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-muted shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-3/4 bg-muted rounded" />
                  <div className="h-2 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredFeatures && filteredFeatures.length > 0 ? (
          <div className="space-y-8">
            {viewMode === "grid" ? (
              isGrouped ? (
                groupedFeatures?.map((group) => (
                  <div key={group.letter} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-black text-foreground w-8">
                        {group.letter}
                      </h2>
                      <div className="h-px bg-border flex-1" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {group.items.map((feature) => (
                        <FeatureCard
                          key={feature._id}
                          feature={feature}
                          isSelected={selectedIds.includes(feature._id)}
                          onSelect={() => toggleSelect(feature._id)}
                          onEdit={() => {
                            setEditingFeature(feature);
                            setEditName(feature.name);
                            setEditEmoji(feature.emoji || "");
                            setEditIconFile(null);
                          }}
                          onDelete={() => setDeletingFeature(feature)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredFeatures.map((feature) => (
                    <FeatureCard
                      key={feature._id}
                      feature={feature}
                      isSelected={selectedIds.includes(feature._id)}
                      onSelect={() => toggleSelect(feature._id)}
                      onEdit={() => {
                        setEditingFeature(feature);
                        setEditName(feature.name);
                        setEditEmoji(feature.emoji || "");
                        setEditIconFile(null);
                      }}
                      onDelete={() => setDeletingFeature(feature)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="bg-background rounded-[40px] border border-border shadow-xl shadow-muted/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-16">
                          Sel.
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-20">
                          Icono
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          Nombre
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right pr-12">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredFeatures.map((feature) => (
                        <tr
                          key={feature._id}
                          onClick={() => toggleSelect(feature._id)}
                          className={`group hover:bg-primary/5 transition-colors cursor-pointer ${
                            selectedIds.includes(feature._id)
                              ? "bg-primary/10"
                              : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div
                              className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                selectedIds.includes(feature._id)
                                  ? "bg-primary border-primary"
                                  : "bg-background border-border group-hover:border-primary/50"
                              }`}
                            >
                              {selectedIds.includes(feature._id) && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-border/50 flex items-center justify-center p-2 group-hover:scale-110 transition-transform shadow-xs">
                              {feature.iconUrl ? (
                                <img
                                  src={feature.iconUrl}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                              ) : feature.emoji ? (
                                <span className="text-xl">{feature.emoji}</span>
                              ) : (
                                <Sparkles className="w-4 h-4 text-primary/60" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {feature.emoji && (
                                <span className="text-lg">{feature.emoji}</span>
                              )}
                              <span className="font-bold text-sm text-foreground">
                                {feature.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFeature(feature);
                                  setEditName(feature.name);
                                  setEditEmoji(feature.emoji || "");
                                  setEditIconFile(null);
                                }}
                                className="p-2.5 rounded-xl bg-background border border-border text-muted-foreground/50 hover:text-blue-500 hover:border-blue-500/50 hover:shadow-lg transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingFeature(feature);
                                }}
                                className="p-2.5 rounded-xl bg-background border border-border text-muted-foreground/50 hover:text-red-500 hover:border-red-500/50 hover:shadow-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 rounded-[40px] border-2 border-dashed border-border bg-muted/20">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground">
              {search
                ? "Sin resultados para la búsqueda"
                : "No hay features registradas aún"}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Crea tu primera feature con el botón de arriba
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent className="rounded-3xl max-w-md bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black tracking-tight">
              Nueva Feature
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Agrega una característica al catálogo con su icono SVG.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3">
                <label className={labelClass}>Nombre</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={inputClass}
                  placeholder="Ej: Piscina"
                />
              </div>
              <div className="col-span-1">
                <label className={labelClass}>Emoji</label>
                <input
                  type="text"
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  className={`${inputClass} text-center text-xl`}
                  placeholder=""
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Icono SVG</label>
              <label className="flex flex-col items-center justify-center gap-2 w-full p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all">
                <input
                  type="file"
                  accept=".svg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && !file.name.toLowerCase().endsWith(".svg")) {
                      sileo.error({
                        title: "El archivo debe ser .svg",
                        fill: "#fee2e2",
                      });
                      return;
                    }
                    setNewIconFile(file);
                  }}
                />
                {newIconFile ? (
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <ImageIcon className="w-5 h-5" />
                    {newIconFile.name}
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground/30" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Seleccionar SVG
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-border hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Crear Feature
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Upload Dialog ── */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent className="rounded-3xl max-w-md bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black tracking-tight">
              Carga Masiva de Features
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Sube múltiples archivos SVG. El nombre de cada feature se toma del
              nombre del archivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label
              className="flex flex-col items-center justify-center gap-3 w-full p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/10 cursor-pointer transition-all"
              onClick={() => bulkInputRef.current?.click()}
            >
              <input
                ref={bulkInputRef}
                type="file"
                accept=".svg"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    const files = Array.from(e.target.files).filter((f) =>
                      f.name.toLowerCase().endsWith(".svg"),
                    );
                    setBulkFiles(files);
                  }
                }}
              />
              <Upload className="w-8 h-8 text-muted-foreground/30" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Seleccionar archivos SVG
              </span>
            </label>
            {bulkFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">
                  {bulkFiles.length} archivos seleccionados
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 px-1">
                  {bulkFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-foreground bg-muted rounded-xl px-3 py-2"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <button
                        onClick={() =>
                          setBulkFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="ml-auto text-muted-foreground/50 hover:text-red-500 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-border hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <button
              onClick={handleBulk}
              disabled={bulkMutation.isPending || bulkFiles.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {bulkMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Subir {bulkFiles.length} archivos
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Dialog ── */}
      <AlertDialog
        open={!!editingFeature}
        onOpenChange={(open) => !open && setEditingFeature(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-md bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black tracking-tight">
              Editar Feature
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Modifica el nombre y/o el icono SVG de la feature.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3">
                <label className={labelClass}>Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="col-span-1">
                <label className={labelClass}>Emoji</label>
                <input
                  type="text"
                  value={editEmoji}
                  onChange={(e) => setEditEmoji(e.target.value)}
                  className={`${inputClass} text-center text-xl`}
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>
                Icono SVG (Opcional, reemplaza el actual)
              </label>
              <label className="flex flex-col items-center justify-center gap-2 w-full p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/10 cursor-pointer transition-all">
                <input
                  type="file"
                  accept=".svg"
                  className="hidden"
                  onChange={(e) => setEditIconFile(e.target.files?.[0] || null)}
                />
                {editIconFile ? (
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <ImageIcon className="w-5 h-5" />
                    {editIconFile.name}
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground/30" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Cambiar icono SVG
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-border hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {updateMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Guardar Cambios
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog
        open={!!deletingFeature}
        onOpenChange={(open) => !open && setDeletingFeature(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-md bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">
              Eliminar &quot;{deletingFeature?.name}&quot;
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si la feature está vinculada a
              alguna finca, la eliminación fallará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-border hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500! hover:bg-red-600! text-white rounded-xl"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FeatureCard({
  feature,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  feature: IconographyItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col items-center justify-center gap-4 p-8 rounded-[38px] bg-background border transition-all duration-500 cursor-pointer overflow-hidden ${
        isSelected
          ? "border-primary shadow-2xl shadow-primary/10 ring-2 ring-primary/20 translate-y-[-4px]"
          : "border-border shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 hover:translate-y-[-4px]"
      }`}
    >
      {/* Background Micro-animation element */}
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 blur-2xl" />

      {/* Selection indicator */}
      <div
        className={`absolute top-5 left-5 w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
          isSelected
            ? "bg-primary border-primary rotate-0 scale-100"
            : "bg-background border-border opacity-0 group-hover:opacity-100 -rotate-12 scale-90"
        }`}
      >
        {isSelected && (
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
        )}
      </div>

      {/* Icon Container */}
      <div
        className={`w-20 h-20 rounded-[28px] flex items-center justify-center p-4 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm ${
          isSelected
            ? "bg-white ring-4 ring-primary/20"
            : "bg-white border border-border group-hover:border-primary/20 group-hover:shadow-lg group-hover:shadow-primary/5"
        }`}
      >
        {feature.iconUrl ? (
          <img
            src={feature.iconUrl}
            alt={feature.name}
            className="w-full h-full object-contain"
          />
        ) : feature.emoji ? (
          <span className="text-5xl selection:bg-transparent drop-shadow-sm">
            {feature.emoji}
          </span>
        ) : (
          <Sparkles className="w-8 h-8 text-primary/60" />
        )}
      </div>

      {/* Info */}
      <div className="space-y-1 w-full text-center relative z-10">
        <h3 className="font-semibold text-sm text-foreground line-clamp-1 px-1 tracking-tight">
          {feature.name || (
            <span className="text-muted-foreground/30 italic">Sin nombre</span>
          )}
        </h3>
        {feature.emoji && (
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            {feature.emoji} ICON
          </p>
        )}
      </div>

      {/* Actions overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 md:translate-x-2 group-hover:translate-x-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-2.5 rounded-2xl bg-background border border-border text-muted-foreground/50 hover:text-blue-500 hover:border-blue-500/30 shadow-xl transition-all active:scale-95"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2.5 rounded-2xl bg-background border border-border text-muted-foreground/50 hover:text-red-500 hover:border-red-500/30 shadow-xl transition-all active:scale-95"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
