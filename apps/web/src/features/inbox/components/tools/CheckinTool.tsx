'use client';

/**
 * Herramienta "Check-ins" del rail (general, no requiere chat abierto):
 * reservas próximas/en curso que NO han completado el check-in. Clic en una
 * abre el chat de ese cliente (match por número) para enviarle la plantilla
 * o el link de invitados.
 */
import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { CheckCircle2, DoorOpen, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Booking = {
  _id: string;
  nombreCompleto?: string;
  celular?: string;
  fechaEntrada: number;
  fechaSalida: number;
  status?: string;
  checkinCompleted?: boolean;
  checkinSentManualAt?: number;
  property?: { title?: string } | null;
};

function dayLabel(ms: number): { label: string; urgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: 'En curso', urgent: true };
  if (diff === 0) return { label: 'Hoy', urgent: true };
  if (diff === 1) return { label: 'Mañana', urgent: true };
  return { label: `En ${diff} días`, urgent: diff <= 3 };
}

export function CheckinTool({
  onOpenChat,
}: {
  onOpenChat?: (phone: string) => void;
}) {
  const data = useQuery(api.bookings.list, { limit: 500 }) as
    | { bookings: Booking[] }
    | undefined;

  const pending = useMemo(() => {
    const now = Date.now();
    return (data?.bookings ?? [])
      .filter(
        (b) =>
          b.status !== 'CANCELLED' &&
          !b.checkinCompleted &&
          b.fechaSalida >= now,
      )
      .sort((a, b) => a.fechaEntrada - b.fechaEntrada)
      .slice(0, 40);
  }, [data]);

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        <DoorOpen className="h-3.5 w-3.5" /> Check-ins pendientes ·{' '}
        {pending.length}
      </h3>
      {data === undefined ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <p className="text-xs text-muted-foreground">
            Todas las reservas próximas tienen su check-in al día. 🎉
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {pending.map((b) => {
            const d = dayLabel(b.fechaEntrada);
            return (
              <button
                key={b._id}
                type="button"
                onClick={() =>
                  b.celular
                    ? onOpenChat?.(b.celular)
                    : undefined
                }
                title={
                  b.celular
                    ? 'Abrir el chat de este cliente'
                    : 'La reserva no tiene celular'
                }
                className="flex w-full items-center gap-2.5 rounded-xl border border-border p-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    d.urgent
                      ? 'bg-orange-500/15 text-orange-500'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {d.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {b.nombreCompleto || 'Sin nombre'}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {b.property?.title ?? ''} ·{' '}
                    {new Date(b.fechaEntrada).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {b.checkinSentManualAt ? ' · check-in enviado' : ''}
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
