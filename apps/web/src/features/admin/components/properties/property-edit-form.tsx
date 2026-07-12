"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { sileo } from "sileo";
import {
  useProperty,
  useUpdateProperty,
  useAddPropertyImage,
  useDeletePropertyImage,
  useUploadPropertyVideo,
  useDeletePropertyVideo,
  useDeleteProperty,
  useLinkPropertyFeature,
  useUnlinkPropertyFeature,
  useReorderPropertyImages,
} from "@/features/fincas/queries/fincas.queries";
import { Reorder, useDragControls } from "framer-motion";
import { useIconography } from "@/features/admin/queries/features.queries";
import { useGlobalPricingRules } from "@/features/fincas/queries/global-pricing.queries";
import { FeaturePicker } from "./feature-picker";
import { CardIconPicker } from "./card-icon-picker";
import { ZoneTemplateImportBlock } from "./zone-template-import-block";
import { makeDuplicateZoneName } from "../../utils/zone-utils";
import { CatalogFilterTagsField } from "./catalog-filter-tags-field";
import { ColombiaDepartmentsField } from "./colombia-departments-field";
import { PropertyLocationSelect } from "./property-location-select";
import type { UpdatePropertyPayload } from "@/features/fincas/types/fincas.types";
import { MapPicker as MapPickerComponent } from "./map-picker";
import {
  ArrowLeft,
  Save,
  Loader2,
  MapPin,
  Users,
  DollarSign,
  FileText,
  ImageIcon,
  ListChecks,
  Video,
  Globe,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar,
  PlusCircle,
  Plus,
  X,
  AlertTriangle,
  Eye,
  Download,
  CalendarCheck,
  Star,
  Settings2,
  LayoutGrid,
  User,
  ChevronUp,
  GripVertical,
  Pencil,
  Copy,
  Wand2,
  Dog,
  Music,
  HeartHandshake,
  Shield,
  UserCheck,
  Store,
  MessageCircle,
  Maximize2,
} from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PropertyReservationsHistory } from "./property-reservations-history";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  formatPriceInput,
  parseCOP,
  cn,
  tidyDescriptionText,
} from "@/lib/utils";
import { canonicalLocationDisplay } from "@/lib/property-locations";
import { mergeDepositIntoPropertyDescription } from "@/lib/property-description-deposits";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { compressImageFilesForPropertyUpload } from "@/lib/property-upload-media";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
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
import { FormSection } from "../shared/form-section";
import { AdminFloatingSaveBar } from "../shared/admin-floating-save-bar";

interface PropertyEditFormProps {
  propertyId: string;
}
interface ReorderableImageItemProps {
  item: { id: string; url: string };
  index: number;
  isReorderMode: boolean;
  isSelected: boolean;
  toggleImageSelection: (id: string) => void;
  handleDrag: (event: any, info: any) => void;
  handleDragEnd: () => void;
}

function ReorderableImageItem({
  item,
  index,
  isReorderMode,
  isSelected,
  toggleImageSelection,
  handleDrag,
  handleDragEnd,
}: ReorderableImageItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="relative select-none"
    >
      {isReorderMode ? (
        /* List View Item (optimized for dragging) */
        <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-background border border-border rounded-3xl shadow-sm hover:shadow-md transition-shadow max-md:space-y-1">
          <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
            <div
              className="p-2 bg-muted rounded-xl cursor-grab active:cursor-grabbing touch-none hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
              onPointerDown={(e) => controls.start(e)}
            >
              <GripVertical className="w-5 h-5 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-sm shrink-0 select-none border border-border">
              <Image
                src={item.url}
                alt={`Imagen ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 select-none min-w-0">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 block truncate">
                Posición {index + 1}
              </span>
              <span className="text-sm font-semibold text-foreground truncate block">
                {index === 0 ? "Finca Portada" : `Imagen secundaria #${index}`}
              </span>
            </div>
          </div>
          <div className="px-4 py-1.5 w-full md:w-fit flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 select-none">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              {index === 0 ? "PRINCIPAL" : `ORDEN ${index}`}
            </span>
          </div>
        </div>
      ) : (
        /* Grid View Item (standard view) */
        <div
          className={`relative group rounded-3xl overflow-hidden aspect-square bg-muted cursor-default
            ring-2 shadow-sm transition-all duration-200
            ${
              isSelected
                ? "ring-primary scale-[0.97] shadow-primary/10"
                : "ring-border hover:ring-primary/20 hover:scale-[0.98]"
            }`}
        >
          <div
            className="absolute inset-0 z-0"
            onClick={() => toggleImageSelection(item.id)}
          >
            <Image
              src={item.url}
              alt={`Imagen ${index + 1}`}
              fill
              className={`object-cover transition-all duration-500 pointer-events-none ${isSelected ? "brightness-75" : "group-hover:scale-110"}`}
            />
          </div>

          {/* Overlay on selected */}
          <div
            className={`absolute inset-0 pointer-events-none transition-all duration-300 ${
              isSelected
                ? "bg-primary/20"
                : "bg-black/0 group-hover:bg-linear-to-t group-hover:from-black/50 group-hover:via-transparent"
            }`}
          />
          {/* Checkbox indicator */}
          <div
            className={`absolute top-3 right-3 transition-all duration-200 ${isSelected ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-200
              ${
                isSelected
                  ? "bg-primary border-primary"
                  : "bg-background/80 border-border backdrop-blur-sm"
              }`}
            >
              {isSelected ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {/* Badge / Order */}
          <div
            className={`absolute bottom-3 left-3 transition-all duration-200 ${isSelected ? "opacity-100 translate-y-0" : "opacity-0 group-hover:opacity-100 translate-y-[10px] group-hover:translate-y-0"}`}
          >
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border
              ${
                isSelected
                  ? "bg-primary text-white border-primary/20"
                  : "bg-background/30 backdrop-blur-md text-white border-white/20"
              }`}
            >
              {index === 0 ? "Portada" : `#${index + 1}`}
            </span>
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}

interface ReorderableZoneItemProps {
  zone: string;
  form: UpdatePropertyPayload;
  setForm: React.Dispatch<React.SetStateAction<UpdatePropertyPayload>>;
  customZones: string[];
  setCustomZones: React.Dispatch<React.SetStateAction<string[]>>;
  editingZone: { oldName: string; newName: string } | null;
  setEditingZone: React.Dispatch<
    React.SetStateAction<{ oldName: string; newName: string } | null>
  >;
  iconography: any[] | undefined;
  onDragEnd?: () => void;
}

function ReorderableZoneItem({
  zone,
  form,
  setForm,
  customZones,
  setCustomZones,
  editingZone,
  setEditingZone,
  iconography,
  onDragEnd,
}: ReorderableZoneItemProps) {
  const controls = useDragControls();
  const zoneFeatures = (form.features || []).filter(
    (f) => (f.zone || "General") === zone,
  );

  const handleRename = () => {
    const { oldName, newName } = editingZone!;
    if (
      newName.trim() &&
      newName !== oldName &&
      newName.toLowerCase() !== "general"
    ) {
      // Rename in features
      setForm((prev) => ({
        ...prev,
        features: (prev.features || []).map((f) =>
          (f.zone || "General") === oldName
            ? {
                ...f,
                zone: newName === "General" ? undefined : newName,
              }
            : f,
        ),
      }));
      // Rename in customZones
      setCustomZones((prev) => prev.map((z) => (z === oldName ? newName : z)));
    }
    setEditingZone(null);
  };

  const handleDuplicate = () => {
    const newName = makeDuplicateZoneName(zone, ["General", ...customZones]);
    // Clonar todas las amenidades de la zona origen bajo el nuevo nombre.
    setForm((prev) => {
      const sourceFeatures = (prev.features || []).filter(
        (f) => (f.zone || "General") === zone,
      );
      const cloned = sourceFeatures.map((f) => ({ ...f, zone: newName }));
      return { ...prev, features: [...(prev.features || []), ...cloned] };
    });
    // Insertar la nueva zona justo después de la original.
    setCustomZones((prev) => {
      const idx = prev.indexOf(zone);
      if (idx === -1) return [...prev, newName];
      const next = [...prev];
      next.splice(idx + 1, 0, newName);
      return next;
    });
  };

  return (
    <Reorder.Item
      key={zone}
      value={zone}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="border border-border rounded-3xl p-6 bg-muted/20 select-none"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <div
            onPointerDown={(e) => controls.start(e)}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>
          {editingZone?.oldName === zone ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                type="text"
                value={editingZone.newName}
                onChange={(e) =>
                  setEditingZone({
                    ...editingZone,
                    newName: e.target.value,
                  })
                }
                className="bg-background border border-border rounded-lg px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRename();
                  }
                  if (e.key === "Escape") setEditingZone(null);
                }}
              />
              <button
                type="button"
                onClick={handleRename}
                className="text-xs font-bold text-primary hover:text-primary/90 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1.5"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2 leading-none">
                <LayoutGrid className="w-5 h-5 text-inherit" />
                {zone}
              </h3>
              {zone !== "General" && (
                <button
                  type="button"
                  onClick={() =>
                    setEditingZone({
                      oldName: zone,
                      newName: zone,
                    })
                  }
                  className="text-muted-foreground hover:text-primary transition-all p-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        {zone !== "General" && !editingZone && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDuplicate}
              title="Duplicar zona con sus amenidades"
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 px-3 py-2 rounded-xl transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span className="max-md:hidden">Duplicar</span>
            </button>
            {zoneFeatures.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  setCustomZones((prev) => prev.filter((z) => z !== zone))
                }
                className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      <FeaturePicker
        features={zoneFeatures}
        onChange={(newFeatures) => {
          setForm((prev) => {
            const otherFeatures = (prev.features || []).filter(
              (f) => (f.zone || "General") !== zone,
            );
            const updatedZoneFeatures = newFeatures.map((f) => ({
              ...f,
              zone: zone === "General" ? undefined : zone,
            }));
            return {
              ...prev,
              features: [...otherFeatures, ...updatedZoneFeatures],
            };
          });
        }}
        catalog={iconography || []}
      />
    </Reorder.Item>
  );
}

export function PropertyEditForm({ propertyId }: PropertyEditFormProps) {
  const { data: property, isLoading, isError } = useProperty(propertyId);
  const updateMutation = useUpdateProperty();
  const deleteImageMutation = useDeletePropertyImage();
  const deleteVideoMutation = useDeletePropertyVideo();
  const deletePropertyMutation = useDeleteProperty();
  const linkFeatureMutation = useLinkPropertyFeature();
  const unlinkFeatureMutation = useUnlinkPropertyFeature();
  const reorderImagesMutation = useReorderPropertyImages();
  const { data: iconography, isLoading: isLoadingFeatures } = useIconography();
  const { data: globalRules } = useGlobalPricingRules();
  const router = useRouter();
  const formTopRef = useRef<HTMLDivElement>(null);

  const scrollToFormTop = () => {
    formTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    const inset = document.querySelector('[data-slot="sidebar-inset"]');
    if (inset instanceof HTMLElement) {
      inset.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Initialization ref
  const hasInitialized = useRef(false);
  const initialFeatures = useRef<string[]>([]);
  const [form, setForm] = useState<UpdatePropertyPayload>({});
  const [newRule, setNewRule] = useState({
    nombre: "",
    fechaDesde: "",
    fechaHasta: "",
    fechas: [] as string[],
    valorUnico: 0,
    activa: true,
    reglas: "",
    globalRuleId: undefined as string | undefined,
  });
  const [ruleMode, setRuleMode] = useState<"range" | "specific">("range");
  const [newZoneName, setNewZoneName] = useState("");
  const [customZones, setCustomZones] = useState<string[]>([]);
  const handleBeautifyDescription = () => {
    const current = form.description || "";
    const beautified = tidyDescriptionText(current);

    setForm((prev) => ({
      ...prev,
      description: beautified,
    }));

    if (beautified && beautified !== current) {
      sileo.success({
        title: "Texto ordenado correctamente",
        fill: "#f0fdf4",
      });
      return;
    }

    sileo.info({
      title: "La descripción ya estaba organizada",
    });
  };
  // Multi-select state (using image IDs for stability)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [editingZone, setEditingZone] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);
  // Auto-scroll during drag
  const [scrollDir, setScrollDir] = useState<number>(0);
  const scrollDirRef = useRef<number>(0);
  const scrollRaf = useRef<number | null>(null);

  useEffect(() => {
    scrollDirRef.current = scrollDir;
    if (scrollDir === 0) {
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = null;
      }
      return;
    }

    if (scrollRaf.current) return; // Already running

    const performScroll = () => {
      if (scrollDirRef.current !== 0) {
        const amount = scrollDirRef.current * 16;
        window.scrollBy(0, amount);
        // Also try to scroll the SidebarInset if it's the scroll container
        const inset = document.querySelector('[data-slot="sidebar-inset"]');
        if (inset) {
          inset.scrollBy(0, amount);
        }
        scrollRaf.current = requestAnimationFrame(performScroll);
      } else {
        scrollRaf.current = null;
      }
    };

    scrollRaf.current = requestAnimationFrame(performScroll);
    return () => {
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
      }
    };
  }, [scrollDir]);
  // Delete video dialog state
  const [showDeleteVideoDialog, setShowDeleteVideoDialog] = useState(false);
  const [showDeletePropertyDialog, setShowDeletePropertyDialog] =
    useState(false);
  useEffect(() => {
    if (updateMutation.isSuccess) {
      sileo.success({
        title: "¡Propiedad actualizada exitosamente!",
        fill: "#f0fdf4",
      });
    }
  }, [updateMutation.isSuccess]);
  useEffect(() => {
    if (updateMutation.isError) {
      sileo.error({
        title: "Error al actualizar la propiedad",
        description: "Intentalo de nuevo.",
        fill: "#fee2e2",
      });
    }
  }, [updateMutation.isError]);
  useEffect(() => {
    if (property && !hasInitialized.current) {
      hasInitialized.current = true;
      setForm({
        title: property.title,
        description: property.description,
        location: canonicalLocationDisplay(property.location) || property.location,
        capacity: property.capacity,
        code: property.code,
        type: property.type,
        // Flat price fields (what the API actually accepts)
        priceBase:
          property.priceBase ?? property.seasonPrices?.base ?? property.price,
        priceBaja: property.priceBaja ?? property.seasonPrices?.baja ?? 0,
        priceMedia: property.priceMedia ?? property.seasonPrices?.media ?? 0,
        priceAlta: property.priceAlta ?? property.seasonPrices?.alta ?? 0,
        pricing: property.pricing || property.seasonPrices?.rules || [],
        // Flat coords
        lat: property.lat ?? property.coordinates?.lat,
        lng: property.lng ?? property.coordinates?.lng,
        // Legacy nested (kept for display fallback)
        price: property.price,
        seasonPrices: property.seasonPrices,
        images: property.images,
        imageItems: property.imageItems,
        features: property.features || [],
        files: [],
        video: property.video,
        videoFile: undefined,
        catalogIds: property.catalogIds?.includes(
          "m977kbc084b6rgbrxcnzakvw0581mmvv",
        )
          ? property.catalogIds
          : [
              ...(property.catalogIds || []),
              "m977kbc084b6rgbrxcnzakvw0581mmvv",
            ],
        visible: property.visible ?? true,
        active: property.active ?? true,
        reservable: property.reservable ?? true,
        visibleInWhatsAppCatalog: property.visibleInWhatsAppCatalog ?? true,
        priceOriginal: property.priceOriginal || 0,
        rating: property.rating || 0,
        isFavorite: property.isFavorite || false,
        featuredIcons: property.featuredIcons || [],
        contractTemplateUrl: property.contractTemplateUrl,
        allowsPets: property.allowsPets ?? false,
        requiresGuestList: property.requiresGuestList ?? true,
        allowsEventsContent: property.allowsEventsContent ?? false,
        eventCapacity: property.eventCapacity,
        eventPackagePrice: property.eventPackagePrice,
        familyOnly: property.familyOnly ?? false,
        serviceStaffAvailable: property.serviceStaffAvailable ?? false,
        serviceStaffMandatory: property.serviceStaffMandatory ?? false,
        serviceStaffPrice: property.serviceStaffPrice || 0,
        depositoDanosReembolsable: property.depositoDanosReembolsable ?? 0,
        manillaCondominio: property.manillaCondominio ?? 0,
        depositoAseo: property.depositoAseo ?? 0,
        catalogFilterTags: Array.isArray(property.catalogFilterTags)
          ? property.catalogFilterTags
          : undefined,
        departamentos: Array.isArray(property.departamentos)
          ? property.departamentos.slice(0, 1)
          : [],
        marketplaceForSale: property.marketplaceForSale === true,
        salePriceCop:
          property.salePriceCop != null &&
          Number.isFinite(Number(property.salePriceCop))
            ? Number(property.salePriceCop)
            : undefined,
        saleSquareMeters:
          property.saleSquareMeters != null &&
          Number.isFinite(Number(property.saleSquareMeters))
            ? Number(property.saleSquareMeters)
            : undefined,
        saleDescription: property.saleDescription ?? "",
      });

      // Initialize customZones excluding General
      const allZones = Array.from(
        new Set([
          ...(property.zoneOrder || []),
          ...(property.features || []).map((f) => f.zone || "General"),
        ]),
      );
      setCustomZones(allZones.filter((z) => z !== "General"));

      initialFeatures.current =
        (property.features?.map((f) => f.iconId).filter(Boolean) as string[]) ||
        [];
    }
  }, [property]);

  const selectedLocation =
    canonicalLocationDisplay(form.location ?? property?.location) || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lodgingCap = Number(form.capacity) || 0;
      if (
        form.allowsEventsContent &&
        form.eventCapacity != null &&
        form.eventCapacity > 0 &&
        form.eventCapacity < lodgingCap
      ) {
        sileo.error({
          title: "Revisa las capacidades",
          description:
            "La capacidad para evento no puede ser menor que la capacidad de hospedaje.",
          fill: "#fee2e2",
        });
        return;
      }

      // 3. Update main property
      const { catalogIds, ...payloadWithoutFeatures } = form;

      // Clean up pricing rules to avoid "Bad Request" (extra fields like id, _id, etc.)
      const cleanedPricing = form.pricing?.map((rule: any) => {
        const cleanRule: any = {};
        const allowedFields = [
          "nombre",
          "fechaDesde",
          "fechaHasta",
          "fechas",
          "valorUnico",
          "condiciones",
          "globalRuleId",
          "activa",
          "reglas",
          "order",
          "subReglasCapacidad",
        ];
        allowedFields.forEach((field) => {
          if (rule[field] !== undefined) cleanRule[field] = rule[field];
        });
        return cleanRule;
      });

      await updateMutation.mutateAsync({
        id: propertyId,
        payload: {
          ...payloadWithoutFeatures,
          ...(selectedLocation ? { location: selectedLocation } : {}),
          description: mergeDepositIntoPropertyDescription(
            form.description,
            form.depositoDanosReembolsable,
            form.manillaCondominio,
            form.depositoAseo,
          ),
          features: form.features,
          pricing: cleanedPricing,
          videoFile: form.videoFile, // Explicitly ensure videoFile is passed
          zoneOrder: ["General", ...customZones],
        },
      });

      await syncImageOrder({ silent: true });

      scrollToFormTop();

      if (selectedLocation) {
        setForm((prev) => ({ ...prev, location: selectedLocation }));
      }

      // Update initial features ref after success
      initialFeatures.current =
        (form.features?.map((f) => f.iconId).filter(Boolean) as string[]) || [];

      sileo.success({
        title: "¡Propiedad y características actualizadas!",
        fill: "#f0fdf4",
      });
    } catch (error) {
      sileo.error({ title: "Error al sincronizar cambios", fill: "#fee2e2" });
    }
  };
  const addPricingRule = () => {
    if (!newRule.nombre) {
      sileo.error({
        title: "Por favor asigna un nombre a la regla",
        fill: "#fee2e2",
      });
      return;
    }

    if (ruleMode === "range") {
      if (!newRule.fechaDesde || !newRule.fechaHasta) {
        sileo.error({
          title: "Por favor completa el rango de fechas",
          fill: "#fee2e2",
        });
        return;
      }
    }

    if (
      ruleMode === "specific" &&
      (!newRule.fechas || newRule.fechas.length === 0)
    ) {
      sileo.error({
        title: "Por favor selecciona al menos un día",
        fill: "#fee2e2",
      });
      return;
    }

    const ruleToAdd = {
      ...newRule,
      fechaDesde: ruleMode === "range" ? newRule.fechaDesde : undefined,
      fechaHasta: ruleMode === "range" ? newRule.fechaHasta : undefined,
      fechas: ruleMode === "specific" ? newRule.fechas : undefined,
      reglas: newRule.reglas,
    };

    setForm((prev) => ({
      ...prev,
      pricing: [...(prev.pricing || []), ruleToAdd],
    }));

    setNewRule({
      nombre: "",
      fechaDesde: "",
      fechaHasta: "",
      fechas: [],
      valorUnico: 0,
      activa: true,
      reglas: "",
      globalRuleId: undefined,
    });
  };
  const removePricingRule = (index: number) => {
    setForm((prev) => ({
      ...prev,
      pricing: prev.pricing?.filter((_, i) => i !== index),
    }));
  };
  const toggleRuleActive = (index: number) => {
    setForm((prev) => ({
      ...prev,
      pricing: prev.pricing?.map((rule, i) =>
        i === index ? { ...rule, activa: !rule.activa } : rule,
      ),
    }));
  };

  // Individual image selection
  const toggleImageSelection = (id: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  // Select / deselect all
  const toggleSelectAll = () => {
    if (selectedImages.size === (form.imageItems?.length || 0)) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(
        new Set((form.imageItems || []).map((item) => item.id)),
      );
    }
  };
  // Delete all selected images
  const deleteSelectedImages = async () => {
    if (selectedImages.size === 0) return;
    setIsDeletingSelected(true);
    try {
      const idsToDelete = Array.from(selectedImages);
      await Promise.all(
        idsToDelete.map((id) =>
          deleteImageMutation.mutateAsync({ imageId: id }),
        ),
      );
      // Remove from local state
      setForm((prev) => ({
        ...prev,
        images: prev.images?.filter(
          (_, i) => !selectedImages.has(prev.imageItems?.[i]?.id || ""),
        ),
        imageItems: prev.imageItems?.filter(
          (item) => !selectedImages.has(item.id),
        ),
      }));
      sileo.success({
        title: `${selectedImages.size} ${selectedImages.size === 1 ? "imagen eliminada" : "imágenes seleccionadas"} correctamente`,
        fill: "#f0fdf4",
      });
      setSelectedImages(new Set());
    } catch (error) {
      sileo.error({
        title: "Error al eliminar las imágenes seleccionadas",
        fill: "#fee2e2",
      });
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleReorder = (newItems: any[]) => {
    // ONLY update local state during reorder to avoid flooding backend
    setForm((prev) => ({
      ...prev,
      imageItems: newItems,
      images: newItems.map((item) => item.url),
    }));
  };

  const handleDrag = (_: any, info: any) => {
    if (!isReorderMode) return;
    const threshold = 100;
    // info.point.y is absolute page coordinate, we need viewport-relative
    const y = info.point.y - window.scrollY;
    const viewportHeight = window.innerHeight;

    if (y < threshold) {
      setScrollDir(-1);
    } else if (y > viewportHeight - threshold) {
      setScrollDir(1);
    } else {
      setScrollDir(0);
    }
  };

  const handleDragEnd = () => {
    setScrollDir(0);
    syncImageOrder();
  };

  const syncImageOrder = async (options?: { silent?: boolean }) => {
    if (!form.imageItems || form.imageItems.length === 0) return;

    try {
      const imageOrders = form.imageItems.map((item, index) => ({
        id: item.id,
        order: index,
      }));

      await reorderImagesMutation.mutateAsync({
        id: propertyId,
        imageOrders,
      });

      if (!options?.silent) {
        sileo.success({
          title: "¡Orden de imágenes sincronizado!",
          fill: "#f0fdf4",
        });
      }
    } catch (error) {
      sileo.error({ title: "Error al sincronizar el orden", fill: "#fee2e2" });
      throw error;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const raw = Array.from(e.target.files);
    e.target.value = "";
    try {
      const newFiles = await compressImageFilesForPropertyUpload(raw);
      setForm((prev) => ({
        ...prev,
        files: [...(prev.files || []), ...newFiles],
      }));
    } catch {
      sileo.error({
        title: "No se pudieron procesar las imágenes",
        fill: "#fee2e2",
      });
    }
  };
  const removeFile = (index: number) => {
    setForm((prev) => ({
      ...prev,
      files: prev.files?.filter((_, i) => i !== index),
    }));
  };
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setForm((prev) => ({
        ...prev,
        videoFile: file,
      }));
    }
  };
  const removeVideoFile = () => {
    setForm((prev) => ({
      ...prev,
      videoFile: undefined,
    }));
  };
  const removeCurrentVideo = () => {
    setShowDeleteVideoDialog(true);
  };
  const confirmDeleteVideo = async () => {
    try {
      // If specialized delete fails (404), fallback to updating the field to empty
      try {
        await deleteVideoMutation.mutateAsync({ id: propertyId });
      } catch (e) {
        console.warn("Specialized delete failed, trying fallback update", e);
        await updateMutation.mutateAsync({
          id: propertyId,
          payload: { video: "" },
        });
      }
      setForm((prev) => ({ ...prev, video: "" }));
      sileo.success({
        title: "Video eliminado correctamente",
        fill: "#f0fdf4",
      });
    } catch (error) {
      sileo.error({ title: "Error al eliminar el video", fill: "#fee2e2" });
    } finally {
      setShowDeleteVideoDialog(false);
    }
  };
  const confirmDeleteProperty = async () => {
    try {
      await deletePropertyMutation.mutateAsync(propertyId);
      sileo.success({
        title: "Propiedad eliminada correctamente",
        fill: "#f0fdf4",
      });
      router.push("/admin/properties");
    } catch (error) {
      sileo.error({ title: "Error al eliminar la propiedad", fill: "#fee2e2" });
    } finally {
      setShowDeletePropertyDialog(false);
    }
  };
  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 bg-background min-h-[calc(100vh-4rem)]">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }
  if (isError || !property) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-foreground font-medium mb-1">
          No se pudo cargar la propiedad
        </p>
        <p className="text-muted-foreground text-sm mb-4">
          Verifica que el ID sea correcto
        </p>
        <Link
          href="/admin/properties"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/90 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </Link>
      </div>
    );
  }
  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";
  const totalImages = form.images?.length || 0;
  const allSelected = selectedImages.size === totalImages && totalImages > 0;
  return (
    <div
      ref={formTopRef}
      className="min-w-0 max-w-full overflow-x-hidden p-4 md:p-8 lg:p-10 pb-28 bg-background min-h-[calc(100vh-4rem)]"
    >
      <form
        onSubmit={handleSubmit}
        className="min-w-0 max-w-4xl mx-auto space-y-8 md:space-y-12"
      >
        <Tabs defaultValue="edit" className="w-full">
          {/* Header */}
          <div className="relative z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-4 md:py-0 mb-8 md:mb-12 bg-transparent border-b md:border-none border-border/40 transition-all duration-500">
            <div className="flex flex-col gap-6 md:gap-8">
              {/* Top Navigation Row */}
              <div className="flex items-center justify-between">
                <Link
                  href="/admin/properties"
                  className="p-3 md:p-3.5 rounded-xl border border-border bg-background hover:bg-muted shadow-sm transition-all active:scale-95 group shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>

                <Link
                  href={`/admin/properties/${propertyId}/owner`}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground font-bold px-4 h-10 shadow-sm transition-all active:scale-95 text-xs"
                >
                  <User className="w-3.5 h-3.5 text-primary/60" />
                  <span className="hidden sm:inline">
                    Gestionar Propietario
                  </span>
                  <span className="sm:hidden">Propietario</span>
                </Link>
              </div>

              {/* Title & Tabs Section */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 md:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h1 className="text-xl md:text-3xl font-bold tracking-tight leading-tight text-foreground truncate">
                      {property.title}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pb-0.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] md:text-[9px] font-bold text-emerald-500 uppercase tracking-widest leading-none">
                        Edición
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted/30 border border-border/50 text-muted-foreground">
                      <MapPin className="w-2.5 h-2.5" />
                      <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest truncate max-w-[200px]">
                        {property.location}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0">
                  <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/50 shadow-xs h-auto w-full md:w-auto">
                    <TabsTrigger
                      value="edit"
                      className="flex-1 md:flex-none rounded-lg px-6 md:px-8 py-2 font-bold text-[9px] md:text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                    >
                      Información
                    </TabsTrigger>
                    <TabsTrigger
                      value="bookings"
                      className="flex-1 md:flex-none rounded-lg px-6 md:px-8 py-2 font-bold text-[9px] md:text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                    >
                      Reservas
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </div>
          </div>

          <TabsContent
            value="edit"
            className="space-y-8 md:space-y-12 outline-none"
          >
            {/* Basic Info */}
            <FormSection
              title="Información General"
              description="Identidad y descripción del inmueble"
              icon={LayoutGrid}
              gradientFrom="from-blue-500/5"
              iconBg="bg-blue-600"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              defaultOpen={true}
            >
              <div className="space-y-6 md:space-y-8">
                {/* Title + Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Título</label>
                    <input
                      type="text"
                      value={form.title || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Ej: Mansión del Sol en Copacabana"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Código único</label>
                    <input
                      type="text"
                      value={form.code || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, code: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Ej: FINCA001 o villa-el-sol"
                    />
                  </div>
                </div>
                {/* Location */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Ubicación Geográfica</label>
                  <PropertyLocationSelect
                    value={selectedLocation}
                    onChange={(location) =>
                      setForm((prev) => ({
                        ...prev,
                        location,
                      }))
                    }
                    className={`${inputClass} pl-11`}
                  />
                </div>

                <ColombiaDepartmentsField
                  value={form.departamentos}
                  onChange={(departamentos) =>
                    setForm((prev) => ({ ...prev, departamentos }))
                  }
                />

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className={labelClass}>Descripción</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBeautifyDescription}
                      className="h-8 rounded-xl text-xs"
                    >
                      <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                      Arreglar texto
                    </Button>
                  </div>
                  <textarea
                    rows={12}
                    value={form.description || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className={`${inputClass} min-h-[220px] resize-y py-4 leading-relaxed`}
                    placeholder="Describe la experiencia única que ofrece esta propiedad..."
                  />
                </div>
                <CatalogFilterTagsField
                  value={form.catalogFilterTags}
                  onChange={(catalogFilterTags) =>
                    setForm((prev) => ({ ...prev, catalogFilterTags }))
                  }
                />
                {/* Type + Category + Capacity + Rating */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Tipo de propiedad</label>
                    <select
                      value={form.type || "FINCA"}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                      className={inputClass}
                    >
                      {[
                        { value: "FINCA", label: "Finca" },
                        { value: "CASA_CAMPESTRE", label: "Casa Campestre" },
                        { value: "VILLA", label: "Villa" },
                        { value: "HACIENDA", label: "Hacienda" },
                        { value: "QUINTA", label: "Quinta" },
                        { value: "APARTAMENTO", label: "Apartamento" },
                        { value: "CASA", label: "Casa" },
                        { value: "CASA_PRIVADA", label: "Casa Privada" },
                        {
                          value: "CASA_EN_CONJUNTO_CERRADO",
                          label: "Casa en Conjunto Cerrado",
                        },
                        { value: "VILLA_PRIVADA", label: "Villa Privada" },
                        { value: "CONDOMINIO", label: "Condominio" },
                        { value: "YATE", label: "Yate" },
                        { value: "ISLA", label: "Isla" },
                        { value: "GLAMPING", label: "Glamping" },
                      ].map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Capacidad de hospedaje</label>
                  
                    <div className="relative group">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="number"
                        min={1}
                        value={form.capacity || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            capacity: Number(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Rating deseado</label>
                    <div className="relative group">
                      <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="number"
                        step="0.1"
                        min={3.0}
                        max={5.0}
                        value={form.rating || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            rating: Number(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Visibility */}
            <FormSection
              title="Visibilidad"
              description="Activa la finca, catálogo web, catálogo Meta/WhatsApp, reservas, marketplace (venta) y favoritos"
              icon={Eye}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-600"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Habilitar Finca
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Permitir que la finca se muestre en la web
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, active: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Visible en catálogo
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Mostrar esta propiedad al público
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.visible}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, visible: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Catálogo Meta (WhatsApp)
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Incluir cuando el bot envía fincas. Si está off, la web
                        es solo informativa (sin reserva)
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.visibleInWhatsAppCatalog !== false}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        visibleInWhatsAppCatalog: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Propiedad Empresa
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Es gestionada directamente por nosotros
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.reservable}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, reservable: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Star className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Favorita
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Marcar como propiedad destacada
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.isFavorite}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, isFavorite: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Marketplace (venta)
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Listado en /marketplace; en la ficha el contacto es por
                        WhatsApp
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.marketplaceForSale === true}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        marketplaceForSale: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </FormSection>

            {form.marketplaceForSale ? (
              <FormSection
                title="Datos de venta (Marketplace)"
                description="Información para /marketplace y la ficha con ?modo=venta. No reemplaza los datos de arriendo."
                icon={Store}
                gradientFrom="from-rose-500/10"
                iconBg="bg-rose-600"
                iconShadow="shadow-rose-500/20"
                textColor="text-rose-500"
                defaultOpen
              >
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Valor de venta (COP)</label>
                      <div className="relative group">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formatPriceInput(form.salePriceCop ?? 0)}
                          onChange={(e) => {
                            const v = parseCOP(e.target.value);
                            setForm((prev) => ({
                              ...prev,
                              salePriceCop: v === 0 ? undefined : v,
                            }));
                          }}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Referencia en la web; precio final lo confirma un asesor.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Metros cuadrados (m²)</label>
                      <div className="relative group">
                        <Maximize2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 1200"
                          value={
                            form.saleSquareMeters != null &&
                            form.saleSquareMeters > 0
                              ? String(form.saleSquareMeters)
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            const v = raw ? parseInt(raw, 10) : undefined;
                            setForm((prev) => ({
                              ...prev,
                              saleSquareMeters:
                                v != null && v > 0 ? v : undefined,
                            }));
                          }}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Descripción de la venta
                    </label>
                    <textarea
                      rows={10}
                      value={form.saleDescription || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          saleDescription: e.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Texto comercial para compradores: terreno, construcción, plusvalía, documentación, etc."
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Se muestra en /marketplace y en la ficha con modo venta. La
                      descripción de arriendo sigue intacta para reservas.
                    </p>
                  </div>
                </div>
              </FormSection>
            ) : null}

            {/* Coexistence Rules */}
            <FormSection
              title="Reglas de Convivencia"
              description="Configura lo que está permitido en la propiedad"
              icon={Shield}
              gradientFrom="from-orange-500/10"
              iconBg="bg-orange-600"
              iconShadow="shadow-orange-500/20"
              textColor="text-orange-500"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Dog className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Mascotas
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Permite animales
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.allowsPets}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, allowsPets: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Listado de invitados
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Exigir lista en check-in (propietario y turista)
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.requiresGuestList ?? true}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, requiresGuestList: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Eventos
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sonido y decoración
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={!!form.allowsEventsContent}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        allowsEventsContent: checked,
                        ...(!checked
                          ? { eventCapacity: undefined, eventPackagePrice: undefined }
                          : {}),
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Familias
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Solo descanso
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.familyOnly}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, familyOnly: checked }))
                    }
                  />
                </div>
              </div>
              {form.allowsEventsContent ? (
                <div className="mt-4 space-y-4 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2 lg:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>
                        Capacidad máxima para evento (invitados)
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Personas que pueden asistir al evento o celebración (puede ser mayor
                        que la capacidad de hospedaje de arriba). Si lo deja vacío, el bot y
                        el catálogo usan solo la capacidad de hospedaje.
                      </p>
                      <div className="relative group max-w-xs">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                        <input
                          type="number"
                          min={Math.max(1, Number(form.capacity) || 1)}
                          placeholder={`Ej. ${Math.max((Number(form.capacity) || 0) + 10, 30)}`}
                          value={
                            form.eventCapacity !== undefined && form.eventCapacity !== null
                              ? form.eventCapacity
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setForm((prev) => ({ ...prev, eventCapacity: undefined }));
                              return;
                            }
                            const n = Number(raw);
                            setForm((prev) => ({
                              ...prev,
                              eventCapacity: Number.isFinite(n) ? n : undefined,
                            }));
                          }}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>
                        Precio de referencia para el evento (COP)
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Monto orientador para la celebración con hasta la cantidad de
                        invitados indicada (no sustituye la cotización por noches ni
                        temporadas). Opcional.
                      </p>
                      <div className="relative group max-w-xs">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej. 2.500.000"
                          value={
                            form.eventPackagePrice !== undefined &&
                            form.eventPackagePrice !== null
                              ? formatPriceInput(String(form.eventPackagePrice))
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "" || raw.trim() === "") {
                              setForm((prev) => ({
                                ...prev,
                                eventPackagePrice: undefined,
                              }));
                              return;
                            }
                            setForm((prev) => ({
                              ...prev,
                              eventPackagePrice: parseCOP(raw),
                            }));
                          }}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </FormSection>

            {/* Service Staff */}
            <FormSection
              title="Personal de Servicio (sujeto a disponibilidad)"
              description="Gestión de personal disponible para contratación"
              icon={UserCheck}
              gradientFrom="from-blue-600/10"
              iconBg="bg-blue-600"
              iconShadow="shadow-blue-600/20"
              textColor="text-blue-600"
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Servicio Disponible
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Ofrecer personal de cocina/aseo
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={form.serviceStaffAvailable}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          serviceStaffAvailable: checked,
                        }))
                      }
                    />
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30 transition-all duration-500",
                      !form.serviceStaffAvailable &&
                        "opacity-40 grayscale pointer-events-none",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Obligatorio
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          El cliente debe contratarlo
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={form.serviceStaffMandatory}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          serviceStaffMandatory: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/60">
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Depósito por daños (reembolsable)
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Se agrega al final de la descripción al guardar. También en chat
                      y contratos.
                    </p>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-amber-600 transition-colors" />
                      <input
                        type="text"
                        value={formatPriceInput(
                          String(form.depositoDanosReembolsable ?? 0),
                        )}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            depositoDanosReembolsable: parseCOP(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11`}
                        placeholder="Ej: 200.000 (0 = no aplica)"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Manilla condominio
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Para conjuntos cerrados. Se incluye en la descripción al guardar.
                    </p>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-600 transition-colors" />
                      <input
                        type="text"
                        value={formatPriceInput(
                          String(form.manillaCondominio ?? 0),
                        )}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            manillaCondominio: parseCOP(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11`}
                        placeholder="Ej: 50.000 (0 = no aplica)"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Auxilio de aseo</label>
                    <p className="text-[11px] text-muted-foreground">
                      Cobro único de limpieza final. Se incluye en la descripción al
                      guardar y precarga el contrato.
                    </p>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
                      <input
                        type="text"
                        value={formatPriceInput(String(form.depositoAseo ?? 0))}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            depositoAseo: parseCOP(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11`}
                        placeholder="Ej: 100.000 (0 = no aplica)"
                      />
                    </div>
                  </div>
                </div>

                {form.serviceStaffAvailable && (
                  <div className="space-y-1.5 max-w-md animate-in fade-in slide-in-from-top-2 duration-500">
                    <label className={labelClass}>
                      Precio por día (Personal)
                    </label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
                      <input
                        type="text"
                        value={formatPriceInput(
                          form.serviceStaffPrice?.toString() || "0",
                        )}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            serviceStaffPrice: parseCOP(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11 font-bold text-blue-600`}
                        placeholder="Ej: 80,000"
                      />
                    </div>
                  </div>
                )}
              </div>
            </FormSection>

            {/* Pricing Section */}
            <FormSection
              title="Tarifas y Temporadas"
              description="Gestiona el precio base y las reglas de temporada"
              icon={DollarSign}
              gradientFrom="from-green-500/10"
              iconBg="bg-green-600"
              iconShadow="shadow-green-500/20"
              textColor="text-green-600"
            >
              <div className="space-y-8">
                {/* Base Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Precio Base (Por noche)
                    </label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-green-500 transition-colors" />
                      <input
                        type="text"
                        required
                        value={formatPriceInput(form.priceBase || 0)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            priceBase: parseCOP(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11 font-black text-lg text-green-500`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Precio Original (Tachado)
                    </label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-red-500 transition-colors" />
                      <input
                        type="text"
                        value={formatPriceInput(form.priceOriginal || 0)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            priceOriginal: parseCOP(e.target.value),
                          }))
                        }
                        className={`${inputClass} pl-11 font-black text-lg text-red-500/50`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border w-full" />

                {/* Rules Management */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-500" />
                      Reglas de Temporada Globales
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {globalRules?.map((gr) => {
                      const existingRule = form.pricing?.find(
                        (r) => r.globalRuleId === gr._id,
                      );
                      const isActive = !!existingRule && existingRule.activa;
                      return (
                        <div
                          key={gr._id}
                          className={cn(
                            "flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-[32px] border transition-all duration-300",
                            isActive
                              ? "bg-background border-border shadow-sm"
                              : "bg-muted/10 border-border/50 opacity-60 grayscale-[0.5]",
                          )}
                        >
                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex items-center justify-between mb-2">
                              <p
                                className={cn(
                                  "font-bold text-sm tracking-tight",
                                  isActive
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                                )}
                              >
                                {gr.nombre}
                              </p>
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => {
                                  setForm((prev) => {
                                    const existing = prev.pricing || [];
                                    const idx = existing.findIndex(
                                      (r) => r.globalRuleId === gr._id,
                                    );

                                    if (!checked) {
                                      if (idx !== -1) {
                                        const newPricing = [...existing];
                                        newPricing[idx] = {
                                          ...newPricing[idx],
                                          activa: false,
                                        };
                                        return { ...prev, pricing: newPricing };
                                      } else {
                                        return {
                                          ...prev,
                                          pricing: [
                                            ...existing,
                                            {
                                              nombre: gr.nombre,
                                              fechaDesde: gr.fechaDesde || "",
                                              fechaHasta: gr.fechaHasta || "",
                                              fechas: gr.fechas || [],
                                              valorUnico: 0,
                                              activa: false,
                                              reglas: "",
                                              globalRuleId: gr._id,
                                              order: existing.length,
                                            },
                                          ],
                                        };
                                      }
                                    }

                                    if (idx !== -1) {
                                      const newPricing = [...existing];
                                      newPricing[idx] = {
                                        ...newPricing[idx],
                                        activa: true,
                                      };
                                      return { ...prev, pricing: newPricing };
                                    }
                                    return {
                                      ...prev,
                                      pricing: [
                                        ...existing,
                                        {
                                          nombre: gr.nombre,
                                          fechaDesde: gr.fechaDesde || "",
                                          fechaHasta: gr.fechaHasta || "",
                                          fechas: gr.fechas || [],
                                          valorUnico: 0,
                                          activa: true,
                                          reglas: "",
                                          globalRuleId: gr._id,
                                          order: existing.length,
                                        },
                                      ],
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-3">
                              <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 w-fit shadow-sm">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                {gr.fechas && gr.fechas.length > 0 ? (
                                  <span className="flex items-center gap-1 uppercase tracking-wider">
                                    {gr.fechas.length} días (
                                    {gr.fechas.slice(0, 3).join(", ")}
                                    {gr.fechas.length > 3 && "..."})
                                  </span>
                                ) : (
                                  <span className="uppercase tracking-wider">
                                    {gr.fechaDesde}
                                    <span className="text-muted-foreground/30 mx-1.5">
                                      —
                                    </span>
                                    {gr.fechaHasta}
                                  </span>
                                )}
                              </span>

                              <div
                                className={cn(
                                  "relative flex-1 sm:max-w-[240px] transition-all duration-500",
                                  isActive
                                    ? "opacity-100 translate-x-0"
                                    : "opacity-0 -translate-x-4 pointer-events-none",
                                )}
                              >
                                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                  type="text"
                                  value={
                                    existingRule?.valorUnico
                                      ? formatPriceInput(
                                          existingRule.valorUnico.toString(),
                                        )
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const val = parseCOP(e.target.value);
                                    setForm((prev) => {
                                      const existing = prev.pricing || [];
                                      const idx = existing.findIndex(
                                        (r) => r.globalRuleId === gr._id,
                                      );
                                      if (idx !== -1) {
                                        const newPricing = [...existing];
                                        newPricing[idx] = {
                                          ...newPricing[idx],
                                          valorUnico: val,
                                        };
                                        return {
                                          ...prev,
                                          pricing: newPricing,
                                        };
                                      }
                                      return prev;
                                    });
                                  }}
                                  placeholder="Valor por noche..."
                                  className="w-full bg-muted/20 border border-border rounded-2xl px-4 py-3 pl-10 text-xs font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-xs"
                                />
                              </div>

                              {/* Capacity Rules Toggle */}
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm((prev) => {
                                      const existing = prev.pricing || [];
                                      const idx = existing.findIndex(
                                        (r) => r.globalRuleId === gr._id,
                                      );
                                      if (idx !== -1) {
                                        const hasSubRules =
                                          !!existing[idx].subReglasCapacidad
                                            ?.length;
                                        const newPricing = [...existing];
                                        newPricing[idx] = {
                                          ...newPricing[idx],
                                          subReglasCapacidad: hasSubRules
                                            ? []
                                            : [
                                                {
                                                  capacidadMin: 1,
                                                  capacidadMax: 10,
                                                  valorUnico: 0,
                                                },
                                              ],
                                        };
                                        return { ...prev, pricing: newPricing };
                                      }
                                      return prev;
                                    });
                                  }}
                                  className="text-[10px] font-bold text-purple-600 hover:bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20 transition-all flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  {existingRule?.subReglasCapacidad?.length
                                    ? "Reducir Capacidad"
                                    : "Precios por Capacidad"}
                                </button>
                              )}
                            </div>

                            {isActive &&
                              existingRule?.subReglasCapacidad &&
                              existingRule.subReglasCapacidad.length > 0 && (
                                <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                  {existingRule.subReglasCapacidad.map(
                                    (sub: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2 bg-muted/30 rounded-2xl p-3 border border-border"
                                      >
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min={1}
                                            value={sub.capacidadMin}
                                            onChange={(e) => {
                                              const val =
                                                parseInt(e.target.value) || 1;
                                              setForm((prev) => {
                                                const existing =
                                                  prev.pricing || [];
                                                const ruleIdx =
                                                  existing.findIndex(
                                                    (r) =>
                                                      r.globalRuleId === gr._id,
                                                  );
                                                if (ruleIdx !== -1) {
                                                  const newPricing = [
                                                    ...existing,
                                                  ];
                                                  const subRules = [
                                                    ...(newPricing[ruleIdx]
                                                      .subReglasCapacidad ||
                                                      []),
                                                  ];
                                                  subRules[idx] = {
                                                    ...subRules[idx],
                                                    capacidadMin: val,
                                                  };
                                                  newPricing[ruleIdx] = {
                                                    ...newPricing[ruleIdx],
                                                    subReglasCapacidad:
                                                      subRules,
                                                  };
                                                  return {
                                                    ...prev,
                                                    pricing: newPricing,
                                                  };
                                                }
                                                return prev;
                                              });
                                            }}
                                            className="w-14 bg-background border border-border rounded-xl px-2 py-1.5 text-xs text-center font-bold"
                                          />
                                          <span className="text-muted-foreground">
                                            —
                                          </span>
                                          <input
                                            type="number"
                                            min={1}
                                            value={sub.capacidadMax}
                                            onChange={(e) => {
                                              const val =
                                                parseInt(e.target.value) || 1;
                                              setForm((prev) => {
                                                const existing =
                                                  prev.pricing || [];
                                                const ruleIdx =
                                                  existing.findIndex(
                                                    (r) =>
                                                      r.globalRuleId === gr._id,
                                                  );
                                                if (ruleIdx !== -1) {
                                                  const newPricing = [
                                                    ...existing,
                                                  ];
                                                  const subRules = [
                                                    ...(newPricing[ruleIdx]
                                                      .subReglasCapacidad ||
                                                      []),
                                                  ];
                                                  subRules[idx] = {
                                                    ...subRules[idx],
                                                    capacidadMax: val,
                                                  };
                                                  newPricing[ruleIdx] = {
                                                    ...newPricing[ruleIdx],
                                                    subReglasCapacidad:
                                                      subRules,
                                                  };
                                                  return {
                                                    ...prev,
                                                    pricing: newPricing,
                                                  };
                                                }
                                                return prev;
                                              });
                                            }}
                                            className="w-14 bg-background border border-border rounded-xl px-2 py-1.5 text-xs text-center font-bold"
                                          />
                                        </div>
                                        <div className="relative flex-1">
                                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                          <input
                                            type="text"
                                            value={
                                              sub.valorUnico
                                                ? formatPriceInput(
                                                    sub.valorUnico.toString(),
                                                  )
                                                : ""
                                            }
                                            onChange={(e) => {
                                              const val = parseCOP(
                                                e.target.value,
                                              );
                                              setForm((prev) => {
                                                const existing =
                                                  prev.pricing || [];
                                                const ruleIdx =
                                                  existing.findIndex(
                                                    (r) =>
                                                      r.globalRuleId === gr._id,
                                                  );
                                                if (ruleIdx !== -1) {
                                                  const newPricing = [
                                                    ...existing,
                                                  ];
                                                  const subRules = [
                                                    ...(newPricing[ruleIdx]
                                                      .subReglasCapacidad ||
                                                      []),
                                                  ];
                                                  subRules[idx] = {
                                                    ...subRules[idx],
                                                    valorUnico: val,
                                                  };
                                                  newPricing[ruleIdx] = {
                                                    ...newPricing[ruleIdx],
                                                    subReglasCapacidad:
                                                      subRules,
                                                  };
                                                  return {
                                                    ...prev,
                                                    pricing: newPricing,
                                                  };
                                                }
                                                return prev;
                                              });
                                            }}
                                            placeholder="Precio"
                                            className="w-full bg-background border border-border rounded-xl px-2 py-1.5 pl-8 text-xs font-bold"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setForm((prev) => {
                                              const existing =
                                                prev.pricing || [];
                                              const ruleIdx =
                                                existing.findIndex(
                                                  (r) =>
                                                    r.globalRuleId === gr._id,
                                                );
                                              if (ruleIdx !== -1) {
                                                const newPricing = [
                                                  ...existing,
                                                ];
                                                const subRules = newPricing[
                                                  ruleIdx
                                                ].subReglasCapacidad?.filter(
                                                  (_, i) => i !== idx,
                                                );
                                                newPricing[ruleIdx] = {
                                                  ...newPricing[ruleIdx],
                                                  subReglasCapacidad: subRules,
                                                };
                                                return {
                                                  ...prev,
                                                  pricing: newPricing,
                                                };
                                              }
                                              return prev;
                                            });
                                          }}
                                          className="p-2 hover:bg-red-500/10 rounded-xl text-red-500 transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ),
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForm((prev) => {
                                        const existing = prev.pricing || [];
                                        const ruleIdx = existing.findIndex(
                                          (r) => r.globalRuleId === gr._id,
                                        );
                                        if (ruleIdx !== -1) {
                                          const newPricing = [...existing];
                                          const subRules =
                                            newPricing[ruleIdx]
                                              .subReglasCapacidad || [];
                                          const lastSub =
                                            subRules[subRules.length - 1];
                                          const nextMin = lastSub
                                            ? lastSub.capacidadMax + 1
                                            : 1;
                                          newPricing[ruleIdx] = {
                                            ...newPricing[ruleIdx],
                                            subReglasCapacidad: [
                                              ...subRules,
                                              {
                                                capacidadMin: nextMin,
                                                capacidadMax: nextMin + 5,
                                                valorUnico: 0,
                                              },
                                            ],
                                          };
                                          return {
                                            ...prev,
                                            pricing: newPricing,
                                          };
                                        }
                                        return prev;
                                      });
                                    }}
                                    className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 px-2"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Añadir rango
                                  </button>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                    {(!globalRules || globalRules.length === 0) && (
                      <div className="text-center py-10 border-2 border-dashed border-border rounded-[32px] bg-muted/20">
                        <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-muted-foreground">
                          No hay reglas globales creadas. Ve a "Reglas Globales"
                          en el panel.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Video Section */}
            <FormSection
              title="Video Promocional"
              description="Sube un video de la propiedad para destacar en el catálogo"
              icon={Video}
              gradientFrom="from-red-500/10"
              iconBg="bg-red-600"
              iconShadow="shadow-red-500/20"
              textColor="text-red-500"
            >
              <div className="space-y-4">
                {form.video || form.videoFile ? (
                  <div className="relative group rounded-[32px] overflow-hidden bg-muted aspect-video ring-1 ring-border shadow-sm max-h-[400px] mx-auto">
                    {form.videoFile ? (
                      <video
                        src={URL.createObjectURL(form.videoFile)}
                        className="w-full h-full object-contain"
                        controls
                      />
                    ) : (
                      <video
                        src={form.video}
                        className="w-full h-full object-contain"
                        controls
                      />
                    )}
                    <button
                      type="button"
                      onClick={
                        form.videoFile ? removeVideoFile : removeCurrentVideo
                      }
                      className="absolute top-4 right-4 p-3 rounded-2xl bg-background/90 text-red-500 shadow-xl opacity-0 group-hover:opacity-100 transition-all translate-y-[-10px] group-hover:translate-y-0 active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-4 left-4">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20">
                        {form.videoFile ? "Por subir" : "Actual"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative group">
                    <input
                      type="file"
                      id="video-upload"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoSelect}
                    />
                    <label
                      htmlFor="video-upload"
                      className="flex flex-col items-center justify-center gap-4 w-full p-12 rounded-[40px] border-2 border-dashed border-border hover:border-red-500/20 hover:bg-red-500/5 text-muted-foreground hover:text-red-500 cursor-pointer transition-all duration-500"
                    >
                      <div className="p-5 rounded-[24px] bg-muted group-hover:bg-red-500/10 group-hover:scale-110 transition-all duration-500">
                        <Video className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <span className="text-base font-bold tracking-tight block text-foreground group-hover:text-red-500">
                          Subir Video de la Propiedad
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mt-1 block">
                          Archivos MP4, MOV o WebM
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </FormSection>

            {/* Location Section */}
            <FormSection
              title="Ubicación Satelital"
              description="Marca la ubicación exacta de la propiedad en el mapa"
              icon={Globe}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-600"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-600"
            >
              <div className="space-y-6">
                <MapPickerComponent
                  lat={form.lat ?? 0}
                  lng={form.lng ?? 0}
                  onChange={(newLat: number, newLng: number) =>
                    setForm((prev) => ({ ...prev, lat: newLat, lng: newLng }))
                  }
                />
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Latitud (manual)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lat ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          lat:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        }))
                      }
                      className={inputClass}
                      placeholder="4.3007"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Longitud (manual)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lng ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          lng:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        }))
                      }
                      className={inputClass}
                      placeholder="-74.8006"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Features Section */}
            <FormSection
              title="Características y Zonas"
              description="Gestiona las amenidades y distribuciones de la propiedad"
              icon={ListChecks}
              gradientFrom="from-orange-500/10"
              iconBg="bg-orange-600"
              iconShadow="shadow-orange-500/20"
              textColor="text-orange-600"
            >
              <div className="space-y-8">
                <ZoneTemplateImportBlock
                  iconography={iconography || []}
                  features={form.features || []}
                  onMerged={({ features, extraZoneNames }) => {
                    setForm((prev) => ({ ...prev, features }));
                    setCustomZones((prev) => {
                      const s = new Set(prev);
                      for (const z of extraZoneNames) {
                        if (z.trim().toLowerCase() !== "general") s.add(z);
                      }
                      return Array.from(s);
                    });
                    sileo.success({
                      title: "Zonas aplicadas",
                      description:
                        "Las plantillas se copiaron a esta finca. Guarda los cambios para persistirlos.",
                      fill: "#f0fdf4",
                    });
                  }}
                />

                {/* Add New Zone */}
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Ej: Primer piso, Zona húmeda..."
                    className="flex-1 bg-background border border-border rounded-2xl px-5 py-4 text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (
                          newZoneName.trim() &&
                          newZoneName.trim().toLowerCase() !== "general" &&
                          !customZones.includes(newZoneName.trim())
                        ) {
                          setCustomZones((prev) => [
                            ...prev,
                            newZoneName.trim(),
                          ]);
                          setNewZoneName("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="px-8 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 max-md:h-14 active:scale-95 flex items-center justify-center gap-2"
                    onClick={() => {
                      if (
                        newZoneName.trim() &&
                        newZoneName.trim().toLowerCase() !== "general" &&
                        !customZones.includes(newZoneName.trim())
                      ) {
                        setCustomZones((prev) => [...prev, newZoneName.trim()]);
                        setNewZoneName("");
                      }
                    }}
                  >
                    <Plus className="w-5 h-5" />
                    <span>Añadir Zona</span>
                  </button>
                </div>

                {/* Render zones */}
                <div className="space-y-6">
                  <div className="border border-border rounded-[32px] p-6 bg-muted/20">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                        <LayoutGrid className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-bold text-foreground text-sm uppercase tracking-widest leading-none">
                        General
                      </h3>
                    </div>
                    <FeaturePicker
                      features={(form.features || []).filter(
                        (f) => (f.zone || "General") === "General",
                      )}
                      onChange={(newFeatures) => {
                        setForm((prev) => {
                          const otherFeatures = (prev.features || []).filter(
                            (f) => (f.zone || "General") !== "General",
                          );
                          const updatedZoneFeatures = newFeatures.map((f) => ({
                            ...f,
                            zone: undefined,
                          }));
                          return {
                            ...prev,
                            features: [
                              ...otherFeatures,
                              ...updatedZoneFeatures,
                            ],
                          };
                        });
                      }}
                      catalog={iconography || []}
                    />
                  </div>

                  <Reorder.Group
                    axis="y"
                    values={customZones}
                    onReorder={setCustomZones}
                    className="space-y-6"
                  >
                    {customZones.map((zone) => (
                      <ReorderableZoneItem
                        key={zone}
                        zone={zone}
                        form={form}
                        setForm={setForm}
                        customZones={customZones}
                        setCustomZones={setCustomZones}
                        editingZone={editingZone}
                        setEditingZone={setEditingZone}
                        iconography={iconography}
                        onDragEnd={() => {
                          const { catalogIds, ...payloadWithoutFeatures } =
                            form;
                          updateMutation.mutate({
                            id: propertyId,
                            payload: {
                              ...payloadWithoutFeatures,
                              features: form.features,
                              zoneOrder: ["General", ...customZones],
                            },
                          });
                        }}
                      />
                    ))}
                  </Reorder.Group>
                </div>

                {/* Featured Icons */}
                <div className="pt-8 border-t border-border mt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <LayoutGrid className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-xs font-black text-foreground uppercase tracking-widest leading-none">
                      Iconos Card Principal
                    </h4>
                  </div>
                  <CardIconPicker
                    selectedIconIds={form.featuredIcons || []}
                    availableFeatures={form.features || []}
                    onChange={(ids) =>
                      setForm((prev) => ({ ...prev, featuredIcons: ids }))
                    }
                    onAddFeature={(feature) =>
                      setForm((prev) => ({
                        ...prev,
                        features: [...(prev.features || []), feature],
                      }))
                    }
                    catalog={iconography || []}
                    isLoading={isLoadingFeatures}
                  />
                </div>
              </div>
            </FormSection>

            {/* Images */}
            {/* Multimedia Section */}
            <FormSection
              title="Multimedia & Galería"
              description="Administra las imágenes de la propiedad y su orden visual"
              icon={ImageIcon}
              gradientFrom="from-pink-500/10"
              iconBg="bg-pink-600"
              iconShadow="shadow-pink-500/20"
              textColor="text-pink-600"
              customHeaderActions={
                totalImages > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsReorderMode(!isReorderMode)}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 active:scale-95 shadow-sm min-h-[48px]",
                        isReorderMode
                          ? "bg-primary text-white border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/20 hover:text-primary hover:bg-primary/5",
                      )}
                    >
                      <Settings2 className="w-4 h-4" />
                      <span>{isReorderMode ? "Finalizar" : "Reordenar"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 active:scale-95 shadow-sm min-h-[48px]",
                        allSelected
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-muted-foreground border-border hover:border-primary/20 hover:text-primary hover:bg-primary/5",
                      )}
                    >
                      {allSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/30" />
                      )}
                      <span>{allSelected ? "Todas" : "Seleccionar"}</span>
                    </button>

                    {selectedImages.size > 0 && (
                      <button
                        type="button"
                        onClick={deleteSelectedImages}
                        disabled={isDeletingSelected}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 min-h-[48px]"
                      >
                        {isDeletingSelected ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        <span>Eliminar ({selectedImages.size})</span>
                      </button>
                    )}
                  </div>
                )
              }
            >
              <div className="space-y-10">
                <Reorder.Group
                  axis="y"
                  values={form.imageItems || []}
                  onReorder={handleReorder}
                  className={
                    isReorderMode
                      ? "flex flex-col gap-4"
                      : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6"
                  }
                >
                  {(form.imageItems || []).map((item, index) => (
                    <ReorderableImageItem
                      key={item.id}
                      item={item}
                      index={index}
                      isReorderMode={isReorderMode}
                      isSelected={selectedImages.has(item.id)}
                      toggleImageSelection={toggleImageSelection}
                      handleDrag={handleDrag}
                      handleDragEnd={handleDragEnd}
                    />
                  ))}
                </Reorder.Group>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {form.files?.map((file, index) => (
                    <div
                      key={`new-${index}`}
                      className="relative group rounded-[32px] overflow-hidden aspect-square bg-primary/5 ring-2 ring-dashed ring-primary/20"
                    >
                      <Image
                        src={URL.createObjectURL(file)}
                        alt={`Nueva ${index + 1}`}
                        fill
                        className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
                        onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-4 right-4 p-2.5 rounded-2xl bg-background/90 text-red-500 shadow-xl opacity-0 group-hover:opacity-100 transition-all translate-y-[-10px] group-hover:translate-y-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-4 left-4">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-primary text-white px-4 py-2 rounded-full shadow-lg">
                          Nueva
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative group">
                  <input
                    type="file"
                    id="image-upload"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center gap-4 w-full p-16 rounded-[48px] border-2 border-dashed border-border hover:border-pink-500/20 hover:bg-pink-500/5 text-muted-foreground hover:text-pink-600 cursor-pointer transition-all duration-500"
                  >
                    <div className="p-6 rounded-[28px] bg-muted group-hover:bg-pink-500/10 group-hover:scale-110 transition-all duration-500">
                      <Plus className="w-10 h-10" />
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-bold tracking-tight block text-foreground">
                        Sube tus mejores tomas
                      </span>
                      <span className="text-sm font-semibold opacity-60 mt-1 block">
                        JPG, PNG o WebP de alta resolución
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </FormSection>

            {/* Danger Zone Section */}
            <FormSection
              title="Zona de Peligro"
              description="Acciones críticas que no se pueden deshacer"
              icon={AlertCircle}
              gradientFrom="from-red-500/10"
              iconBg="bg-red-600"
              iconShadow="shadow-red-500/20"
              textColor="text-red-500"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 py-4">
                <div className="max-w-md">
                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    Eliminar Propiedad
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Esta acción purgará todos los datos, imágenes y registros de
                    esta finca. No hay vuelta atrás.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeletePropertyDialog(true)}
                  className="inline-flex items-center justify-center gap-3 px-10 py-4 rounded-[24px] bg-red-500/5 border-2 border-red-500/20 text-red-500 font-black uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95 group shadow-sm"
                >
                  <Trash2 className="w-5 h-5 group-hover:animate-shake" />
                  Eliminar Finca
                </button>
              </div>
            </FormSection>

            {/* Save actions — fijo al fondo de la pantalla */}
            <AdminFloatingSaveBar>
              <div className="flex min-w-0 flex-row gap-1.5">
                <button
                  type="button"
                  onClick={scrollToFormTop}
                  title="Volver arriba"
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-foreground shadow-sm transition-all duration-300 hover:bg-muted/80 active:scale-[0.98]"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Arriba</span>
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-primary via-primary/90 to-primary/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all duration-500 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:px-6 sm:text-xs"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <div className="rounded-lg bg-white/20 p-1.5 transition-transform duration-500 group-hover:scale-110">
                        <Save className="h-4 w-4 font-black" />
                      </div>
                      <span className="truncate sm:hidden">Guardar</span>
                      <span className="hidden truncate sm:inline">
                        Sincronizar Cambios
                      </span>
                    </>
                  )}
                </button>
              </div>
            </AdminFloatingSaveBar>

            {/* Dialogs */}
            <AlertDialog
              open={showDeleteVideoDialog}
              onOpenChange={setShowDeleteVideoDialog}
            >
              <AlertDialogContent className="rounded-[40px] border-none shadow-2xl p-8">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                    ¿Eliminar video?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base text-muted-foreground mt-4 leading-relaxed">
                    Esta acción eliminará el video actual de la finca. Podrás
                    subir uno nuevo después de guardar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                  <AlertDialogCancel className="rounded-2xl px-8 h-12 font-bold bg-muted border-none hover:bg-muted/80">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmDeleteVideo();
                    }}
                    disabled={deleteVideoMutation.isPending}
                    className="rounded-2xl px-8 h-12 font-bold bg-red-500! hover:bg-red-600 text-white"
                  >
                    {deleteVideoMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Eliminar Video
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              open={showDeletePropertyDialog}
              onOpenChange={setShowDeletePropertyDialog}
            >
              <AlertDialogContent className="rounded-[40px] border-none shadow-2xl p-8">
                <AlertDialogHeader>
                  <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                    ¿Estás seguro de eliminar?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base text-muted-foreground mt-4 leading-relaxed">
                    Esta acción es irreversible. Se eliminarán permanentemente
                    todos los datos de la propiedad y sus registros asociados
                    del servidor.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                  <AlertDialogCancel className="rounded-2xl px-10 h-14 font-bold bg-muted border-none hover:bg-muted/80">
                    Regresar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmDeleteProperty();
                    }}
                    disabled={deletePropertyMutation.isPending}
                    className="rounded-2xl px-10 h-14 font-bold bg-red-500! hover:bg-red-600 text-white"
                  >
                    {deletePropertyMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : null}
                    Confirmar Eliminación
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="bookings" className="outline-none py-6">
            <section className="rounded-[48px] bg-background border border-border shadow-sm overflow-hidden p-8">
              <PropertyReservationsHistory propertyId={propertyId} />
            </section>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}
