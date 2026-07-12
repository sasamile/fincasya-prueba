"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { sileo } from "sileo";
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
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Users,
  Home,
  HelpCircle,
  BarChart3,
  Megaphone,
  Award,
} from "lucide-react";

import {
  fetchComoFunciona,
  updateComoFunciona,
} from "@/features/admin/api/como-funciona.api";
import { COMO_FUNCIONA_DEFAULT } from "@/features/admin/constants/como-funciona.constants";
import { FormSection } from "@/features/admin/components/shared/form-section";

const formSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  heroStats: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1),
    }),
  ),
  guestSectionEyebrow: z.string().min(1, "Requerido"),
  guestSectionTitle: z.string().min(1, "Requerido"),
  guestSectionSubtitle: z.string().min(1, "Requerido"),
  guestSteps: z.array(
    z.object({
      title: z.string().min(1),
      channel: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  ownerSectionEyebrow: z.string().min(1, "Requerido"),
  ownerSectionTitle: z.string().min(1, "Requerido"),
  ownerSectionSubtitle: z.string().min(1, "Requerido"),
  ownerSteps: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  benefitsSectionEyebrow: z.string().min(1, "Requerido"),
  benefitsSectionTitle: z.string().min(1, "Requerido"),
  benefits: z.array(
    z.object({
      icon: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  faqSectionEyebrow: z.string().min(1, "Requerido"),
  faqSectionTitle: z.string().min(1, "Requerido"),
  faqs: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ),
  ctaTitle: z.string().min(1, "Requerido"),
  ctaSubtitle: z.string().min(1, "Requerido"),
  ctaPrimaryLabel: z.string().min(1, "Requerido"),
  ctaSecondaryLabel: z.string().min(1, "Requerido"),
  ctaSecondaryHref: z.string().min(1, "Requerido"),
  ctaWhatsappUrl: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof formSchema>;

export function ComoFuncionaManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: COMO_FUNCIONA_DEFAULT,
  });

  const {
    fields: statsFields,
    append: appendStat,
    remove: removeStat,
  } = useFieldArray({ control: form.control, name: "heroStats" });

  const {
    fields: guestFields,
    append: appendGuest,
    remove: removeGuest,
  } = useFieldArray({ control: form.control, name: "guestSteps" });

  const {
    fields: ownerFields,
    append: appendOwner,
    remove: removeOwner,
  } = useFieldArray({ control: form.control, name: "ownerSteps" });

  const {
    fields: benefitFields,
    append: appendBenefit,
    remove: removeBenefit,
  } = useFieldArray({ control: form.control, name: "benefits" });

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({ control: form.control, name: "faqs" });

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchComoFunciona();
        if (data) {
          form.reset({ ...COMO_FUNCIONA_DEFAULT, ...data });
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
      await updateComoFunciona(COMO_FUNCIONA_DEFAULT);
      form.reset(COMO_FUNCIONA_DEFAULT);
      setHasBackendData(true);
      sileo.success({ title: "Página creada", fill: "#f0fdf4" });
    } catch {
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
      await updateComoFunciona(values);
      setHasBackendData(true);
      sileo.success({
        title: "¡Página 'Cómo Funciona' actualizada correctamente!",
        fill: "#f0fdf4",
      });
      const data = await fetchComoFunciona();
      if (data) {
        form.reset(data);
        setHasBackendData(true);
      }
    } catch {
      sileo.error({
        title: "Error",
        description:
          "Error al guardar. Verifica que el endpoint del backend esté disponible.",
        fill: "#fee2e2",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";
  const textareaClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm resize-none";

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="text-primary h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="relative z-10 mx-auto max-w-5xl space-y-6 md:space-y-8">
        {/* Page Header */}
        <div className="border-border/50 top-[56px] z-20 -mx-3 mb-4 flex flex-col justify-between gap-4 border-b px-3 py-3 backdrop-blur-2xl transition-all duration-500 sm:-mx-4 sm:px-4 md:top-[64px] md:-mx-6 md:mb-10 md:flex-row md:items-center md:px-6 md:py-5">
          <div className="flex w-full items-center gap-3 md:w-auto md:gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="from-foreground via-foreground/90 to-muted-foreground truncate bg-linear-to-br bg-clip-text text-lg leading-none font-bold tracking-tight text-transparent md:text-3xl">
                ¿Cómo Funciona?
              </h1>
              <p className="text-muted-foreground mt-1 truncate text-[9px] font-semibold tracking-widest uppercase md:mt-2 md:text-[11px]">
                Administra el contenido de la página &quot;¿Cómo Funciona?&quot;
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
              icon={Megaphone}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-500"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-500"
              hoverShadow="hover:shadow-indigo-500/5"
              defaultOpen={true}
            >
              <FormField
                control={form.control}
                name="heroTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>
                      Título Principal
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
                name="heroSubtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Subtítulo</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} className={textareaClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormLabel className={labelClass}>
                  Estadísticas del Hero
                </FormLabel>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {statsFields.map((field, index) => (
                    <div key={field.id} className="group flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={`heroStats.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className={labelClass}>Valor</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="+600"
                                className={inputClass}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`heroStats.${index}.label`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className={labelClass}>
                              Etiqueta
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Fincas verificadas"
                                className={inputClass}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStat(index)}
                        className="text-muted-foreground h-12 w-12 shrink-0 rounded-2xl opacity-100 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 md:opacity-0"
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
                  onClick={() => appendStat({ value: "", label: "" })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Estadística
                </Button>
              </div>
            </FormSection>

            <FormSection
              title="Para Huéspedes"
              description="Proceso paso a paso de reserva"
              icon={Users}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-500"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="guestSectionEyebrow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Eyebrow</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="guestSectionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Título de Sección
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
                    name="guestSectionSubtitle"
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

                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Pasos del Proceso
                  </FormLabel>
                  {guestFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/30 border-border group space-y-4 rounded-2xl border p-4 md:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                          Paso {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGuest(index)}
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 md:opacity-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`guestSteps.${index}.title`}
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
                          name={`guestSteps.${index}.channel`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Canal
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="WhatsApp, fincasya.com, etc."
                                  className={inputClass}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name={`guestSteps.${index}.description`}
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
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-emerald-500 hover:bg-emerald-500/5 hover:text-emerald-500"
                    onClick={() =>
                      appendGuest({ title: "", channel: "", description: "" })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Paso
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Para Propietarios"
              description="Proceso de vinculación de fincas"
              icon={Home}
              gradientFrom="from-orange-500/10"
              iconBg="bg-orange-500"
              iconShadow="shadow-orange-500/20"
              textColor="text-orange-500"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="ownerSectionEyebrow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Eyebrow</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ownerSectionTitle"
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
                    name="ownerSectionSubtitle"
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

                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Pasos para Propietarios
                  </FormLabel>
                  {ownerFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/30 border-border group space-y-4 rounded-2xl border p-4 md:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                          Paso {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOwner(index)}
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 md:opacity-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormField
                        control={form.control}
                        name={`ownerSteps.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>Título</FormLabel>
                            <FormControl>
                              <Input {...field} className={inputClass} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ownerSteps.${index}.description`}
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
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-orange-500 hover:bg-orange-500/5 hover:text-orange-500"
                    onClick={() => appendOwner({ title: "", description: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Paso
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Beneficios"
              description="Ventajas competitivas de FincasYa"
              icon={Award}
              gradientFrom="from-violet-500/10"
              iconBg="bg-violet-500"
              iconShadow="shadow-violet-500/20"
              textColor="text-violet-500"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="benefitsSectionEyebrow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Eyebrow</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="benefitsSectionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Título</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Lista de Beneficios
                  </FormLabel>
                  {benefitFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/30 border-border group space-y-4 rounded-2xl border p-4 md:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                          Beneficio {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBenefit(index)}
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 md:opacity-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`benefits.${index}.icon`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>
                                Icono
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="CheckCircle, Phone, Shield..."
                                  className={inputClass}
                                />
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
                      </div>
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
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-violet-500 hover:bg-violet-500/5 hover:text-violet-500"
                    onClick={() =>
                      appendBenefit({
                        icon: "CheckCircle",
                        title: "",
                        description: "",
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Beneficio
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Preguntas Frecuentes"
              description="FAQ de la página"
              icon={HelpCircle}
              gradientFrom="from-amber-500/10"
              iconBg="bg-amber-500"
              iconShadow="shadow-amber-500/20"
              textColor="text-amber-500"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="faqSectionEyebrow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Eyebrow</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="faqSectionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Título</FormLabel>
                        <FormControl>
                          <Input {...field} className={inputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormLabel className={labelClass}>
                    Preguntas y Respuestas
                  </FormLabel>
                  {faqFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-secondary/30 border-border group space-y-4 rounded-2xl border p-4 md:p-6"
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
                          className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 md:opacity-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-amber-500 hover:bg-amber-500/5 hover:text-amber-500"
                    onClick={() => appendFaq({ question: "", answer: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Pregunta
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Call to Action"
              description="Banner final de conversión"
              icon={BarChart3}
              gradientFrom="from-rose-500/10"
              iconBg="bg-rose-500"
              iconShadow="shadow-rose-500/20"
              textColor="text-rose-500"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="ctaTitle"
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
                    name="ctaSubtitle"
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
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="ctaPrimaryLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Label principal
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
                    name="ctaSecondaryLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Label secundario
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
                    name="ctaSecondaryHref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Link secundario
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
                      <FormLabel className={labelClass}>
                        URL de WhatsApp
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
