"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  HelpCircle,
  FileQuestion,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CENTRO_DE_AYUDA_DEFAULT } from "@/features/admin/constants/paginas-internas.constants";
import {
  fetchInternalPage,
  updateInternalPage,
} from "@/features/admin/api/internal-pages.api";
import type { CentroDeAyudaContent } from "@/features/admin/types/paginas-internas.types";
import { FormSection } from "@/features/admin/components/shared/form-section";

const faqSchema = z.object({
  question: z.string().min(1, "Pregunta requerida"),
  answer: z.string().min(1, "Respuesta requerida"),
});

const formSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  searchPlaceholder: z.string().min(1, "Requerido"),
  faqSectionTitle: z.string().min(1, "Requerido"),
  faqs: z.array(faqSchema).min(1, "Agregá preguntas"),
  ctaTitle: z.string().min(1, "Requerido"),
  ctaSubtitle: z.string().min(1, "Requerido"),
  ctaWhatsappUrl: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof formSchema>;

export function CentroAyudaManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: CENTRO_DE_AYUDA_DEFAULT,
  });

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({ control: form.control, name: "faqs" });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data =
          await fetchInternalPage<CentroDeAyudaContent>("centro-de-ayuda");
        if (data) {
          form.reset(data as FormValues);
          setHasBackendData(true);
        } else {
          setHasBackendData(false);
        }
      } catch {
        setHasBackendData(false);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [form]);

  async function createFromDefault() {
    setIsSaving(true);
    try {
      const payload: CentroDeAyudaContent = {
        ...CENTRO_DE_AYUDA_DEFAULT,
        categoriesSectionTitle: "",
        categories: [],
      };
      await updateInternalPage<CentroDeAyudaContent>(
        "centro-de-ayuda",
        payload,
      );
      form.reset(payload as FormValues);
      setHasBackendData(true);
      sileo.success({ title: "Página creada", fill: "#f0fdf4" });
    } catch (error) {
      sileo.error({
        title: "Error",
        description: "No se pudo crear la página",
        fill: "#fee2e2",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      await updateInternalPage<CentroDeAyudaContent>("centro-de-ayuda", {
        ...CENTRO_DE_AYUDA_DEFAULT,
        ...values,
        categoriesSectionTitle: "",
        categories: [],
      });
      setHasBackendData(true);
      sileo.success({ title: "Centro de Ayuda actualizado", fill: "#f0fdf4" });
    } catch (error) {
      console.error("Error updating centro de ayuda", error);
      sileo.error({
        title: "Error",
        description: "No se pudo guardar el contenido",
        fill: "#fee2e2",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";
  const textareaClass = `${inputClass} resize-none min-h-[120px]`;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 px-3 py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 sm:px-4 md:px-6 mb-4 md:mb-10 transition-all duration-500 backdrop-blur-2xl">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                Centro de Ayuda
              </h1>
              <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2 truncate">
                Preguntas frecuentes, búsqueda y CTA
              </p>
            </div>
          </div>
          {!hasBackendData ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void createFromDefault()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none w-full md:w-auto"
            >
              <Save className="w-4 h-4" />
              <span>Crear página</span>
            </button>
          ) : null}
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 md:space-y-8"
          >
            <FormSection
              title="Hero y Búsqueda"
              description="Título principal y barra de ayuda"
              icon={HelpCircle}
              gradientFrom="from-amber-500/10"
              iconBg="bg-amber-500"
              iconShadow="shadow-amber-500/20"
              textColor="text-amber-500"
              hoverShadow="hover:shadow-amber-500/5"
              defaultOpen={true}
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="heroTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Título</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroSubtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Subtítulo</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          className={textareaClass}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="searchPlaceholder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Placeholder de búsqueda
                      </FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title="Preguntas Frecuentes"
              description="Preguntas y respuestas del centro"
              icon={FileQuestion}
              gradientFrom="from-amber-500/10"
              iconBg="bg-amber-500"
              iconShadow="shadow-amber-500/20"
              textColor="text-amber-500"
              hoverShadow="hover:shadow-amber-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="faqSectionTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Título de sección
                      </FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  {faqFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/20 p-4 md:p-6 rounded-2xl border border-border/50 space-y-4 transition-all hover:bg-secondary/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                          Pregunta {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFaq(index)}
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name={`faqs.${index}.question`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Pregunta
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className={inputClass} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`faqs.${index}.answer`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Respuesta
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  rows={3}
                                  className={textareaClass}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-amber-500 hover:bg-amber-500/5 hover:text-amber-500"
                    onClick={() =>
                      appendFaq({ question: "Nueva pregunta", answer: "" })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Agregar Pregunta
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Contacto Final"
              description="Llamado a la acción de ayuda"
              icon={MessageSquare}
              gradientFrom="from-blue-500/10"
              iconBg="bg-blue-500"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              hoverShadow="hover:shadow-blue-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="ctaTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Título CTA</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ctaSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Subtítulo CTA
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="ctaWhatsappUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>URL WhatsApp</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

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
