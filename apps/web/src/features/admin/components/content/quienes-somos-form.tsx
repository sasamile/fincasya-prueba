"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { sileo } from "sileo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Reorder, useDragControls } from "framer-motion";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Info,
  History,
  Target,
  Trophy,
  ShieldCheck,
  Building,
  Users,
  ArrowLeft,
  AlertCircle,
  ImageIcon,
  Video,
  Play,
  X,
  Settings2,
  GripVertical,
} from "lucide-react";
import Image from "next/image";
import {
  fetchQuienesSomos,
  updateQuienesSomos,
  uploadQuienesSomosImages,
  uploadQuienesSomosVideo,
} from "@/features/admin/api/quienes-somos.api";
import { QUIENES_SOMOS_DEFAULT } from "@/features/admin/constants/quienes-somos.constants";
import { QuienesSomosData } from "@/features/admin/types/quienes-somos.types";
import { FormSection } from "@/features/admin/components/shared/form-section";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const statSchema = z.object({
  label: z.string().min(1, "El label es requerido"),
  value: z.string().min(1, "El valor es requerido"),
});

const formSchema = z.object({
  queEsFincasYa: z.string().min(10, "La descripción es muy corta"),
  mision: z.string().min(10, "La misión es muy corta"),
  vision: z.string().min(10, "La visión es muy corta"),
  objetivos: z.array(z.string()).min(1, "Al menos un objetivo es requerido"),
  politicas: z.array(z.string()).min(1, "Al menos una política es requerida"),
  trayectoriaTitle: z.string().min(5, "El título es muy corto"),
  trayectoriaParagraphs: z.string().min(10, "La trayectoria es muy corta"),
  stats: z.array(
    z.object({
      label: z.string().min(1, "Etiqueta requerida"),
      value: z.string().min(1, "Valor requerido"),
    }),
  ),
  recognitionTitle: z
    .string()
    .min(5, "El título del reconocimiento es muy corto"),
  recognitionSubtitle: z
    .string()
    .min(5, "El subtítulo del reconocimiento es muy corto"),
  presenciaInstitucional: z
    .string()
    .min(10, "La descripción de presencia es muy corta"),
  videoUrl: z.string().optional(),
  videoTitle: z.string().optional(),
  videoDescription: z.string().optional(),
  videoBadge: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ReorderableCarouselItemProps {
  url: string;
  index: number;
  isReorderMode: boolean;
  onRemove: () => void;
  handleDrag: (_: any, info: any) => void;
  handleDragEnd: () => void;
}

function ReorderableCarouselItem({
  url,
  index,
  isReorderMode,
  onRemove,
  handleDrag,
  handleDragEnd,
}: ReorderableCarouselItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={url}
      dragListener={false}
      dragControls={controls}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="relative select-none"
    >
      {isReorderMode ? (
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
                src={url}
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
                {index === 0
                  ? "Primera Imagen"
                  : `Imagen de carrusel #${index + 1}`}
              </span>
            </div>
          </div>
          <div className="px-4 py-1.5 w-full md:w-fit flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 select-none">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              ORDEN {index + 1}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative group rounded-2xl overflow-hidden aspect-square bg-muted border border-border ring-2 ring-dashed ring-border/50">
          <Image
            src={url}
            alt={`Existente ${index + 1}`}
            fill
            className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 rounded-xl bg-background/95 text-muted-foreground hover:text-red-500 shadow-xl opacity-100 md:opacity-0 group-hover:opacity-100 transition-all font-bold"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="absolute bottom-2 left-2 transition-all duration-200 opacity-0 group-hover:opacity-100 translate-y-[10px] group-hover:translate-y-0">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border bg-background/30 backdrop-blur-md text-white border-white/20">
              #{index + 1}
            </span>
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}

export function QuienesSomosManagement() {
  const [isLoading, setIsLoading] = useState(true); // Changed loading to isLoading
  const [isSaving, setIsSaving] = useState(false); // Changed saving to isSaving
  const [files, setFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [scrollDir, setScrollDir] = useState(0);

  const form = useForm<FormValues>({
    // Used FormValues type
    resolver: zodResolver(formSchema),
    defaultValues: QUIENES_SOMOS_DEFAULT,
  });

  // Removed useFieldArray for queEsFincasYa, objetivos, politicas, trayectoriaParagraphs

  const {
    fields: statFields,
    append: appendStat,
    remove: removeStat,
  } = useFieldArray({
    control: form.control as any,
    name: "stats" as any,
  });

  const {
    fields: objetivoFields,
    append: appendObjetivo,
    remove: removeObjetivo,
  } = useFieldArray({
    control: form.control as any,
    name: "objetivos" as any,
  });

  const {
    fields: politicaFields,
    append: appendPolitica,
    remove: removePolitica,
  } = useFieldArray({
    control: form.control as any,
    name: "politicas" as any,
  });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await fetchQuienesSomos();
        if (data) {
          // Normalización para evitar el error de strings fragmentados por useFieldArray
          // Si el valor viene como string HTML (del editor anterior), lo intentamos extraer o usamos el default
          const normalizeList = (val: any, defaultList: string[]) => {
            let arr = Array.isArray(val) ? val : undefined;

            if (typeof val === "string") {
              arr = [val];
              if (val.includes("<li>")) {
                const matches = val.match(/<li>([\s\S]*?)<\/li>/g);
                if (matches) {
                  arr = matches.map((m) => m.replace(/<\/?li>/g, "").trim());
                }
              }
            }

            if (arr && arr.length > 0) {
              if (
                arr.every(
                  (item) => typeof item === "string" && item.length === 1,
                )
              ) {
                const joined = arr.join("");
                if (joined.startsWith("<")) return defaultList;
                return [joined];
              }
              if (
                arr.length === 1 &&
                typeof arr[0] === "string" &&
                arr[0].trim().startsWith("<") &&
                arr[0].trim().endsWith(">")
              ) {
                return defaultList;
              }
              // Limpiar strings vacíos accidentales
              const cleanedArr = arr.filter(
                (item) => typeof item === "string" && item.trim().length > 0,
              );
              return cleanedArr.length > 0 ? cleanedArr : defaultList;
            }

            return defaultList;
          };

          const cleanHtml = (html: any) => {
            if (!html || typeof html !== "string") return "";
            const trimmed = html.trim().replace(/\s+/g, "");
            if (trimmed === "<p></p>" || trimmed === "") return "";
            return html;
          };

          form.reset({
            queEsFincasYa:
              cleanHtml(data.queEsFincasYa) ||
              QUIENES_SOMOS_DEFAULT.queEsFincasYa,
            mision: cleanHtml(data.mision) || QUIENES_SOMOS_DEFAULT.mision,
            vision: cleanHtml(data.vision) || QUIENES_SOMOS_DEFAULT.vision,
            trayectoriaTitle:
              data.trayectoriaTitle || QUIENES_SOMOS_DEFAULT.trayectoriaTitle,
            trayectoriaParagraphs:
              data.trayectoriaParagraphs ||
              QUIENES_SOMOS_DEFAULT.trayectoriaParagraphs,
            stats: data.stats || QUIENES_SOMOS_DEFAULT.stats,
            objetivos: normalizeList(
              data.objetivos,
              QUIENES_SOMOS_DEFAULT.objetivos,
            ),
            politicas: normalizeList(
              data.politicas,
              QUIENES_SOMOS_DEFAULT.politicas,
            ),
            recognitionTitle:
              data.recognitionTitle || QUIENES_SOMOS_DEFAULT.recognitionTitle,
            recognitionSubtitle:
              data.recognitionSubtitle ||
              QUIENES_SOMOS_DEFAULT.recognitionSubtitle,
            presenciaInstitucional:
              data.presenciaInstitucional ||
              QUIENES_SOMOS_DEFAULT.presenciaInstitucional,
            videoUrl: data.videoUrl || "",
            videoTitle: data.videoTitle || QUIENES_SOMOS_DEFAULT.videoTitle,
            videoDescription:
              data.videoDescription || QUIENES_SOMOS_DEFAULT.videoDescription,
            videoBadge: data.videoBadge || QUIENES_SOMOS_DEFAULT.videoBadge,
          });
          setExistingImages(data.carouselImages || []);
        }
      } catch (error) {
        console.error("Error loading Quienes Somos data:", error);
        sileo.error({
          title: "Error",
          description: "No se pudo cargar la información actual.",
          fill: "#fee2e2",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [form]);

  useEffect(() => {
    if (scrollDir === 0) return;
    const scrollAmount = scrollDir * 15;
    const interval = setInterval(() => {
      window.scrollBy({ top: scrollAmount, behavior: "auto" });
    }, 16);
    return () => clearInterval(interval);
  }, [scrollDir]);

  const handleDrag = (_: any, info: any) => {
    if (!isReorderMode) return;
    const threshold = 100;
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
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      let newUrls: string[] = [];
      if (files.length > 0) {
        newUrls = await uploadQuienesSomosImages(files);
      }
      const finalImages = [...existingImages, ...newUrls];

      let finalVideoUrl = values.videoUrl;
      if (videoFile) {
        finalVideoUrl = await uploadQuienesSomosVideo(videoFile);
      }

      await updateQuienesSomos({
        ...values,
        carouselImages: finalImages,
        videoUrl: finalVideoUrl,
      });
      sileo.success({
        title: "¡Información institucional actualizada correctamente!",
        fill: "#f0fdf4",
      });
      setFiles([]);
      setVideoFile(null);
      const data = await fetchQuienesSomos();
      if (data) {
        form.reset({
          ...data,
          queEsFincasYa:
            data.queEsFincasYa || QUIENES_SOMOS_DEFAULT.queEsFincasYa,
          mision: data.mision || QUIENES_SOMOS_DEFAULT.mision,
          vision: data.vision || QUIENES_SOMOS_DEFAULT.vision,
          videoUrl: data.videoUrl || "",
        });
        setExistingImages(data.carouselImages || []);
      }
    } catch (error) {
      console.error("Error updating Quienes Somos data:", error);
      sileo.error({
        title: "Error",
        description: "Error al guardar los cambios.",
        fill: "#fee2e2",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 150 * 1024 * 1024; // 150MB

      if (file.size > maxSize) {
        sileo.error({
          title: "Video demasiado grande",
          description: "El video no debe exceder los 150MB.",
          fill: "#fee2e2",
        });
        e.target.value = "";
        return;
      }

      setVideoFile(file);
    }
  };

  const removeVideoFile = () => {
    setVideoFile(null);
  };

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:px-8 lg:px-10 bg-transparent min-h-[calc(100vh-4rem)] relative">
      <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 top-[56px] md:top-[64px] z-20 backdrop-blur-2xl py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 mb-4 md:mb-10 transition-all duration-500 border-b border-border/50">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                ¿Quiénes Somos?
              </h1>
              <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2 truncate">
                Administra el contenido de la página "¿Quiénes Somos?"
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 md:space-y-8"
          >
            {/* Introducción y Misión */}
            <FormSection
              title="Identidad Corporativa"
              description="Descripción, Misión y Visión"
              icon={Info}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-500"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-500"
              hoverShadow="hover:shadow-indigo-500/5"
              defaultOpen={true}
            >
              <FormField
                control={form.control}
                name="queEsFincasYa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>
                      ¿Qué es FincasYa?
                    </FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Escribe la descripción central de la empresa..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="mision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Misión</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Escribe la misión institucional..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Visión</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Escribe la visión institucional..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            {/* Listas y Objetivos */}
            <FormSection
              title="Estrategia Organizacional"
              description="Objetivos y Políticas"
              icon={Target}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-500"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
              hoverShadow="hover:shadow-emerald-500/5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Objetivos Principales
                  </FormLabel>
                  {objetivoFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 group">
                      <FormField
                        control={form.control}
                        name={`objetivos.${index}` as any}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="Ingresa un objetivo..."
                                className={inputClass}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeObjetivo(index)}
                        disabled={objetivoFields.length <= 1}
                        className="h-12 w-12 shrink-0 rounded-2xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-2xl border-dashed border-2 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5 transition-colors font-bold text-sm"
                    onClick={() => appendObjetivo("")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Objetivo
                  </Button>
                </div>

                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Políticas Internas
                  </FormLabel>
                  {politicaFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 group">
                      <FormField
                        control={form.control}
                        name={`politicas.${index}` as any}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="Ingresa una política..."
                                className={inputClass}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePolitica(index)}
                        disabled={politicaFields.length <= 1}
                        className="h-12 w-12 shrink-0 rounded-2xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-2xl border-dashed border-2 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5 transition-colors font-bold text-sm"
                    onClick={() => appendPolitica("")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Política
                  </Button>
                </div>
              </div>
            </FormSection>

            {/* Trayectoria */}
            <FormSection
              title="Trayectoria y Resultados"
              description="Historia y Estadísticas de la empresa"
              icon={History}
              gradientFrom="from-orange-500/10"
              iconBg="bg-orange-500"
              iconShadow="shadow-orange-500/20"
              textColor="text-orange-500"
              hoverShadow="hover:shadow-orange-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="trayectoriaTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Título de Trayectoria
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          className={inputClass}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Párrafos de Trayectoria
                  </FormLabel>
                  <FormField
                    control={form.control}
                    name="trayectoriaParagraphs"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Escribe la historia o trayectoria de FincasYa..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-border/50">
                  <FormLabel className={labelClass}>
                    Estadísticas (Métricas Históricas)
                  </FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {statFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="p-5 border border-border rounded-[24px] bg-muted/20 space-y-4 relative group hover:border-orange-500/30 transition-colors"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStat(index)}
                          disabled={statFields.length <= 1}
                          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/30 shadow-sm opacity-100 md:opacity-0 group-hover:opacity-100 transition-all active:scale-95 z-10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <FormField
                          control={form.control}
                          name={`stats.${index}.label` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold text-muted-foreground">
                                Etiqueta (Ej: Reservas)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  className={inputClass}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`stats.${index}.value` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold text-muted-foreground">
                                Valor (Ej: 15,000+)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  className={inputClass}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-4 h-12 rounded-2xl border-dashed border-2 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/5 transition-colors font-bold text-sm"
                    onClick={() => appendStat({ label: "", value: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Métrica
                  </Button>
                </div>
              </div>
            </FormSection>

            {/* Video Institucional */}
            <FormSection
              title="Video Institucional"
              description="Sube un video para la página principal"
              icon={Video}
              gradientFrom="from-rose-500/10"
              iconBg="bg-rose-500"
              iconShadow="shadow-rose-500/20"
              textColor="text-rose-500"
              hoverShadow="hover:shadow-rose-500/5"
            >
              <div className="space-y-8">
                {/* Inputs Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="videoTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Título de la Sección
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            className={inputClass}
                            placeholder="Ej: NUESTRA HISTORIA EN VIDEO"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="videoBadge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Texto del Badge (Superior)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            className={inputClass}
                            placeholder="Ej: Conócenos mejor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="videoDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            Descripción del Video
                          </FormLabel>
                          <FormControl>
                            <RichTextEditor
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Escribe una breve descripción para acompañar el video..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Video Row - Full Width Bottom */}
                <div className="pt-4 border-t border-border/50">
                  <FormField
                    control={form.control}
                    name="videoUrl"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <FormLabel className={labelClass}>
                          Video Reel (Vertical 9:16)
                        </FormLabel>
                        <div className="flex flex-col gap-4">
                          {videoFile || field.value ? (
                            <div className="relative rounded-[32px] overflow-hidden bg-black h-[400px] w-full group shadow-2xl border border-border/50">
                              <video
                                src={
                                  videoFile
                                    ? URL.createObjectURL(videoFile)
                                    : field.value
                                }
                                className="w-full h-full object-contain"
                                controls
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => {
                                  field.onChange("");
                                  removeVideoFile();
                                }}
                                className="absolute top-4 right-4 h-10 w-10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all font-bold"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="relative group w-full">
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => {
                                  handleVideoSelect(e);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed border-border rounded-[32px] bg-muted/20 group-hover:bg-rose-500/5 group-hover:border-rose-500/50 transition-all duration-300 h-[200px] w-full">
                                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Play className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                  <p className="text-sm font-bold text-foreground">
                                    Sube un Reel
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Máx. 150MB — Vertical 9:16 recomendado
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </FormSection>

            {/* Imágenes del Carrusel */}
            <FormSection
              title="Imágenes de FincasYa"
              description={`${existingImages.length + files.length} Fotos para el carrusel`}
              icon={ImageIcon}
              gradientFrom="from-primary/5"
              iconBg="bg-primary"
              iconShadow="shadow-primary/20"
              textColor="text-primary"
              hoverShadow="hover:shadow-primary/5"
              customHeaderActions={
                existingImages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsReorderMode(!isReorderMode)}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 active:scale-95 shadow-sm min-h-[40px] sm:min-h-[48px] w-full sm:w-auto
                      ${
                        isReorderMode
                          ? "bg-primary text-white border-primary hover:bg-primary/90"
                          : "bg-background text-muted-foreground border-border hover:border-primary/20 hover:text-primary hover:bg-primary/5"
                      }`}
                  >
                    <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>
                      {isReorderMode ? "Finalizar" : "Modo Reordenar"}
                    </span>
                  </button>
                )
              }
            >
              <div className="space-y-6 md:space-y-8">
                {(existingImages.length > 0 || files.length > 0) && (
                  <div className="space-y-6">
                    {existingImages.length > 0 && (
                      <Reorder.Group
                        axis="y"
                        values={existingImages}
                        onReorder={setExistingImages}
                        className={
                          isReorderMode
                            ? "flex flex-col gap-4"
                            : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
                        }
                      >
                        {existingImages.map((url, index) => (
                          <ReorderableCarouselItem
                            key={url}
                            url={url}
                            index={index}
                            isReorderMode={isReorderMode}
                            onRemove={() => removeExistingImage(index)}
                            handleDrag={handleDrag}
                            handleDragEnd={handleDragEnd}
                          />
                        ))}
                      </Reorder.Group>
                    )}
                    {files.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {files.map((file, index) => (
                          <div
                            key={`new-${index}`}
                            className="relative group rounded-2xl overflow-hidden aspect-square bg-muted border border-border ring-2 ring-dashed ring-primary/50"
                          >
                            <Image
                              src={URL.createObjectURL(file)}
                              alt={`Nueva ${index + 1}`}
                              fill
                              className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
                              onLoad={(e) =>
                                URL.revokeObjectURL(e.currentTarget.src)
                              }
                            />
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-2 right-2 p-1.5 rounded-xl bg-background/95 text-muted-foreground hover:text-red-500 shadow-xl opacity-100 md:opacity-0 group-hover:opacity-100 transition-all font-bold"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-2 left-2">
                              <span className="text-[10px] font-black uppercase tracking-widest bg-primary text-white px-3 py-1.5 rounded-full shadow-lg">
                                Nueva
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                      <span className="text-base font-bold tracking-tight block text-foreground group-hover:text-primary">
                        Añadir contenido visual
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mt-1 block">
                        JPG, PNG, WEBP — Máx 10MB
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </FormSection>

            {/* Reconocimientos e Institucional */}
            <FormSection
              title="Avales y Presencia"
              description="Premios, Reconocimientos e Impacto"
              icon={ShieldCheck}
              gradientFrom="from-blue-500/10"
              iconBg="bg-blue-500"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              hoverShadow="hover:shadow-blue-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField
                    control={form.control}
                    name="recognitionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Título del Reconocimiento
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            className={inputClass}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recognitionSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Subtítulo del Reconocimiento
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            className={inputClass}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-border/50">
                  <FormLabel className={labelClass}>
                    Texto de Presencia Institucional
                  </FormLabel>
                  <FormField
                    control={form.control}
                    name="presenciaInstitucional"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Escribe sobre membrecías, sellos de calidad y agremiaciones..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </FormSection>

            {/* Botón de guardar */}
            <div className="sticky bottom-6 md:bottom-8 z-100 px-4 md:px-6 py-4 bg-background/60 backdrop-blur-2xl border border-border/40 rounded-[28px] md:rounded-3xl shadow-2xl shadow-primary/10 mx-2 md:mx-0">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-12 w-full rounded-2xl bg-primary font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}
                Guardar cambios
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
