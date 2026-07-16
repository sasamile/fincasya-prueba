'use client';

/**
 * Panel de herramientas del asesor, sobre la conversación seleccionada.
 * Esta es la capa de DISEÑO (UX de cada herramienta); la lógica se conecta por
 * fases — ver memoria inbox-asesor-roadmap. Los botones marcados "Fase 1/2" aún
 * no ejecutan.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
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
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { computePetFees } from '@/lib/pet-fees';
import {
  CopMoneyInput,
} from '@/features/admin/components/contracts/cop-money-input';
import {
  getContractSettingsSnapshot,
  useContractSettingsStore,
  type BankAccount as StoreBankAccount,
} from '@/features/admin/store/contract-settings.store';
import { BankAccountDialog } from '@/features/admin/components/contracts/bank-account-dialog';
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
  /** Nombre completo (se arma con nombres + apellidos, siempre mayúsculas al generar). */
  clientName: string;
  clientFirstName: string;
  clientLastName: string;
  clientDocType: string;
  clientCedula: string;
  clientDocIssuedAt: string;
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
  clientFirstName: '',
  clientLastName: '',
  clientDocType: 'CC',
  clientCedula: '',
  clientDocIssuedAt: '',
  clientPhone: '',
  clientEmail: '',
  clientCity: '',
  clientAddress: '',
  notes: '',
};

const DOC_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'RC', label: 'Registro civil' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
] as const;

function fullClientName(d: Pick<ContractDraft, 'clientFirstName' | 'clientLastName' | 'clientName'>) {
  const assembled = `${d.clientFirstName} ${d.clientLastName}`.trim();
  return (assembled || d.clientName).trim().toUpperCase();
}

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
  priceBase?: number;
  depositoAseo?: number;
  depositoDanosReembolsable?: number;
  manillaCondominio?: number;
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
  onChange: (finca: FincaOption) => void;
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
                    onChange(f);
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
        [key: string]: unknown;
      }
    | null
    | undefined;
  const replaceSettings = useMutation(api.adminContractSettings.replaceForAdmin);
  const bankAccounts: BankAccount[] = settings?.bankAccounts ?? [];
  const [draft, setDraft] = useState<ContractDraft>(EMPTY_DRAFT);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [bankTouched, setBankTouched] = useState(false);
  const [openOwners, setOpenOwners] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

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

  const handleSaveBank = async (data: Omit<StoreBankAccount, 'id'>) => {
    if (savingBank) return;
    setSavingBank(true);
    try {
      const id = crypto.randomUUID();
      const newAccount: StoreBankAccount = {
        id,
        bankName: data.bankName,
        accountType: data.accountType,
        accountNumber: data.accountNumber,
        ownerName: data.ownerName,
        ownerCedula: data.ownerCedula,
        imageUrls: data.imageUrls ?? [],
        qrOnly: data.qrOnly,
        brebKey: data.brebKey,
      };

      const base =
        settings ??
        getContractSettingsSnapshot(useContractSettingsStore.getState());
      const prevAccounts = (base.bankAccounts as StoreBankAccount[] | undefined) ?? [];
      const prevContractIds =
        (base.contractBankAccountIds as string[] | undefined) ?? [];
      const nextAccounts = [...prevAccounts, newAccount];
      const nextContractIds = [...new Set([...prevContractIds, id])];
      const nextPrimary =
        (base.primaryBankAccountId as string | null | undefined) ?? id;

      await replaceSettings({
        payload: {
          ...base,
          bankAccounts: nextAccounts,
          contractBankAccountIds: nextContractIds,
          primaryBankAccountId: nextPrimary,
        },
      });

      useContractSettingsStore.getState().addBankAccounts([newAccount]);
      setSelectedBankIds((prev) => [...new Set([...prev, id])]);
      setBankTouched(true);
      const ownerKey = (data.ownerName || 'Sin titular').trim();
      setOpenOwners((prev) => new Set(prev).add(ownerKey));
      setBankDialogOpen(false);
      toast.success('Cuenta agregada');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo guardar la cuenta',
      );
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBank = async (id: string, label: string) => {
    if (!settings || deletingBankId) return;
    if (
      !window.confirm(
        `¿Eliminar la cuenta ${label}? Se quita del catálogo de pagos (no solo de esta selección).`,
      )
    ) {
      return;
    }

    setDeletingBankId(id);
    try {
      const nextAccounts = (settings.bankAccounts ?? []).filter((a) => a.id !== id);
      const nextContractIds = (settings.contractBankAccountIds ?? []).filter(
        (x) => x !== id,
      );
      const nextPrimary =
        settings.primaryBankAccountId === id
          ? (nextAccounts[0]?.id ?? null)
          : (settings.primaryBankAccountId ?? null);

      await replaceSettings({
        payload: {
          ...settings,
          bankAccounts: nextAccounts,
          contractBankAccountIds: nextContractIds,
          primaryBankAccountId: nextPrimary,
        },
      });

      useContractSettingsStore.getState().removeBankAccount(id);
      setSelectedBankIds((prev) => prev.filter((x) => x !== id));
      setBankTouched(true);
      toast.success('Cuenta eliminada');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo eliminar la cuenta',
      );
    } finally {
      setDeletingBankId(null);
    }
  };

  const set =
    (k: keyof ContractDraft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((d) => {
        const next = { ...d, [k]: e.target.value };
        if (k === 'clientFirstName' || k === 'clientLastName') {
          next.clientName = fullClientName(next);
        }
        return next;
      });

  const petFees = useMemo(
    () => computePetFees(Number(draft.petCount) || 0),
    [draft.petCount],
  );

  /** Noches + desglose de lo que se le cobra al cliente (como en admin). */
  const chargeSummary = useMemo(() => {
    const a = new Date(`${draft.checkIn}T12:00:00`).getTime();
    const b = new Date(`${draft.checkOut}T12:00:00`).getTime();
    const nights =
      Number.isFinite(a) && Number.isFinite(b) && b > a
        ? Math.max(1, Math.round((b - a) / 86400000))
        : 0;
    const perNight = Number(draft.pricePerNight) || 0;
    const stay = nights > 0 ? perNight * nights : 0;
    const cleaningFee = Number(draft.cleaningFee) || 0;
    const refundableDeposit = Number(draft.refundableDeposit) || 0;
    const manillaCondominio = Number(draft.manillaCondominio) || 0;
    const otherCharges = Number(draft.otherCharges) || 0;
    const total =
      stay +
      petFees.deposit +
      petFees.serviceFee +
      petFees.cleaningFee +
      cleaningFee +
      refundableDeposit +
      manillaCondominio +
      otherCharges;
    return {
      nights,
      stay,
      cleaningFee,
      refundableDeposit,
      manillaCondominio,
      otherCharges,
      total,
    };
  }, [
    draft.checkIn,
    draft.checkOut,
    draft.pricePerNight,
    draft.cleaningFee,
    draft.refundableDeposit,
    draft.manillaCondominio,
    draft.otherCharges,
    petFees,
  ]);

  const moneyCop = (n: number) =>
    `$ ${Math.round(n).toLocaleString('es-CO')}`;

  function applyFinca(f: FincaOption) {
    setDraft((d) => ({
      ...d,
      fincaId: f._id,
      fincaTitle: f.title,
      pricePerNight:
        f.priceBase != null && f.priceBase > 0
          ? String(Math.round(f.priceBase))
          : d.pricePerNight,
      cleaningFee:
        f.depositoAseo != null && f.depositoAseo > 0
          ? String(Math.round(f.depositoAseo))
          : d.cleaningFee,
      refundableDeposit:
        f.depositoDanosReembolsable != null && f.depositoDanosReembolsable > 0
          ? String(Math.round(f.depositoDanosReembolsable))
          : d.refundableDeposit,
      manillaCondominio:
        f.manillaCondominio != null && f.manillaCondominio > 0
          ? String(Math.round(f.manillaCondominio))
          : d.manillaCondominio,
    }));
  }

  async function handleAnalyze() {
    if (!conversation) return;
    setAnalyzing(true);
    try {
      const r = await extract({ conversationId: conversation.conversationId });
      setDraft((d) => {
        const name = (r.client.name || d.clientName).trim();
        const parts = name.split(/\s+/).filter(Boolean);
        const first =
          parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || d.clientFirstName;
        const last = parts.length > 1 ? parts[parts.length - 1]! : d.clientLastName;
        const next: ContractDraft = {
          ...d,
          fincaId: r.finca?.id ?? d.fincaId,
          fincaTitle: r.finca?.title ?? r.fincaGuess ?? d.fincaTitle,
          contractCode: r.contractCode || d.contractCode,
          checkIn: r.checkIn || d.checkIn,
          checkOut: r.checkOut || d.checkOut,
          guests: r.guests ? String(r.guests) : d.guests,
          pricePerNight: r.pricePerNight ? String(r.pricePerNight) : d.pricePerNight,
          clientName: name.toUpperCase(),
          clientFirstName: first.toUpperCase(),
          clientLastName: last.toUpperCase(),
          clientCedula: r.client.cedula || d.clientCedula,
          clientPhone: r.client.phone || d.clientPhone,
          clientEmail: r.client.email || d.clientEmail,
          clientCity: r.client.city || d.clientCity,
          clientAddress: r.client.address || d.clientAddress,
        };
        return next;
      });
      // Si la IA matcheó finca, trae depósitos/precio de la finca real.
      if (r.finca?.id && fincas) {
        const f = fincas.find((x) => x._id === r.finca!.id);
        if (f) applyFinca(f);
      }
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
    const clientName = fullClientName(draft);
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/fincas/${draft.fincaId}/direct-booking-contract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outputFormat: 'docx',
            propertyId: draft.fincaId,
            contractNumber: draft.contractCode,
            nightlyPrice: String(perNight),
            totalPrice: String(perNight * nights),
            clientName,
            clientFirstName: draft.clientFirstName.trim().toUpperCase(),
            clientLastName: draft.clientLastName.trim().toUpperCase(),
            clientId: draft.clientCedula,
            clientDocType: draft.clientDocType,
            clientDocIssuedAt: draft.clientDocIssuedAt,
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
        data.filename || 'contrato.docx',
        data.mimeType ||
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      toast.success('Contrato Word generado y descargado.');
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
        className={cn(
          input,
          (key === 'clientFirstName' ||
            key === 'clientLastName' ||
            key === 'clientName') &&
            'uppercase',
        )}
        type={type}
        value={draft[key]}
        onChange={set(key)}
        placeholder={placeholder}
      />
    </div>
  );

  const moneyField = (label: string, key: keyof ContractDraft) => (
    <div>
      <label className={fl}>{label}</label>
      <CopMoneyInput
        value={draft[key]}
        onChange={(digits) => setDraft((d) => ({ ...d, [key]: digits }))}
        className={cn(input, 'pl-9')}
        placeholder="0"
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
              onChange={applyFinca}
            />
            {draft.fincaTitle && !draft.fincaId ? (
              <p className="mt-1 text-[11px] font-medium text-amber-600">
                IA sugirió “{draft.fincaTitle}” — selecciónala arriba.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Código contrato', 'contractCode', 'Ej. CR 2041')}
            {moneyField('Valor / noche', 'pricePerNight')}
            {field('Entrada', 'checkIn', '', 'date')}
            {field('Salida', 'checkOut', '', 'date')}
            {field('Hora entrada', 'checkInTime')}
            {field('Hora salida', 'checkOutTime')}
            {field('Personas', 'guests', '0')}
            <div>
              <label className={fl}>N° mascotas</label>
              <input
                className={input}
                type="number"
                min={0}
                step={1}
                value={draft.petCount}
                onChange={set('petCount')}
                placeholder="0"
              />
            </div>
          </div>
          {petFees.count > 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">
                  {petFees.count === 1
                    ? '1 mascota'
                    : `${petFees.count} mascotas`}
                </p>
                <p className="text-[14px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                  {moneyCop(petFees.total)}
                </p>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                {petFees.deposit > 0 ? (
                  <li className="flex justify-between gap-2">
                    <span>
                      Depósito reembolsable
                      {petFees.count >= 2 ? ' (máx. 2 × $100.000)' : ' ($100.000)'}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {moneyCop(petFees.deposit)}
                    </span>
                  </li>
                ) : null}
                {petFees.serviceFee > 0 ? (
                  <li className="flex justify-between gap-2">
                    <span>
                      Ingreso desde la 3ª ($30.000 c/u)
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {moneyCop(petFees.serviceFee)}
                    </span>
                  </li>
                ) : null}
                {petFees.cleaningFee > 0 ? (
                  <li className="flex justify-between gap-2">
                    <span>Aseo mascotas (desde 3ª)</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {moneyCop(petFees.cleaningFee)}
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Al poner mascotas (ej. 3) verás el valor al instante: depósito
              $100.000 c/u (máx. 2), y desde la 3ª +$30.000 ingreso + $70.000
              aseo.
            </p>
          )}
        </div>
      </Section>

      <Section title="Cargos y depósitos">
        <div className="grid grid-cols-2 gap-3">
          {moneyField('Aseo final', 'cleaningFee')}
          {moneyField('Depósito garantía', 'refundableDeposit')}
          {moneyField('Manilla / condominio', 'manillaCondominio')}
          {moneyField('Otros cobros', 'otherCharges')}
        </div>
      </Section>

      <Section
        title="Resumen de cobro"
        hint={
          chargeSummary.nights > 0
            ? chargeSummary.nights === 1
              ? '1 noche'
              : `${chargeSummary.nights} noches`
            : 'Pon fechas'
        }
      >
        <div className="space-y-1 text-[12px]">
          <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
            <span className="text-muted-foreground">
              Finca
              {chargeSummary.nights > 0
                ? ` (${chargeSummary.nights === 1 ? '1 noche' : `${chargeSummary.nights} noches`} × valor/noche)`
                : ''}
            </span>
            <span className="font-semibold tabular-nums">
              {moneyCop(chargeSummary.stay)}
            </span>
          </div>
          {petFees.deposit > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-emerald-600">Depósito mascotas</span>
              <span className="font-semibold tabular-nums text-emerald-600">
                + {moneyCop(petFees.deposit)}
              </span>
            </div>
          ) : null}
          {petFees.serviceFee > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-muted-foreground">
                Ingreso mascotas (3ª+)
              </span>
              <span className="font-semibold tabular-nums">
                + {moneyCop(petFees.serviceFee)}
              </span>
            </div>
          ) : null}
          {petFees.cleaningFee > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-muted-foreground">Aseo mascotas (3+)</span>
              <span className="font-semibold tabular-nums">
                + {moneyCop(petFees.cleaningFee)}
              </span>
            </div>
          ) : null}
          {chargeSummary.cleaningFee > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-muted-foreground">Aseo final</span>
              <span className="font-semibold tabular-nums">
                + {moneyCop(chargeSummary.cleaningFee)}
              </span>
            </div>
          ) : null}
          {chargeSummary.refundableDeposit > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-muted-foreground">Depósito garantía</span>
              <span className="font-semibold tabular-nums">
                + {moneyCop(chargeSummary.refundableDeposit)}
              </span>
            </div>
          ) : null}
          {chargeSummary.manillaCondominio > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-muted-foreground">Manilla / condominio</span>
              <span className="font-semibold tabular-nums">
                + {moneyCop(chargeSummary.manillaCondominio)}
              </span>
            </div>
          ) : null}
          {chargeSummary.otherCharges > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 py-1.5">
              <span className="text-muted-foreground">Otros cobros</span>
              <span className="font-semibold tabular-nums">
                + {moneyCop(chargeSummary.otherCharges)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-[13px] font-black uppercase tracking-wide">
              Total a cobrar
            </span>
            <span className="text-[15px] font-black tabular-nums text-primary">
              {moneyCop(chargeSummary.total)}
            </span>
          </div>
          <p className="pt-1 text-[10px] text-muted-foreground">
            En el Word, el “valor del contrato” es el arriendo (noches × noche).
            Aseo, depósitos y mascotas van desglosados aparte; aquí ves el total
            que paga el cliente.
          </p>
        </div>
      </Section>

      <Section
        title="Cuentas de pago"
        hint={`${selectedBankIds.length} seleccionada${selectedBankIds.length === 1 ? '' : 's'}`}
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setBankDialogOpen(true)}
            disabled={savingBank}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-bold text-foreground hover:bg-muted disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar cuenta
          </button>
        </div>
        {bankAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay cuentas aún. Agrega la primera con el botón de arriba.
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
                        const deleting = deletingBankId === acc.id;
                        const label = `${acc.bankName}${acc.accountNumber ? ` · ${acc.accountNumber}` : ''}`;
                        return (
                          <div
                            key={acc.id}
                            className={cn(
                              'flex items-center gap-1 rounded-lg border transition',
                              on
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggleBank(acc.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left hover:bg-muted/40"
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
                            <button
                              type="button"
                              title="Eliminar cuenta"
                              aria-label={`Eliminar ${label}`}
                              disabled={deleting || Boolean(deletingBankId)}
                              onClick={() => void handleDeleteBank(acc.id, label)}
                              className="mr-1.5 shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {deleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <BankAccountDialog
          open={bankDialogOpen}
          onClose={() => setBankDialogOpen(false)}
          onSave={(data) => void handleSaveBank(data)}
          contentClassName="bg-card text-foreground"
        />
      </Section>

      <Section title="Cliente">
        <div className="grid grid-cols-2 gap-3">
          {field('Nombres', 'clientFirstName', 'NOMBRES')}
          {field('Apellidos', 'clientLastName', 'APELLIDOS')}
          <div>
            <label className={fl}>Tipo documento</label>
            <select
              className={input}
              value={draft.clientDocType}
              onChange={set('clientDocType')}
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {field('N° documento', 'clientCedula', '—')}
          {field('Fecha expedición', 'clientDocIssuedAt', '', 'date')}
          {field('Ciudad expedición', 'clientCity', 'Ej. Bogotá')}
          {field('Teléfono', 'clientPhone', '—')}
          {field('Correo', 'clientEmail', '—')}
          <div className="col-span-2">{field('Dirección', 'clientAddress', '—')}</div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          En el contrato el nombre sale en mayúsculas:{' '}
          <span className="font-semibold text-foreground">
            {fullClientName(draft) || '—'}
          </span>
        </p>
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() =>
            draft.fincaId
              ? setShowPreview(true)
              : toast.error('Selecciona la finca.')
          }
          disabled={!draft.fincaId}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <FileText className="h-4 w-4" /> Ver y enviar
        </button>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating || !draft.fincaId}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Generar contrato
        </button>
      </div>

      {showPreview ? (
        <ContractPreviewModal
          draft={{
            ...draft,
            clientName: fullClientName(draft),
          }}
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
  onOpenChat?: (phone: string) => void | Promise<void>;
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
