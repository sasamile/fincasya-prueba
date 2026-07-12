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
  Share2,
  Rss,
  Settings,
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { InternalPageImageUpload } from "@/features/admin/components/content/internal-page-image-upload";
import { BLOG_DEFAULT } from "@/features/admin/constants/paginas-internas.constants";
import {
  fetchInternalPage,
  updateInternalPage,
} from "@/features/admin/api/internal-pages.api";
import type { BlogContent } from "@/features/admin/types/paginas-internas.types";
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
});

const formSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  categories: z.array(z.string().min(1)).min(1, "Agregá categorías"),
  posts: z.array(postSchema).min(1, "Agregá publicaciones"),
  loadMore: z.string().min(1, "Requerido"),
  ctaTitle: z.string().min(1, "Requerido"),
  ctaSubtitle: z.string().min(1, "Requerido"),
  ctaWhatsappUrl: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof formSchema>;

export function BlogManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: BLOG_DEFAULT,
  });

  const {
    fields: postFields,
    append: appendPost,
    remove: removePost,
  } = useFieldArray({ control: form.control, name: "posts" });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchInternalPage<BlogContent>("blog");
        if (data) {
          // Ensure numeric readTime + id come as numbers
          const normalized = {
            ...data,
            posts:
              data.posts?.map((post) => ({
                ...post,
                id: Number(post.id) || 0,
                readTime: Number(post.readTime) || 1,
                imageUrl: post.imageUrl ?? "",
              })) ?? BLOG_DEFAULT.posts,
          } as FormValues;
          form.reset(normalized);
        }
      } catch {
        // ignore, fallback default
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [form]);

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      await updateInternalPage<FormValues>("blog", values);
      sileo.success({
        title: "Blog actualizado",
        fill: "#f0fdf4",
      });
    } catch (error) {
      console.error("Error updating blog", error);
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

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";
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
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 px-3 py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 sm:px-4 md:px-6 mb-4 md:mb-10 transition-all duration-500 backdrop-blur-2xl">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                Blog / Feed social
              </h1>
              <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2 truncate">
                Gestioná categorías, artículos y CTA
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 md:space-y-8"
          >
            <FormSection
              title="Hero del Blog"
              description="Encabezado principal y título"
              icon={Share2}
              gradientFrom="from-violet-500/10"
              iconBg="bg-violet-500"
              iconShadow="shadow-violet-500/20"
              textColor="text-violet-500"
              hoverShadow="hover:shadow-violet-500/5"
              defaultOpen={true}
            >
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
            </FormSection>

            <FormSection
              title="Categorías"
              description="Organización de contenido"
              icon={Settings}
              gradientFrom="from-indigo-500/10"
              iconBg="bg-indigo-500"
              iconShadow="shadow-indigo-500/20"
              textColor="text-indigo-500"
              hoverShadow="hover:shadow-indigo-500/5"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {categories.map((_, index) => (
                    <div
                      key={`${index}-${categories[index]}`}
                      className="flex items-end gap-2 bg-secondary/20 p-4 rounded-2xl border border-border/50"
                    >
                      <FormField
                        control={form.control}
                        name={`categories.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className={labelClass}>
                              Categoría #{index + 1}
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
                        onClick={() => removeCategory(index)}
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
                  onClick={addCategory}
                >
                  <Plus className="mr-2 h-4 w-4" /> Agregar categoría
                </Button>
              </div>
            </FormSection>

            <FormSection
              title="Publicaciones"
              description="Artículos y noticias"
              icon={Rss}
              gradientFrom="from-violet-500/10"
              iconBg="bg-violet-500"
              iconShadow="shadow-violet-500/20"
              textColor="text-violet-500"
              hoverShadow="hover:shadow-violet-500/5"
            >
              <div className="space-y-6">
                {postFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="bg-secondary/20 border-border group space-y-4 rounded-2xl border p-4 md:p-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase">
                        Post #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePost(index)}
                        className="text-muted-foreground h-10 w-10 shrink-0 rounded-2xl opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`posts.${index}.id`}
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
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`posts.${index}.category`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>
                              Categoría
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
                      name={`posts.${index}.title`}
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
                      name={`posts.${index}.excerpt`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>Resumen</FormLabel>
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

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`posts.${index}.imageUrl`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel className={labelClass}>
                              Imagen destacada
                            </FormLabel>
                            <FormControl>
                              <InternalPageImageUpload
                                value={field.value || ""}
                                onChange={field.onChange}
                                previewAlt={
                                  form.getValues(`posts.${index}.title`) ||
                                  "Imagen del artículo"
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`posts.${index}.date`}
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
                        name={`posts.${index}.readTime`}
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
                      name={`posts.${index}.content`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>
                            Contenido del artículo
                          </FormLabel>
                          <FormControl>
                            <RichTextEditor
                              value={field.value}
                              onChange={field.onChange}
                              className="min-h-[320px]"
                              placeholder="Escribí el artículo, insertá imágenes o videos..."
                            />
                          </FormControl>
                          <FormMessage />
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
                    appendPost({
                      id: Date.now(),
                      category: form.getValues("categories")[0] || "General",
                      title: "Nuevo artículo",
                      excerpt: "",
                      imageUrl: "",
                      date: new Date().toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                      readTime: 5,
                      content: "<p>Contenido...</p>",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Agregar publicación
                </Button>
              </div>
            </FormSection>

            <FormSection
              title="Llamado a la Acción (CTA)"
              description="Botones y contacto final"
              icon={MessageSquare}
              gradientFrom="from-blue-500/10"
              iconBg="bg-blue-500"
              iconShadow="shadow-blue-500/20"
              textColor="text-blue-500"
              hoverShadow="hover:shadow-blue-500/5"
            >
              <div className="space-y-6 md:space-y-8">
                <FormField
                  control={form.control}
                  name="loadMore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Texto botón "Cargar más"
                      </FormLabel>
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
