'use client';

/** Rail de herramientas del asesor (columna extrema izquierda del inbox). */
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  CalendarDays,
  DoorOpen,
  FileText,
  Link2,
  LogOut,
  MessageCircle,
  PanelLeft,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';
import { useSidebar } from '@/components/ui/sidebar';

export type AsesorTool =
  | 'contrato'
  | 'calendario'
  | 'venta'
  | 'checkin'
  | 'confirmar';

export const ASESOR_TOOLS: {
  id: AsesorTool;
  icon: LucideIcon;
  label: string;
  needsChat: boolean;
}[] = [
  { id: 'contrato', icon: FileText, label: 'Generar contrato', needsChat: true },
  { id: 'calendario', icon: CalendarDays, label: 'Reservas', needsChat: false },
  { id: 'venta', icon: Link2, label: 'Links de venta', needsChat: false },
  { id: 'checkin', icon: DoorOpen, label: 'Check-ins', needsChat: false },
  { id: 'confirmar', icon: BadgeCheck, label: 'Confirmar reserva', needsChat: false },
];

function RailIcon({
  icon: Icon,
  label,
  active,
  disabled,
  dot,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  dot?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={disabled ? `${label} — selecciona un chat primero` : label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-40 hover:bg-transparent hover:text-muted-foreground',
      )}
    >
      <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.3 : 1.9} />
      {dot && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
      )}
    </button>
  );
}

export function IconRail({
  activeTool,
  onOpenTool,
  hasSelection,
  className,
}: {
  activeTool: AsesorTool | null;
  onOpenTool: (tool: AsesorTool | null) => void;
  hasSelection: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();

  async function handleLogout() {
    await authClient.signOut();
    router.replace('/admin/login');
  }

  return (
    <nav
      className={cn(
        'flex w-[60px] shrink-0 flex-col items-center justify-between border-r border-border bg-background py-4 md:w-[68px]',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        {/* Desplegar / ocultar el sidebar principal de admin */}
        <RailIcon
          icon={PanelLeft}
          label="Mostrar/ocultar menú de admin"
          onClick={toggleSidebar}
        />
        <div className="my-1 h-px w-7 bg-border" />

        {/* Chats (cierra cualquier herramienta abierta) */}
        <RailIcon
          icon={MessageCircle}
          label="Chats"
          active={activeTool === null}
          onClick={() => onOpenTool(null)}
        />

        {/* Herramientas del asesor sobre el chat seleccionado */}
        {ASESOR_TOOLS.map((tool) => (
          <RailIcon
            key={tool.id}
            icon={tool.icon}
            label={tool.label}
            active={activeTool === tool.id}
            disabled={tool.needsChat && !hasSelection}
            onClick={() => onOpenTool(tool.id)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <RailIcon icon={Settings} label="Ajustes" />
        <button
          type="button"
          onClick={() => void handleLogout()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <LogOut className="h-[20px] w-[20px]" strokeWidth={1.9} />
        </button>
        <img
          src="/inbox-avatar.png"
          alt="FincasYa"
          title="FincasYa"
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/40"
          draggable={false}
        />
      </div>
    </nav>
  );
}
