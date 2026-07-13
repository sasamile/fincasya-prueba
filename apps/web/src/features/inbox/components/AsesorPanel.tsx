'use client';

/**
 * Panel deslizante de herramientas del asesor, sobre la conversación
 * seleccionada. Estructura base; cada herramienta se completa por fases
 * (ver memoria inbox-asesor-roadmap).
 */
import {
  CalendarDays,
  DoorOpen,
  FileText,
  Link2,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AsesorTool } from '@/features/inbox/components/IconRail';
import type { ConversationRow } from '@/features/inbox/types';

const TOOL_META: Record<
  AsesorTool,
  { icon: LucideIcon; title: string; subtitle: string }
> = {
  contrato: {
    icon: FileText,
    title: 'Generar contrato con IA',
    subtitle: 'Analiza el chat, prellena los datos y envía el contrato.',
  },
  calendario: {
    icon: CalendarDays,
    title: 'Disponibilidad de fincas',
    subtitle: 'Revisa si una finca está libre para responder al instante.',
  },
  venta: {
    icon: Link2,
    title: 'Crear link de venta',
    subtitle: 'Genera un link con metadata para compartir en el chat.',
  },
  checkin: {
    icon: DoorOpen,
    title: 'Check-ins del día',
    subtitle: 'Mensajes de check-in por enviar hoy, según las reglas.',
  },
};

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
      <Sparkles className="h-6 w-6 text-muted-foreground/60" />
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        En construcción — siguiente fase
      </span>
    </div>
  );
}

export function AsesorPanel({
  tool,
  conversation,
  onClose,
}: {
  tool: AsesorTool;
  conversation: ConversationRow | null;
  onClose: () => void;
}) {
  const meta = TOOL_META[tool];
  const Icon = meta.icon;

  return (
    <aside className="flex w-full min-w-0 flex-1 flex-col border-l border-border bg-background">
      {/* Cabecera */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold">{meta.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Contexto del chat seleccionado */}
      {conversation ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold',
              'bg-primary/10 text-primary',
            )}
          >
            {(conversation.name || conversation.phone || '?')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {conversation.name || 'Sin nombre'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {conversation.phone}
            </p>
          </div>
        </div>
      ) : null}

      {/* Contenido de la herramienta */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {tool === 'contrato' && (
          <Placeholder text="La IA leerá este chat, extraerá finca, fechas, personas, precio y datos del cliente, y mostrará una vista previa editable del contrato (tipo Word) lista para firmar y enviar por WhatsApp." />
        )}
        {tool === 'calendario' && (
          <Placeholder text="Vista rápida tipo calendario para ver qué fincas están reservadas en unas fechas y responderle al cliente sin salir del chat." />
        )}
        {tool === 'venta' && (
          <Placeholder text="Elige finca, valor negociado y código de contrato para generar un link de venta con metadata; el cliente entra, llena sus datos y sube el soporte de pago." />
        )}
        {tool === 'checkin' && (
          <Placeholder text="Lista de check-ins que toca enviar hoy según las reglas (un día antes, al propietario, etc.) con sus teléfonos, para despacharlos rápido." />
        )}
      </div>
    </aside>
  );
}
