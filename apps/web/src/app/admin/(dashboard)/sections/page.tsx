"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, type ComponentType } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutDashboard } from "lucide-react";
import { QuienesSomosManagement } from "@/features/admin/components/content/quienes-somos-form";
import { ComoFuncionaManagement } from "@/features/admin/components/content/como-funciona-form";
import { VinculateManagement } from "@/features/admin/components/content/vinculate-form";
import { BlogManagement } from "@/features/admin/components/content/blog-form";
import { CentroAyudaManagement } from "@/features/admin/components/content/centro-ayuda-form";
import { ContactoManagement } from "@/features/admin/components/content/contacto-form";
import { TerminosManagement } from "@/features/admin/components/content/terminos-form";
import { PrivacidadManagement } from "@/features/admin/components/content/privacidad-form";
import { CancelacionManagement } from "@/features/admin/components/content/cancelacion-form";
import { HomeManagement } from "@/features/admin/components/content/home-form";

type SectionConfig = {
  id: string;
  label: string;
  shortLabel?: string;
  component: ComponentType;
};

const SECTIONS: SectionConfig[] = [
  {
    id: "home",
    label: "Inicio",
    shortLabel: "Inicio ",
    component: HomeManagement,
  },
  {
    id: "quienes-somos",
    label: "¿Quiénes Somos?",
    component: QuienesSomosManagement,
  },
  {
    id: "como-funciona",
    label: "¿Cómo Funciona?",
    component: ComoFuncionaManagement,
  },
  { id: "vinculate", label: "Vincúlate", component: VinculateManagement },
  { id: "blog", label: "Blog / Feed Social", component: BlogManagement },
  {
    id: "centro-ayuda",
    label: "Centro de Ayuda",
    component: CentroAyudaManagement,
  },
  { id: "contacto", label: "Contacto", component: ContactoManagement },
  {
    id: "terminos",
    label: "Términos y Condiciones",
    component: TerminosManagement,
  },
  { id: "privacidad", label: "Privacidad", component: PrivacidadManagement },
  { id: "cancelacion", label: "Cancelación", component: CancelacionManagement },
];

function SectionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentType = searchParams.get("type") || "quienes-somos";

  const CurrentComponent = useMemo(() => {
    const section = SECTIONS.find((s) => s.id === currentType) || SECTIONS[0];
    return section.component;
  }, [currentType]);

  const handleSectionChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex-1 bg-transparent">
      {/* Sticky Navigation Bar */}
      <div className="sticky top-14 md:top-[60.4px] z-40 w-full px-4 md:px-8 py-4 backdrop-blur-lg bg-background/40 border-b border-border/40 shadow-xs">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground/90 leading-tight">
                Gestión de Contenidos
              </h2>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">
                {SECTIONS.find((s) => s.id === currentType)?.label ||
                  "Seleccionar sección"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={currentType} onValueChange={handleSectionChange}>
              <SelectTrigger className="w-full md:w-[300px] rounded-2xl h-11 border-border/60 bg-background/50 backdrop-blur-sm shadow-sm transition-all hover:border-primary/30 focus:ring-primary/10">
                <SelectValue placeholder="Seleccionar sección" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/60 shadow-2xl backdrop-blur-2xl bg-background/95 max-h-[min(70vh,420px)]">
                {SECTIONS.map((section) => (
                  <SelectItem
                    key={section.id}
                    value={section.id}
                    className="rounded-xl focus:bg-primary/5 focus:text-primary transition-colors cursor-pointer py-2.5"
                  >
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mx-auto max-w-5xl mt-3 flex gap-2 overflow-x-auto pb-1">
          {SECTIONS.map((section) => {
            const isActive = section.id === currentType;
            const chipLabel = section.shortLabel ?? section.label;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  section.id === "home"
                    ? isActive
                      ? "ring-2 ring-emerald-400/50"
                      : "border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "",
                ].join(" ")}
              >
                {chipLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="transition-all duration-500 ease-in-out opacity-100 py-6">
        <CurrentComponent key={currentType} />
      </div>
    </div>
  );
}

export default function AdminSectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <SectionsContent />
    </Suspense>
  );
}
