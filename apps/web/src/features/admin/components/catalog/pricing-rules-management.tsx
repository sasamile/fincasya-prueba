"use client";

import { useState } from "react";
import { sileo } from "sileo";
import {
  useGlobalPricingRules,
  useCreateGlobalPricingRule,
  useUpdateGlobalPricingRule,
  useDeleteGlobalPricingRule,
} from "@/features/fincas/queries/global-pricing.queries";
import { GlobalPricingRule } from "@/features/fincas/types/fincas.types";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
  Search,
  X,
  Calendar,
  CalendarRange,
  CheckCircle2,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PricingRulesManagement() {
  const { data: rules, isLoading } = useGlobalPricingRules();
  const createMutation = useCreateGlobalPricingRule();
  const updateMutation = useUpdateGlobalPricingRule();
  const deleteMutation = useDeleteGlobalPricingRule();

  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<GlobalPricingRule | null>(
    null,
  );
  const [deletingRule, setDeletingRule] = useState<GlobalPricingRule | null>(
    null,
  );

  // Form states
  const [formData, setFormData] = useState({
    nombre: "",
    type: "range" as "range" | "days",
    fechaDesde: "",
    fechaHasta: "",
    fechas: "" as string, // Comma separated for input
    activa: true,
  });

  const filteredRules = rules?.filter((r) =>
    r.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  const resetForm = () => {
    setFormData({
      nombre: "",
      type: "range",
      fechaDesde: "",
      fechaHasta: "",
      fechas: "",
      activa: true,
    });
  };

  const handleCreate = async () => {
    if (!formData.nombre.trim()) {
      sileo.error({ title: "El nombre es obligatorio", fill: "#fee2e2" });
      return;
    }

    try {
      const payload: any = {
        nombre: formData.nombre.trim(),
        activa: formData.activa,
      };

      if (formData.type === "range") {
        if (!formData.fechaDesde || !formData.fechaHasta) {
          sileo.error({
            title: "Debes ingresar ambas fechas del rango",
            fill: "#fee2e2",
          });
          return;
        }
        payload.fechaDesde = formData.fechaDesde;
        payload.fechaHasta = formData.fechaHasta;
      } else {
        if (!formData.fechas.trim()) {
          sileo.error({
            title: "Debes ingresar al menos una fecha",
            fill: "#fee2e2",
          });
          return;
        }
        payload.fechas = formData.fechas
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
      }

      await createMutation.mutateAsync(payload);
      sileo.success({ title: "Regla global creada", fill: "#f0fdf4" });
      setShowCreateDialog(false);
      resetForm();
    } catch (e: any) {
      sileo.error({
        title: "Error al crear la regla",
        description: e.message,
        fill: "#fee2e2",
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingRule) return;
    if (!formData.nombre.trim()) {
      sileo.error({ title: "El nombre es obligatorio", fill: "#fee2e2" });
      return;
    }

    try {
      const payload: any = {
        nombre: formData.nombre.trim(),
        activa: formData.activa,
        // Reset old values
        fechaDesde: undefined,
        fechaHasta: undefined,
        fechas: undefined,
      };

      if (formData.type === "range") {
        payload.fechaDesde = formData.fechaDesde;
        payload.fechaHasta = formData.fechaHasta;
      } else {
        payload.fechas = formData.fechas
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
      }

      await updateMutation.mutateAsync({ id: editingRule._id, payload });
      sileo.success({ title: "Regla actualizada", fill: "#f0fdf4" });
      setEditingRule(null);
      resetForm();
    } catch (e: any) {
      sileo.error({
        title: "Error al actualizar la regla",
        description: e.message,
        fill: "#fee2e2",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    try {
      await deleteMutation.mutateAsync(deletingRule._id);
      sileo.success({ title: "Regla eliminada", fill: "#f0fdf4" });
      setDeletingRule(null);
    } catch (e: any) {
      sileo.error({
        title: "Error al eliminar la regla",
        description: e.message,
        fill: "#fee2e2",
      });
    }
  };

  const openEdit = (rule: GlobalPricingRule) => {
    setEditingRule(rule);
    setFormData({
      nombre: rule.nombre,
      type: rule.fechas && rule.fechas.length > 0 ? "days" : "range",
      fechaDesde: rule.fechaDesde || "",
      fechaHasta: rule.fechaHasta || "",
      fechas: (rule.fechas || []).join(", "),
      activa: rule.activa,
    });
  };

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-1";

  return (
    <div className="p-4 md:p-8 lg:p-10 bg-transparent min-h-[calc(100vh-4rem)] relative">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-linear-to-br from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent">
              Reglas de Precios Globales
            </h1>
            <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
              Temporadas y fechas aplicables a todas las fincas
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nueva Regla
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-background/50 backdrop-blur-md p-4 rounded-[32px] border border-border shadow-sm">
          <div className="relative flex-1 w-full box-border">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium"
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
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-3xl bg-background border border-border animate-pulse"
              />
            ))}
          </div>
        ) : filteredRules && filteredRules.length > 0 ? (
          <div className="bg-background rounded-[40px] border border-border shadow-xl shadow-muted/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Nombre
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Tipo
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Fechas (MM-DD)
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Estado
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRules.map((rule) => (
                    <tr
                      key={rule._id}
                      className="group hover:bg-primary/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-bold text-sm text-foreground">
                          {rule.nombre}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {rule.fechas && rule.fechas.length > 0 ? (
                            <>
                              <Calendar className="w-4 h-4 text-blue-500" />
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                Días Específicos
                              </span>
                            </>
                          ) : (
                            <>
                              <CalendarRange className="w-4 h-4 text-orange-500" />
                              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                                Rango
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground font-mono">
                          {rule.fechas && rule.fechas.length > 0
                            ? rule.fechas.slice(0, 3).join(", ") +
                              (rule.fechas.length > 3 ? "..." : "")
                            : `${rule.fechaDesde} → ${rule.fechaHasta}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {rule.activa ? (
                          <div className="flex items-center gap-1.5 text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full w-fit border border-green-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              Activa
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted px-2.5 py-1 rounded-full w-fit border border-border">
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              Inactiva
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(rule)}
                            className="p-2 rounded-xl bg-background border border-border text-muted-foreground/50 hover:text-primary hover:border-primary/50 transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingRule(rule)}
                            className="p-2 rounded-xl bg-background border border-border text-muted-foreground/50 hover:text-red-500 hover:border-red-500/50 transition-all"
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
        ) : (
          <div className="text-center py-20 rounded-[40px] border-2 border-dashed border-border bg-muted/20">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground">
              {search
                ? "Sin resultados para la búsqueda"
                : "No hay reglas globales registradas"}
            </p>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingRule}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingRule(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="rounded-[40px] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border border-border bg-background shadow-2xl">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
              {editingRule ? "Editar Regla Global" : "Nueva Regla de Temporada"}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              Configura el nombre y las fechas (MM-DD) para esta temporada.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 scrollbar-hide">
            <div>
              <label className={labelClass}>Nombre de la Temporada</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                className={inputClass}
                placeholder="Ej: Semana Santa"
              />
            </div>

            <div className="space-y-4">
              <label className={labelClass}>Tipo de Configuración</label>
              <div className="flex bg-muted p-1.5 rounded-[22px] gap-1.5 border border-border">
                <button
                  onClick={() => setFormData({ ...formData, type: "range" })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] border transition-all text-xs font-bold ${
                    formData.type === "range"
                      ? "bg-background border-border text-foreground shadow-sm"
                      : "bg-transparent border-transparent text-muted-foreground"
                  }`}
                >
                  <CalendarRange className="w-4 h-4" />
                  Rango de Fechas
                </button>
                <button
                  onClick={() => setFormData({ ...formData, type: "days" })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] border transition-all text-xs font-bold ${
                    formData.type === "days"
                      ? "bg-background border-border text-foreground shadow-sm"
                      : "bg-transparent border-transparent text-muted-foreground"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Días Específicos
                </button>
              </div>
            </div>

            {formData.type === "range" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Desde (MM-DD)</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-bold rounded-2xl h-14 border-border bg-background hover:bg-muted text-foreground text-xs",
                          !formData.fechaDesde && "text-muted-foreground",
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-primary" />
                        {formData.fechaDesde ? (
                          format(
                            new Date(
                              `${new Date().getFullYear()}-${formData.fechaDesde}T00:00:00`,
                            ),
                            "MM-dd",
                            { locale: es },
                          )
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        locale={es}
                        disabled={(date) =>
                          formData.fechaHasta
                            ? date >
                              new Date(
                                `${new Date().getFullYear()}-${formData.fechaHasta}T00:00:00`,
                              )
                            : false
                        }
                        selected={
                          formData.fechaDesde
                            ? new Date(
                                `${new Date().getFullYear()}-${formData.fechaDesde}T00:00:00`,
                              )
                            : undefined
                        }
                        onSelect={(date) =>
                          setFormData({
                            ...formData,
                            fechaDesde: date ? format(date, "MM-dd") : "",
                          })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Hasta (MM-DD)</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-bold rounded-2xl h-14 border-gray-100 bg-white hover:bg-gray-50 text-xs",
                          !formData.fechaHasta && "text-muted-foreground",
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-orange-500" />
                        {formData.fechaHasta ? (
                          format(
                            new Date(
                              `${new Date().getFullYear()}-${formData.fechaHasta}T00:00:00`,
                            ),
                            "MM-dd",
                            { locale: es },
                          )
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        locale={es}
                        disabled={(date) =>
                          formData.fechaDesde
                            ? date <
                              new Date(
                                `${new Date().getFullYear()}-${formData.fechaDesde}T00:00:00`,
                              )
                            : false
                        }
                        selected={
                          formData.fechaHasta
                            ? new Date(
                                `${new Date().getFullYear()}-${formData.fechaHasta}T00:00:00`,
                              )
                            : undefined
                        }
                        onSelect={(date) =>
                          setFormData({
                            ...formData,
                            fechaHasta: date ? format(date, "MM-dd") : "",
                          })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Lista de Fechas (MM-DD)</label>
                <div className="bg-background rounded-[32px] border border-border p-4 shadow-sm">
                  <CalendarPicker
                    mode="multiple"
                    locale={es}
                    selected={
                      formData.fechas
                        ? formData.fechas
                            .split(",")
                            .map((d) => {
                              const trimmed = d.trim();
                              if (!trimmed) return undefined;
                              const parts = trimmed.split("-");
                              if (parts.length >= 2) {
                                const month = parseInt(parts[parts.length - 2]);
                                const day = parseInt(parts[parts.length - 1]);
                                return new Date(
                                  new Date().getFullYear(),
                                  month - 1,
                                  day,
                                );
                              }
                              return undefined;
                            })
                            .filter(
                              (d): d is Date =>
                                d !== undefined && !isNaN(d.getTime()),
                            )
                        : []
                    }
                    onSelect={(dates) => {
                      setFormData({
                        ...formData,
                        fechas: (dates || [])
                          .map((d) => format(d, "MM-dd"))
                          .sort()
                          .join(", "),
                      });
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-muted border border-border rounded-[24px]">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">
                  Activar regla
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Habilitar esta regla en las propiedades
                </span>
              </div>
              <button
                onClick={() =>
                  setFormData({ ...formData, activa: !formData.activa })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.activa ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.activa ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter className="p-8 pt-4 bg-muted border-t border-border rounded-b-[40px] gap-3">
            <Button
              variant="outline"
              className="rounded-2xl h-12 px-8 font-bold text-muted-foreground border-border bg-background hover:bg-muted shadow-sm"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingRule(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <button
              onClick={editingRule ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 min-w-[160px]"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {editingRule ? "Guardar Cambios" : "Crear Regla"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-red-500">
              ¿Eliminar Regla?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Esta acción no se puede deshacer. Las fincas vinculadas a esta
              regla dejarán de aplicarla automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl flex-1 border-border hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all flex-1"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Eliminar"
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
