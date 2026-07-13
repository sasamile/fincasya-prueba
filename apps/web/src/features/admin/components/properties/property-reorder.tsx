"use client";

import { useState, useMemo, useEffect, memo } from "react";
import {
  useProperties,
  useTabOrder,
  useUpdateTabOrder,
} from "@/features/fincas/queries/fincas.queries";
import { PropertyResponse } from "@/features/fincas/types/fincas.types";
import { propertyMatchesSearchQuery } from "@/lib/property/property-search";
import {
  Reorder,
  useDragControls,
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  GripVertical,
  Search,
  Save,
  Loader2,
  MapPin,
  LayoutGrid,
  ChevronRight,
  Info,
  Heart,
  Menu,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CATALOG_GEO_TAB_IDS,
  HOME_TAB_ROWS,
  formatCatalogTabLabel,
  isBuiltInCatalogTagId,
  mergeHomeTabRowsWithDynamic,
  propertyMatchesCatalogTab,
  propertyMatchesEventosTab,
  propertyMatchesGeoTab,
  propertyMatchesLuxuryTab,
} from "@/lib/property/catalog-filter-tags";

const HighlightMatch = memo(function HighlightMatch({
  text,
  search,
}: {
  text: string;
  search: string;
}) {
  if (!search) return <>{text}</>;
  const parts = text.split(new RegExp(`(${search})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark
            key={i}
            className="bg-primary/20 text-foreground rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
});

interface FincaCardContentProps {
  item: PropertyResponse;
  index: number;
  isFavorite?: boolean;
  dragControls?: any;
  searchTerm?: string;
  isCurrentMatch?: boolean;
}

const FincaCardContent = memo(function FincaCardContent({
  item,
  index,
  isFavorite,
  dragControls,
  searchTerm,
  isCurrentMatch,
}: FincaCardContentProps) {
  return (
    <div
      id={`finca-${item.id}`}
      className={cn(
        "flex items-center gap-3 p-3 bg-background border rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden active:scale-[0.98]",
        isCurrentMatch
          ? "border-primary ring-2 ring-primary/20 shadow-primary/10"
          : "border-border",
      )}
    >
      <div
        className={cn(
          "p-3 bg-muted rounded-xl transition-colors shrink-0 touch-none",
          dragControls
            ? "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary hover:bg-primary/10"
            : "text-muted-foreground/30",
        )}
        onPointerDown={(e) => dragControls?.start(e)}
      >
        <GripVertical className="w-5 h-5" />
      </div>

      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0 border border-border">
        <Image
          src={item.images?.[0] || "/placeholder.png"}
          alt={item.title}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest shrink-0">
            #{index + 1}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground/50 tracking-tighter shrink-0 border-l border-border pl-2">
            {item.code || "S/N"}
          </span>
        </div>
        <h3 className="text-[13px] font-bold text-foreground truncate tracking-tight leading-tight">
          <HighlightMatch text={item.title} search={searchTerm || ""} />
        </h3>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground truncate lowercase first-letter:uppercase">
            <HighlightMatch
              text={item.location || ""}
              search={searchTerm || ""}
            />
          </span>
        </div>
      </div>

      {isFavorite && (
        <div className="shrink-0 p-2 bg-pink-500/10 rounded-full">
          <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
        </div>
      )}
    </div>
  );
});

interface ReorderableFincaItemProps {
  item: PropertyResponse;
  index: number;
  isFavorite?: boolean;
  searchTerm?: string;
  isCurrentMatch?: boolean;
}

const ReorderableFincaItem = memo(function ReorderableFincaItem({
  item,
  index,
  isFavorite,
  searchTerm,
  isCurrentMatch,
}: ReorderableFincaItemProps) {
  const controls = useDragControls();

  const handleDrag = (event: any, info: any) => {
    // We use the raw clientY from the event for reliable viewport-relative coordinates
    const clientY =
      event.clientY ||
      (event.touches
        ? event.touches[0].clientY
        : info.point.y - window.scrollY);
    const threshold = 120; // Slightly larger for better detection
    const scrollSpeed = 8; // Much slower and more controllable

    if (clientY < threshold) {
      window.scrollBy({ top: -scrollSpeed, behavior: "auto" });
    } else if (clientY > window.innerHeight - threshold) {
      window.scrollBy({ top: scrollSpeed, behavior: "auto" });
    }
  };

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDrag={handleDrag}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative mb-2 select-none"
    >
      <FincaCardContent
        item={item}
        index={index}
        isFavorite={isFavorite}
        dragControls={controls}
        searchTerm={searchTerm}
        isCurrentMatch={isCurrentMatch}
      />
    </Reorder.Item>
  );
});

export function PropertyReorder() {
  const [selectedTab, setSelectedTab] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { data: propertiesData, isLoading: isLoadingFincas } = useProperties({
    limit: 1000,
    all: true,
  });
  const { data: tabOrderData, isLoading: isLoadingOrder } =
    useTabOrder(selectedTab);
  const updateTabOrderMutation = useUpdateTabOrder();

  const allFincas = useMemo(() => {
    const raw = propertiesData?.properties || [];
    return raw.filter((f) => f.active !== false);
  }, [propertiesData]);

  const reorderTabs = useMemo(() => {
    const seen = new Set(HOME_TAB_ROWS.map((r) => r.id));
    const extra: { id: string; label: string }[] = [];
    allFincas.forEach((f) => {
      (f.catalogFilterTags ?? []).forEach((t) => {
        if (seen.has(t)) return;
        if (!isBuiltInCatalogTagId(t)) {
          seen.add(t);
          extra.push({ id: t, label: formatCatalogTabLabel(t) });
        }
      });
    });
    extra.sort((a, b) => a.label.localeCompare(b.label, "es"));
    return mergeHomeTabRowsWithDynamic(extra);
  }, [allFincas]);

  const [orderedFavorites, setOrderedFavorites] = useState<PropertyResponse[]>(
    [],
  );
  const [orderedOthers, setOrderedOthers] = useState<PropertyResponse[]>([]);

  const filteredByCategory = useMemo(() => {
    let result = allFincas;

    if (selectedTab === "todas") {
      result = allFincas;
    } else if (selectedTab === "favoritas") {
      result = allFincas.filter((f) => f.isFavorite);
    } else if (selectedTab === "luxury") {
      result = allFincas.filter((f) => propertyMatchesLuxuryTab(f as any));
    } else if (selectedTab === "eventos") {
      result = allFincas.filter((f) => propertyMatchesEventosTab(f as any));
    } else if (
      (CATALOG_GEO_TAB_IDS as readonly string[]).includes(selectedTab)
    ) {
      result = allFincas.filter((f) =>
        propertyMatchesGeoTab(
          f as any,
          selectedTab as (typeof CATALOG_GEO_TAB_IDS)[number],
        ),
      );
    } else {
      result = allFincas.filter((f) =>
        propertyMatchesCatalogTab(f as any, selectedTab),
      );
    }
    return result;
  }, [allFincas, selectedTab]);

  useEffect(() => {
    // Reset local states when tab changes to avoid state pollution from previous tab
    setOrderedFavorites([]);
    setOrderedOthers([]);
  }, [selectedTab]);

  useEffect(() => {
    if (isLoadingFincas || isLoadingOrder) return;

    const propertyIds = tabOrderData?.propertyIds || [];
    const propertyMap = new Map(filteredByCategory.map((f) => [f.id, f]));

    const orderedTotal = [...propertyIds]
      .map((id) => propertyMap.get(id))
      .filter((f): f is PropertyResponse => !!f);

    const remaining = filteredByCategory.filter(
      (f) => !propertyIds.map(String).includes(String(f.id)),
    );

    const combined = [...orderedTotal, ...remaining];

    setOrderedFavorites(combined.filter((f) => f.isFavorite));
    setOrderedOthers(combined.filter((f) => !f.isFavorite));
  }, [filteredByCategory, tabOrderData, isLoadingFincas, isLoadingOrder]);

  // Search Match Logic
  const matchingIds = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    // Use a flat list for searching
    const allItems = [...orderedFavorites, ...orderedOthers];

    return allItems
      .filter((f: PropertyResponse) =>
        propertyMatchesSearchQuery(
          { title: f.title, code: f.code, location: f.location },
          searchTerm,
        ),
      )
      .map((f: PropertyResponse) => f.id);
  }, [searchTerm, orderedFavorites.length, orderedOthers.length]); // Minimize dependencies

  useEffect(() => {
    if (matchingIds.length > 0) {
      setCurrentMatchIndex(0);
      scrollToMatch(matchingIds[0]);
    }
  }, [matchingIds]);

  const scrollToMatch = (id: string) => {
    const element = document.getElementById(`finca-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleNextMatch = () => {
    if (matchingIds.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matchingIds.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(matchingIds[nextIndex]);
  };

  const handlePrevMatch = () => {
    if (matchingIds.length === 0) return;
    const prevIndex =
      (currentMatchIndex - 1 + matchingIds.length) % matchingIds.length;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(matchingIds[prevIndex]);
  };

  const handleSaveOrder = async () => {
    try {
      const propertyIds = [
        ...orderedFavorites.map((f) => f.id),
        ...orderedOthers.map((f) => f.id),
      ];

      await updateTabOrderMutation.mutateAsync({
        tabId: selectedTab,
        propertyIds,
      });
      sileo.success({ title: "Prioridades actualizadas", fill: "#f0fdf4" });
    } catch (error) {
      console.error("[Reorder] Save error:", error);
      sileo.error({ title: "Error al guardar prioridad", fill: "#fee2e2" });
    }
  };

  const currentTabLabel = reorderTabs.find((t) => t.id === selectedTab)?.label;
  const isLoading = isLoadingFincas || isLoadingOrder;

  return (
    <div className="mx-auto flex min-h-0 max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:flex-row lg:gap-6">
      {/* Sidebar: drawer en móvil, columna sticky en desktop (sin fixed → no hueco blanco) */}
      <aside
        className={cn(
          "z-50 flex w-[min(288px,88vw)] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
          "fixed inset-y-0 left-0 transition-transform duration-300 ease-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:inset-auto lg:w-64 lg:translate-x-0",
          "lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)]",
        )}
      >
        <div className="relative shrink-0 border-b border-border/60 p-4">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Cerrar menú"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Prioridad de fincas
          </p>
          <h1 className="mt-1 truncate text-base font-bold tracking-tight">
            {currentTabLabel}
          </h1>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={updateTabOrderMutation.isPending || isLoading}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            {updateTabOrderMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar orden
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <p className="shrink-0 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Pestañas front-page
          </p>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 px-3 pb-3">
              {reorderTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedTab(tab.id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                    selectedTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <span className="truncate">{tab.label}</span>
                  {selectedTab === tab.id ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  ) : null}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-[2px] lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      {/* Lista de fincas */}
      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground shadow-sm transition hover:text-primary lg:hidden"
            aria-label="Abrir pestañas"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={updateTabOrderMutation.isPending || isLoading}
            className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm transition active:scale-95 disabled:opacity-50 lg:hidden"
            title="Guardar orden"
          >
            {updateTabOrderMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por código o nombre…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-xs font-medium shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          {matchingIds.length > 1 ? (
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm">
              <span className="px-2 text-[10px] font-bold text-muted-foreground tabular-nums">
                {currentMatchIndex + 1}/{matchingIds.length}
              </span>
              <button
                type="button"
                onClick={handlePrevMatch}
                className="rounded-lg p-1.5 hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                className="rounded-lg p-1.5 hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <LayoutGrid className="absolute inset-0 m-auto h-5 w-5 text-primary" />
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Cargando fincas…
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-2 px-0.5">
                <div className="rounded-lg bg-pink-500/10 p-1.5">
                  <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Favoritas de la categoría</h2>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {orderedFavorites.length} destacadas
                  </p>
                </div>
              </div>

              {orderedFavorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-10">
                  <Heart className="mb-2 h-7 w-7 text-muted-foreground/30" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sin favoritas en esta pestaña
                  </p>
                </div>
              ) : (
                <Reorder.Group
                  key={`favs-${selectedTab}`}
                  axis="y"
                  values={orderedFavorites}
                  onReorder={setOrderedFavorites}
                  className="flex flex-col gap-2"
                >
                  <AnimatePresence>
                    {orderedFavorites.map((item, idx) => (
                      <ReorderableFincaItem
                        key={item.id}
                        item={item}
                        index={idx}
                        isFavorite
                        searchTerm={searchTerm}
                        isCurrentMatch={
                          searchTerm
                            ? matchingIds[currentMatchIndex] === item.id
                            : false
                        }
                      />
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 px-0.5">
                <div className="rounded-lg bg-orange-500/10 p-1.5">
                  <LayoutGrid className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Otras propiedades</h2>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {orderedOthers.length} fincas
                  </p>
                </div>
              </div>

              {orderedOthers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-10">
                  <Info className="mb-2 h-7 w-7 text-muted-foreground/30" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    No hay más propiedades en esta pestaña
                  </p>
                </div>
              ) : (
                <Reorder.Group
                  key={`others-${selectedTab}`}
                  axis="y"
                  values={orderedOthers}
                  onReorder={setOrderedOthers}
                  className="flex flex-col gap-2"
                >
                  <AnimatePresence>
                    {orderedOthers.map((item, idx) => (
                      <ReorderableFincaItem
                        key={item.id}
                        item={item}
                        index={idx}
                        searchTerm={searchTerm}
                        isCurrentMatch={
                          searchTerm
                            ? matchingIds[currentMatchIndex] === item.id
                            : false
                        }
                      />
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              )}
            </section>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showScrollToTop ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed right-5 bottom-5 z-30 rounded-xl bg-primary p-3 text-primary-foreground shadow-lg transition hover:bg-primary/90 active:scale-95"
            aria-label="Volver arriba"
          >
            <ChevronRight className="h-5 w-5 -rotate-90" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
