/** Primitivas visuales compartidas del inbox: avatar, tick de entrega, toggle del bot. */
import { Check, CheckCheck, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { avatarColorFor } from '@/lib/avatarColor';

export function BotToggle({
  enabled,
  disabled,
  onChange,
  title,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        'toggle-track relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
      data-on={enabled}
      title={title ?? (enabled ? 'Bot activo' : 'Bot apagado')}
    >
      <span className="toggle-thumb absolute left-0.5 h-3.5 w-3.5 rounded-full transition-transform" />
    </button>
  );
}

/**
 * Avatar por defecto de WhatsApp (default-contact-refreshed de Meta):
 * círculo gris con la silueta oficial. SVG exacto del cliente de WhatsApp.
 */
export function DefaultContactSvg({ fill = '#8a9399', className }: { fill?: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <path
        fill={fill}
        d="M24 23q-1.86 0-3.18-1.32T19.5 18.5t1.32-3.18T24 14t3.18 1.32q1.32 1.32 1.32 3.18t-1.32 3.18T24 23m-6.75 10q-.93 0-1.59-.66T15 30.75v-.9q0-.96.5-1.76a3.3 3.3 0 0 1 1.3-1.22 16.7 16.7 0 0 1 3.54-1.3q1.8-.44 3.66-.44t3.66.43 3.54 1.31q.82.42 1.3 1.22t.5 1.76v.9q0 .93-.66 1.59t-1.59.66z"
      />
    </svg>
  );
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const dim = size === 'xs' ? 'h-7 w-7' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const { bg, fg } = avatarColorFor(name);
  return (
    <div
      title={name}
      className={cn('shrink-0 overflow-hidden rounded-full', dim, className)}
      style={{ backgroundColor: bg }}
    >
      <DefaultContactSvg fill={fg} className="h-full w-full" />
    </div>
  );
}

export function DeliveryTick({ status }: { status: string | null }) {
  if (!status) return null;
  const cls = 'h-3.5 w-3.5 shrink-0';
  const stroke = 2.25;
  if (status === 'failed') {
    return <CircleAlert className={cn(cls, 'text-destructive')} strokeWidth={stroke} />;
  }
  if (status === 'read') {
    return <CheckCheck className={cn(cls, 'text-[#53bdeb]')} strokeWidth={stroke} />;
  }
  if (status === 'delivered') {
    return <CheckCheck className={cn(cls, 'text-[#8696a0]')} strokeWidth={stroke} />;
  }
  return <Check className={cn(cls, 'text-[#8696a0]')} strokeWidth={stroke} />;
}
