"use client";

/**
 * Sección plegable (acordeón) para el panel de detalle de reserva.
 * Diseño sobrio: header neutro con icono, título y chevron, separado por
 * divisores (sin caja propia, para no anidar tarjetas). Cada sección del
 * detalle (cliente, estancia, abonos, etc.) se envuelve en una de estas
 * para que el panel no abrume.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DetailSection({
  icon,
  title,
  hint,
  badge,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode;
  title: string;
  /** Texto secundario pequeño bajo el título (resumen de la sección). */
  hint?: string;
  /** Elemento a la derecha del header (ej. estado), siempre visible. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold tracking-tight text-foreground">
            {title}
          </span>
          {hint ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="px-1 pb-5 pt-1">{children}</div> : null}
    </section>
  );
}
