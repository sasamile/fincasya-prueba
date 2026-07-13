"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronsUpDown,
  Plus,
  X,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  HOME_CATALOG_TAB_ORDER,
  CATALOG_TAG_LABELS,
  formatCatalogTabLabel,
  isBuiltInCatalogTagId,
} from "@/lib/property/catalog-filter-tags";

const PRESETS_STORAGE_KEY = "fincasya-catalog-filter-tag-presets";
const HIDDEN_STORAGE_KEY = "fincasya-catalog-filter-tag-hidden";

type TagOption = { id: string; label: string };

const RESERVED_IDS = new Set<string>(HOME_CATALOG_TAB_ORDER);

function builtinOptions(): TagOption[] {
  const ids = Object.keys(CATALOG_TAG_LABELS);
  return ids
    .map((id) => ({ id, label: CATALOG_TAG_LABELS[id] ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function slugifyLabel(raw: string): string {
  const s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "categoria";
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

interface CatalogFilterTagsFieldProps {
  value: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
}

function toggleId(list: string[], id: string, on: boolean): string[] {
  const set = new Set(list);
  if (on) set.add(id);
  else set.delete(id);
  return Array.from(set);
}

export function CatalogFilterTagsField({
  value,
  onChange,
}: CatalogFilterTagsFieldProps) {
  const selected = value ?? [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [presets, setPresets] = useState<TagOption[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as TagOption[]) : [];
      setPresets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPresets([]);
    }
    try {
      const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setHiddenIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHiddenIds([]);
    }
  }, []);

  const persistPresets = useCallback((next: TagOption[]) => {
    setPresets(next);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const persistHidden = useCallback((next: string[]) => {
    setHiddenIds(next);
    try {
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const allOptions = useMemo(() => {
    const byId = new Map<string, TagOption>();
    for (const o of builtinOptions()) byId.set(o.id, o);
    for (const o of presets) {
      if (!byId.has(o.id)) byId.set(o.id, o);
    }
    for (const id of selected) {
      if (!byId.has(id)) {
        byId.set(id, { id, label: formatCatalogTabLabel(id) });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es"),
    );
  }, [presets, selected]);

  const visibleOptions = useMemo(() => {
    const hidden = new Set(hiddenIds);
    return allOptions.filter((o) => !hidden.has(o.id) || selected.includes(o.id));
  }, [allOptions, hiddenIds, selected]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleOptions;
    return visibleOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
    );
  }, [visibleOptions, query]);

  const setHas = (id: string) => selected.includes(id);

  const handleToggle = (id: string, checked: boolean) => {
    if (value === undefined) {
      onChange(checked ? [id] : []);
      return;
    }
    const next = toggleId(selected, id, checked);
    onChange(next);
  };

  const remove = useCallback(
    (id: string) => {
      const next = selected.filter((x) => x !== id);
      onChange(next.length ? next : []);
    },
    [selected, onChange],
  );

  const hideOption = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (selected.includes(id)) remove(id);
      const isCustom =
        !isBuiltInCatalogTagId(id) && presets.some((p) => p.id === id);
      if (isCustom) {
        persistPresets(presets.filter((p) => p.id !== id));
        return;
      }
      if (!hiddenIds.includes(id)) {
        persistHidden([...hiddenIds, id]);
      }
    },
    [
      selected,
      remove,
      presets,
      persistPresets,
      hiddenIds,
      persistHidden,
    ],
  );

  const restoreAllHidden = () => {
    persistHidden([]);
  };

  const addCustomCategory = () => {
    const label = newLabel.trim();
    if (!label) return;
    const taken = new Set(allOptions.map((o) => o.id));
    let base = slugifyLabel(label);
    if (RESERVED_IDS.has(base)) {
      base = `cat-${base}`;
    }
    const id = uniqueSlug(base, taken);
    const nextPresets = [...presets.filter((p) => p.id !== id), { id, label }];
    persistPresets(nextPresets);
    if (hiddenIds.includes(id)) {
      persistHidden(hiddenIds.filter((x) => x !== id));
    }
    handleToggle(id, true);
    setNewLabel("");
    setQuery("");
  };

  const triggerLabel =
    selected.length === 0
      ? "Seleccionar filtros…"
      : `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}`;

  const hiddenCount = hiddenIds.length;

  return (
    <div className="border-border bg-muted/20 space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold">Categorías</h3>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-w-40 justify-between gap-2 font-normal"
              aria-expanded={open}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-2rem,24rem)] p-0" align="end">
            <div className="border-border flex flex-col gap-2 border-b p-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar…"
                  className="h-9 pl-9"
                />
              </div>
              <p className="text-muted-foreground text-[10px] leading-snug">
                Cualquier categoría puede ocultarse del selector con la
                papelera. Esto no se envía al sitio público; solo te limpia tu
                lista. Para que aparezca en el home, la finca debe tenerla
                marcada y guardada.
              </p>
            </div>
            <ScrollArea className="h-[min(50vh,280px)]">
              <ul className="p-1">
                {filteredOptions.length === 0 ? (
                  <li className="text-muted-foreground px-3 py-6 text-center text-xs">
                    Sin coincidencias
                  </li>
                ) : (
                  filteredOptions.map((opt) => {
                    const isCustom =
                      !isBuiltInCatalogTagId(opt.id) &&
                      presets.some((p) => p.id === opt.id);
                    const isHiddenButSelected = hiddenIds.includes(opt.id);
                    return (
                      <li
                        key={opt.id}
                        className="hover:bg-accent/60 flex items-center gap-0.5 rounded-lg px-1 py-0.5"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-1 py-1.5 text-sm">
                          <Checkbox
                            checked={setHas(opt.id)}
                            onCheckedChange={(c) =>
                              handleToggle(opt.id, c === true)
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {opt.label}
                          </span>
                          {isCustom ? (
                            <span className="border-primary/30 text-primary bg-primary/10 shrink-0 rounded-md border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider">
                              Tuya
                            </span>
                          ) : null}
                          {isHiddenButSelected ? (
                            <span className="border-amber-500/30 text-amber-700 bg-amber-500/10 dark:text-amber-300 shrink-0 rounded-md border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider">
                              Oculta
                            </span>
                          ) : null}
                          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                            {opt.id}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive shrink-0 rounded-md p-2"
                          title={
                            isCustom
                              ? "Borrar categoría (solo tuya)"
                              : "Ocultar de mi selector"
                          }
                          onClick={(e) => hideOption(e, opt.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </ScrollArea>
            {hiddenCount > 0 ? (
              <div className="border-border border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-8 w-full justify-start gap-2 text-[11px]"
                  onClick={restoreAllHidden}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Mostrar {hiddenCount}{" "}
                  {hiddenCount === 1 ? "oculta" : "ocultas"}
                </Button>
              </div>
            ) : null}
            <div className="border-border space-y-2 border-t p-2">
              <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                Nueva categoría
              </p>
              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nombre (ej. Medellín)"
                  className="h-9 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomCategory();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shrink-0 gap-1"
                  onClick={addCustomCategory}
                >
                  <Plus className="h-4 w-4" />
                  Añadir
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {selected.map((id) => (
              <Badge
                key={id}
                variant="secondary"
                className="border-border gap-1 border py-0 pr-0.5 pl-2 font-normal"
              >
                <span className="max-w-[200px] truncate">
                  {allOptions.find((o) => o.id === id)?.label ??
                    formatCatalogTabLabel(id)}
                </span>
                <button
                  type="button"
                  className="hover:bg-muted rounded-md p-1"
                  onClick={() => remove(id)}
                  aria-label={`Quitar ${id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {selected.some((id) => !isBuiltInCatalogTagId(id)) ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              La categoría nueva aparece en el home como pestaña antes de
              «Eventos» <strong>después de guardar la finca</strong>. El
              carrusel se desliza horizontalmente: revisa el final si tienes
              muchas zonas.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
