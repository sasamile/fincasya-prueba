'use client';

/** Stub hasta portar el inbox admin con alertas reales. */
export function NotificationBell({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <button
      type="button"
      aria-label="Notificaciones"
      className={triggerClassName ?? 'text-muted-foreground hover:text-foreground p-2'}
      disabled
    />
  );
}
