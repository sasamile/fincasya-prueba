"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import { Home, Loader2, Save, Users, UserPlus } from "lucide-react";

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
import { HOME_DEFAULT } from "@/features/admin/constants/home.constants";
import {
  fetchInternalPage,
  updateInternalPage,
} from "@/features/admin/api/internal-pages.api";
import type { HomeContent } from "@/features/admin/types/home.types";
import { FormSection } from "@/features/admin/components/shared/form-section";

const formSchema = z.object({
  verifiedFincasValue: z.string().min(1, "El valor es requerido"),
  happyGuestsValue: z.string().min(1, "El valor es requerido"),
  totalFollowersValue: z.string().min(1, "El valor es requerido"),
});

type FormValues = z.infer<typeof formSchema>;

export function HomeManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: HOME_DEFAULT,
  });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchInternalPage<HomeContent>("home");
        if (data) {
          form.reset({
            verifiedFincasValue:
              data.verifiedFincasValue ?? HOME_DEFAULT.verifiedFincasValue,
            happyGuestsValue:
              data.happyGuestsValue ?? HOME_DEFAULT.happyGuestsValue,
            totalFollowersValue:
              data.totalFollowersValue ?? HOME_DEFAULT.totalFollowersValue,
          });
        }
      } catch {
        // Mantener valor por defecto del formulario
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [form]);

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      await updateInternalPage<FormValues>("home", values);
      sileo.success({ title: "Inicio actualizado", fill: "#f0fdf4" });
    } catch {
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

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-transparent p-3 sm:p-4 md:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 px-3 py-3 md:py-5 -mx-3 sm:-mx-4 md:-mx-6 sm:px-4 md:px-6 mb-4 md:mb-10">
          <div>
            <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none">
              Inicio
            </h1>
            <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1 md:mt-2">
              Estadísticas del hero en la página principal (fincasya.com)
            </p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 md:space-y-8"
          >
            <FormSection
              title="Fincas verificadas"
              description="Número que aparece en el hero de la página principal"
              icon={Home}
              gradientFrom="from-emerald-500/10"
              iconBg="bg-emerald-500"
              iconShadow="shadow-emerald-500/20"
              textColor="text-emerald-500"
              hoverShadow="hover:shadow-emerald-500/5"
              defaultOpen
            >
              <FormField
                control={form.control}
                name="verifiedFincasValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Valor mostrado</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={inputClass}
                        placeholder="+300"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground px-1 mt-2">
                      Se muestra junto a la etiqueta &quot;Fincas verificadas&quot; en el
                      inicio.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection
              title="Huéspedes felices"
              description="Número que aparece en el hero de la página principal"
              icon={Users}
              gradientFrom="from-sky-500/10"
              iconBg="bg-sky-500"
              iconShadow="shadow-sky-500/20"
              textColor="text-sky-500"
              hoverShadow="hover:shadow-sky-500/5"
            >
              <FormField
                control={form.control}
                name="happyGuestsValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Valor mostrado</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={inputClass}
                        placeholder="+40K"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground px-1 mt-2">
                      Se muestra junto a la etiqueta &quot;Huéspedes felices&quot; en el
                      inicio.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection
              title="Seguidores totales"
              description="Número que aparece en el hero de la página principal"
              icon={UserPlus}
              gradientFrom="from-violet-500/10"
              iconBg="bg-violet-500"
              iconShadow="shadow-violet-500/20"
              textColor="text-violet-500"
              hoverShadow="hover:shadow-violet-500/5"
            >
              <FormField
                control={form.control}
                name="totalFollowersValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Valor mostrado</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={inputClass}
                        placeholder="+300K"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground px-1 mt-2">
                      Se muestra junto a la etiqueta &quot;Seguidores totales&quot; en el
                      inicio.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <div className="flex justify-end pb-8">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-12 rounded-2xl px-8 font-bold"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
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
