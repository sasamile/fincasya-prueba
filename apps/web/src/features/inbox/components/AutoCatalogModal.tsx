'use client';

/**
 * Modal centrado: envío de catálogo automático (misma lógica del bot),
 * con prefill del chat y lista seleccionable.
 */
import { useEffect, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { Star, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type PreviewItem = {
  propertyId: Id<'properties'>;
  title: string;
  location: string;
  capacity: number;
  priceFrom: number;
  image: string | null;
  isFavorite: boolean;
};

function formatCop(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-CO')}`;
}

function PreviewRow({
  item,
  selected,
  onToggle,
}: {
  item: PreviewItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-black/10 dark:hover:bg-white/5"
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/50',
        )}
      >
        {selected && (
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M5 12l5 5L20 6" />
          </svg>
        )}
      </span>
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-[13px] font-medium">
          {item.isFavorite && (
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
          )}
          {item.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          👥 {item.capacity} · {item.location}
          {item.priceFrom > 0 ? ` · ${formatCop(item.priceFrom)}` : ''}
        </p>
      </div>
    </button>
  );
}

export function AutoCatalogModal({
  conversationId,
  onClose,
  onSent,
}: {
  conversationId: Id<'conversations'>;
  onClose: () => void;
  /** Tras envío OK: cierra también el panel padre si aplica. */
  onSent?: () => void;
}) {
  const sendAuto = useAction(api.inbox.sendAutoCatalog);
  const previewAuto = useAction(api.inbox.previewAutoCatalog);
  const prefill = useQuery(api.inbox.getCatalogPrefill, { conversationId });

  const [autoFe, setAutoFe] = useState('');
  const [autoFs, setAutoFs] = useState('');
  const [autoPersonas, setAutoPersonas] = useState('');
  const [autoZona, setAutoZona] = useState('');
  const [autoInit, setAutoInit] = useState(false);
  const [autoSending, setAutoSending] = useState(false);
  const [autoLoadingPreview, setAutoLoadingPreview] = useState(false);
  const [autoPreview, setAutoPreview] = useState<PreviewItem[] | null>(null);
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  const [autoPreviewError, setAutoPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [filtersTouched, setFiltersTouched] = useState(false);

  useEffect(() => {
    if (!prefill || autoInit) return;
    setAutoFe(prefill.fechaEntrada || '');
    setAutoFs(prefill.fechaSalida || '');
    setAutoPersonas(prefill.personas != null ? String(prefill.personas) : '');
    setAutoZona(prefill.zona || '');
    setAutoInit(true);
  }, [prefill, autoInit]);

  useEffect(() => {
    if (!autoInit) return;
    if (!autoFe && !autoPersonas && !autoZona) return;
    void handleLoadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInit]);

  useEffect(() => {
    if (!filtersTouched) return;
    setAutoPreview(null);
    setAutoSelected(new Set());
    setAutoPreviewError(null);
  }, [autoFe, autoFs, autoPersonas, autoZona, filtersTouched]);

  async function handleLoadPreview() {
    if (autoLoadingPreview) return;
    setAutoLoadingPreview(true);
    setAutoPreviewError(null);
    setResult(null);
    try {
      const res = await previewAuto({
        conversationId,
        personas: autoPersonas ? Number(autoPersonas) : undefined,
        zona: autoZona.trim() || undefined,
        fechaEntrada: autoFe || undefined,
        fechaSalida: autoFs || undefined,
      });
      if (!res.ok) {
        setAutoPreview([]);
        setAutoSelected(new Set());
        setAutoPreviewError(res.motivo ?? 'No se pudo cargar el preview');
        return;
      }
      if (res.items.length === 0) {
        setAutoPreview([]);
        setAutoSelected(new Set());
        setAutoPreviewError(
          'No hay fincas disponibles con esos filtros. Ajusta fechas, cupo o zona.',
        );
        return;
      }
      setAutoPreview(res.items);
      setAutoSelected(new Set(res.items.map((i) => String(i.propertyId))));
    } catch (err) {
      setAutoPreviewError(
        err instanceof Error ? err.message : 'Error al cargar fincas',
      );
    } finally {
      setAutoLoadingPreview(false);
    }
  }

  async function handleAutoSend() {
    if (autoSending) return;
    if (!autoPreview) {
      await handleLoadPreview();
      return;
    }
    if (autoSelected.size === 0) {
      setResult('Selecciona al menos una finca');
      return;
    }
    setAutoSending(true);
    setResult(null);
    try {
      const res = await sendAuto({
        conversationId,
        personas: autoPersonas ? Number(autoPersonas) : undefined,
        zona: autoZona.trim() || undefined,
        fechaEntrada: autoFe || undefined,
        fechaSalida: autoFs || undefined,
        propertyIds: [...autoSelected] as Id<'properties'>[],
      });
      if (res.ok) {
        setResult(`✓ Enviando ${res.queued ?? 0} finca(s)…`);
        setTimeout(() => {
          onSent?.();
          onClose();
        }, 500);
      } else {
        setResult(res.motivo ?? 'No se pudo enviar');
      }
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setAutoSending(false);
    }
  }

  function toggleAuto(id: string) {
    setAutoSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">
              Catálogo automático
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Como el bot: filtra, revisa y envía las fichas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[12px] text-muted-foreground">
            Si el cliente ya dio fechas/personas/zona en el chat, se llenan
            solos. Luego ves las fincas y puedes desmarcar las que no quieras
            enviar.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Entrada
              <input
                type="date"
                value={autoFe}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setAutoFe(e.target.value);
                }}
                className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground"
              />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">
              Salida
              <input
                type="date"
                value={autoFs}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setAutoFs(e.target.value);
                }}
                className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground"
              />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">
              Personas
              <input
                type="number"
                min={1}
                value={autoPersonas}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setAutoPersonas(e.target.value);
                }}
                placeholder="Ej: 10"
                className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground"
              />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">
              Zona (opcional)
              <input
                type="text"
                value={autoZona}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setAutoZona(e.target.value);
                }}
                placeholder="Ej: Melgar"
                className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground"
              />
            </label>
          </div>

          {autoPreview && autoPreview.length > 0 && (
            <div className="mt-3 space-y-0.5 rounded-xl border border-border/60 bg-muted/20 p-1.5">
              <div className="flex items-center justify-between px-1.5 pb-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {autoSelected.size} de {autoPreview.length} seleccionada(s)
                </p>
                <button
                  type="button"
                  className="text-[11px] font-medium text-primary hover:underline"
                  onClick={() => {
                    if (autoSelected.size === autoPreview.length) {
                      setAutoSelected(new Set());
                    } else {
                      setAutoSelected(
                        new Set(autoPreview.map((i) => String(i.propertyId))),
                      );
                    }
                  }}
                >
                  {autoSelected.size === autoPreview.length
                    ? 'Ninguna'
                    : 'Todas'}
                </button>
              </div>
              {autoPreview.map((item) => {
                const id = String(item.propertyId);
                return (
                  <PreviewRow
                    key={id}
                    item={item}
                    selected={autoSelected.has(id)}
                    onToggle={() => toggleAuto(id)}
                  />
                );
              })}
            </div>
          )}

          {autoPreviewError && (
            <p className="mt-2 text-[12px] text-amber-500">{autoPreviewError}</p>
          )}
          {result && (
            <p className="mt-2 text-[12px] text-muted-foreground">{result}</p>
          )}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => void handleLoadPreview()}
            disabled={autoLoadingPreview || autoSending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-background px-3 py-2.5 text-[13px] font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
          >
            {autoLoadingPreview
              ? 'Buscando…'
              : autoPreview
                ? 'Actualizar lista'
                : 'Ver fincas'}
          </button>
          <button
            type="button"
            onClick={() => void handleAutoSend()}
            disabled={
              autoSending ||
              autoLoadingPreview ||
              (autoPreview != null && autoSelected.size === 0)
            }
            className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Zap className="h-4 w-4" />
            {autoSending
              ? 'Enviando…'
              : !autoPreview
                ? 'Ver y enviar'
                : `Enviar (${autoSelected.size})`}
          </button>
        </footer>
      </div>
    </div>
  );
}
