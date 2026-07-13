"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, MapPin, Users, Trash2, Loader2, Video } from "lucide-react";
import { useDeleteProperty } from "@/features/fincas/queries/fincas.queries";
import type { PropertyResponse } from "@/features/fincas/types/fincas.types";
import { useState } from "react";
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
import { sileo } from "sileo";
import { getErrorMessage } from "@/lib/error-utils";

interface PropertiesTableProps {
  properties: PropertyResponse[];
  isLoading: boolean;
}

export function PropertiesTable({
  properties,
  isLoading,
}: PropertiesTableProps) {
  const router = useRouter();
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const deleteMutation = useDeleteProperty();

  const handleDelete = async () => {
    if (!propertyToDelete) return;
    try {
      await deleteMutation.mutateAsync(propertyToDelete);
      sileo.success({
        title: "Propiedad eliminada correctamente",
        fill: "#f0fdf4",
      });
    } catch (error) {
      sileo.error({
        title: "Error al eliminar la propiedad",
        description: getErrorMessage(error),
        fill: "#fee2e2",
      });
    } finally {
      setPropertyToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="divide-y divide-border/40">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="w-14 h-10 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!properties?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <MapPin className="w-7 h-7 text-muted-foreground/30" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          No se encontraron propiedades
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Intenta con otro término de búsqueda
        </p>
      </div>
    );
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <div className="bg-background/50 backdrop-blur-sm">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-[80px_2fr_1.2fr_100px_160px_120px] gap-4 px-8 py-5 bg-muted/30 border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        <span>Imagen</span>
        <span>Propiedad & Detalles</span>
        <span>Ubicación</span>
        <span className="text-center">Capacidad</span>
        <span className="text-right">Tarifa / noche</span>
        <span className="text-right pr-4">Acciones</span>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border/50">
        {properties.map((property) => (
          <div
            key={property.id}
            onClick={() => router.push(`/admin/properties/${property.id}/edit`)}
            className={`flex flex-col md:grid md:grid-cols-[80px_2fr_1.2fr_100px_160px_120px] gap-4 md:gap-4 items-start md:items-center px-6 md:px-8 py-6 hover:bg-primary/5 transition-all group relative border-l-4 border-l-transparent hover:border-l-primary cursor-pointer ${property.active === false ? "opacity-60" : ""}`}
          >
            {/* Mobile Header (Image + Title + Edit Button) */}
            <div className="flex w-full md:hidden gap-4 items-center mb-2">
              <div className="w-14 h-10 rounded-lg overflow-hidden bg-muted shrink-0 shadow-sm ring-1 ring-border">
                {property.images?.[0] ? (
                  <Image
                    src={property.images[0]}
                    alt={property.title}
                    width={56}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-[8px] font-bold">
                    S/I
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/admin/properties/${property.id}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-xs text-foreground truncate block tracking-tight leading-tight"
                >
                  {property.title}
                </Link>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[8px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded-full tracking-widest uppercase">
                    Verificada
                  </span>
                  {property.active === false && (
                    <span className="text-[8px] font-black text-white bg-muted-foreground/50 px-1.5 py-0.5 rounded-full tracking-widest uppercase">
                      Inactiva
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/admin/properties/${property.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-primary bg-primary/10 shadow-sm active:scale-95 shrink-0"
              >
                <Pencil className="w-4 h-4" />
              </Link>
            </div>

            {/* Desktop Image */}
            <div className="w-16 h-12 rounded-xl overflow-hidden bg-muted shrink-0 hidden md:block shadow-md ring-1 ring-border group-hover:scale-110 transition-all duration-500 group-hover:shadow-primary/20">
              {property.images?.[0] ? (
                <Image
                  src={property.images[0]}
                  alt={property.title}
                  width={64}
                  height={48}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-[10px] font-bold">
                  S/I
                </div>
              )}
            </div>

            {/* Desktop Name & Details */}
            <div className="min-w-0 hidden md:block">
              <Link
                href={`/admin/properties/${property.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors block tracking-tight"
              >
                {property.title}
              </Link>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-semibold text-white bg-emerald-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm">
                  Verificada
                </span>
                {property.active === false && (
                  <span className="text-[9px] font-semibold text-white bg-muted-foreground/50 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm">
                    Inactiva
                  </span>
                )}
                {property.rating > 4.5 && (
                  <span className="text-[9px] font-semibold text-white bg-amber-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm">
                    Premium
                  </span>
                )}
                {property.video && (
                  <span className="text-[9px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm flex items-center gap-1">
                    <Video className="w-2 h-2" />
                    Video
                  </span>
                )}
              </div>
            </div>

            {/* Location (Shared with mobile refinements) */}
            <div className="flex items-center gap-3 md:gap-2 max-md:hidden text-xs font-semibold text-muted-foreground min-w-0 w-full md:w-auto mt-2 md:mt-0">
              <div className="w-8 h-8 rounded-xl bg-muted/50 md:group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                <MapPin className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
              <span className="truncate group-hover:text-foreground transition-colors">
                {property.location}
              </span>
            </div>

            {/* Capacity & Price (Flex container for mobile) */}
            <div className="flex items-center justify-between w-full md:contents gap-4 mt-3 md:mt-0">
              {/* Capacity */}
              <div className="flex items-center md:justify-center">
                <div className="flex items-center gap-2 bg-muted/50 md:group-hover:bg-background px-3 py-2 rounded-xl ring-1 ring-border transition-all">
                  <Users className="w-4 h-4 text-muted-foreground/50" />
                  <span className="text-sm font-bold text-foreground/80">
                    {property.capacity}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="text-right">
                <p className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {formatPrice(
                    property.priceBase ??
                      property.seasonPrices?.base ??
                      property.price ??
                      0,
                  )}
                </p>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Temporada Base
                </p>
              </div>
            </div>

            {/* Desktop Action buttons */}
            <div className="hidden md:flex justify-end gap-2 pr-2">
              <Link
                href={`/admin/properties/${property.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="w-11 h-11 flex items-center justify-center rounded-2xl text-muted-foreground/50 hover:text-white hover:bg-primary transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-lg hover:shadow-primary/20 active:scale-95 shrink-0"
              >
                <Pencil className="w-5 h-5" />
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPropertyToDelete(property.id!);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-2xl text-muted-foreground/50 hover:text-white hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-lg hover:shadow-red-200 active:scale-95 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={!!propertyToDelete}
        onOpenChange={(open) => !open && setPropertyToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              la propiedad y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-500! hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Sí, eliminar propiedad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
