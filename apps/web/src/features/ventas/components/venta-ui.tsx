"use client";

/**
 * Primitivos visuales del portal /venta/[token].
 * Neutral + un acento (primary del .landing). Sin cajas de color “estado”
 * salvo success / warning / destructive reales.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description?: string;
}) {
  return (
    <header className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Paso {step} de 6
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function VentaPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function VentaPanelTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-3 text-sm font-semibold text-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}

type CalloutTone = "neutral" | "success" | "warning" | "destructive";

const calloutTone: Record<CalloutTone, string> = {
  neutral: "border-border bg-muted/40 text-foreground",
  success: "border-border bg-muted/40 text-foreground",
  warning: "border-border bg-muted/40 text-foreground",
  destructive: "border-destructive/30 bg-destructive/5 text-destructive",
};

export function VentaCallout({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: CalloutTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        calloutTone[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function VentaMetaRow({
  label,
  value,
  muted,
}: {
  label: ReactNode;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium tabular-nums",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
