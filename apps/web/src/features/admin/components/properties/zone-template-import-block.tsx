"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAllCategoryZoneTemplates } from "@/features/admin/queries/category-zone-templates.queries";
import type { IconographyItem } from "@/features/admin/types/features.types";
import type { PropertyFeature } from "@/features/fincas/types/fincas.types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

interface ZoneTemplateImportBlockProps {
  iconography: IconographyItem[];
  /** Current features in the form; merged on apply. */
  features: PropertyFeature[];
  onMerged: (next: {
    features: PropertyFeature[];
    extraZoneNames: string[];
  }) => void;
  className?: string;
}

export function ZoneTemplateImportBlock({
  iconography,
  features,
  onMerged,
  className,
}: ZoneTemplateImportBlockProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filterQuery, setFilterQuery] = useState("");
  const [page, setPage] = useState(1);

  const {
    data: templates,
    isLoading,
    isError,
    error,
    refetch,
  } = useAllCategoryZoneTemplates();

  const appliedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of features) {
      if (f.zoneTemplateSourceId) ids.add(f.zoneTemplateSourceId);
    }
    return ids;
  }, [features]);

  const catalogById = useMemo(() => {
    const m = new Map<string, IconographyItem>();
    for (const i of iconography) m.set(i._id, i);
    return m;
  }, [iconography]);

  const filteredTemplates = useMemo(() => {
    if (!templates?.length) return [];
    const q = filterQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, filterQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageTemplates = filteredTemplates.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [filterQuery]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const apply = () => {
    if (!templates) return;
    const chosen = templates.filter((t) => selected[t._id]);
    if (chosen.length === 0) return;

    let nextFeatures = [...features];
    const extraZoneNames: string[] = [];

    for (const tpl of chosen) {
      nextFeatures = nextFeatures.filter(
        (f) => f.zoneTemplateSourceId !== tpl._id,
      );
      extraZoneNames.push(tpl.name);

      for (const row of tpl.features) {
        const icon = catalogById.get(row.iconographyId);
        const displayName =
          (row.alias && row.alias.trim()) ||
          icon?.name?.trim() ||
          "Característica";
        nextFeatures.push({
          name: displayName,
          iconId: row.iconographyId,
          iconUrl: icon?.iconUrl,
          emoji: icon?.emoji,
          quantity:
            row.quantity != null && Number(row.quantity) >= 1
              ? Math.floor(Number(row.quantity))
              : 1,
          zone: tpl.name,
          zoneTemplateSourceId: tpl._id,
        });
      }
    }

    onMerged({ features: nextFeatures, extraZoneNames });
  };

  const errMsg =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Error).message === "string"
      ? (error as Error).message
      : "Error de red o del servidor";

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const t of filteredTemplates) next[t._id] = true;
      return next;
    });
  };

  const clearSelection = () => setSelected({});

  return (
    <div
      className={cn(
        "space-y-4 rounded-[32px] border border-border bg-card p-6 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Plantillas de zona
          </h3>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
          <Link href="/admin/category-zone-templates" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Editar plantillas
          </Link>
        </Button>
      </div>

      {isError && (
        <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">No se pudieron cargar las plantillas</p>
          <p className="text-xs opacity-90">{errMsg}</p>
          <p className="text-xs text-muted-foreground">
            Si acabas de desplegar el API, reiniciá Nest y confirmá la ruta{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              GET /api/category-zone-templates/all
            </code>
            .
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg border-destructive/40"
            onClick={() => void refetch()}
          >
            Reintentar
          </Button>
        </div>
      )}

      {isLoading && !isError ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando plantillas…
        </div>
      ) : isError ? null : !templates?.length ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          <p>No hay plantillas de zona todavía.</p>
          <p className="mt-2 text-xs">
            Creá zonas en{" "}
            <Link
              href="/admin/category-zone-templates"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Admin → Plantillas de zona
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filtrar por nombre de zona…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-10 rounded-xl pl-9"
              aria-label="Filtrar plantillas por nombre"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {filteredTemplates.length === templates.length
                ? `${templates.length} plantilla${templates.length === 1 ? "" : "s"}`
                : `${filteredTemplates.length} de ${templates.length} (filtro)`}
            </span>
            {totalPages > 1 && (
              <span>
                Página {safePage} de {totalPages}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[11px]"
              onClick={selectAllFiltered}
              disabled={filteredTemplates.length === 0}
            >
              Seleccionar todas (filtro)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-[11px] text-muted-foreground"
              onClick={clearSelection}
            >
              Quitar selección
            </Button>
          </div>

          {filteredTemplates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
              Ninguna plantilla coincide con el filtro.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-xl border border-border bg-muted/10">
                {pageTemplates.map((t) => {
                  const applied = appliedTemplateIds.has(t._id);
                  return (
                    <li key={t._id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
                          selected[t._id] && "bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={!!selected[t._id]}
                          onCheckedChange={(c) =>
                            setSelected((prev) => ({
                              ...prev,
                              [t._id]: c === true,
                            }))
                          }
                          className="shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {t.name}
                        </span>
                        {applied ? (
                          <span className="shrink-0 text-[11px] text-emerald-700 dark:text-emerald-400">
                            Ya en finca
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-2"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-32 text-center text-xs text-muted-foreground">
                    {pageStart + 1}–
                    {Math.min(pageStart + PAGE_SIZE, filteredTemplates.length)} de{" "}
                    {filteredTemplates.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-2"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}

          <Button
            type="button"
            className="h-12 w-full rounded-2xl font-semibold"
            disabled={!Object.values(selected).some(Boolean)}
            onClick={apply}
          >
            Importar zonas seleccionadas a esta finca
          </Button>
        </>
      )}
    </div>
  );
}
