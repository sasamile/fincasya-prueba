'use client';

/**
 * Herramienta "Reservas" del rail del asesor: calendario del mes con las
 * reservas (de todas las fincas o de una), lista del día seleccionado y
 * reserva rápida sin salir del chat.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReservationCalendarBarClass } from '@/features/admin/utils/reservation-calendar-semaphore';
import type { ConversationRow } from '@/features/inbox/types';

const fl =
  'mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground';
const input =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

type Booking = {
  _id: string;
  nombreCompleto?: string;
  fechaEntrada: number;
  fechaSalida: number;
  precioTotal?: number;
  numeroPersonas?: number;
  status?: string;
  paymentStatus?: string;
  property?: { id: string; title?: string } | null;
};

function money(n?: number) {
  if (!n) return '—';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function ReservasTool({
  conversation,
  fincas,
}: {
  conversation: ConversationRow | null;
  fincas: Array<{ _id: string; title: string }> | undefined;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [fincaId, setFincaId] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showQuick, setShowQuick] = useState(false);

  const data = useQuery(api.bookings.list, {
    month: String(month + 1),
    year: String(year),
    limit: 500,
    ...(fincaId ? { propertyId: fincaId as never } : {}),
  }) as { bookings: Booking[] } | undefined;

  const bookings = useMemo(
    () =>
      (data?.bookings ?? []).filter(
        (b) => b.status !== 'CANCELLED',
      ),
    [data],
  );

  // Días del mes con reservas que los cubren (entrada <= día <= salida).
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0
  const byDay = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (let d = 1; d <= daysInMonth; d++) {
      const start = new Date(year, month, d, 0, 0, 0).getTime();
      const end = new Date(year, month, d, 23, 59, 59).getTime();
      const list = bookings.filter(
        (b) => b.fechaEntrada <= end && b.fechaSalida >= start,
      );
      if (list.length) map.set(d, list);
    }
    return map;
  }, [bookings, year, month, daysInMonth]);

  const dayList = selectedDay ? (byDay.get(selectedDay) ?? []) : bookings;

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(null);
  }

  return (
    <>
      {/* Filtro por finca + navegación de mes */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <select
          className={input}
          value={fincaId}
          onChange={(e) => {
            setFincaId(e.target.value);
            setSelectedDay(null);
          }}
        >
          <option value="">Todas las fincas</option>
          {(fincas ?? []).map((f) => (
            <option key={f._id} value={f._id}>
              {f.title}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold">
            {MESES[month]} {year}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Grilla del mes */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <span key={d} className="text-[10px] font-bold text-muted-foreground">
              {d}
            </span>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const list = byDay.get(d) ?? [];
            const isToday =
              d === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition',
                  selectedDay === d
                    ? 'bg-primary text-primary-foreground font-bold'
                    : isToday
                      ? 'bg-primary/10 font-bold text-primary'
                      : 'hover:bg-muted',
                )}
              >
                {d}
                {list.length > 0 ? (
                  <span
                    className={cn(
                      'mt-0.5 flex gap-0.5',
                      selectedDay === d && 'opacity-90',
                    )}
                  >
                    {list.slice(0, 3).map((b) => (
                      <span
                        key={b._id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          getReservationCalendarBarClass(b),
                        )}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="mt-0.5 h-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reserva rápida */}
      {showQuick ? (
        <QuickBooking
          conversation={conversation}
          fincas={fincas}
          defaultFincaId={fincaId}
          onClose={() => setShowQuick(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowQuick(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Plus className="h-4 w-4" /> Reserva rápida
        </button>
      )}

      {/* Lista de reservas (del día o del mes) */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {selectedDay
            ? `Reservas del ${selectedDay} de ${MESES[month].toLowerCase()}`
            : `Reservas de ${MESES[month].toLowerCase()}`}{' '}
          · {dayList.length}
        </h3>
        {data === undefined ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : dayList.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Sin reservas{selectedDay ? ' ese día' : ' este mes'}.
          </p>
        ) : (
          <div className="space-y-1.5">
            {dayList
              .slice()
              .sort((a, b) => a.fechaEntrada - b.fechaEntrada)
              .map((b) => (
                <div
                  key={b._id}
                  className="flex items-center gap-2.5 rounded-xl border border-border p-2"
                >
                  <span
                    className={cn(
                      'h-9 w-1.5 shrink-0 rounded-full',
                      getReservationCalendarBarClass(b),
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {b.nombreCompleto || 'Sin nombre'}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {b.property?.title ?? ''} ·{' '}
                      {new Date(b.fechaEntrada).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      →{' '}
                      {new Date(b.fechaSalida).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold">{money(b.precioTotal)}</p>
                    <p className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {b.numeroPersonas ?? '—'}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  );
}

/** Form compacto de reserva rápida (valida disponibilidad en bookings.create). */
function QuickBooking({
  conversation,
  fincas,
  defaultFincaId,
  onClose,
}: {
  conversation: ConversationRow | null;
  fincas: Array<{ _id: string; title: string }> | undefined;
  defaultFincaId: string;
  onClose: () => void;
}) {
  const createBooking = useMutation(api.bookings.create);
  const [form, setForm] = useState({
    fincaId: defaultFincaId,
    checkIn: '',
    checkOut: '',
    guests: '1',
    total: '',
    nombre: conversation?.name ?? '',
    celular: conversation?.phone ?? '',
    cedula: '',
  });
  const [saving, setSaving] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleCreate() {
    if (!form.fincaId) return toast.error('Selecciona la finca.');
    if (!form.checkIn || !form.checkOut) return toast.error('Elige las fechas.');
    if (!form.nombre.trim()) return toast.error('Nombre del cliente.');
    const entrada = new Date(`${form.checkIn}T12:00:00`).getTime();
    const salida = new Date(`${form.checkOut}T12:00:00`).getTime();
    const noches = Math.max(1, Math.round((salida - entrada) / 86400000));
    const total = Number(form.total.replace(/\D/g, '')) || 0;
    if (total <= 0) return toast.error('Ingresa el valor total.');
    setSaving(true);
    try {
      await createBooking({
        propertyId: form.fincaId as never,
        nombreCompleto: form.nombre.trim(),
        cedula: form.cedula.trim() || '—',
        celular: form.celular.trim(),
        correo: '',
        fechaEntrada: entrada,
        fechaSalida: salida,
        numeroNoches: noches,
        numeroPersonas: Number(form.guests) || 1,
        subtotal: total,
        precioTotal: total,
        temporada: 'ESTANDAR',
        isDirect: true,
      });
      toast.success('Reserva creada.');
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo crear la reserva.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-primary">
          <CalendarDays className="h-3.5 w-3.5" /> Reserva rápida
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={fl}>Finca</label>
          <select className={input} value={form.fincaId} onChange={set('fincaId')}>
            <option value="">Selecciona…</option>
            {(fincas ?? []).map((f) => (
              <option key={f._id} value={f._id}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fl}>Entrada</label>
          <input className={input} type="date" value={form.checkIn} onChange={set('checkIn')} />
        </div>
        <div>
          <label className={fl}>Salida</label>
          <input className={input} type="date" value={form.checkOut} onChange={set('checkOut')} />
        </div>
        <div>
          <label className={fl}>Personas</label>
          <input className={input} inputMode="numeric" value={form.guests} onChange={set('guests')} />
        </div>
        <div>
          <label className={fl}>Valor total</label>
          <input className={input} inputMode="numeric" placeholder="$ 0" value={form.total} onChange={set('total')} />
        </div>
        <div className="col-span-2">
          <label className={fl}>Cliente</label>
          <input className={input} value={form.nombre} onChange={set('nombre')} placeholder="Nombre completo" />
        </div>
        <div>
          <label className={fl}>Celular</label>
          <input className={input} value={form.celular} onChange={set('celular')} />
        </div>
        <div>
          <label className={fl}>Cédula</label>
          <input className={input} value={form.cedula} onChange={set('cedula')} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={saving}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Crear reserva
      </button>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        Valida disponibilidad automáticamente antes de crear.
      </p>
    </section>
  );
}
