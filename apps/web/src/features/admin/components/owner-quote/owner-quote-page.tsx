'use client';

/**
 * COTIZACIÓN AL PROPIETARIO (Adriana, 22-jul).
 *
 * Baja las reservas, el asesor elige una, escribe en cuánto se le negoció la
 * finca al dueño, revisa el documento con la marca y lo envía por correo al
 * propietario. El correo se precarga de la ficha de la finca y se puede editar.
 */

import { useMemo, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { toast } from 'sonner';
import { Eye, Loader2, Mail, Search, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopMoneyInput } from '@/features/admin/components/contracts/cop-money-input';
import { buildOwnerQuoteHtml } from '@/features/admin/lib/owner-quote-doc';

type Reserva = {
  _id: Id<'bookings'>;
  reference: string;
  nombreCompleto: string;
  propertyTitle: string;
  propertyLocation: string;
  propietarioNombre: string;
  propietarioCorreo: string;
  fechaEntrada: number;
  fechaSalida: number;
  numeroNoches: number;
  numeroPersonas: number;
  precioTotal: number;
  groupType: string;
};

function parseCop(raw: string): number {
  const n = Number((raw || '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function money(n?: number): string {
  if (!n || n <= 0) return '—';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function ymd(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchLogoDataUrl(): Promise<string | null> {
  const candidates = [
    '/contracts/contract-logo.jpg',
    '/fincasya-negro-logo-reserva.png',
    '/fincas-ya-logo.png',
  ];
  for (const src of candidates) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      /* siguiente */
    }
  }
  return null;
}

export function OwnerQuotePage() {
  const [buscar, setBuscar] = useState('');
  const [selId, setSelId] = useState<Id<'bookings'> | null>(null);
  const [correo, setCorreo] = useState('');
  const [correoTouched, setCorreoTouched] = useState(false);
  const [valorRaw, setValorRaw] = useState('');
  const [notas, setNotas] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'preview' | 'send'>(null);

  const reservas = useQuery(api.ownerQuotes.listReservations, { buscar }) as
    | Reserva[]
    | undefined;
  const sendToOwner = useAction(api.ownerQuotes.sendToOwner);

  const selected = useMemo(
    () => reservas?.find((r) => r._id === selId) ?? null,
    [reservas, selId],
  );

  // Correo del dueño: precargado de la finca, editable.
  const correoEfectivo = correoTouched
    ? correo
    : (selected?.propietarioCorreo ?? '');

  function elegir(r: Reserva) {
    setSelId(r._id);
    setCorreoTouched(false);
    setCorreo(r.propietarioCorreo ?? '');
    setPreviewUrl(null);
  }

  async function generarPdf(
    r: Reserva,
    valor: number,
  ): Promise<{ blob: Blob; filename: string }> {
    const logo = await fetchLogoDataUrl();
    const html = buildOwnerQuoteHtml(
      {
        propertyTitle: r.propertyTitle,
        propertyLocation: r.propertyLocation,
        ownerName: r.propietarioNombre,
        contractReference: r.reference,
        clientName: r.nombreCompleto,
        checkInDate: ymd(r.fechaEntrada),
        checkOutDate: ymd(r.fechaSalida),
        nights: r.numeroNoches,
        guests: r.numeroPersonas,
        groupType: r.groupType,
        ownerAmount: valor,
        notes: notas,
      },
      logo,
    );
    const filename = `Cotizacion-propietario-${(r.reference || 'FINCA').replace(/\s+/g, '-')}.pdf`;
    const res = await fetch('/api/fincas/html-to-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename }),
    });
    if (!res.ok) throw new Error('No se pudo generar el documento.');
    return { blob: await res.blob(), filename };
  }

  async function verDocumento() {
    if (!selected) return;
    const valor = parseCop(valorRaw);
    if (valor <= 0) {
      toast.error('Escribe el valor a reconocer al propietario.');
      return;
    }
    setBusy('preview');
    try {
      const { blob } = await generarPdf(selected, valor);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar.');
    } finally {
      setBusy(null);
    }
  }

  async function enviar() {
    if (!selected) return;
    const valor = parseCop(valorRaw);
    if (valor <= 0) {
      toast.error('Escribe el valor a reconocer al propietario.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoEfectivo.trim())) {
      toast.error('El correo del propietario no es válido.');
      return;
    }
    setBusy('send');
    try {
      const { blob, filename } = await generarPdf(selected, valor);
      // Subir el PDF para adjuntarlo por correo.
      const fd = new FormData();
      fd.append('file', new File([blob], filename, { type: 'application/pdf' }));
      fd.append('folder', 'documents');
      fd.append('subpath', 'cotizaciones-propietario');
      const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const upData = (await up.json().catch(() => ({}))) as { url?: string };
      if (!up.ok || !upData.url) throw new Error('No se pudo subir el documento.');

      const result = await sendToOwner({
        to: correoEfectivo.trim(),
        ownerName: selected.propietarioNombre || undefined,
        propertyTitle: selected.propertyTitle,
        contractReference: selected.reference || undefined,
        amount: valor,
        pdfUrl: upData.url,
        pdfFilename: filename,
        bookingId: selected._id,
      });
      if (!result.ok) throw new Error(result.error || 'No se pudo enviar.');
      toast.success('Cotización enviada al propietario.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      {/* Selector de reserva */}
      <section className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por CR o cliente…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50"
          />
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-auto">
          {reservas === undefined ? (
            <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando reservas…
            </div>
          ) : reservas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No hay reservas para mostrar.
            </p>
          ) : (
            reservas.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => elegir(r)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition',
                  selId === r._id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    {r.reference || 'Sin CR'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {money(r.precioTotal)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {r.propertyTitle} · {r.nombreCompleto}
                </p>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Detalle + envío */}
      <section className="space-y-4">
        {!selected ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Elige una reserva para preparar la cotización al propietario.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">{selected.propertyTitle}</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <div>
                  <dt className="text-muted-foreground">Reserva</dt>
                  <dd className="font-semibold">{selected.reference || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Propietario</dt>
                  <dd className="font-semibold">
                    {selected.propietarioNombre || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Personas</dt>
                  <dd className="font-semibold">{selected.numeroPersonas}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Noches</dt>
                  <dd className="font-semibold">{selected.numeroNoches}</dd>
                </div>
              </dl>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Valor a reconocer al propietario
              </label>
              <div className="mt-1">
                <CopMoneyInput
                  value={valorRaw}
                  onChange={setValorRaw}
                  placeholder="Ej. 1.800.000"
                  className="h-11 rounded-xl border-border bg-background text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Correo del propietario
              </label>
              <input
                type="email"
                value={correoEfectivo}
                onChange={(e) => {
                  setCorreoTouched(true);
                  setCorreo(e.target.value);
                }}
                placeholder="correo@propietario.com"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
              />
              {!selected.propietarioCorreo && (
                <p className="mt-1 text-[11px] text-amber-600">
                  La finca no tiene correo del propietario guardado: escríbelo
                  aquí.
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Observaciones (opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Notas para el propietario…"
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/50"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void verDocumento()}
                disabled={busy !== null}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-bold disabled:opacity-60"
              >
                {busy === 'preview' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Ver documento
              </button>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={busy !== null}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy === 'send' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Enviar al propietario
              </button>
            </div>

            {previewUrl && (
              <iframe
                src={previewUrl}
                title="Vista previa de la cotización"
                className="h-[70vh] w-full rounded-xl border border-border bg-muted/40"
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
