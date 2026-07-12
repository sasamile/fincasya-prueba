"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useProperties } from "@/features/fincas/queries/fincas.queries";
import { usePropertiesStore } from "@/features/fincas/store/fincas.store";
import { PropertiesTable } from "@/features/admin/components/properties/properties-table";
import { Search, RefreshCw, Filter, Plus } from "lucide-react";
import {
  buildAdminRegionOptions,
  propertyMatchesAdminRegion,
} from "@/lib/property-locations";
import { propertyMatchesSearchQuery } from "@/features/home/lib/property-search";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PropertiesPage() {
  const [isMounted, setIsMounted] = useState(false);
  const {
    search,
    region,
    statusFilter,
    itemsPerPage,
    setSearch,
    setRegion,
    setStatusFilter,
    setItemsPerPage,
  } = usePropertiesStore();
  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);
  // API returns all properties at once — do client-side pagination
  const [pageIndex, setPageIndex] = useState(0);
  const {
    data: propertiesData,
    isLoading,
  } = useProperties({
    all: true,
  });
  const properties = propertiesData?.properties || propertiesData?.data || [];
  const regionOptions = useMemo(
    () => buildAdminRegionOptions(properties),
    [properties],
  );
  // Client-side search + region + status + sort
  const filteredProperties = useMemo(
    () =>
      [...properties]
        .filter((p) => {
          const matchesSearch = propertyMatchesSearchQuery(
            { title: p.title, location: p.location },
            search,
            ["title", "location"],
          );

          const matchesRegion = propertyMatchesAdminRegion(p.location, region);

          let matchesStatus = true;
          if (statusFilter === "active") {
            matchesStatus = p.active !== false;
          } else if (statusFilter === "inactive") {
            matchesStatus = p.active === false;
          }

          return matchesSearch && matchesRegion && matchesStatus;
        })
        .sort((a, b) => a.title.localeCompare(b.title, "es")),
    [properties, search, region, statusFilter],
  );
  // Client-side pagination slice
  const pageStart = pageIndex * itemsPerPage;
  const currentProperties = filteredProperties.slice(
    pageStart,
    pageStart + itemsPerPage,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProperties.length / itemsPerPage),
  );
  const hasPrev = pageIndex > 0;
  const hasNext = pageIndex < totalPages - 1;
  const goNext = () => {
    if (hasNext) setPageIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (hasPrev) setPageIndex((i) => i - 1);
  };
  // Reset to page 0 when region or itemsPerPage or status changes
  useEffect(() => {
    setPageIndex(0);
  }, [region, itemsPerPage, search, statusFilter]);
  const router = useRouter();
  // Convex es reactivo: la lista se refresca sola, no hay invalidation manual.

  if (!isMounted) {
    return null; // O un skeleton de carga completa si se prefiere
  }

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6 md:space-y-10 bg-transparent min-h-[calc(100vh-4rem)] relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Propiedades
          </h1>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-bold uppercase tracking-wider opacity-60">
            Catálogo Maestro de Fincas
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full md:w-auto">
          <button
            onClick={() => router.push("/admin/properties/new")}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden xs:inline">Nueva Finca</span>
            <span className="xs:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* Search + Table Container */}
      <div className="rounded-[2rem] bg-background border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Search Bar Refined */}
        <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row items-center gap-3 md:gap-4 bg-muted/20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, ubicación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-xl md:rounded-2xl pl-11 pr-4 py-2.5 md:py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium"
            />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-full md:w-[180px] bg-muted/40 border-border rounded-xl md:rounded-2xl h-[44px] md:h-[48px]! text-xs font-semibold text-foreground">
                <Filter className="w-4 h-4 text-muted-foreground mr-2" />
                <SelectValue placeholder="Región" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl bg-background">
                {regionOptions.map((r) => (
                  <SelectItem
                    key={r.value}
                    value={r.value}
                    className="text-sm font-medium"
                  >
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v: any) => setStatusFilter(v)}
            >
              <SelectTrigger className="w-full md:w-[160px] bg-muted/40 border-border rounded-xl md:rounded-2xl h-[44px] md:h-[48px]! text-xs font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${statusFilter === "all" ? "bg-muted-foreground/30" : statusFilter === "active" ? "bg-emerald-500" : "bg-orange-500"}`}
                  />
                  <SelectValue placeholder="Estado de finca" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl bg-background">
                <SelectItem value="all" className="text-sm font-medium">
                  Todos los estados
                </SelectItem>
                <SelectItem value="active" className="text-sm font-medium">
                  Activas
                </SelectItem>
                <SelectItem value="inactive" className="text-sm font-medium">
                  Inactivas
                </SelectItem>
              </SelectContent>
            </Select>
            {(search || region !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setRegion("all");
                  setStatusFilter("all");
                }}
                className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Limpiar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {/* Table */}
        <PropertiesTable
          properties={currentProperties || []}
          isLoading={isLoading}
        />
        {/* Pagination */}
        <div className="p-4 border-t border-border bg-background flex items-center justify-center md:justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
            <span>Mostrar</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(v) => setItemsPerPage(Number(v))}
            >
              <SelectTrigger className="w-[72px] h-8 text-xs bg-muted/40 border-border rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {[5, 10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>por página</span>
          </div>
          {(hasPrev || hasNext) && (
            <Pagination className="w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className="cursor-pointer"
                    onClick={goPrev}
                    aria-disabled={!hasPrev}
                    style={{
                      pointerEvents: !hasPrev ? "none" : "auto",
                      opacity: !hasPrev ? 0.5 : 1,
                    }}
                  />
                </PaginationItem>
                <div className="hidden md:flex">
                  <span className="px-3 py-1.5 text-xs font-bold text-muted-foreground">
                    Pág. {pageIndex + 1} / {totalPages}
                  </span>
                </div>
                <PaginationItem>
                  <PaginationNext
                    className="cursor-pointer"
                    onClick={goNext}
                    aria-disabled={!hasNext}
                    style={{
                      pointerEvents: !hasNext ? "none" : "auto",
                      opacity: !hasNext ? 0.5 : 1,
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  );
}
