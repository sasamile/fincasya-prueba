"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Home,
  MessageCircle,
  ListOrdered,
  Building2,
  CheckCircle,
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
import { VINCULATE_DEFAULT } from "@/features/admin/constants/paginas-internas.constants";
import {
  fetchInternalPage,
  updateInternalPage,
} from "@/features/admin/api/internal-pages.api";
import type { VinculateContent } from "@/features/admin/types/paginas-internas.types";
import { FormSection } from "@/features/admin/components/shared/form-section";

const statSchema = z.object({
  label: z.string().min(1, "Etiqueta requerida"),
  value: z.string().min(1, "Valor requerido"),
});

const benefitSchema = z.object({
  icon: z.string().min(1, "Icono requerido"),
  title: z.string().min(1, "Título requerido"),
  description: z.string().min(1, "Descripción requerida"),
});

const stepSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  description: z.string().min(1, "Descripción requerida"),
});

const formSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  stats: z.array(statSchema).min(1, "Agregá al menos una estadística"),
  benefitsSectionTitle: z.string().min(1, "Requerido"),
  benefits: z.array(benefitSchema).min(1, "Agregá beneficios"),
  stepsSectionTitle: z.string().min(1, "Requerido"),
  steps: z.array(stepSchema).min(1, "Agregá pasos"),
  formTitle: z.string().min(1, "Requerido"),
  formSubtitle: z.string().min(1, "Requerido"),
  formFields: z.object({
    nombre: z.string().min(1, "Requerido"),
    telefono: z.string().min(1, "Requerido"),
    correo: z.string().min(1, "Requerido"),
    ubicacion: z.string().min(1, "Requerido"),
    tipoPropiedad: z.string().min(1, "Requerido"),
    mensaje: z.string().min(1, "Requerido"),
  }),
  formSubmit: z.string().min(1, "Requerido"),
  ctaTitle: z.string().min(1, "Requerido"),
  ctaSubtitle: z.string().min(1, "Requerido"),
  ctaWhatsappUrl: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof formSchema>;

export function VinculateManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: VINCULATE_DEFAULT,
  });

  const {
    fields: statFields,
    append: appendStat,
    remove: removeStat,
  } = useFieldArray({
    control: form.control,
    name: "stats",
  });

  const {
    fields: benefitFields,
    append: appendBenefit,
    remove: removeBenefit,
  } = useFieldArray({
    control: form.control,
    name: "benefits",
  });

  const {
    fields: stepFields,
    append: appendStep,
    remove: removeStep,
  } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchInternalPage<VinculateContent>("vinculate");
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
      await updateInternalPage<FormValues>("vinculate", VINCULATE_DEFAULT);
      form.reset(VINCULATE_DEFAULT);
      setHasBackendData(true);
      sileo.success({ title: "Página creada", fill: "#f0fdf4" });
    } catch {
      sileo.error({
        title: "Error",
        description: "No pudimos crear la página",
        fill: "#fee2e2",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      await updateInternalPage<FormValues>("vinculate", values);
      setHasBackendData(true);
      sileo.success({
        title: "Vincúlate actualizado",
        description: "Los cambios se guardaron correctamente.",
        fill: "#f0fdf4",
      });
    } catch (error) {
      console.error("Error updating vinculate", error);
      sileo.error({
        title: "Error",
        description:
          "No pudimos guardar los cambios. Verificá que el backend esté disponible.",
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

  const formFieldKeys = Object.keys(VINCULATE_DEFAULT.formFields) as Array<
    keyof VinculateContent["formFields"]
  >;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 px-3 py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 sm:px-4 md:px-6 mb-4 md:mb-10 transition-all duration-500 backdrop-blur-2xl">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                Vincúlate
              </h1>
              <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2 truncate">
                Administra el contenido que ven los propietarios
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
              title="Hero Principal"
              description="Título, Subtítulo y Estadísticas"
              icon={Home}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-500"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-500"
              hoverShadow="hover:shadow-indigo-500/5"
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

                <div className="space-y-4">
                  <FormLabel className={labelClass}>Estadísticas</FormLabel>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {statFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="group flex items-end gap-2 bg-secondary/20 p-4 rounded-2xl border border-border/50"
                      >
                        <div className="flex-1 space-y-4">
                          <FormField
                            control={form.control}
                            name={`stats.${index}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={labelClass}>
                                  Valor
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} className={inputClass} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`stats.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={labelClass}>
                                  Etiqueta
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} className={inputClass} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStat(index)}
                          className="text-muted-foreground h-12 w-12 shrink-0 rounded-2xl opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-indigo-500 hover:bg-indigo-500/5 hover:text-indigo-500"
                    onClick={() => appendStat({ label: "", value: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Agregar Estadística
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Beneficios"
              description="Ventajas para propietarios"
              icon={MessageCircle}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-500"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
              hoverShadow="hover:shadow-emerald-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="benefitsSectionTitle"
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
                  {benefitFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/20 p-4 md:p-6 rounded-2xl border border-border/50 space-y-4 transition-all hover:bg-secondary/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                          Beneficio {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBenefit(index)}
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FormField
                          control={form.control}
                          name={`benefits.${index}.icon`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Icono
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className={inputClass} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`benefits.${index}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Título
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className={inputClass} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`benefits.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Descripción
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  rows={2}
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
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-emerald-500 hover:bg-emerald-500/5 hover:text-emerald-500"
                    onClick={() =>
                      appendBenefit({
                        icon: "CheckCircle",
                        title: "",
                        description: "",
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Agregar Beneficio
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Pasos de Vinculación"
              description="Proceso de registro"
              icon={ListOrdered}
              gradientFrom="from-orange-500/10"
              iconBg="bg-orange-500"
              iconShadow="shadow-orange-500/20"
              textColor="text-orange-500"
              hoverShadow="hover:shadow-orange-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="stepsSectionTitle"
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
                  {stepFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/20 border-border group space-y-4 rounded-2xl border p-4 md:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                          Paso {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStep(index)}
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name={`steps.${index}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Título
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className={inputClass} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`steps.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Descripción
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
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-orange-500 hover:bg-orange-500/5 hover:text-orange-500"
                    onClick={() => appendStep({ title: "", description: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Agregar Paso
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Formulario y Captación"
              description="Lead Generation y WhatsApp"
              icon={Building2}
              gradientFrom="from-blue-500/10"
              iconBg="bg-blue-500"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              hoverShadow="hover:shadow-blue-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="formTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Título del formulario
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="formSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Subtítulo</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {formFieldKeys.map((key) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`formFields.${key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            Etiqueta para {key}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} className={inputClass} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
