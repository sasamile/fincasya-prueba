'use client';

/**
 * Panel de herramientas del asesor, sobre la conversación seleccionada.
 * Esta es la capa de DISEÑO (UX de cada herramienta); la lógica se conecta por
 * fases — ver memoria inbox-asesor-roadmap. Los botones marcados "Fase 1/2" aún
 * no ejecutan.
 */
import { useEffect, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { toast } from 'sonner';
import { BankLogoBadge } from '@/features/checkin/components/bank-logo-badge';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  DoorOpen,
  FileText,
  Home,
  Link2,
  Loader2,
  Search,
  Send,
  Sparkles,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContractPreviewModal } from '@/features/inbox/components/ContractPreviewModal';
import { ReservasTool } from '@/features/inbox/components/tools/ReservasTool';
import { VentaTool } from '@/features/inbox/components/tools/VentaTool';
import { CheckinTool } from '@/features/inbox/components/tools/CheckinTool';
import { ConfirmarReservaTool } from '@/features/inbox/components/tools/ConfirmarReservaTool';
import type { AsesorTool } from '@/features/inbox/components/IconRail';
import type { ConversationRow } from '@/features/inbox/types';

type ContractDraft = {
  fincaId: string;
  fincaTitle: string;
  contractCode: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  guests: string;
  pricePerNight: string;
  petCount: string;
  cleaningFee: string;
  refundableDeposit: string;
  manillaCondominio: string;
  otherCharges: string;
  clientName: string;
  clientCedula: string;
  clientPhone: string;
  clientEmail: string;
  clientCity: string;
  clientAddress: string;
  notes: string;
};

const EMPTY_DRAFT: ContractDraft = {
  fincaId: '',
  fincaTitle: '',
  contractCode: '',
  checkIn: '',
  checkOut: '',
  checkInTime: '10:00 AM',
  checkOutTime: '04:00 PM',
  guests: '',
  pricePerNight: '',
  petCount: '0',
  cleaningFee: '',
  refundableDeposit: '',
  manillaCondominio: '',
  otherCharges: '',
  clientName: '',
  clientCedula: '',
  clientPhone: '',
  clientEmail: '',
  clientCity: '',
  clientAddress: '',
  notes: '',
};

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
    title: 'Reservas',
    subtitle: 'Calendario de reservas y reserva rápida sin salir del chat.',
  },
  venta: {
    icon: Link2,
    title: 'Links de venta',
    subtitle: 'Tus links enviados, su estado y creación rápida.',
  },
  checkin: {
    icon: DoorOpen,
    title: 'Check-ins',
    subtitle: 'Reservas próximas sin check-in — abre el chat y despacha.',
  },
  confirmar: {
    icon: BadgeCheck,
    title: 'Confirmar reserva',
    subtitle: 'Busca el contrato por código y envía la confirmación al chat.',
  },
};

const fl =
  'mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground';
const input =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
const soonPill =
  'inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h3>
        {hint ? (
          <span className="text-[11px] text-muted-foreground/70">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type FincaOption = {
  _id: string;
  title: string;
  code?: string;
  location?: string;
  images?: string[];
};

type BankAccount = {
  id: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  ownerName?: string;
  ownerCedula?: string;
  brebKey?: boolean;
};

/** Selector de finca con imagen + buscador (estilo página de contratos). */
function FincaPicker({
  fincas,
  value,
  onChange,
}: {
  fincas: FincaOption[] | undefined;
  value: string;
  onChange: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = fincas?.find((f) => f._id === value) ?? null;

  const list = (fincas ?? []).filter((f) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      f.title.toLowerCase().includes(q) ||
      (f.code ?? '').toLowerCase().includes(q) ||
      (f.location ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-2 text-left transition hover:border-primary/40"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {selected?.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.images[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Home className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {selected ? selected.title : 'Selecciona una finca…'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {selected
              ? [selected.code, selected.location].filter(Boolean).join(' · ')
              : 'Toca para buscar'}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe nombre o código"
                className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {list.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              list.map((f) => (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => {
                    onChange(f._id, f.title);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-muted',
                    f._id === value && 'bg-primary/10',
                  )}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {f.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <Home className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{f.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[f.code, f.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function downloadBase64(fileBase64: string, filename: string, mime: string) {
  const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Contrato — formulario completo (como la página de contratos) con escaneo IA
 * OPCIONAL para prellenar. El asesor ve y edita todos los campos y genera.
 */
function ContratoTool({ conversation }: { conversation: ConversationRow | null }) {
  const extract = useAction(api.contractAi.extractFromConversation);
  const fincas = useQuery(api.adminProperties.listAll, {}) as
    | FincaOption[]
    | undefined;
  const settings = useQuery(api.adminContractSettings.getGlobalPayload, {}) as
    | {
        bankAccounts?: BankAccount[];
        contractBankAccountIds?: string[];
        primaryBankAccountId?: string;
      }
    | null
    | undefined;
  const bankAccounts: BankAccount[] = settings?.bankAccounts ?? [];
  const [draft, setDraft] = useState<ContractDraft>(EMPTY_DRAFT);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [bankTouched, setBankTouched] = useState(false);
  const [openOwners, setOpenOwners] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Selección de cuentas por defecto (las del contrato / la principal).
  useEffect(() => {
    if (bankTouched || !settings || bankAccounts.length === 0) return;
    const def =
      settings.contractBankAccountIds?.length
        ? settings.contractBankAccountIds
        : settings.primaryBankAccountId
          ? [settings.primaryBankAccountId]
          : [];
    if (def.length) setSelectedBankIds(def.map(String));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const toggleBank = (id: string) => {
    setBankTouched(true);
    setSelectedBankIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const set =
    (k: keyof ContractDraft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function handleAnalyze() {
    if (!conversation) return;
    setAnalyzing(true);
    try {
      const r = await extract({ conversationId: conversation.conversationId });
      setDraft((d) => ({
        ...d,
        fincaId: r.finca?.id ?? d.fincaId,
        fincaTitle: r.finca?.title ?? r.fincaGuess ?? d.fincaTitle,
        contractCode: r.contractCode || d.contractCode,
        checkIn: r.checkIn || d.checkIn,
        checkOut: r.checkOut || d.checkOut,
        guests: r.guests ? String(r.guests) : d.guests,
        pricePerNight: r.pricePerNight ? String(r.pricePerNight) : d.pricePerNight,
        clientName: r.client.name || d.clientName,
        clientCedula: r.client.cedula || d.clientCedula,
        clientPhone: r.client.phone || d.clientPhone,
        clientEmail: r.client.email || d.clientEmail,
        clientCity: r.client.city || d.clientCity,
        clientAddress: r.client.address || d.clientAddress,
      }));
      toast.success(
        r.finca
          ? 'Datos extraídos del chat. Revísalos antes de generar.'
          : `Extraje los datos; la finca "${r.fincaGuess}" no matcheó — selecciónala.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo analizar.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!draft.fincaId) {
      toast.error('Selecciona la finca.');
      return;
    }
    const nights = (() => {
      const a = new Date(`${draft.checkIn}T12:00:00`).getTime();
      const b = new Date(`${draft.checkOut}T12:00:00`).getTime();
      return Number.isFinite(a) && Number.isFinite(b) && b > a
        ? Math.max(1, Math.round((b - a) / 86400000))
        : 1;
    })();
    const perNight = Number(draft.pricePerNight) || 0;
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/fincas/${draft.fincaId}/direct-booking-contract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: draft.fincaId,
            contractNumber: draft.contractCode,
            nightlyPrice: String(perNight),
            totalPrice: String(perNight * nights),
            clientName: draft.clientName,
            clientId: draft.clientCedula,
            clientEmail: draft.clientEmail,
            clientPhone: draft.clientPhone,
            clientCity: draft.clientCity,
            clientAddress: draft.clientAddress,
            checkInDate: draft.checkIn,
            checkOutDate: draft.checkOut,
            checkInTime: draft.checkInTime,
            checkOutTime: draft.checkOutTime,
            guests: Number(draft.guests) || 1,
            petCount: Number(draft.petCount) || 0,
            cleaningFee: Number(draft.cleaningFee) || 0,
            refundableDeposit: Number(draft.refundableDeposit) || 0,
            manillaCondominio: Number(draft.manillaCondominio) || 0,
            otherCharges: Number(draft.otherCharges) || 0,
            bankAccountIds: selectedBankIds,
          }),
        },
      );
      const data = (await res.json()) as {
        success?: boolean;
        fileBase64?: string;
        filename?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.fileBase64) {
        throw new Error(data.error || 'No se pudo generar el contrato.');
      }
      downloadBase64(
        data.fileBase64,
        data.filename || 'contrato',
        data.mimeType || 'application/pdf',
      );
      toast.success('Contrato generado y descargado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar.');
    } finally {
      setGenerating(false);
    }
  }

  const field = (
    label: string,
    key: keyof ContractDraft,
    placeholder = '',
    type = 'text',
  ) => (
    <div>
      <label className={fl}>{label}</label>
      <input
        className={input}
        type={type}
        value={draft[key]}
        onChange={set(key)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <>
      {/* Escaneo con IA — OPCIONAL */}
      <button
        type="button"
        onClick={() => void handleAnalyze()}
        disabled={!conversation || analyzing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60"
      >
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        {analyzing ? 'Analizando chat…' : 'Prellenar con IA (opcional)'}
      </button>

      <Section title="Finca y estadía">
        <div className="space-y-3">
          <div>
            <label className={fl}>Finca</label>
            <FincaPicker
              fincas={fincas}
              value={draft.fincaId}
              onChange={(id, title) =>
                setDraft((d) => ({ ...d, fincaId: id, fincaTitle: title }))
              }
            />
            {draft.fincaTitle && !draft.fincaId ? (
              <p className="mt-1 text-[11px] font-medium text-amber-600">
                IA sugirió “{draft.fincaTitle}” — selecciónala arriba.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Código contrato', 'contractCode', 'Ej. CR 2041')}
            {field('Valor / noche', 'pricePerNight', '$ 0')}
            {field('Entrada', 'checkIn', '', 'date')}
            {field('Salida', 'checkOut', '', 'date')}
            {field('Hora entrada', 'checkInTime')}
            {field('Hora salida', 'checkOutTime')}
            {field('Personas', 'guests', '0')}
            {field('N° mascotas', 'petCount', '0')}
          </div>
        </div>
      </Section>

      <Section title="Cargos y depósitos">
        <div className="grid grid-cols-2 gap-3">
          {field('Aseo final', 'cleaningFee', '$ 0')}
          {field('Depósito garantía', 'refundableDeposit', '$ 0')}
          {field('Manilla / condominio', 'manillaCondominio', '$ 0')}
          {field('Otros cobros', 'otherCharges', '$ 0')}
        </div>
      </Section>

      <Section
        title="Cuentas de pago"
        hint={`${selectedBankIds.length} seleccionada${selectedBankIds.length === 1 ? '' : 's'}`}
      >
        {bankAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay cuentas configuradas en Ajustes del contrato.
          </p>
        ) : (
          <div className="space-y-2">
            {Array.from(
              bankAccounts
                .reduce((map, acc) => {
                  const owner = (acc.ownerName || 'Sin titular').trim();
                  if (!map.has(owner)) map.set(owner, []);
                  map.get(owner)!.push(acc);
                  return map;
                }, new Map<string, BankAccount[]>())
                .entries(),
            ).map(([owner, accs]) => {
              const open = openOwners.has(owner);
              const selCount = accs.filter((a) =>
                selectedBankIds.includes(a.id),
              ).length;
              return (
                <div
                  key={owner}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenOwners((prev) => {
                        const next = new Set(prev);
                        if (next.has(owner)) next.delete(owner);
                        else next.add(owner);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {owner.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{owner}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {accs.length} cuenta{accs.length === 1 ? '' : 's'}
                        {selCount > 0 ? ` · ${selCount} seleccionada${selCount === 1 ? '' : 's'}` : ''}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                  {open ? (
                    <div className="space-y-1.5 p-2">
                      {accs.map((acc) => {
                        const on = selectedBankIds.includes(acc.id);
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => toggleBank(acc.id)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition',
                              on
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border hover:bg-muted',
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition',
                                on
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border',
                              )}
                            >
                              {on ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <BankLogoBadge
                              bankName={acc.bankName ?? ''}
                              brebKey={Boolean(acc.brebKey)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold">
                                {acc.bankName}
                                {acc.accountType ? ` · ${acc.accountType}` : ''}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {acc.accountNumber}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Cliente">
        <div className="grid grid-cols-2 gap-3">
          {field('Nombre', 'clientName', 'Nombre completo')}
          {field('Cédula', 'clientCedula', '—')}
          {field('Teléfono', 'clientPhone', '—')}
          {field('Correo', 'clientEmail', '—')}
          {field('Ciudad', 'clientCity', '—')}
          {field('Dirección', 'clientAddress', '—')}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating || !draft.fincaId}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Generar contrato
        </button>
        <button
          type="button"
          onClick={() =>
            draft.fincaId
              ? setShowPreview(true)
              : toast.error('Selecciona la finca.')
          }
          disabled={!draft.fincaId}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> Ver y enviar
        </button>
      </div>

      {showPreview ? (
        <ContractPreviewModal
          draft={draft}
          selectedBankIds={selectedBankIds}
          conversation={conversation}
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </>
  );
}

export function AsesorPanel({
  tool,
  conversation,
  onClose,
  onOpenChat,
  className,
}: {
  tool: AsesorTool;
  conversation: ConversationRow | null;
  onClose: () => void;
  onOpenChat?: (phone: string) => void;
  className?: string;
}) {
  const fincasForTools = useQuery(api.adminProperties.listAll, {}) as
    | Array<{ _id: string; title: string }>
    | undefined;
  const meta = TOOL_META[tool];
  const Icon = meta.icon;

  return (
    <aside
      className={cn(
        'flex min-w-0 flex-1 flex-col border-r border-border bg-muted/20 md:w-[440px] md:flex-none',
        className,
      )}
    >
      {/* Cabecera */}
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold">{meta.title}</h2>
          </div>
          <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Volver al chat"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Contexto del chat seleccionado */}
      {conversation ? (
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
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
          <span className="ml-auto text-[11px] font-medium text-muted-foreground">
            Chat seleccionado
          </span>
        </div>
      ) : null}

      {/* Contenido de la herramienta */}
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 overflow-y-auto p-4">
        {tool === 'contrato' && <ContratoTool conversation={conversation} />}
        {tool === 'calendario' && (
          <ReservasTool conversation={conversation} fincas={fincasForTools} />
        )}
        {tool === 'venta' && (
          <VentaTool conversation={conversation} fincas={fincasForTools} />
        )}
        {tool === 'checkin' && (
          <CheckinTool conversation={conversation} onOpenChat={onOpenChat} />
        )}
        {tool === 'confirmar' && (
          <ConfirmarReservaTool
            conversation={conversation}
            onOpenChat={onOpenChat}
          />
        )}
      </div>
    </aside>
  );
}
