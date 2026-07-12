"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import { Loader2, Save, BookOpen, Newspaper, Settings } from "lucide-react";

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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { BlogPost } from "@/features/admin/types/paginas-internas.types";
import { InternalPageImageUpload } from "@/features/admin/components/content/internal-page-image-upload";
import { FormSection } from "@/features/admin/components/shared/form-section";

const postSchema = z.object({
  id: z.number().int().nonnegative(),
  category: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  imageUrl: z.string().optional(),
  date: z.string().min(1),
  readTime: z.number().int().positive(),
  content: z.string().min(1),
  // Optional active field for toggling visibility
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof postSchema>;

interface BlogPostFormProps {
  onSave: (values: FormValues) => Promise<void>;
  onCancel: () => void;
  initialData?: BlogPost;
  isEditing: boolean;
}

export function BlogPostForm({
  onSave,
  onCancel,
  initialData,
  isEditing,
}: BlogPostFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      id: 0,
      category: "",
      title: "",
      excerpt: "",
      imageUrl: "",
      date: "",
      readTime: 1,
      content: "<p>Contenido...</p>",
      active: true,
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
        title: isEditing ? "Publicación actualizada" : "Publicación creada",
        fill: "#f0fdf4",
      });
      onCancel();
    } catch (error) {
      console.error("Error saving blog post", error);
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

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
        <header className="border-border/50 border-b px-3 py-4 sm:px-4 md:px-6 md:py-6">
          <div>
            <h1 className="bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-lg font-bold text-transparent md:text-3xl">
              {isEditing ? "Editar publicación" : "Nueva publicación"}
            </h1>
            <p className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase tracking-widest">
              Completa los detalles de la publicación del blog
            </p>
          </div>
        </header>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 md:space-y-8"
          >
            <FormSection
              title="Información básica"
              description="Título, categoría y fechas"
              icon={BookOpen}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-500"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-500"
              hoverShadow="hover:shadow-indigo-500/5"
              defaultOpen={true}
            >
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Categoría</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Imagen destacada
                      </FormLabel>
                      <FormControl>
                        <InternalPageImageUpload
                          value={field.value || ""}
                          onChange={field.onChange}
                          previewAlt={
                            form.getValues("title") || "Imagen del blog"
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Fecha</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className={inputClass}
                            placeholder="15 de marzo, 2025"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="readTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Minutos de lectura
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                            className={inputClass}
                            min={1}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          name={field.name}
                          ref={field.ref}
                          checked={!!field.value}
                          onBlur={field.onBlur}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 text-primary rounded border-gray-300"
                        />
                      </FormControl>
                      <FormLabel className={labelClass}>
                        Publicar (visible en el blog)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title="Contenido del Artículo"
              description="Resumen y contenido completo"
              icon={Newspaper}
              gradientFrom="from-violet-500/10"
              iconBg="bg-violet-500"
              iconShadow="shadow-violet-500/20"
              textColor="text-violet-500"
              hoverShadow="hover:shadow-violet-500/5"
            >
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Resumen</FormLabel>
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
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Contenido del artículo
                      </FormLabel>
                      <FormControl>
                        <RichTextEditor
                          {...field}
                          className="min-h-[400px]"
                          placeholder="Ingresá el contenido aquí..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            {/* ID Section (only for editing) */}
            {isEditing && (
              <FormSection
                title="Detalles técnicos"
                description="ID de la publicación"
                icon={Settings}
                gradientFrom="from-slate-500/10"
                iconBg="bg-slate-500"
                iconShadow="shadow-slate-500/20"
                textColor="text-slate-500"
                hoverShadow="hover:shadow-slate-500/5"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>ID</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                            className={inputClass}
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>
            )}

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
                {isSaving
                  ? "Guardando..."
                  : isEditing
                    ? "Actualizar publicación"
                    : "Crear publicación"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
