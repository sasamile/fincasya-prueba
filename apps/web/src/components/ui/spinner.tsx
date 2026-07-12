import { cn } from '@/lib/utils';

/** Spinner circular (borde superior en verde de acento). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        'inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-muted-foreground/25 border-t-primary',
        className,
      )}
    />
  );
}

/** Área de carga centrada con spinner y etiqueta opcional. */
export function LoadingArea({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-3 py-10 text-muted-foreground',
        className,
      )}
    >
      <Spinner className="h-7 w-7" />
      {label ? <span className="text-[13px]">{label}</span> : null}
    </div>
  );
}
