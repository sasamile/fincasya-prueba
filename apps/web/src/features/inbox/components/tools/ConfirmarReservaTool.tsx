'use client';

/**
 * Herramienta "Confirmar reserva" del rail: busca el contrato por su código
 * (ej. CR 2041), muestra el resumen y envía al chat la confirmación oficial
 * (mensaje + PDF de confirmación si el contrato lo tiene).
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { toast } from 'sonner';
import {
  BadgeCheck,
  FileText,
  Loader2,
  MessageCircle,
  Search,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationRow } from '@/features/inbox/types';

type Contract = {
  _id: Id<'contracts'>;
  contractNumber: string;
  propertyTitle?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  valorTotal?: number;
  fechaEntrada?: string;
  fechaSalida?: string;
  estado: string;
  confirmationPdfUrl?: string;
  confirmationPdfFilename?: string;
};

function digits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function phonesMatch(a?: string | null, b?: string | null) {
  const d1 = digits(a ?? '');
  const d2 = digits(b ?? '');
  if (d1.length < 7 || d2.length < 7) return false;
  return d1.endsWith(d2.slice(-10)) || d2.endsWith(d1.slice(-10));
}

function money(n?: number) {
  if (!n) return null;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

/** Mensaje oficial de confirmación (tuteo + emojis del equipo). */
function buildConfirmationMessage(c: Contract): string {
  const lines: string[] = ['🎉 ¡Tu reserva está confirmada! ✅', ''];
  lines.push(`📄 Código de confirmación: *${c.contractNumber}*`);
  if (c.propertyTitle) lines.push(`🏡 Finca: ${c.propertyTitle}`);
  if (c.fechaEntrada && c.fechaSalida) {
    lines.push(`📅 Entrada: ${c.fechaEntrada} · Salida: ${c.fechaSalida}`);
  }
  const total = money(c.valorTotal);
  if (total) lines.push(`💰 Valor total: ${total}`);
  lines.push('');
  if (c.confirmationPdfUrl) {
    lines.push('Adjunto encontrarás tu documento de confirmación 📎');
  }
  lines.push(
    'Guarda este código para tu check-in y cualquier consulta. ¡Gracias por reservar con *FincasYa.com*! 💚',
  );
  return lines.join('\n');
}

export function ConfirmarReservaTool({
  conversation,
  onOpenChat,
}: {
  conversation: ConversationRow | null;
  onOpenChat?: (phone: string) => void | Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [selectedId, setSelectedId] = useState<Id<'contracts'> | null>(null);
  const [sending, setSending] = useState(false);

  const sendMessage = useMutation(api.inbox.sendAdvisorMessage);
  const sendDocument = useMutation(api.inbox.sendAdvisorDocumentByUrl);

  const trimmed = code.trim();
  const results = useQuery(
    api.contracts.list,
    trimmed.length >= 2 ? { search: trimmed, limit: 6 } : 'skip',
  ) as { items: Contract[] } | undefined;

  const matches = results?.items ?? [];
  const selected = useMemo(() => {
    if (selectedId) return matches.find((c) => c._id === selectedId) ?? null;
    if (matches.length === 1) return matches[0];
    return null;
  }, [selectedId, matches]);

  const chatMatchesSelected =
    Boolean(conversation) &&
    Boolean(selected?.clienteTelefono) &&
    phonesMatch(conversation!.phone, selected!.clienteTelefono);

  // Sin teléfono en el contrato no podemos validar: se permite enviar al chat
  // abierto, con aviso.
  const canSend =
    Boolean(conversation && selected) &&
    (chatMatchesSelected || !selected?.clienteTelefono);

  async function handleSend() {
    if (!conversation || !selected) return;
    setSending(true);
    try {
      await sendMessage({
        conversationId: conversation.conversationId,
        content: buildConfirmationMessage(selected),
      });
      if (selected.confirmationPdfUrl) {
        await sendDocument({
          conversationId: conversation.conversationId,
          documentUrl: selected.confirmationPdfUrl,
          filename:
            selected.confirmationPdfFilename ??
            `Confirmacion-${selected.contractNumber.replace(/\s+/g, '-')}.pdf`,
        });
      }
      toast.success(
        selected.confirmationPdfUrl
          ? 'Confirmación enviada (mensaje + PDF)'
          : 'Confirmación enviada en el chat',
      );
    } catch {
      toast.error('No se pudo enviar la confirmación.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Buscador por código de contrato */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5" /> Código del contrato
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Ej. CR 2041"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {trimmed.length >= 2 && (
          <div className="mt-2 space-y-1.5">
            {results === undefined ? (
              <div className="grid place-items-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
                Ningún contrato coincide con “{trimmed}”.
              </p>
            ) : (
              matches.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c._id);
                    if (c.clienteTelefono) onOpenChat?.(c.clienteTelefono);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition',
                    selected?._id === c._id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {c.contractNumber}
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        {c.clienteNombre ?? 'Sin cliente'}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.propertyTitle ?? 'Sin finca'} · {c.estado}
                      {c.confirmationPdfUrl ? ' · PDF ✓' : ''}
                    </p>
                  </div>
                  <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {/* Resumen y envío */}
      {selected && (
        <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Confirmación a enviar
          </h3>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <p className="text-sm font-bold">{selected.contractNumber}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-semibold">
                  {selected.clienteNombre ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Finca</dt>
                <dd className="font-semibold">
                  {selected.propertyTitle ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entrada</dt>
                <dd className="font-semibold">{selected.fechaEntrada ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Salida</dt>
                <dd className="font-semibold">{selected.fechaSalida ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valor total</dt>
                <dd className="font-semibold">
                  {money(selected.valorTotal) ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">PDF confirmación</dt>
                <dd
                  className={cn(
                    'font-semibold',
                    selected.confirmationPdfUrl
                      ? 'text-emerald-600'
                      : 'text-amber-600',
                  )}
                >
                  {selected.confirmationPdfUrl
                    ? 'Se adjunta'
                    : 'No disponible (solo mensaje)'}
                </dd>
              </div>
            </dl>

            {!conversation ? (
              <p className="mt-2 text-[11px] text-amber-600">
                Abre el chat del cliente para enviar la confirmación.
              </p>
            ) : selected.clienteTelefono && !chatMatchesSelected ? (
              <p className="mt-2 text-[11px] text-amber-600">
                El chat abierto no coincide con el celular del contrato (
                {selected.clienteTelefono}). Toca el contrato para abrir el chat
                correcto.
              </p>
            ) : !selected.clienteTelefono ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                El contrato no tiene celular registrado: se enviará al chat
                abierto.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!canSend || sending}
            onClick={() => void handleSend()}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar confirmación en este chat
          </button>
        </section>
      )}

      {!selected && trimmed.length < 2 && (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Escribe el código del contrato (ej. CR 2041), revisa el resumen y
          envía la confirmación de reserva al chat del cliente.
        </section>
      )}
    </>
  );
}
