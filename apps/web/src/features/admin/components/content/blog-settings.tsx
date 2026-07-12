"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import { Loader2, Save, Plus, Trash2, BookOpenCheck } from "lucide-react";

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
import type { BlogContent } from "@/features/admin/types/paginas-internas.types";

const settingsSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  categories: z.array(z.string().min(1)).min(1, "Agregá categorías"),
  loadMore: z.string().min(1, "Requerido"),
  ctaTitle: z.string().min(1, "Requerido"),
  ctaSubtitle: z.string().min(1, "Requerido"),
  ctaWhatsappUrl: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof settingsSchema>;

interface BlogSettingsProps {
  onSave: (values: FormValues) => Promise<void>;
  onCancel: () => void;
  initialData?: BlogContent;
  isEditing: boolean;
}

export function BlogSettings({
  onSave,
  onCancel,
  initialData,
  isEditing,
}: BlogSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      heroTitle: "",
      heroSubtitle: "",
      categories: ["Todos"],
      loadMore: "Cargar más",
      ctaTitle: "",
      ctaSubtitle: "",
      ctaWhatsappUrl: "",
      ...initialData,
    },
  });

  useEffect(() => {
    setIsLoading(false);
  }, [form]);

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      await onSave(values);
      sileo.success({
        title: isEditing ? "Configuración actualizada" : "Configuración guardada",
        fill: "#f0fdf4",
      });
      onCancel();
    } catch (error) {
      console.error("Error saving blog settings", error);
      sileo.error({
        title: "Error",
        description: "No pudimos guardar los cambios.",
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

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2";
  const inputClass =
    "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary/5";
  const textareaClass = `${inputClass} resize-none min-h-[120px]`;

  const categories = form.watch("categories");

  const addCategory = () => {
    form.setValue("categories", [...categories, "Nueva categoría"]);
  };

  const removeCategory = (index: number) => {
    const updated = categories.slice();
    updated.splice(index, 1);
    form.setValue("categories", updated.length ? updated : ["General"]);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
        <header className="border-border/50 border-b px-3 py-4 sm:px-4 md:px-6 md:py-6">
          <div>
            <h1 className="bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-lg font-bold text-transparent md:text-3xl">
              Configuración del blog
            </h1>
            <p className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase tracking-widest">
              Gestioná el encabezado, categorías y llamado a la acción
            </p>
          </div>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
            {/* Hero Section */}
            <section className="rounded-3xl border border-border bg-background shadow-sm">
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
                <BookOpenCheck className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-base font-semibold">Hero del blog</h2>
                  <p className="text-muted-foreground text-xs">Encabezado principal del blog</p>
                </div>
              </div>
              <div className="space-y-6 p-4 sm:p-6">
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
                        <Textarea {...field} rows={3} className={textareaClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Categories Section */}
            <section className="rounded-3xl border border-border bg-background shadow-sm">
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
                <h2 className="text-base font-semibold">Categorías</h2>
                <p className="text-muted-foreground text-xs">Organizá tus publicaciones por tema</p>
              </div>
              <div className="space-y-4 p-4 sm:p-6">
                {categories.map((_, index) => (
                  <div key={`${index}-${categories[index]}`} className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name={`categories.${index}`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className={labelClass}>Categoría #{index + 1}</FormLabel>
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
                      className="text-red-500"
                      onClick={() => removeCategory(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addCategory}
                >
                  <Plus className="mr-2 h-4 w-4" /> Agregar categoría
                </Button>
              </div>
            </section>

            {/* CTA Section */}
            <section className="rounded-3xl border border-border bg-background shadow-sm">
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
                <h2 className="text-base font-semibold">CTA final</h2>
                <p className="text-muted-foreground text-xs">Llamado a la acción al final del blog</p>
              </div>
              <div className="space-y-6 p-4 sm:p-6">
                <FormField
                  control={form.control}
                  name="loadMore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Texto botón "Cargar más"</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        <FormLabel className={labelClass}>Subtítulo CTA</FormLabel>
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
            </section>

            {/* Submit Button */}
            <div className="sticky bottom-0 z-10 -mx-3 rounded-t-3xl border-t bg-background/80 px-4 py-3 backdrop-blur-xl sm:-mx-4 md:-mx-6">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-12 w-full rounded-2xl bg-primary font-semibold text-white shadow-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    {isEditing ? "Actualizar configuración" : "Guardar configuración"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}