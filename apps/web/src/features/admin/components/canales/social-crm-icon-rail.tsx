'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Inbox,
  MessageCircle,
  LayoutGrid,
  PenSquare,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

export type SocialCrmView = 'inbox' | 'comments' | 'posts';

const VIEWS: {
  id: SocialCrmView;
  icon: LucideIcon;
  label: string;
}[] = [
  { id: 'inbox', icon: Inbox, label: 'Mensajes' },
  { id: 'comments', icon: MessageCircle, label: 'Comentarios' },
  { id: 'posts', icon: LayoutGrid, label: 'Publicaciones' },
];

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.3 : 1.9} />
    </button>
  );
}

export function SocialCrmIconRail({
  activeView,
  onViewChange,
  onCompose,
}: {
  activeView: SocialCrmView;
  onViewChange: (view: SocialCrmView) => void;
  onCompose: () => void;
}) {
  const { toggleSidebar } = useSidebar();

  return (
    <nav className="border-border bg-card flex w-[68px] shrink-0 flex-col items-center justify-between border-r py-4">
      <div className="flex flex-col items-center gap-2">
        <RailButton
          icon={PanelLeft}
          label="Menú admin"
          onClick={toggleSidebar}
        />
        <div className="bg-border my-1 h-px w-7" />

        {VIEWS.map((view) => (
          <RailButton
            key={view.id}
            icon={view.icon}
            label={view.label}
            active={activeView === view.id}
            onClick={() => onViewChange(view.id)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <RailButton
          icon={PenSquare}
          label="Publicar en redes"
          onClick={onCompose}
        />
        <img
          src="/favicon.png"
          alt="FincasYa"
          className="ring-border/60 mt-2 h-9 w-9 rounded-full object-cover ring-1"
          draggable={false}
        />
      </div>
    </nav>
  );
}

export const SOCIAL_CRM_VIEW_LABELS: Record<SocialCrmView, string> = {
  inbox: 'Bandeja unificada',
  comments: 'Comentarios',
  posts: 'Publicaciones',
};
