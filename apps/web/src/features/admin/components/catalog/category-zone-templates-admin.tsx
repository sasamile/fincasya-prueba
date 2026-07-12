"use client";

import { useMemo, useState, useCallback } from "react";
import { useIconography } from "@/features/admin/queries/features.queries";
import {
  useAddCategoryZoneTemplateFeature,
  useAllCategoryZoneTemplates,
  useCreateCategoryZoneTemplate,
  useDeleteCategoryZoneTemplate,
  useDeleteCategoryZoneTemplateFeature,
  useUpdateCategoryZoneTemplate,
  useUpdateCategoryZoneTemplateFeature,
} from "@/features/admin/queries/category-zone-templates.queries";
import type { CategoryZoneTemplateFeature } from "@/features/admin/queries/category-zone-templates.queries";
import type { IconographyItem } from "@/features/admin/types/features.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { sileo } from "sileo";
import {
  Loader2,
  Plus,
  Trash2,
  LayoutGrid,
  Pencil,
  X,
  Search,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

function IconCell({
  item,
  size = "md",
}: {
  item: Pick<IconographyItem, "emoji" | "iconUrl" | "name">;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-10 w-10" : "h-8 w-8";
  return (
    <div
      className={cn(
        box,
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background p-1.5 shadow-xs ring-1 ring-primary/15",
      )}
    >
      {item.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.iconUrl}
          alt=""
          className="h-full w-full object-contain"
        />
      ) : item.emoji ? (
        <span className="text-xl leading-none">{item.emoji}</span>
      ) : (
        <span className="text-[9px] text-muted-foreground">—</span>
      )}
    </div>
  );
}

type CatalogDialogState =
  | {
      open: true;
      zoneTemplateId: string;
      featureId: string | null;
      iconographyId: string | null;
      alias: string;
      /** Texto del input; al guardar se valida ≥1. */
      quantityInput: string;
      search: string;
    }
  | { open: false };

export function CategoryZoneTemplatesAdmin() {
  const { data: iconography = [], isLoading: iconsLoading } = useIconography();
  const { data: templates, isLoading } = useAllCategoryZoneTemplates();

  const createTpl = useCreateCategoryZoneTemplate();
  const updateTpl = useUpdateCategoryZoneTemplate();
  const deleteTpl = useDeleteCategoryZoneTemplate();
  const addFeat = useAddCategoryZoneTemplateFeature();
  const updateFeat = useUpdateCategoryZoneTemplateFeature();
  const deleteFeat = useDeleteCategoryZoneTemplateFeature();

  const [newZoneName, setNewZoneName] = useState("");
  const [catalogDialog, setCatalogDialog] = useState<CatalogDialogState>({
    open: false,
  });

  const sortedIcons = useMemo(
    () => [...iconography].sort((a, b) => a.name.localeCompare(b.name)),
    [iconography],
  );

  const handleCreateZone = async () => {
    const n = newZoneName.trim();
    if (!n) return;
    try {
      await createTpl.mutateAsync({ name: n });
      setNewZoneName("");
      sileo.success({ title: "Zona creada", fill: "#f0fdf4" });
    } catch {
      sileo.error({ title: "No se pudo crear la zona", fill: "#fee2e2" });
    }
  };

  const openAddDialog = useCallback((zoneTemplateId: string) => {
    setCatalogDialog({
      open: true,
      zoneTemplateId,
      featureId: null,
      iconographyId: null,
      alias: "",
      quantityInput: "1",
      search: "",
    });
  }, []);

  const openEditDialog = useCallback(
    (zoneTemplateId: string, f: CategoryZoneTemplateFeature) => {
      setCatalogDialog({
        open: true,
        zoneTemplateId,
        featureId: f._id,
        iconographyId: f.iconographyId,
        alias: f.alias ?? "",
        quantityInput:
          f.quantity != null && Number(f.quantity) >= 1
            ? String(Math.floor(Number(f.quantity)))
            : "1",
        search: "",
      });
    },
    [],
  );

  const closeCatalogDialog = useCallback(() => {
    setCatalogDialog({ open: false });
  }, []);

  const saveCatalogDialog = async () => {
    if (!catalogDialog.open) return;
    const { zoneTemplateId, featureId, iconographyId, alias, quantityInput } =
      catalogDialog;
    const quantity = Math.max(
      1,
      Math.floor(Number.parseInt(quantityInput.trim(), 10) || 1),
    );
    if (!iconographyId) {
      sileo.error({
        title: "Elige un ícono del catálogo",
        fill: "#fee2e2",
      });
      return;
    }
    try {
      if (featureId) {
        await updateFeat.mutateAsync({
          id: featureId,
          body: {
            iconographyId,
            alias: alias.trim() || undefined,
            quantity,
          },
        });
      } else {
        await addFeat.mutateAsync({
          zoneTemplateId,
          body: {
            iconographyId,
            alias: alias.trim() || undefined,
            quantity,
          },
        });
      }
      closeCatalogDialog();
      sileo.success({ title: "Listo", fill: "#f0fdf4" });
    } catch {
      sileo.error({ title: "No se pudo guardar", fill: "#fee2e2" });
    }
  };

  const filteredForDialog = useMemo(() => {
    if (!catalogDialog.open) return [];
    const q = catalogDialog.search.trim().toLowerCase();
    if (!q) return sortedIcons;
    return sortedIcons.filter((i) => i.name.toLowerCase().includes(q));
  }, [catalogDialog, sortedIcons]);

  const dialogBusy = addFeat.isPending || updateFeat.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Plantillas de zona
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Misma idea que en la ficha de la finca: tarjetas por amenidad y un
          bloque punteado para añadir desde el catálogo global (con alias
          opcional).
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex w-full flex-1 gap-2">
          <Input
            placeholder="Nombre de la nueva zona (ej. Exteriores)"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            className="h-12 rounded-2xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateZone();
            }}
          />
          <Button
            type="button"
            className="h-12 shrink-0 rounded-2xl px-5"
            onClick={() => void handleCreateZone()}
            disabled={createTpl.isPending || !newZoneName.trim()}
          >
            {createTpl.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                Zona
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading || iconsLoading ? (
        <div className="flex justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      ) : (
        <div className="space-y-8">
          {(templates || []).map((tpl) => (
            <div
              key={tpl._id}
              className="rounded-[28px] border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black uppercase tracking-[0.2em] text-foreground">
                      {tpl.name}
                    </h2>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tpl.features.length}{" "}
                      {tpl.features.length === 1
                        ? "característica"
                        : "características"}{" "}
                      en plantilla
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    defaultValue={tpl.name}
                    className="h-9 max-w-[200px] rounded-xl text-sm"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === tpl.name) return;
                      void updateTpl.mutateAsync({
                        id: tpl._id,
                        body: { name: v },
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      if (
                        !confirm(
                          "¿Eliminar esta zona y todas sus características de plantilla?",
                        )
                      )
                        return;
                      void deleteTpl.mutateAsync({ id: tpl._id });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {tpl.features.length === 0 ? (
                  <p className="w-full py-2 text-sm italic text-muted-foreground">
                    Aún no hay características en esta zona.
                  </p>
                ) : (
                  tpl.features.map((f) => {
                    const icon = sortedIcons.find(
                      (i) => i._id === f.iconographyId,
                    );
                    const label = (
                      f.alias?.trim() ||
                      icon?.name ||
                      "Sin nombre"
                    ).toUpperCase();
                    return (
                      <div
                        key={f._id}
                        className="group relative flex min-w-[76px] max-w-[104px] flex-col items-center justify-center rounded-2xl border border-border bg-muted/40 p-2 text-foreground shadow-sm transition-all hover:border-primary/35 hover:bg-muted/60"
                      >
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() => openEditDialog(tpl._id, f)}
                          className="absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-primary opacity-0 shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-white group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Quitar"
                          onClick={() =>
                            void deleteFeat.mutateAsync({
                              id: f._id,
                            })
                          }
                          className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-primary opacity-0 shadow-sm transition-all hover:border-destructive hover:bg-destructive hover:text-white group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {icon ? (
                          <IconCell item={icon} />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-[10px] text-muted-foreground">
                            ?
                          </div>
                        )}
                        <span className="mt-1.5 w-full truncate px-0.5 text-center text-[10px] font-black uppercase leading-tight tracking-wider">
                          {label}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground">
                          Cant. {f.quantity != null && f.quantity >= 1 ? f.quantity : 1}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                disabled={iconsLoading}
                onClick={() => openAddDialog(tpl._id)}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-transparent text-muted-foreground transition-all hover:border-primary/45 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                  Agregar característica ({tpl.features.length})
                </span>
              </button>
            </div>
          ))}
          {templates?.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay plantillas de zona. Crea la primera arriba.
            </p>
          )}
        </div>
      )}

      <Dialog
        open={catalogDialog.open}
        onOpenChange={(o) => !o && closeCatalogDialog()}
      >
        <DialogContent className="flex! min-h-0 max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-[28px] border-none p-0 shadow-2xl">
          <DialogHeader className="shrink-0 bg-primary p-6 text-white md:p-8">
            <DialogTitle className="flex items-center gap-3 text-xl font-black tracking-tight text-white md:text-2xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shadow-lg shadow-black/10">
                <ListChecks className="h-6 w-6" />
              </span>
              {catalogDialog.open && catalogDialog.featureId
                ? "Editar característica"
                : "Elegir del catálogo"}
            </DialogTitle>
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <Input
                placeholder="Buscar por nombre…"
                className="h-12 rounded-2xl border-white/20 bg-white/10 pl-11 text-white placeholder:text-white/55 focus-visible:ring-white/30"
                value={catalogDialog.open ? catalogDialog.search : ""}
                onChange={(e) =>
                  catalogDialog.open &&
                  setCatalogDialog({
                    ...catalogDialog,
                    search: e.target.value,
                  })
                }
              />
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 pt-4 md:px-6">
            <div className="mb-4 grid shrink-0 gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Alias (opcional)
                </label>
                <Input
                  placeholder="Ej. Baño social"
                  className="h-11 rounded-2xl"
                  value={catalogDialog.open ? catalogDialog.alias : ""}
                  onChange={(e) =>
                    catalogDialog.open &&
                    setCatalogDialog({
                      ...catalogDialog,
                      alias: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Cantidad
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 rounded-2xl text-center"
                  value={catalogDialog.open ? catalogDialog.quantityInput : ""}
                  onChange={(e) => {
                    if (!catalogDialog.open) return;
                    const raw = e.target.value.replace(/\D/g, "");
                    setCatalogDialog({ ...catalogDialog, quantityInput: raw });
                  }}
                  onBlur={() => {
                    if (!catalogDialog.open) return;
                    if (catalogDialog.quantityInput.trim() === "")
                      setCatalogDialog({
                        ...catalogDialog,
                        quantityInput: "1",
                      });
                  }}
                />
              </div>
            </div>
            <p className="mb-2 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Ícono del catálogo
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
              <div className="grid grid-cols-3 gap-2 pb-4 sm:grid-cols-4 md:grid-cols-5">
                {filteredForDialog.map((item) => {
                  const selected =
                    catalogDialog.open &&
                    catalogDialog.iconographyId === item._id;
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() =>
                        catalogDialog.open &&
                        setCatalogDialog({
                          ...catalogDialog,
                          iconographyId: item._id,
                        })
                      }
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-all",
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                          : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                      )}
                    >
                      <IconCell item={item} size="sm" />
                      <span className="line-clamp-2 w-full text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-foreground">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="relative z-20 shrink-0 gap-2 border-t border-border bg-background px-4 py-4 shadow-[0_-12px_24px_-8px_rgba(0,0,0,0.08)] sm:justify-end md:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-border bg-background px-5 shadow-sm"
              onClick={closeCatalogDialog}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              className="h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground shadow-sm"
              disabled={
                dialogBusy ||
                !catalogDialog.open ||
                !catalogDialog.iconographyId
              }
              onClick={() => void saveCatalogDialog()}
            >
              {dialogBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : catalogDialog.open && catalogDialog.featureId ? (
                "Guardar"
              ) : (
                "Añadir a la zona"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
