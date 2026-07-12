'use client';

/** Rail de navegación vertical (columna extrema izquierda estilo WhatsApp Web). */
import { useRouter } from 'next/navigation';
import { CircleDashed, LogOut, MessageCircle, Radio, Settings, Store, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';

/** Icono del rail de navegación (columna extrema izquierda de WhatsApp). */
function RailIcon({
  icon: Icon,
  label,
  active,
  dot,
}: {
  icon: typeof MessageCircle;
  label: string;
  active?: boolean;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
      {dot && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </button>
  );
}

/** Rail de navegación vertical estilo WhatsApp Web. */
export function IconRail() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.replace('/login');
  }

  return (
    <nav className="flex w-[68px] shrink-0 flex-col items-center justify-between border-r border-border bg-background py-4">
      <div className="flex flex-col items-center gap-2">
        <RailIcon icon={MessageCircle} label="Chats" active />
        <RailIcon icon={CircleDashed} label="Estados" dot />
        <RailIcon icon={Radio} label="Canales" />
        <RailIcon icon={Users} label="Comunidades" />
        <RailIcon icon={Store} label="Catálogo" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <RailIcon icon={Settings} label="Ajustes" />
        <button
          type="button"
          onClick={() => void handleLogout()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
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
