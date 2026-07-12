"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { sileo } from "sileo";
import { useCreateProperty } from "@/features/fincas/queries/fincas.queries";
import { useIconography } from "@/features/admin/queries/features.queries";
import { useGlobalPricingRules } from "@/features/fincas/queries/global-pricing.queries";
import { FeaturePicker } from "./feature-picker";
import { makeDuplicateZoneName } from "../../utils/zone-utils";
import { CardIconPicker } from "./card-icon-picker";
import type { UpdatePropertyPayload } from "@/features/fincas/types/fincas.types";
import { MapPicker as MapPickerComponent } from "./map-picker";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  X,
  MapPin,
  Users,
  DollarSign,
  FileText,
  ImageIcon,
  ListChecks,
  Video,
  Globe,
  PlusCircle,
  Tag,
  BarChart3,
  Calendar,
  Trash2,
  Copy,
  AlertCircle,
  Eye,
  CalendarCheck,
  CheckCircle2,
  User,
  Wand2,
  Dog,
  Music,
  HeartHandshake,
  Shield,
  UserCheck,
  Star,
  LayoutGrid,
  Store,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import {
  formatPriceInput,
  parseCOP,
  cn,
  tidyDescriptionText,
} from "@/lib/utils";
import { mergeDepositIntoPropertyDescription } from "@/lib/property-description-deposits";
import { compressImageFilesForPropertyUpload } from "@/lib/property-upload-media";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FormSection } from "../shared/form-section";
import { AdminFloatingSaveBar } from "../shared/admin-floating-save-bar";
import { ZoneTemplateImportBlock } from "./zone-template-import-block";
import { CatalogFilterTagsField } from "./catalog-filter-tags-field";
import { ColombiaDepartmentsField } from "./colombia-departments-field";
import { PropertyLocationSelect } from "./property-location-select";
import { useAllCategoryZoneTemplates } from "@/features/admin/queries/category-zone-templates.queries";
import type { PropertyFeature } from "@/features/fincas/types/fincas.types";

/** Lowercase key for de-duping zone labels (General is special-cased). */
function zoneKey(raw: string): string | null {
  const z = raw.trim();
  if (!z) return null;
  return z.toLowerCase() === "general" ? "general" : z.toLowerCase();
}

/**
 * Zones to show while creating a property: only General plus zones the user
 * actually added or that already have rows in `features`. Listing every
 * catalog template name here looked like a full import and broke delete
 * (remove only touched `customZones`, not template-derived names).
 */
function orderedZoneNames(
  templates: { name: string }[] | undefined,
  customZones: string[],
  features: PropertyFeature[] | undefined,
): string[] {
  const activeByKey = new Map<string, string>();
  const register = (raw: string) => {
    const k = zoneKey(raw);
    if (!k) return;
    const display =
      k === "general" ? "General" : raw.trim();
    if (!activeByKey.has(k)) activeByKey.set(k, display);
  };

  register("General");
  for (const z of customZones) register(z);
  for (const f of features ?? []) register(f.zone || "General");

  const out: string[] = [];
  const seenKeys = new Set<string>();

  const add = (raw: string) => {
    const k = zoneKey(raw);
    if (!k || !activeByKey.has(k) || seenKeys.has(k)) return;
    seenKeys.add(k);
    out.push(activeByKey.get(k)!);
  };

  add("General");

  for (const t of templates ?? []) {
    const name = t.name?.trim();
    if (!name) continue;
    if (zoneKey(name) === "general") continue;
    add(name);
  }

  for (const z of customZones) add(z);

  for (const f of features ?? []) add(f.zone || "General");

  return out;
}

const PROPERTY_TYPES = [
  { value: "FINCA", label: "Finca" },
  { value: "CASA_CAMPESTRE", label: "Casa Campestre" },
  { value: "VILLA", label: "Villa" },
  { value: "HACIENDA", label: "Hacienda" },
  { value: "QUINTA", label: "Quinta" },
  { value: "APARTAMENTO", label: "Apartamento" },
  { value: "CASA", label: "Casa" },
  { value: "CASA_PRIVADA", label: "Casa Privada" },
  { value: "CASA_EN_CONJUNTO_CERRADO", label: "Casa en Conjunto Cerrado" },
  { value: "VILLA_PRIVADA", label: "Villa Privada" },
  { value: "CONDOMINIO", label: "Condominio" },
  { value: "YATE", label: "Yate" },
  { value: "ISLA", label: "Isla" },
  { value: "GLAMPING", label: "Glamping" },
];

export function PropertyCreateForm() {
  const router = useRouter();
  const createMutation = useCreateProperty();
  const { data: iconography, isLoading: isLoadingFeatures } = useIconography();
  const { data: globalRules } = useGlobalPricingRules();

  const [form, setForm] = useState<UpdatePropertyPayload>({
    title: "",
    description: "",
    location: "",
    departamentos: [],
    capacity: 20,
    code: "",
    type: "FINCA",
    priceBase: 0,
    priceBaja: 0,
    priceMedia: 0,
    priceAlta: 0,
    pricing: [],
    lat: 4.3007,
    lng: -74.8006,
    features: [],
    files: [],
    catalogIds: ["m977kbc084b6rgbrxcnzakvw0581mmvv"],
    visible: true,
    active: true,
    reservable: true,
    visibleInWhatsAppCatalog: true,
    priceOriginal: 0,
    isFavorite: false,
    featuredIcons: [],
    allowsPets: false,
    requiresGuestList: true,
    allowsEventsContent: false,
    eventCapacity: undefined,
    eventPackagePrice: undefined,
    familyOnly: false,
    serviceStaffAvailable: false,
    serviceStaffMandatory: false,
    serviceStaffPrice: 0,
    depositoDanosReembolsable: 0,
    manillaCondominio: 0,
    depositoAseo: 0,
    marketplaceForSale: false,
    salePriceCop: undefined,
    saleSquareMeters: undefined,
    saleDescription: "",
  });

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

  const { data: zoneTemplatesForList } = useAllCategoryZoneTemplates();

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

  useEffect(() => {
    if (createMutation.isSuccess) {
      sileo.success({
        title: "¡Propiedad creada exitosamente!",
        fill: "#f0fdf4",
      });
      router.push("/admin/properties");
    }
  }, [createMutation.isSuccess, router]);

  useEffect(() => {
    if (createMutation.isError) {
      sileo.error({
        title: "Error al crear la propiedad",
        description: "Intentalo de nuevo.",
        fill: "#fee2e2",
      });
    }
  }, [createMutation.isError]);

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

      const payload = {
        ...form,
        description: mergeDepositIntoPropertyDescription(
          form.description,
          form.depositoDanosReembolsable,
          form.manillaCondominio,
          form.depositoAseo,
        ),
      };
      if (payload.pricing) {
        payload.pricing = payload.pricing.map((rule: any) => {
          const cleanRule: any = {};
          const allowedFields = [
            "nombre",
            "fechaDesde",
            "fechaHasta",
            "fechas",
            "valorUnico",
            "activa",
            "condiciones",
            "reglas",
            "order",
            "globalRuleId",
            "subReglasCapacidad",
          ];
          allowedFields.forEach((field) => {
            if (rule[field] !== undefined) cleanRule[field] = rule[field];
          });
          return cleanRule;
        });
      }
      await createMutation.mutateAsync(payload);
    } catch (error) {}
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
      setForm((prev) => ({ ...prev, videoFile: file }));
    }
  };

  const removeVideoFile = () => {
    setForm((prev) => ({ ...prev, videoFile: undefined }));
  };

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";

  return (
    <div className="relative min-h-[calc(100vh-4rem)] min-w-0 max-w-full overflow-x-hidden bg-transparent p-4 pb-28 md:p-8 lg:p-10">
      <form
        onSubmit={handleSubmit}
        className="space-y-8 max-w-4xl mx-auto relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between z-10 py-4 md:py-5 -mx-4 md:-mx-6 px-4 md:px-6 mb-6 md:mb-10 transition-all duration-500 bg-transparent">
          <div className="flex items-center gap-3 md:gap-6 w-full">
            <Link
              href="/admin/properties"
              className="p-3 md:p-4 rounded-xl md:rounded-[20px] border border-border bg-background hover:bg-muted shadow-sm transition-all active:scale-95 group shrink-0"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent truncate">
                Nueva Propiedad
              </h1>
              <div className="flex items-center gap-2 mt-1 md:mt-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  <span className="text-[8px] md:text-[10px] font-semibold text-primary uppercase tracking-widest leading-none">
                    Registro
                  </span>
                </div>
                <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
                  FincasYa Admin
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <FormSection
          title="Información General"
          description="Título, tipo de propiedad, ubicación y descripción principal"
          icon={LayoutGrid}
          gradientFrom="from-blue-500/5"
          iconBg="bg-blue-600"
          iconShadow="shadow-blue-500/20"
          textColor="text-blue-500"
          defaultOpen={true}
        >
          <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Título</label>
                <input
                  type="text"
                  required
                  value={form.title || ""}
                  onChange={(e) => {
                    const title = e.target.value;
                    const slug = title
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9\s-]/g, "")
                      .trim()
                      .replace(/\s+/g, "-");
                    setForm((prev) => ({ ...prev, title, code: slug }));
                  }}
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

            <div className="space-y-1.5">
              <label className={labelClass}>Ubicación Geográfica</label>
              <PropertyLocationSelect
                value={form.location || ""}
                onChange={(location) =>
                  setForm((prev) => ({ ...prev, location }))
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
                required
                value={form.description || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className={`${inputClass} resize-none py-4 leading-relaxed`}
                placeholder="Describe la experiencia única que ofrece esta propiedad..."
              />
            </div>

            <CatalogFilterTagsField
              value={form.catalogFilterTags}
              onChange={(catalogFilterTags) =>
                setForm((prev) => ({ ...prev, catalogFilterTags }))
              }
            />

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
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Capacidad máxima</label>
                <div className="relative group">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.capacity || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        capacity: Number(e.target.value),
                      }))
                    }
                    className={`${inputClass} pl-11`}
                    placeholder="15"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Rating deseado</label>
                <div className="relative group">
                  <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-blue-500 transition-colors" />
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
                    placeholder="4.9"
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
                  <h3 className="text-sm font-bold text-foreground">Habilitar Finca</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Permitir que se muestre en la web</p>
                </div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Visible en catálogo</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Mostrar propiedad al público</p>
                </div>
              </div>
              <Switch
                checked={form.visible}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, visible: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Catálogo Meta (WhatsApp)</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Incluir cuando el bot envía fincas. Si está off, la web es solo informativa
                  </p>
                </div>
              </div>
              <Switch
                checked={form.visibleInWhatsAppCatalog !== false}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, visibleInWhatsAppCatalog: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Propiedad Empresa</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Es gestionada directamente por nosotros</p>
                </div>
              </div>
              <Switch
                checked={form.reservable}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, reservable: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Star className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Favorita</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Destacar en las secciones especiales</p>
                </div>
              </div>
              <Switch
                checked={form.isFavorite}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isFavorite: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Marketplace (venta)</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Listado en /marketplace; en la ficha el contacto es por WhatsApp
                  </p>
                </div>
              </div>
              <Switch
                checked={form.marketplaceForSale === true}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, marketplaceForSale: checked }))
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
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-blue-500 transition-colors" />
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
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Metros cuadrados (m²)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 1200"
                    value={
                      form.saleSquareMeters != null && form.saleSquareMeters > 0
                        ? String(form.saleSquareMeters)
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const v = raw ? parseInt(raw, 10) : undefined;
                      setForm((prev) => ({
                        ...prev,
                        saleSquareMeters: v != null && v > 0 ? v : undefined,
                      }));
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Descripción de la venta</label>
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
                  placeholder="Texto comercial para compradores."
                />
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
                <h3 className="text-sm font-bold text-foreground">Mascotas</h3>
              </div>
              <Switch
                checked={form.allowsPets}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowsPets: checked }))}
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
                    Exigir lista en check-in
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
                <h3 className="text-sm font-bold text-foreground">Eventos</h3>
              </div>
              <Switch
                checked={form.allowsEventsContent}
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
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Solo Familias</h3>
              </div>
              <Switch
                checked={form.familyOnly}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, familyOnly: checked }))}
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
                    que la capacidad de hospedaje de arriba). Si lo deja vacío, el bot y el
                    catálogo usan solo la capacidad de hospedaje.
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
                    Monto orientador para la celebración con hasta la cantidad de invitados
                    indicada (no sustituye la cotización por noches ni temporadas). Opcional.
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
          title="Personal de Servicio"
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
                    <h3 className="text-sm font-bold text-foreground">Servicio Disponible</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Ofrecer personal de cocina/aseo</p>
                  </div>
                </div>
                <Switch
                  checked={form.serviceStaffAvailable}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, serviceStaffAvailable: checked }))}
                />
              </div>
              <div className={cn(
                "flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30 transition-all duration-500",
                !form.serviceStaffAvailable && "opacity-40 grayscale pointer-events-none"
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Obligatorio</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">El cliente debe contratarlo</p>
                  </div>
                </div>
                <Switch
                  checked={form.serviceStaffMandatory}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, serviceStaffMandatory: checked }))}
                />
              </div>
            </div>

            {form.serviceStaffAvailable && (
              <div className="space-y-1.5 max-w-md animate-in fade-in slide-in-from-top-2 duration-500">
                <label className={labelClass}>Precio por día (Personal)</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    value={formatPriceInput(form.serviceStaffPrice || 0)}
                    onChange={(e) => setForm((prev) => ({ ...prev, serviceStaffPrice: parseCOP(e.target.value) }))}
                    className={`${inputClass} pl-11 font-bold text-blue-600`}
                    placeholder="Ej: 80,000"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/60">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Depósito por daños (reembolsable)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Se agrega al final de la descripción al guardar. También en chat y
                  contratos.
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
                    placeholder="Ej: 200.000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Manilla condominio</label>
                <p className="text-[11px] text-muted-foreground">
                  Para conjuntos cerrados. Se incluye en la descripción al guardar.
                </p>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-600 transition-colors" />
                  <input
                    type="text"
                    value={formatPriceInput(String(form.manillaCondominio ?? 0))}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        manillaCondominio: parseCOP(e.target.value),
                      }))
                    }
                    className={`${inputClass} pl-11`}
                    placeholder="Ej: 50.000"
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
                    placeholder="Ej: 100.000"
                  />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Pricing */}
        <FormSection
          title="Tarifas y Temporadas"
          description="Configuración de precios base y reglas dinámicas"
          icon={DollarSign}
          gradientFrom="from-green-500/10"
          iconBg="bg-green-600"
          iconShadow="shadow-green-500/20"
          textColor="text-green-600"
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Precio Base (Por noche)</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-green-600 transition-colors" />
                  <input
                    type="text"
                    required
                    value={formatPriceInput(form.priceBase || 0)}
                    onChange={(e) => setForm((prev) => ({ ...prev, priceBase: parseCOP(e.target.value) }))}
                    className={`${inputClass} pl-11 font-bold text-lg text-green-700`}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Precio Original (Tachado)</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="text"
                    value={formatPriceInput(form.priceOriginal || 0)}
                    onChange={(e) => setForm((prev) => ({ ...prev, priceOriginal: parseCOP(e.target.value) }))}
                    className={`${inputClass} pl-11 font-bold text-lg text-red-700/50`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-bold text-sm text-foreground uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-500" />
                Reglas de Temporada Globales
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {globalRules?.map((gr) => {
                  const existingRule = form.pricing?.find((r) => r.globalRuleId === gr._id);
                  const isActive = !!existingRule && existingRule.activa;
                  return (
                    <div
                      key={gr._id}
                      className={cn(
                        "flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-[32px] border transition-all duration-300",
                        isActive ? "bg-background border-border shadow-sm" : "bg-muted/30 border-border/50 opacity-60 grayscale-[0.5]"
                      )}
                    >
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center justify-between mb-2">
                          <p className={cn("font-bold text-sm tracking-tight", isActive ? "text-foreground" : "text-muted-foreground")}>
                            {gr.nombre}
                          </p>
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => {
                              setForm((prev) => {
                                const existing = prev.pricing || [];
                                const idx = existing.findIndex((r) => r.globalRuleId === gr._id);
                                if (!checked) {
                                  if (idx !== -1) {
                                    const newPricing = [...existing];
                                    newPricing[idx] = { ...newPricing[idx], activa: false };
                                    return { ...prev, pricing: newPricing };
                                  }
                                  return prev;
                                }
                                if (idx !== -1) {
                                  const newPricing = [...existing];
                                  newPricing[idx] = { ...newPricing[idx], activa: true };
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
                                    },
                                  ],
                                };
                              });
                            }}
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-3">
                          <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 w-fit shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/50" />
                            {gr.fechas && gr.fechas.length > 0 ? (
                              <span className="uppercase tracking-wider">{gr.fechas.length} días seleccionados</span>
                            ) : (
                              <span className="uppercase tracking-wider">{gr.fechaDesde} — {gr.fechaHasta}</span>
                            )}
                          </span>
                          <div className={cn(
                            "relative flex-1 sm:max-w-[240px] transition-all duration-500",
                            isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                          )}>
                            <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                            <input
                              type="text"
                              value={existingRule?.valorUnico ? formatPriceInput(existingRule.valorUnico.toString()) : ""}
                              onChange={(e) => {
                                const val = parseCOP(e.target.value);
                                setForm((prev) => {
                                  const existing = prev.pricing || [];
                                  const idx = existing.findIndex((r) => r.globalRuleId === gr._id);
                                  if (idx !== -1) {
                                    const newPricing = [...existing];
                                    newPricing[idx] = { ...newPricing[idx], valorUnico: val };
                                    return { ...prev, pricing: newPricing };
                                  }
                                  return prev;
                                });
                              }}
                              placeholder="Valor por noche..."
                              className="w-full bg-muted/30 border border-border rounded-2xl px-4 py-3 pl-10 text-xs font-bold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 shadow-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </FormSection>

        {/* Coordinates */}
        <FormSection
          title="Ubicación"
          description="Marca la posición exacta en el mapa"
          icon={Globe}
          gradientFrom="from-indigo-500/10"
          iconBg="bg-indigo-600"
          iconShadow="shadow-indigo-500/20"
          textColor="text-indigo-500"
        >
          <div className="space-y-6">
            <MapPickerComponent
              lat={form.lat || 0}
              lng={form.lng || 0}
              onChange={(newLat, newLng) => setForm((prev) => ({ ...prev, lat: newLat, lng: newLng }))}
            />
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <label className={labelClass}>Latitud</label>
                <input
                  type="number"
                  step="any"
                  value={form.lat || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, lat: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Longitud</label>
                <input
                  type="number"
                  step="any"
                  value={form.lng || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, lng: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* Features & Zones */}
        <FormSection
          title="Características y Zonas"
          description="Amenidades y configuración de iconos de la card"
          icon={ListChecks}
          gradientFrom="from-orange-500/10"
          iconBg="bg-orange-600"
          iconShadow="shadow-orange-500/20"
          textColor="text-orange-500"
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
                    "Las características de plantilla se copiaron a esta finca. Puedes añadir más por zona sin afectar el catálogo global.",
                  fill: "#f0fdf4",
                });
              }}
            />

            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nueva zona: Ej: Piscina, Segundo Piso..."
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newZoneName.trim() && !customZones.includes(newZoneName.trim())) {
                      setCustomZones((prev) => [...prev, newZoneName.trim()]);
                      setNewZoneName("");
                    }
                  }
                }}
              />
              <button
                type="button"
                className="px-6 rounded-2xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 max-md:h-12"
                onClick={() => {
                  if (newZoneName.trim() && !customZones.includes(newZoneName.trim())) {
                    setCustomZones((prev) => [...prev, newZoneName.trim()]);
                    setNewZoneName("");
                  }
                }}
              >
                Añadir Zona
              </button>
            </div>

            <div className="space-y-6">
              {orderedZoneNames(
                zoneTemplatesForList,
                customZones,
                form.features,
              ).map((zone) => {
                const zoneFeatures = (form.features || []).filter((f) => (f.zone || "General") === zone);
                const isTemplateShell =
                  zone !== "General" &&
                  zoneFeatures.length === 0 &&
                  (zoneTemplatesForList ?? []).some((t) => t.name === zone);
                return (
                  <div key={zone} className="border border-border rounded-3xl p-6 bg-muted/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5" />
                        {zone}
                      </h3>
                      {zone !== "General" && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Duplicar zona con sus amenidades"
                            onClick={() => {
                              const existing = orderedZoneNames(
                                zoneTemplatesForList,
                                customZones,
                                form.features,
                              );
                              const newName = makeDuplicateZoneName(
                                zone,
                                existing,
                              );
                              setForm((prev) => {
                                const sourceFeatures = (
                                  prev.features || []
                                ).filter(
                                  (f) => (f.zone || "General") === zone,
                                );
                                const cloned = sourceFeatures.map((f) => ({
                                  ...f,
                                  zone: newName,
                                }));
                                return {
                                  ...prev,
                                  features: [
                                    ...(prev.features || []),
                                    ...cloned,
                                  ],
                                };
                              });
                              setCustomZones((prev) =>
                                prev.includes(newName)
                                  ? prev
                                  : [...prev, newName],
                              );
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 px-3 py-2 rounded-xl transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            <span className="max-md:hidden">Duplicar</span>
                          </button>
                          {zoneFeatures.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setCustomZones((prev) => prev.filter((z) => z !== zone))}
                              className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isTemplateShell && (
                      <p className="text-[11px] text-muted-foreground mb-3 -mt-2 leading-relaxed">
                        Zona definida en una plantilla. Márcala arriba en{" "}
                        <span className="font-medium text-foreground/80">
                          Plantillas de zona
                        </span>{" "}
                        y pulsá{" "}
                        <span className="font-medium text-foreground/80">
                          Importar zonas seleccionadas a esta finca
                        </span>{" "}
                        para copiar sus características, o añadí amenidades manualmente.
                      </p>
                    )}
                    <FeaturePicker
                      features={zoneFeatures}
                      onChange={(newFeatures) => {
                        setForm((prev) => {
                          const otherFeatures = (prev.features || []).filter((f) => (f.zone || "General") !== zone);
                          const updatedZoneFeatures = newFeatures.map((f) => ({
                            ...f,
                            zone: zone === "General" ? undefined : zone,
                          }));
                          return { ...prev, features: [...otherFeatures, ...updatedZoneFeatures] };
                        });
                      }}
                      catalog={iconography || []}
                      isLoading={isLoadingFeatures}
                    />
                  </div>
                );
              })}
            </div>

            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <h4 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Iconos para la Card Principal</h4>
              </div>
              <CardIconPicker
                selectedIconIds={form.featuredIcons || []}
                availableFeatures={form.features || []}
                onChange={(ids) => setForm((prev) => ({ ...prev, featuredIcons: ids }))}
                onAddFeature={(feature) => setForm((prev) => ({ ...prev, features: [...(prev.features || []), feature] }))}
                catalog={iconography || []}
                isLoading={isLoadingFeatures}
              />
            </div>
          </div>
        </FormSection>

        {/* Multimedia */}
        <FormSection
          title="Imágenes"
          description="Fotos de alta calidad para el catálogo"
          icon={ImageIcon}
          gradientFrom="from-pink-500/10"
          iconBg="bg-pink-600"
          iconShadow="shadow-pink-500/20"
          textColor="text-pink-500"
        >
          <div className="space-y-8">
            {form.files && form.files.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {form.files.map((file, index) => (
                  <div key={`new-${index}`} className="relative group rounded-2xl overflow-hidden aspect-square border border-border">
                    <Image
                      src={URL.createObjectURL(file)}
                      alt={`Foto ${index + 1}`}
                      fill
                      className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
                      onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 p-1.5 rounded-xl bg-background/95 text-muted-foreground hover:text-red-500 shadow-xl opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                className="flex flex-col items-center justify-center gap-4 w-full p-12 rounded-[40px] border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary cursor-pointer transition-all duration-500"
              >
                <div className="p-5 rounded-[24px] bg-muted/50 group-hover:bg-primary group-hover:text-white group-hover:scale-110 shadow-sm transition-all duration-500">
                  <Plus className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <span className="text-base font-bold tracking-tight block text-foreground group-hover:text-primary">Añadir Imágenes</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mt-1 block">JPG, PNG, WEBP — Máx 10MB</span>
                </div>
              </label>
            </div>
          </div>
        </FormSection>

        {/* Video */}
        <FormSection
          title="Video"
          description="Video promocional de la propiedad"
          icon={Video}
          gradientFrom="from-red-500/10"
          iconBg="bg-red-600"
          iconShadow="shadow-red-500/20"
          textColor="text-red-500"
        >
          <div className="space-y-6">
            {form.videoFile ? (
              <div className="relative group rounded-[28px] overflow-hidden bg-gray-950 aspect-video ring-4 ring-border/50 shadow-2xl max-h-[360px] mx-auto">
                <video src={URL.createObjectURL(form.videoFile)} className="w-full h-full object-contain" controls />
                <button
                  type="button"
                  onClick={removeVideoFile}
                  className="absolute top-4 right-4 p-2.5 rounded-xl bg-background/95 text-muted-foreground hover:text-red-500 shadow-2xl opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
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
                  className="flex flex-col items-center justify-center gap-4 w-full p-12 rounded-[40px] border-2 border-dashed border-border/50 hover:border-red-500/50 hover:bg-red-500/5 text-muted-foreground hover:text-red-500 cursor-pointer transition-all duration-500"
                >
                  <div className="p-5 rounded-[24px] bg-muted/50 group-hover:bg-red-500 group-hover:text-white group-hover:scale-110 shadow-sm transition-all duration-500">
                    <Video className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <span className="text-base font-bold tracking-tight block text-foreground group-hover:text-red-500">Subir Video</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mt-1 block">MP4, WEBM — Máx 100MB</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </FormSection>

        <AdminFloatingSaveBar>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex w-full min-w-0 items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:px-6"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm uppercase tracking-widest">
                  Publicando Propiedad...
                </span>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-white/20 p-1.5 transition-transform group-hover:scale-110">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <span className="text-sm uppercase tracking-widest">
                  Publicar Propiedad
                </span>
              </>
            )}
          </button>
        </AdminFloatingSaveBar>
      </form>
    </div>
  );
}
