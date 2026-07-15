/**
 * Modal de acciones del inbox (botón ⋮ de la cabecera "Chats"). Reúne en un solo
 * lugar: filtrar la lista por fecha, ver por Experto asignado, marcar como
 * leídos en bloque y asignar chats a un vendedor (por fecha o selección manual).
 *
 * Los límites de fecha se calculan aquí en hora local (Colombia) y viajan en ms
 * a las mutaciones del backend (markReadByRange / assignByRange).
 */
'use client';
import { useState } from 'react';
import { CalendarDays, CheckCheck, ListChecks, UserCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateRange = { from?: number; to?: number; label: string };
export type Operator = { id: string; name: string };

/** Inicio del día (00:00:00.000) desplazado `offset` días hacia atrás. */
function startOfDay(offset: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

const DAY = 24 * 60 * 60 * 1000;

/** Presets de fecha compartidos por "filtrar", "marcar leídos" y "asignar". */
function presets(): DateRange[] {
  const hoy = startOfDay(0);
  return [
    { label: 'Hoy', from: hoy },
    { label: 'Ayer', from: startOfDay(1), to: hoy - 1 },
    { label: 'Antier', from: startOfDay(2), to: startOfDay(1) - 1 },
    { label: 'Todos menos hoy', to: hoy - 1 },
  ];
}

/** Convierte un <input type="date"> (YYYY-MM-DD) a inicio/fin de ese día local. */
function parseDateInput(value: string, end: boolean): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return date.getTime();
}

function SectionTitle({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-foreground">
      <Icon className="h-4 w-4 text-primary" />
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-muted/40 text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

export function InboxActionsModal({
  onClose,
  operators,
  currentUser,
  dateFilter,
  assigneeFilter,
  onApplyDateFilter,
  onApplyAssigneeFilter,
  onMarkReadRange,
  onAssignRange,
  onStartManualSelect,
}: {
  onClose: () => void;
  operators: Operator[];
  currentUser: Operator | null;
  dateFilter: DateRange | null;
  assigneeFilter: string | null;
  onApplyDateFilter: (range: DateRange | null) => void;
  onApplyAssigneeFilter: (userId: string | null) => void;
  onMarkReadRange: (range: DateRange) => Promise<void>;
  onAssignRange: (range: DateRange, operator: Operator) => Promise<void>;
  onStartManualSelect: () => void;
}) {
  const ps = presets();
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [assignOpId, setAssignOpId] = useState<string>(currentUser?.id ?? '');
  const [busy, setBusy] = useState(false);

  const customRange = (): DateRange | null => {
    const from = parseDateInput(rangeFrom, false);
    const to = parseDateInput(rangeTo, true);
    if (from == null && to == null) return null;
    return { from, to, label: 'Rango' };
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const selectedOperator =
    operators.find((o) => o.id === assignOpId) ??
    (currentUser && currentUser.id === assignOpId ? currentUser : null);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3.5">
          <h2 className="text-[16px] font-semibold">Filtros y acciones</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-4">
          {/* 1. Filtrar la lista por fecha */}
          <section>
            <SectionTitle icon={CalendarDays}>Ver chats por fecha</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Chip active={!dateFilter} onClick={() => onApplyDateFilter(null)}>
                Todos
              </Chip>
              {ps.map((p) => (
                <Chip
                  key={p.label}
                  active={dateFilter?.label === p.label}
                  onClick={() => onApplyDateFilter(p)}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="rounded-md border border-border bg-input px-2 py-1 text-[12.5px]"
              />
              <span className="text-[12px] text-muted-foreground">a</span>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="rounded-md border border-border bg-input px-2 py-1 text-[12.5px]"
              />
              <Chip
                onClick={() => {
                  const r = customRange();
                  if (r) onApplyDateFilter(r);
                }}
                disabled={!rangeFrom && !rangeTo}
              >
                Aplicar rango
              </Chip>
            </div>
          </section>

          {/* 2. Ver por asignación */}
          <section>
            <SectionTitle icon={UserCheck}>Ver por vendedor asignado</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Chip active={!assigneeFilter} onClick={() => onApplyAssigneeFilter(null)}>
                Todos
              </Chip>
              {currentUser && (
                <Chip
                  active={assigneeFilter === currentUser.id}
                  onClick={() => onApplyAssigneeFilter(currentUser.id)}
                >
                  Míos
                </Chip>
              )}
              {operators
                .filter((o) => o.id !== currentUser?.id)
                .map((o) => (
                  <Chip
                    key={o.id}
                    active={assigneeFilter === o.id}
                    onClick={() => onApplyAssigneeFilter(o.id)}
                  >
                    {o.name.split(' ')[0]}
                  </Chip>
                ))}
            </div>
          </section>

          {/* 3. Marcar como leídos en bloque */}
          <section>
            <SectionTitle icon={CheckCheck}>Marcar como leídos</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {ps.map((p) => (
                <Chip key={p.label} disabled={busy} onClick={() => run(() => onMarkReadRange(p))}>
                  {p.label}
                </Chip>
              ))}
              <Chip
                disabled={busy || (!rangeFrom && !rangeTo)}
                onClick={() => {
                  const r = customRange();
                  if (r) void run(() => onMarkReadRange(r));
                }}
              >
                Rango de arriba
              </Chip>
            </div>
          </section>

          {/* 4. Asignar chats a un vendedor */}
          <section>
            <SectionTitle icon={UserCheck}>Asignar chats a un vendedor</SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={assignOpId}
                onChange={(e) => setAssignOpId(e.target.value)}
                className="rounded-md border border-border bg-input px-2 py-1.5 text-[12.5px]"
              >
                <option value="">Elegir vendedor…</option>
                {currentUser && <option value={currentUser.id}>{currentUser.name} (yo)</option>}
                {operators
                  .filter((o) => o.id !== currentUser?.id)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </div>
            <p className="mt-2 mb-1 text-[11.5px] text-muted-foreground">
              Asignar todos los chats de:
            </p>
            <div className="flex flex-wrap gap-2">
              {ps.map((p) => (
                <Chip
                  key={p.label}
                  disabled={busy || !selectedOperator}
                  onClick={() => {
                    if (selectedOperator) void run(() => onAssignRange(p, selectedOperator));
                  }}
                >
                  {p.label}
                </Chip>
              ))}
              <Chip
                disabled={busy || !selectedOperator || (!rangeFrom && !rangeTo)}
                onClick={() => {
                  const r = customRange();
                  if (r && selectedOperator) void run(() => onAssignRange(r, selectedOperator));
                }}
              >
                Rango de arriba
              </Chip>
            </div>
            <button
              type="button"
              onClick={onStartManualSelect}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 py-2 text-[13px] font-medium hover:bg-muted"
            >
              <ListChecks className="h-4 w-4" />
              Seleccionar chats manualmente
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
