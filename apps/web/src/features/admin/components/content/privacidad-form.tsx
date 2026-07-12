"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import { Loader2, Save, FileText, Lock } from "lucide-react";

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
import { PRIVACIDAD_DEFAULT } from "@/features/admin/constants/paginas-internas.constants";
import {
  fetchLegalPage,
  updateLegalPage,
} from "@/features/admin/api/legal-pages.api";
import type { LegalPageContent } from "@/features/admin/types/legal-pages.types";
import { LegalHtmlPreview } from "@/features/admin/components/content/legal-html-preview";
import { FormSection } from "@/features/admin/components/shared/form-section";

const formSchema = z.object({
  heroTitle: z.string().min(1, "Requerido"),
  heroSubtitle: z.string().min(1, "Requerido"),
  content: z.string().min(10, "Contenido requerido"),
});

type FormValues = z.infer<typeof formSchema>;

export function PrivacidadManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: PRIVACIDAD_DEFAULT,
  });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchLegalPage<LegalPageContent>("privacidad");
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
      await updateLegalPage<FormValues>("privacidad", PRIVACIDAD_DEFAULT);
      form.reset(PRIVACIDAD_DEFAULT);
      setHasBackendData(true);
      sileo.success({ title: "Página creada", fill: "#f0fdf4" });
    } catch (error) {
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
      await updateLegalPage<FormValues>("privacidad", values);
      setHasBackendData(true);
      sileo.success({
        title: "Política de privacidad actualizada",
        description: "La política de privacidad se guardó correctamente.",
        fill: "#f0fdf4",
      });
    } catch (error) {
      console.error("Error updating privacidad", error);
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

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 px-3 py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 sm:px-4 md:px-6 mb-4 md:mb-10 transition-all duration-500 backdrop-blur-2xl">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                Política de Privacidad
              </h1>
              <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2 truncate">
                Administrá el tratamiento de datos personales
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
              title="Hero Legal"
              description="Título y presentación de privacidad"
              icon={FileText}
              gradientFrom="from-slate-500/10"
              iconBg="bg-slate-500"
              iconShadow="shadow-slate-500/20"
              textColor="text-slate-500"
              hoverShadow="hover:shadow-slate-500/5"
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
              title="Tratamiento de Datos"
              description="Contenido legal completo (HTML)"
              icon={Lock}
              gradientFrom="from-slate-500/10"
              iconBg="bg-slate-500"
              iconShadow="shadow-slate-500/20"
              textColor="text-slate-500"
              hoverShadow="hover:shadow-slate-500/5"
            >
              <div className="space-y-8 md:space-y-10">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        Contenido HTML
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={18}
                          className={`${textareaClass} font-mono text-xs`}
                          placeholder="Pegá el código HTML aquí..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Vista previa renderizada
                    </h3>
                  </div>
                  <div className="rounded-2xl border border-border/50 p-2 bg-secondary/5">
                    <LegalHtmlPreview html={form.watch("content")} />
                  </div>
                </div>
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
