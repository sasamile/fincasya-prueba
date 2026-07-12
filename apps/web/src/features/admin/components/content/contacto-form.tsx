"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Mail,
  SquarePen,
  Globe,
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
import { CONTACTO_DEFAULT } from "@/features/admin/constants/paginas-internas.constants";
import {
  fetchInternalPage,
  updateInternalPage,
} from "@/features/admin/api/internal-pages.api";
import type { ContactoContent } from "@/features/admin/types/paginas-internas.types";
import { FormSection } from "@/features/admin/components/shared/form-section";

const asuntoSchema = z.object({
  value: z.string().min(1, "Valor requerido"),
  label: z.string().min(1, "Etiqueta requerida"),
});

const formSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  formTitle: z.string().min(1, "Requerido"),
  formSubtitle: z.string().min(1, "Requerido"),
  formFields: z.object({
    nombre: z.string().min(1),
    correo: z.string().min(1),
    telefono: z.string().min(1),
    asunto: z.string().min(1),
    mensaje: z.string().min(1),
  }),
  asuntoOptions: z.array(asuntoSchema).min(1, "Agregá opciones"),
  formSubmit: z.string().min(1, "Requerido"),
  formNote: z.string().min(1, "Requerido"),
  infoTitle: z.string().min(1, "Requerido"),
  info: z.object({
    email: z.string().min(1),
    phone: z.string().min(1),
    address: z.string().min(1),
    schedule: z.string().min(1),
    note: z.string().min(1),
  }),
  ctaTitle: z.string().min(1, "Requerido"),
  ctaSubtitle: z.string().min(1, "Requerido"),
  ctaWhatsappUrl: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof formSchema>;

export function ContactoManagement() {
  const formFieldEntries = (
    Object.keys(CONTACTO_DEFAULT.formFields) as Array<
      keyof FormValues["formFields"]
    >
  ).map((key) => ({ key, label: CONTACTO_DEFAULT.formFields[key] }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: CONTACTO_DEFAULT,
  });

  const {
    fields: asuntoFields,
    append: appendAsunto,
    remove: removeAsunto,
  } = useFieldArray({ control: form.control, name: "asuntoOptions" });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchInternalPage<ContactoContent>("contacto");
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
      await updateInternalPage<FormValues>("contacto", CONTACTO_DEFAULT);
      form.reset(CONTACTO_DEFAULT);
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
      await updateInternalPage<FormValues>("contacto", values);
      setHasBackendData(true);
      sileo.success({ title: "Contacto actualizado", fill: "#f0fdf4" });
    } catch (error) {
      console.error("Error updating contacto", error);
      sileo.error({
        title: "Error",
        description: "No pudimos guardar los cambios",
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

  const infoFields = (
    Object.keys(CONTACTO_DEFAULT.info) as Array<keyof FormValues["info"]>
  ).filter((key) => key !== "note");

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 px-3 py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 sm:px-4 md:px-6 mb-4 md:mb-10 transition-all duration-500 backdrop-blur-2xl">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                Contacto
              </h1>
              <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2 truncate">
                Formularios y canales oficiales de comunicación
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
              title="Hero de Contacto"
              description="Encabezado principal y presentación"
              icon={Mail}
              gradientFrom="from-blue-500/10"
              iconBg="bg-blue-500"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              hoverShadow="hover:shadow-blue-500/5"
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
              </div>
            </FormSection>

            <FormSection
              title="Formulario"
              description="Configuración de campos y etiquetas"
              icon={SquarePen}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-500"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-500"
              hoverShadow="hover:shadow-indigo-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="formTitle"
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

                <div className="grid gap-4 md:grid-cols-2">
                  {formFieldEntries.map(({ key }) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`formFields.${key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            Etiqueta {key}
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

                <div className="bg-secondary/20 p-4 md:p-6 rounded-2xl border border-border/50 space-y-4">
                  <FormLabel className={labelClass}>
                    Opciones de Asunto
                  </FormLabel>
                  {asuntoFields.map((option, index) => (
                    <div
                      key={option.id}
                      className="grid grid-cols-1 md:grid-cols-2 items-end gap-3 bg-background/50 p-4 rounded-xl border border-border/40"
                    >
                      <FormField
                        control={form.control}
                        name={`asuntoOptions.${index}.value`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              Valor Técnico
                            </FormLabel>
                            <FormControl>
                              <Input {...field} className={inputClass} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end gap-3">
                        <FormField
                          control={form.control}
                          name={`asuntoOptions.${index}.label`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className={labelClass}>
                                Etiqueta Visible
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className={inputClass} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground h-12 w-12 shrink-0 rounded-2xl opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
                          onClick={() => removeAsunto(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-dashed text-sm font-bold transition-colors hover:border-indigo-500 hover:bg-indigo-500/5 hover:text-indigo-500"
                    onClick={() =>
                      appendAsunto({ value: "nuevo", label: "Nuevo" })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Agregar opción
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="formSubmit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Texto del botón enviar
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
                  name="formNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Nota inferior del formulario
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          className={textareaClass}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title="Información de Contacto"
              description="Email, Teléfono y Dirección"
              icon={Globe}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-500"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
              hoverShadow="hover:shadow-emerald-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="infoTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Título informativo
                      </FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {infoFields.map((key) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`info.${key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>{key}</FormLabel>
                          <FormControl>
                            <Input {...field} className={inputClass} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name="info.note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Nota informativa
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          className={textareaClass}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title="Canal WhatsApp"
              description="Llamado a la acción rápido"
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
