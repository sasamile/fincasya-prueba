'use client';

/**
 * Herramienta "Links de venta" del rail: es POR ASESOR (no por chat). Lista
 * los links enviados con filtro por fecha (hoy por defecto), estado del
 * cliente, aviso si el número coincide con el chat abierto, copiar link y
 * creación (mismo formulario completo del panel admin).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listSaleLinks,
  type SaleLink,
} from '@/features/ventas/api/sale-links.api';
import { CreateSaleLinkModal } from '@/features/ventas/components/create-sale-link-modal';
import type { ConversationRow } from '@/features/inbox/types';

const input =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

function money(n?: number) {
  if (!n) return '—';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function digits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function linkStatus(l: SaleLink): { label: string; cls: string } {
  if (l.paymentValidated)
    return { label: 'Pagado', cls: 'bg-emerald-500/15 text-emerald-500' };
  if (l.paymentProofUrl)
    return { label: 'Soporte por revisar', cls: 'bg-orange-500/15 text-orange-500' };
  if (l.clientData)
    return { label: 'Datos llenos', cls: 'bg-sky-500/15 text-sky-500' };
  if (l.status === 'cancelled')
    return { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' };
  return { label: 'Esperando cliente', cls: 'bg-muted text-muted-foreground' };
}

export function VentaTool({
  conversation,
}: {
  conversation: ConversationRow | null;
  /** Conservado por compatibilidad con el rail; el modal carga las fincas solo. */
  fincas?: Array<{ _id: string; title: string }> | undefined;
}) {
  const [rows, setRows] = useState<SaleLink[] | null>(null);
  const [dateFilter, setDateFilter] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
      new Date(),
    ),
  );
  const [showAll, setShowAll] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const { rows } = await listSaleLinks();
      setRows(rows);
    } catch {
      toast.error('No se pudieron cargar los links.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chatDigits = digits(conversation?.phone ?? '');

  const filtered = useMemo(() => {
    const list = rows ?? [];
    if (showAll) return list;
    return list.filter((l) => {
      const created = l as unknown as { createdAt?: number; _creationTime?: number };
      const ts = created.createdAt ?? created._creationTime ?? 0;
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
      }).format(new Date(ts));
      return day === dateFilter;
    });
  }, [rows, dateFilter, showAll]);

  function copyLink(token: string) {
    const url = `${window.location.origin}/venta/${token}`;
    void navigator.clipboard.writeText(url).catch(() => {});
    toast.success('Link copiado.');
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
        <input
          className={cn(input, 'h-9 flex-1')}
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setShowAll(false);
          }}
        />
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className={cn(
            'h-9 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition',
            showAll
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          {showAll ? 'Todos ✓' : 'Todos'}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          title="Actualizar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm"
      >
        <Plus className="h-4 w-4" /> Crear link de venta
      </button>

      {/* Lista */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {showAll ? 'Todos los links' : `Links del ${dateFilter}`} ·{' '}
          {filtered.length}
        </h3>
        {rows === null ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Sin links {showAll ? 'creados' : 'ese día'}.
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((l) => {
              const st = linkStatus(l);
              const clientPhone = digits(l.clientData?.telefono ?? '');
              const matchesChat =
                chatDigits.length >= 7 &&
                clientPhone.length >= 7 &&
                (chatDigits.endsWith(clientPhone.slice(-10)) ||
                  clientPhone.endsWith(chatDigits.slice(-10)));
              return (
                <div
                  key={l.token}
                  className={cn(
                    'rounded-xl border p-2.5',
                    matchesChat ? 'border-primary/50 bg-primary/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-black text-primary">
                      {l.contractCode || l.token.slice(0, 6)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        st.cls,
                      )}
                    >
                      {st.label}
                    </span>
                    {matchesChat ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        Este chat
                      </span>
                    ) : null}
                    <span className="ml-auto text-[12px] font-bold">
                      {money(l.totalValue)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {(l as unknown as { propertyTitle?: string }).propertyTitle ??
                        ''}{' '}
                      · {l.clientData?.nombre || 'Sin cliente aún'}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyLink(l.token)}
                      title="Copiar link"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={`/venta/${l.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver portal del cliente"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <CreateSaleLinkModal
        open={showCreate}
        onOpenChange={setShowCreate}
        variant="inbox"
        onCreated={() => {
          setShowCreate(false);
          void load();
        }}
      />
    </>
  );
}
