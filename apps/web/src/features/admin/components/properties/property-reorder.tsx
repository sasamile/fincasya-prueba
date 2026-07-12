"use client";

import { useState, useMemo, useEffect, memo } from "react";
import {
  useProperties,
  useTabOrder,
  useUpdateTabOrder,
} from "@/features/fincas/queries/fincas.queries";
import { PropertyResponse } from "@/features/fincas/types/fincas.types";
import { propertyMatchesSearchQuery } from "@/features/home/lib/property-search";
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
  Star,
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
} from "@/features/home/lib/catalog-filter-tags";

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

    // Debug logging to help identify why data might not be persisting
    console.log(`[Reorder] Loading tab: ${selectedTab}`, {
      foundInDb: !!tabOrderData,
      propertyIdsCount: propertyIds.length,
      filteredByCategoryCount: filteredByCategory.length,
    });

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

      console.log(`[Reorder] Saving tab: ${selectedTab}`, {
        propertyIdsCount: propertyIds.length,
        propertyIds,
      });

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
    <div className="min-h-screen bg-transparent">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8">
        {/* Sidebar Navigation */}
        <aside
          className={cn(
            "lg:col-span-3 fixed inset-y-0 left-0 z-999 w-[280px] bg-background border-r border-border lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-hidden",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <ScrollArea className="h-full">
            <div className="px-6 pt-6 pb-8">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
              <div className="mb-4">
                <h1 className="text-lg font-bold text-foreground tracking-tight leading-tight">
                  {currentTabLabel}
                </h1>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1.5 leading-none">
                  Prioridad de Fincas
                </p>
                <button
                  onClick={handleSaveOrder}
                  disabled={updateTabOrderMutation.isPending || isLoading}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95 group font-bold!"
                >
                  {updateTabOrderMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  )}
                  <span>Guardar Orden</span>
                </button>
              </div>
              <div className="h-px bg-border mb-8" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 block">
                Pestañas Front-Page
              </span>
              <div className="space-y-1">
                {reorderTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSelectedTab(tab.id);
                      if (window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between group",
                      selectedTab === tab.id
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-transparent text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span>{tab.label}</span>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 transition-transform",
                        selectedTab === tab.id
                          ? "translate-x-0"
                          : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Content Area */}
        <main className="lg:col-span-9 p-4 md:p-8 pt-6">
          <div className="flex items-center gap-3 mb-8 sticky top-[64px] lg:top-[64px] z-20 py-4 -mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-3.5 bg-background border border-border rounded-2xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shadow-sm"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={handleSaveOrder}
                disabled={updateTabOrderMutation.isPending || isLoading}
                className="lg:hidden p-3.5 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all font-bold!"
                title="Guardar Orden"
              >
                {updateTabOrderMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="flex-1 relative group flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Ubicar finca por código o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-3.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold placeholder:text-muted-foreground/30 shadow-sm"
                />
              </div>

              {matchingIds.length > 1 && (
                <div className="flex items-center gap-1 bg-background border border-border p-1.5 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-black text-muted-foreground px-2">
                    {currentMatchIndex + 1} de {matchingIds.length}
                  </span>
                  <button
                    onClick={handlePrevMatch}
                    className="p-2 hover:bg-muted rounded-xl transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                  <button
                    onClick={handleNextMatch}
                    className="p-2 hover:bg-muted rounded-xl transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin" />
                <LayoutGrid className="absolute inset-0 m-auto w-6 h-6 text-primary" />
              </div>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-[9px] mt-6">
                Sincronizando con Fincas...
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              <section>
                <div className="flex items-center gap-3 mb-4 px-1">
                  <div className="p-1.5 bg-pink-100 rounded-lg">
                    <Heart className="w-4 h-4 text-pink-600 fill-pink-600" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold text-foreground tracking-tight uppercase">
                      Favoritas de la categoría
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {orderedFavorites.length} Propiedades destacadas
                    </p>
                  </div>
                </div>

                {orderedFavorites.length === 0 ? (
                  <div className="py-12 bg-muted/20 border border-dashed border-border rounded-[32px] flex flex-col items-center justify-center">
                    <Heart className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                      Sin favoritas seleccionadas
                    </p>
                  </div>
                ) : (
                  <Reorder.Group
                    key={`favs-${selectedTab}`}
                    axis="y"
                    values={orderedFavorites}
                    onReorder={setOrderedFavorites}
                    className="grid grid-cols-1 gap-2"
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
                <div className="flex items-center gap-3 mb-4 px-1">
                  <div className="p-1.5 bg-orange-100 rounded-lg">
                    <LayoutGrid className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold text-foreground tracking-tight uppercase">
                      Otras propiedades
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {orderedOthers.length} Fincas disponibles
                    </p>
                  </div>
                </div>

                {orderedOthers.length === 0 ? (
                  <div className="py-12 bg-muted/20 border border-dashed border-border rounded-[32px] flex flex-col items-center justify-center">
                    <Info className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                      No hay más propiedades en esta pestaña
                    </p>
                  </div>
                ) : (
                  <Reorder.Group
                    key={`others-${selectedTab}`}
                    axis="y"
                    values={orderedOthers}
                    onReorder={setOrderedOthers}
                    className="grid grid-cols-1 gap-2"
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
      </div>
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-998 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 p-4 bg-primary text-white rounded-2xl shadow-2xl z-100 hover:bg-primary/90 active:scale-95 transition-all group"
          >
            <ChevronRight className="w-5 h-5 -rotate-90 group-hover:-translate-y-1 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
