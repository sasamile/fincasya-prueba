import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

/** Barra de guardar fija al fondo del panel admin (respeta el sidebar). */
export function AdminFloatingSaveBar({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pt-2",
        "md:left-(--sidebar-width,17rem) md:px-6",
        className,
      )}
    >
      <div className="pointer-events-auto mx-auto w-full min-w-0 max-w-4xl">
        <div className="rounded-[24px] border border-border/40 bg-background/95 p-1.5 shadow-2xl shadow-primary/15 backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
