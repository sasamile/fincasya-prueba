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
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  PenLine,
  Pencil,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn, parseCOP } from '@/lib/utils';
import { formatPhoneCo } from '@/lib/phone-co';
import { PhoneWithCountry } from '@/components/phone-with-country';
import { SuggestTextInput } from '@/components/suggest-text-input';
import { MUNICIPIOS_COLOMBIA } from '@/lib/colombia-municipios';
import { propertyMatchesSearchQuery } from '@/lib/property/property-search';
import { computePetFees } from '@/lib/pet-fees';
import {
  CopMoneyInput,
  toStoredCopLabel,
} from '@/features/admin/components/contracts/cop-money-input';
import {
  DEFAULT_ADMIN_SETTINGS,
  getBankAccountImages,
  getContractSettingsSnapshot,
  useContractSettingsStore,
  type BankAccount as StoreBankAccount,
  type Firmante as StoreFirmante,
  type PaymentMedia,
} from '@/features/admin/store/contract-settings.store';
import { uploadPaymentImages } from '@/features/admin/api/payment-images.api';
import { BankAccountDialog } from '@/features/admin/components/contracts/bank-account-dialog';
import {
  FirmanteDialog,
  type FirmanteFormData,
} from '@/features/admin/components/contracts/firmante-dialog';
import { ContractPreviewModal } from '@/features/inbox/components/ContractPreviewModal';
import { ReservasTool } from '@/features/inbox/components/tools/ReservasTool';
import { VentaTool } from '@/features/inbox/components/tools/VentaTool';
import { CheckinTool } from '@/features/inbox/components/tools/CheckinTool';
import { ConfirmarReservaTool } from '@/features/inbox/components/tools/ConfirmarReservaTool';
import { SemanaTool } from '@/features/inbox/components/tools/SemanaTool';
import {
  loadInboxContratoDraft,
  saveInboxContratoDraft,
} from '@/features/inbox/utils/contrato-draft-storage';
import { resolveSelectedBankPayload } from '@/features/inbox/utils/selected-bank-accounts';
import { ContractCodeSellerButtons } from '@/features/admin/components/contracts/contract-code-seller-buttons';
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
  /** Personas de más sobre las contratadas (cobra tarifa / noche c/u). */
  extraGuests: string;
  pricePerNight: string;
  petCount: string;
  /** Depósito reembolsable mascotas (editable; se autollena al cambiar N°). */
  petDeposit: string;
  /** Ingreso desde la 3ª mascota (editable). */
  petServiceFee: string;
  /** Aseo mascotas 3+ (editable). */
  petCleaningFee: string;
  cleaningFee: string;
  refundableDeposit: string;
  /** Tarifa por persona adicional / noche (va al contrato como precioPorPersonasExtras). */
  extraPersonFee: string;
  manillaCondominio: string;
  otherCharges: string;
  /** Nombre completo (se arma con nombres + apellidos, siempre mayúsculas al generar). */
  clientName: string;
  clientFirstName: string;
  clientLastName: string;
  clientDocType: string;
  clientCedula: string;
  clientPhone: string;
  /** Segundo número de contacto. Dato interno: NO sale en el contrato. */
  clientPhoneAlt: string;
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
  extraGuests: '0',
  pricePerNight: '',
  petCount: '0',
  petDeposit: '',
  petServiceFee: '',
  petCleaningFee: '',
  cleaningFee: '',
  refundableDeposit: '',
  extraPersonFee: '120000',
  manillaCondominio: '',
  otherCharges: '',
  clientName: '',
  clientFirstName: '',
  clientLastName: '',
  clientDocType: 'CC',
  clientCedula: '',
  clientPhone: '',
  clientPhoneAlt: '',
  clientEmail: '',
  clientCity: '',
  clientAddress: '',
  notes: '',
};

/** Default fijo: $120.000 / noche. El viejo $50k se normaliza aquí. */
const DEFAULT_EXTRA_PERSON_FEE_DIGITS = '120000';

function normalizeExtraPersonFee(raw: string | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits || digits === '50000') return DEFAULT_EXTRA_PERSON_FEE_DIGITS;
  return digits;
}

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
  semana: {
    icon: Star,
    title: 'Fincas de la semana',
    subtitle: 'Fincas que el bot impulsa: esta semana y temporada de fin de año.',
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
      <div className="mb-4 flex items-baseline justify-between gap-2">
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
  qrOnly?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
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

  const list = (fincas ?? []).filter((f) =>
    propertyMatchesSearchQuery(
      { title: f.title, code: f.code, location: f.location },
      query,
    ),
  );

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
        paymentMedia?: PaymentMedia[];
        contractBankAccountIds?: string[];
        primaryBankAccountId?: string;
        firmantes?: Array<{
          id: string;
          nombre: string;
          cargo?: string;
          cedula?: string;
          ciudad?: string;
          firmaUrl?: string;
          esDefault?: boolean;
        }>;
        adminSettings?: {
          adminName?: string;
          adminCedula?: string;
          adminCity?: string;
        };
        [key: string]: unknown;
      }
    | null
    | undefined;
  const replaceSettings = useMutation(api.adminContractSettings.replaceForAdmin);
  const storeBankAccounts = useContractSettingsStore((s) => s.bankAccounts);
  const storePaymentMedia = useContractSettingsStore((s) => s.paymentMedia);
  const storeFirmantes = useContractSettingsStore((s) => s.firmantes);
  /** Catálogo de cuentas: une Convex + store local (por id). */
  const bankAccounts: BankAccount[] = useMemo(() => {
    const map = new Map<string, BankAccount>();
    for (const a of storeBankAccounts) {
      if (!a?.id) continue;
      map.set(String(a.id), {
        id: String(a.id),
        bankName: a.bankName,
        accountType: a.accountType,
        accountNumber: a.accountNumber,
        ownerName: a.ownerName,
        ownerCedula: a.ownerCedula,
        brebKey: a.brebKey,
        qrOnly: a.qrOnly,
        imageUrl: a.imageUrl,
        imageUrls: a.imageUrls,
      });
    }
    for (const a of (settings?.bankAccounts ?? []) as BankAccount[]) {
      if (!a?.id) continue;
      const id = String(a.id);
      map.set(id, { ...map.get(id), ...a, id });
    }
    return Array.from(map.values());
  }, [settings?.bankAccounts, storeBankAccounts]);

  /** Flyers por titular (cada uno con todas sus cuentas). */
  const paymentMedia: PaymentMedia[] = useMemo(() => {
    const map = new Map<string, PaymentMedia>();
    for (const m of storePaymentMedia) {
      if (!m?.id || !m.imageUrl?.trim()) continue;
      map.set(String(m.id), {
        id: String(m.id),
        label: m.label || 'Medios de pago',
        imageUrl: m.imageUrl,
        ownerName: m.ownerName?.trim() || undefined,
      });
    }
    for (const m of settings?.paymentMedia ?? []) {
      if (!m?.id || !m.imageUrl?.trim()) continue;
      const id = String(m.id);
      map.set(id, {
        ...map.get(id),
        ...m,
        id,
        ownerName: m.ownerName?.trim() || map.get(id)?.ownerName,
      });
    }
    return Array.from(map.values());
  }, [settings?.paymentMedia, storePaymentMedia]);

  const mediaForOwner = (owner: string) => {
    const key = owner.trim().toLowerCase().replace(/\s+/g, ' ');
    return paymentMedia.filter(
      (m) =>
        (m.ownerName ?? '').trim().toLowerCase().replace(/\s+/g, ' ') === key,
    );
  };

  type InboxFirmante = {
    id: string;
    nombre: string;
    cargo?: string;
    cedula?: string;
    ciudad?: string;
    firmaUrl?: string;
    esDefault?: boolean;
  };

  const firmantes: InboxFirmante[] = useMemo(() => {
    const map = new Map<string, InboxFirmante>();
    for (const f of storeFirmantes as StoreFirmante[]) {
      if (!f?.id) continue;
      map.set(String(f.id), {
        id: String(f.id),
        nombre: f.nombre,
        cargo: f.cargo,
        cedula: f.cedula,
        ciudad: f.ciudad,
        firmaUrl: f.firmaUrl,
        esDefault: f.esDefault,
      });
    }
    for (const f of settings?.firmantes ?? []) {
      if (!f?.id) continue;
      const id = String(f.id);
      map.set(id, { ...map.get(id), ...f, id });
    }
    return Array.from(map.values());
  }, [settings?.firmantes, storeFirmantes]);

  const [draft, setDraft] = useState<ContractDraft>(EMPTY_DRAFT);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [selectedFirmanteId, setSelectedFirmanteId] = useState<string>('');
  /**
   * Link para que el cliente cargue el soporte de pago y siga solo con su
   * reserva (Santiago, 23-jul). APAGADO por defecto: el flujo es nuevo y el
   * asesor decide en cuáles casos mandarlo.
   */
  const [enviarLinkSoporte, setEnviarLinkSoporte] = useState(false);
  const selectedBankPayload = useMemo(
    () => resolveSelectedBankPayload(bankAccounts, selectedBankIds),
    [bankAccounts, selectedBankIds],
  );

  /** Flyer de titulares con al menos una cuenta seleccionada. */
  const generalPaymentImageUrls = useMemo(() => {
    const selectedOwners = new Set(
      selectedBankPayload.bankAccounts.map((a) =>
        (a.ownerName || 'Sin titular').trim().toLowerCase().replace(/\s+/g, ' '),
      ),
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of paymentMedia) {
      const key = (m.ownerName ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      if (!key || !selectedOwners.has(key)) continue;
      const url = m.imageUrl.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    return out;
  }, [paymentMedia, selectedBankPayload.bankAccounts]);

  /** Solo si el asesor marcó uno y sigue existiendo; vacío = sin imagen. */
  const selectedFirmante = useMemo(() => {
    if (!selectedFirmanteId) return null;
    return firmantes.find((f) => f.id === selectedFirmanteId) ?? null;
  }, [firmantes, selectedFirmanteId]);

  /** Solo la imagen: nombre/cédula del ARRENDADOR siguen los ajustes globales. */
  const firmanteContractFields = useMemo(() => {
    if (!selectedFirmante?.firmaUrl) return {};
    return { firmaArrendadorUrl: selectedFirmante.firmaUrl };
  }, [selectedFirmante]);
  const [bankTouched, setBankTouched] = useState(false);
  /** Solo persistir cuando el draft en memoria corresponde a este chat. */
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [openOwners, setOpenOwners] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [savingBank, setSavingBank] = useState(false);
  const [uploadingPaymentMediaFor, setUploadingPaymentMediaFor] = useState<
    string | null
  >(null);
  const [removingPaymentMediaId, setRemovingPaymentMediaId] = useState<
    string | null
  >(null);
  const [firmanteDialogOpen, setFirmanteDialogOpen] = useState(false);
  const [editingFirmante, setEditingFirmante] = useState<InboxFirmante | null>(
    null,
  );
  const [savingFirmante, setSavingFirmante] = useState(false);
  const [deletingFirmanteId, setDeletingFirmanteId] = useState<string | null>(
    null,
  );

  const conversationId = conversation?.conversationId ?? null;
  const draftReady = Boolean(conversationId && hydratedFor === conversationId);

  // Restaura el borrador de este chat (o arranca limpio con teléfono/nombre).
  useEffect(() => {
    if (!conversationId) {
      setDraft(EMPTY_DRAFT);
      setSelectedBankIds([]);
      setBankTouched(false);
      setHydratedFor(null);
      return;
    }

    const cached = loadInboxContratoDraft(conversationId);
    if (cached?.draft) {
      const merged = {
        ...EMPTY_DRAFT,
        ...(cached.draft as Partial<ContractDraft>),
      };
      merged.extraPersonFee = normalizeExtraPersonFee(merged.extraPersonFee);
      setDraft(merged);
      setSelectedBankIds(
        Array.isArray(cached.selectedBankIds) ? cached.selectedBankIds : [],
      );
      setBankTouched(Boolean(cached.bankTouched));
    } else {
      const name = (conversation?.name ?? '').trim();
      const parts = name.split(/\s+/).filter(Boolean);
      const first =
        parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] ?? '');
      const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
      setDraft({
        ...EMPTY_DRAFT,
        clientPhone: formatPhoneCo(conversation?.phone ?? ''),
        clientFirstName: first.toUpperCase(),
        clientLastName: last.toUpperCase(),
        clientName: name.toUpperCase(),
      });
      setSelectedBankIds([]);
      setBankTouched(false);
    }
    setHydratedFor(conversationId);
    // Solo al cambiar de chat: name/phone son seed del primer load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Persiste mientras escribe — sobrevive a cambiar de chat / herramienta / cerrar.
  useEffect(() => {
    if (!draftReady || !conversationId) return;
    const timer = window.setTimeout(() => {
      saveInboxContratoDraft(conversationId, {
        draft: { ...draft },
        selectedBankIds,
        bankTouched,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, selectedBankIds, bankTouched, draftReady, conversationId]);

  // Selección de cuentas por defecto (las del contrato / la principal).
  useEffect(() => {
    if (!draftReady || bankTouched || !settings || bankAccounts.length === 0)
      return;
    const def =
      settings.contractBankAccountIds?.length
        ? settings.contractBankAccountIds
        : settings.primaryBankAccountId
          ? [settings.primaryBankAccountId]
          : [];
    if (def.length) setSelectedBankIds(def.map(String));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, draftReady, bankTouched]);

  const toggleBank = (id: string) => {
    const key = String(id);
    setBankTouched(true);
    setSelectedBankIds((prev) =>
      prev.map(String).includes(key)
        ? prev.filter((x) => String(x) !== key)
        : [...prev, key],
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
        imageUrl: data.imageUrl ?? data.imageUrls?.[0],
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
      setEditingBank(null);
      toast.success('Cuenta agregada');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo guardar la cuenta',
      );
    } finally {
      setSavingBank(false);
    }
  };

  const handleUpdateBank = async (
    id: string,
    data: Omit<StoreBankAccount, 'id'>,
  ) => {
    if (savingBank) return;
    setSavingBank(true);
    try {
      const updated: StoreBankAccount = {
        id,
        bankName: data.bankName,
        accountType: data.accountType,
        accountNumber: data.accountNumber,
        ownerName: data.ownerName,
        ownerCedula: data.ownerCedula,
        imageUrls: data.imageUrls ?? [],
        imageUrl: data.imageUrl ?? data.imageUrls?.[0],
        qrOnly: data.qrOnly,
        brebKey: data.brebKey,
      };

      const base =
        settings ??
        getContractSettingsSnapshot(useContractSettingsStore.getState());
      const prevAccounts = (base.bankAccounts as StoreBankAccount[] | undefined) ?? [];
      const nextAccounts = prevAccounts.map((a) =>
        a.id === id ? { ...a, ...updated } : a,
      );

      await replaceSettings({
        payload: {
          ...base,
          bankAccounts: nextAccounts,
        },
      });

      useContractSettingsStore.getState().updateBankAccount(id, updated);
      setBankDialogOpen(false);
      setEditingBank(null);
      toast.success('Cuenta actualizada');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo actualizar la cuenta',
      );
    } finally {
      setSavingBank(false);
    }
  };

  const handleAddHolderPaymentPhotos = async (
    ownerName: string,
    files: File[],
  ) => {
    if (!files.length || uploadingPaymentMediaFor) return;
    const owner = ownerName.trim() || 'Sin titular';
    setUploadingPaymentMediaFor(owner);
    try {
      const urls = await uploadPaymentImages(files);
      const base =
        settings ??
        getContractSettingsSnapshot(useContractSettingsStore.getState());
      const prev = (base.paymentMedia as PaymentMedia[] | undefined) ?? [];
      const added: PaymentMedia[] = urls.map((imageUrl, i) => ({
        id: crypto.randomUUID(),
        label:
          urls.length === 1
            ? `Medios de pago · ${owner}`
            : `Medios de pago · ${owner} (${prev.filter((p) => (p.ownerName ?? '').trim().toLowerCase() === owner.toLowerCase()).length + i + 1})`,
        imageUrl,
        ownerName: owner,
      }));
      const next = [...prev, ...added];
      await replaceSettings({
        payload: {
          ...base,
          paymentMedia: next,
        },
      });
      useContractSettingsStore.setState({ paymentMedia: next });
      toast.success(
        added.length === 1
          ? `Foto de ${owner} agregada`
          : `${added.length} fotos de ${owner} agregadas`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo subir la foto del titular',
      );
    } finally {
      setUploadingPaymentMediaFor(null);
    }
  };

  const handleRemoveHolderPaymentPhoto = async (id: string) => {
    if (removingPaymentMediaId) return;
    setRemovingPaymentMediaId(id);
    try {
      const base =
        settings ??
        getContractSettingsSnapshot(useContractSettingsStore.getState());
      const prev = (base.paymentMedia as PaymentMedia[] | undefined) ?? [];
      const next = prev.filter((m) => m.id !== id);
      await replaceSettings({
        payload: {
          ...base,
          paymentMedia: next,
        },
      });
      useContractSettingsStore.setState({ paymentMedia: next });
      toast.success('Foto del titular eliminada');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo eliminar la foto',
      );
    } finally {
      setRemovingPaymentMediaId(null);
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

  const persistFirmantes = async (nextFirmantes: InboxFirmante[]) => {
    const base =
      settings ??
      getContractSettingsSnapshot(useContractSettingsStore.getState());
    await replaceSettings({
      payload: {
        ...base,
        firmantes: nextFirmantes,
      },
    });
    useContractSettingsStore.setState({
      firmantes: nextFirmantes.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        cargo: f.cargo ?? '',
        cedula: f.cedula ?? '',
        ciudad: f.ciudad ?? '',
        firmaUrl: f.firmaUrl,
        esDefault: f.esDefault,
      })),
    });
  };

  const handleSaveFirmante = async (data: FirmanteFormData) => {
    if (savingFirmante) return;
    setSavingFirmante(true);
    try {
      let next: InboxFirmante[];
      if (editingFirmante) {
        next = firmantes.map((f) =>
          f.id === editingFirmante.id
            ? {
                ...f,
                nombre: data.nombre,
                cargo: data.cargo,
                cedula: data.cedula,
                ciudad: data.ciudad,
                firmaUrl: data.firmaUrl,
              }
            : f,
        );
      } else {
        const id = crypto.randomUUID();
        const isFirst = firmantes.length === 0;
        next = [
          ...firmantes,
          {
            id,
            nombre: data.nombre,
            cargo: data.cargo,
            cedula: data.cedula,
            ciudad: data.ciudad,
            firmaUrl: data.firmaUrl,
            esDefault: isFirst,
          },
        ];
        setSelectedFirmanteId(id);
      }
      await persistFirmantes(next);
      setFirmanteDialogOpen(false);
      setEditingFirmante(null);
      toast.success(editingFirmante ? 'Firmante actualizado' : 'Firmante agregado');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo guardar el firmante',
      );
    } finally {
      setSavingFirmante(false);
    }
  };

  const handleDeleteFirmante = async (id: string, nombre: string) => {
    if (deletingFirmanteId) return;
    if (
      !window.confirm(
        `¿Eliminar a ${nombre}? Se quita del catálogo de firmantes (no solo de esta selección).`,
      )
    ) {
      return;
    }
    setDeletingFirmanteId(id);
    try {
      let next = firmantes.filter((f) => f.id !== id);
      if (next.length > 0 && !next.some((f) => f.esDefault)) {
        next = next.map((f, i) => ({ ...f, esDefault: i === 0 }));
      }
      await persistFirmantes(next);
      setSelectedFirmanteId((prev) =>
        prev === id ? (next[0]?.id ?? '') : prev,
      );
      toast.success('Firmante eliminado');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo eliminar el firmante',
      );
    } finally {
      setDeletingFirmanteId(null);
    }
  };

  const handleSetDefaultFirmante = async (id: string) => {
    if (savingFirmante) return;
    setSavingFirmante(true);
    try {
      const next = firmantes.map((f) => ({
        ...f,
        esDefault: f.id === id,
      }));
      await persistFirmantes(next);
      setSelectedFirmanteId(id);
      toast.success('Firmante por defecto actualizado');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo marcar por defecto',
      );
    } finally {
      setSavingFirmante(false);
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
        if (k === 'petCount') {
          const fees = computePetFees(Number(e.target.value) || 0);
          next.petDeposit = fees.deposit > 0 ? String(fees.deposit) : '';
          next.petServiceFee = fees.serviceFee > 0 ? String(fees.serviceFee) : '';
          next.petCleaningFee =
            fees.cleaningFee > 0 ? String(fees.cleaningFee) : '';
        }
        return next;
      });

  const petFees = useMemo(() => {
    const count = Math.max(0, Math.floor(Number(draft.petCount) || 0));
    const deposit = Number(draft.petDeposit) || 0;
    const serviceFee = Number(draft.petServiceFee) || 0;
    const cleaningFee = Number(draft.petCleaningFee) || 0;
    return {
      count,
      deposit,
      serviceFee,
      cleaningFee,
      total: deposit + serviceFee + cleaningFee,
    };
  }, [
    draft.petCount,
    draft.petDeposit,
    draft.petServiceFee,
    draft.petCleaningFee,
  ]);

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
    const extraGuests = Math.max(0, Math.floor(Number(draft.extraGuests) || 0));
    const extraPersonRate = Number(draft.extraPersonFee) || 0;
    const extraPeopleTotal =
      nights > 0 && extraGuests > 0 && extraPersonRate > 0
        ? extraGuests * extraPersonRate * nights
        : 0;
    const total =
      stay +
      petFees.deposit +
      petFees.serviceFee +
      petFees.cleaningFee +
      cleaningFee +
      refundableDeposit +
      manillaCondominio +
      otherCharges +
      extraPeopleTotal;
    return {
      nights,
      stay,
      cleaningFee,
      refundableDeposit,
      manillaCondominio,
      otherCharges,
      extraGuests,
      extraPersonRate,
      extraPeopleTotal,
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
    draft.extraGuests,
    draft.extraPersonFee,
    petFees,
  ]);

  const moneyCop = (n: number) =>
    `$ ${Math.round(n).toLocaleString('es-CO')}`;

  function resolveDefaultCop(
    propertyValue: number | undefined,
    ...fallbacks: Array<string | undefined>
  ): string {
    if (propertyValue != null && propertyValue > 0) {
      return String(Math.round(propertyValue));
    }
    for (const raw of fallbacks) {
      const n = parseCOP(raw ?? '');
      if (n > 0) return String(n);
    }
    return '';
  }

  function applyFinca(f: FincaOption) {
    const remoteAdmin =
      settings &&
      typeof settings === 'object' &&
      settings.adminSettings &&
      typeof settings.adminSettings === 'object'
        ? (settings.adminSettings as {
            cleaningFee?: string;
            securityDeposit?: string;
            extraPersonFee?: string;
          })
        : null;
    const localAdmin =
      useContractSettingsStore.getState().adminSettings ??
      DEFAULT_ADMIN_SETTINGS;

    setDraft((d) => ({
      ...d,
      fincaId: f._id,
      fincaTitle: f.title,
      pricePerNight:
        f.priceBase != null && f.priceBase > 0
          ? String(Math.round(f.priceBase))
          : d.pricePerNight,
      // Aseo / depósito / personas adic.: primero lo de la finca; si no,
      // default global del contrato.
      cleaningFee: resolveDefaultCop(
        f.depositoAseo,
        remoteAdmin?.cleaningFee,
        localAdmin.cleaningFee,
        DEFAULT_ADMIN_SETTINGS.cleaningFee,
      ) || d.cleaningFee,
      refundableDeposit: resolveDefaultCop(
        f.depositoDanosReembolsable,
        remoteAdmin?.securityDeposit,
        localAdmin.securityDeposit,
        DEFAULT_ADMIN_SETTINGS.securityDeposit,
      ) || d.refundableDeposit,
      // Personas adic.: siempre $120.000 por defecto (no el viejo $50k de admin).
      extraPersonFee: normalizeExtraPersonFee(d.extraPersonFee),
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
          clientPhone: formatPhoneCo(r.client.phone || d.clientPhone),
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

  const field = (
    label: string,
    key: keyof ContractDraft,
    placeholder = '',
    type = 'text',
    /** Sugerencias de auto relleno; el campo sigue aceptando texto libre. */
    suggestions?: readonly string[],
  ) => (
    <div>
      <label className={fl}>{label}</label>
      {suggestions ? (
        <SuggestTextInput
          className={cn(
            input,
            (key === 'clientFirstName' ||
              key === 'clientLastName' ||
              key === 'clientName') &&
              'uppercase',
          )}
          type={type}
          value={String(draft[key] ?? '')}
          placeholder={placeholder}
          suggestions={suggestions}
          onChange={(next) =>
            setDraft((d) => ({ ...d, [key]: next }))
          }
        />
      ) : (
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
          onBlur={undefined}
          placeholder={placeholder}
        />
      )}
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
    <div className="flex flex-col gap-5">
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
        <div className="space-y-4">
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
            <div className="col-span-2 space-y-2">
              {field('Código contrato', 'contractCode', 'Ej. CR 2041')}
              <ContractCodeSellerButtons
                compact
                onAssign={(code) =>
                  setDraft((d) => ({ ...d, contractCode: code }))
                }
              />
            </div>
            {moneyField('Valor / noche', 'pricePerNight')}
            {field('Entrada', 'checkIn', '', 'date')}
            {field('Salida', 'checkOut', '', 'date')}
            {field('Hora entrada', 'checkInTime')}
            {field('Hora salida', 'checkOutTime')}
            {field('Personas', 'guests', '0')}
            {field('Personas adicionales', 'extraGuests', '0')}
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
          <div className="space-y-3">
            {Number(draft.extraGuests) > 0 ? (
              <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold text-sky-700 dark:text-sky-400">
                    {Number(draft.extraGuests) === 1
                      ? '1 persona adicional'
                      : `${Math.floor(Number(draft.extraGuests) || 0)} personas adicionales`}
                  </p>
                  {chargeSummary.extraPeopleTotal > 0 ? (
                    <p className="text-[14px] font-black tabular-nums text-sky-700 dark:text-sky-400">
                      {moneyCop(chargeSummary.extraPeopleTotal)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col">
                  <label className={cn(fl, 'min-h-10 leading-snug')}>
                    Valor / noche c/u
                  </label>
                  <CopMoneyInput
                    value={draft.extraPersonFee}
                    onChange={(digits) =>
                      setDraft((d) => ({ ...d, extraPersonFee: digits }))
                    }
                    className={cn(input, 'pl-9')}
                    placeholder="120000"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Default $120.000 / noche por persona. Editable según la finca.
                </p>
              </div>
            ) : null}
            {petFees.count > 0 ? (
              <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                    {petFees.count === 1
                      ? '1 mascota'
                      : `${petFees.count} mascotas`}
                  </p>
                  <p className="text-[14px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                    {moneyCop(petFees.total)}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      ['Depósito mascotas', 'petDeposit'],
                      ['Ingreso (2ª+)', 'petServiceFee'],
                      ['Aseo mascotas', 'petCleaningFee'],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key} className="flex flex-col">
                      <label className={cn(fl, 'min-h-10 leading-snug')}>
                        {label}
                      </label>
                      <CopMoneyInput
                        value={draft[key]}
                        onChange={(digits) =>
                          setDraft((d) => ({ ...d, [key]: digits }))
                        }
                        className={cn(input, 'pl-9')}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Se autollenan con la política ($100k depósito c/u máx. 2, $30k
                  ingreso y $70k aseo desde la 3ª). Puedes editarlos igual que el
                  valor de la finca.
                </p>
              </div>
            ) : null}
            {Number(draft.extraGuests) <= 0 && petFees.count <= 0 ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Personas adicionales: $120.000 / noche c/u (editable). Mascotas:
                depósito / ingreso / aseo se autollenan (editables).
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Cargos y depósitos">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['Aseo final', 'cleaningFee'],
              ['Depósito garantía', 'refundableDeposit'],
              ['Manilla / condominio', 'manillaCondominio'],
              ['Otros cobros', 'otherCharges'],
            ] as const
          ).map(([label, key]) => (
            <div key={key} className="flex flex-col">
              <label className={cn(fl, 'min-h-10 leading-snug')}>
                {label}
              </label>
              <CopMoneyInput
                value={draft[key]}
                onChange={(digits) =>
                  setDraft((d) => ({ ...d, [key]: digits }))
                }
                className={cn(input, 'pl-9')}
                placeholder="0"
              />
            </div>
          ))}
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
        <div className="space-y-0 text-[12px]">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
            <span className="text-muted-foreground">
              Finca
              {chargeSummary.nights > 0
                ? ` (${chargeSummary.nights === 1 ? '1 noche' : `${chargeSummary.nights} noches`} × valor/noche)`
                : ''}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {moneyCop(chargeSummary.stay)}
            </span>
          </div>
          {petFees.deposit > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-emerald-600">Depósito mascotas</span>
              <span className="shrink-0 font-semibold tabular-nums text-emerald-600">
                + {moneyCop(petFees.deposit)}
              </span>
            </div>
          ) : null}
          {petFees.serviceFee > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-muted-foreground">
                Ingreso mascotas (2ª+)
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(petFees.serviceFee)}
              </span>
            </div>
          ) : null}
          {petFees.cleaningFee > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-muted-foreground">Aseo mascotas (2+)</span>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(petFees.cleaningFee)}
              </span>
            </div>
          ) : null}
          {chargeSummary.cleaningFee > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-muted-foreground">Aseo final</span>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(chargeSummary.cleaningFee)}
              </span>
            </div>
          ) : null}
          {chargeSummary.refundableDeposit > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-muted-foreground">Depósito garantía</span>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(chargeSummary.refundableDeposit)}
              </span>
            </div>
          ) : null}
          {chargeSummary.manillaCondominio > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-muted-foreground">Manilla / condominio</span>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(chargeSummary.manillaCondominio)}
              </span>
            </div>
          ) : null}
          {chargeSummary.otherCharges > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <span className="text-muted-foreground">Otros cobros</span>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(chargeSummary.otherCharges)}
              </span>
            </div>
          ) : null}
          {chargeSummary.extraPeopleTotal > 0 ? (
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-border/60 py-2.5">
              <div className="min-w-0 space-y-1">
                <span className="text-muted-foreground">
                  Personas adicionales
                </span>
                <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                  {chargeSummary.extraGuests}{' '}
                  {chargeSummary.extraGuests === 1 ? 'pers.' : 'pers.'}
                  <span className="mx-1.5 text-border">·</span>
                  {moneyCop(chargeSummary.extraPersonRate)} / noche
                  <span className="mx-1.5 text-border">·</span>
                  {chargeSummary.nights === 1
                    ? '1 noche'
                    : `${chargeSummary.nights} noches`}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                + {moneyCop(chargeSummary.extraPeopleTotal)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 pt-3">
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
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          Marca las cuentas del contrato. Cada <strong>titular</strong> tiene
          su foto general (flyer con todas sus cuentas). La foto por cuenta es
          opcional (QR).
        </p>

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditingBank(null);
              setBankDialogOpen(true);
            }}
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
                selectedBankIds.map(String).includes(String(a.id)),
              ).length;
              const holderMedia = mediaForOwner(owner);
              const uploadingThis = uploadingPaymentMediaFor === owner;
              return (
                <div
                  key={owner}
                  className="overflow-hidden rounded-xl border border-border/40"
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
                        {selCount > 0
                          ? ` · ${selCount} seleccionada${selCount === 1 ? '' : 's'}`
                          : ''}
                        {holderMedia.length > 0
                          ? ` · ${holderMedia.length} foto${holderMedia.length === 1 ? '' : 's'}`
                          : ''}
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
                    <div className="space-y-2 p-2">
                      <div className="space-y-2 rounded-lg border border-border/40 bg-muted/15 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold">
                              Foto general de {owner.split(' ')[0]}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Flyer con todas sus cuentas (se envía con el
                              contrato).
                            </p>
                          </div>
                          <label
                            className={cn(
                              'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-bold hover:bg-muted',
                              uploadingThis && 'pointer-events-none opacity-60',
                            )}
                          >
                            {uploadingThis ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ImagePlus className="h-3.5 w-3.5" />
                            )}
                            {uploadingThis ? 'Subiendo…' : 'Agregar'}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={Boolean(uploadingPaymentMediaFor)}
                              onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                void handleAddHolderPaymentPhotos(owner, files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        {holderMedia.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border/60 px-2 py-2.5 text-center text-[10px] text-amber-600 dark:text-amber-400">
                            Sin foto de este titular — carga el flyer
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {holderMedia.map((m) => (
                              <div
                                key={m.id}
                                className="relative overflow-hidden rounded-lg border border-border/40 bg-background"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={m.imageUrl}
                                  alt={m.label}
                                  className="aspect-video w-full object-cover"
                                />
                                <button
                                  type="button"
                                  title="Quitar foto"
                                  disabled={removingPaymentMediaId === m.id}
                                  onClick={() =>
                                    void handleRemoveHolderPaymentPhoto(m.id)
                                  }
                                  className="absolute right-1.5 top-1.5 rounded-md bg-red-500/90 p-1.5 text-white hover:bg-red-600 disabled:opacity-50"
                                >
                                  {removingPaymentMediaId === m.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {accs.map((acc) => {
                        const on = selectedBankIds
                          .map(String)
                          .includes(String(acc.id));
                        const deleting = deletingBankId === acc.id;
                        const label = `${acc.bankName}${acc.accountNumber ? ` · ${acc.accountNumber}` : ''}`;
                        const images = getBankAccountImages(
                          acc as StoreBankAccount,
                        );
                        return (
                          <div
                            key={acc.id}
                            className={cn(
                              'flex items-center gap-1 rounded-lg border transition',
                              on
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border/40',
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
                                    : 'border-border/60',
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
                                {images.length > 0 ? (
                                  <p className="mt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {images.length} foto
                                    {images.length === 1 ? '' : 's'} de esta
                                    cuenta
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    Sin foto de cuenta (opcional)
                                  </p>
                                )}
                              </div>
                              {images[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={images[0]}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-md border border-border/40 object-cover"
                                />
                              ) : null}
                            </button>
                            <button
                              type="button"
                              title="Editar / foto de esta cuenta"
                              aria-label={`Editar ${label}`}
                              disabled={savingBank}
                              onClick={() => {
                                setEditingBank(acc);
                                setBankDialogOpen(true);
                              }}
                              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                            >
                              {images.length > 0 ? (
                                <Pencil className="h-3.5 w-3.5" />
                              ) : (
                                <ImagePlus className="h-3.5 w-3.5" />
                              )}
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
          onClose={() => {
            setBankDialogOpen(false);
            setEditingBank(null);
          }}
          initial={
            editingBank
              ? ({
                  id: editingBank.id,
                  bankName: editingBank.bankName ?? '',
                  accountType: editingBank.accountType ?? '',
                  accountNumber: editingBank.accountNumber ?? '',
                  ownerName: editingBank.ownerName ?? '',
                  ownerCedula: editingBank.ownerCedula ?? '',
                  imageUrl: editingBank.imageUrl,
                  imageUrls: editingBank.imageUrls,
                  qrOnly: editingBank.qrOnly,
                  brebKey: editingBank.brebKey,
                } satisfies StoreBankAccount)
              : null
          }
          knownHolders={bankAccounts.map((a) => ({
            name: a.ownerName ?? '',
            cedula: a.ownerCedula || undefined,
          }))}
          onSave={(data) => {
            if (editingBank) {
              void handleUpdateBank(editingBank.id, data);
            } else {
              void handleSaveBank(data);
            }
          }}
          contentClassName="bg-card text-foreground"
        />
      </Section>

      <Section
        title="Firma arrendador"
        hint={
          selectedFirmante
            ? selectedFirmante.nombre
            : firmantes.length === 0
              ? 'Sin firmantes'
              : 'Opcional'
        }
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditingFirmante(null);
              setFirmanteDialogOpen(true);
            }}
            disabled={savingFirmante}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-bold text-foreground hover:bg-muted disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar firmante
          </button>
        </div>
        {firmantes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay firmantes aún. Agrega el primero con el botón de arriba
            (nombre + imagen PNG de la firma). La firma es opcional: puedes
            generar el contrato sin ella.
          </p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedFirmanteId('')}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition',
                !selectedFirmante
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition',
                  !selectedFirmante
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border',
                )}
              >
                {!selectedFirmante ? <Check className="h-3 w-3" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">Sin firma</p>
                <p className="text-[11px] text-muted-foreground">
                  El contrato sale sin imagen sobre la línea ARRENDADOR
                </p>
              </div>
            </button>
            {firmantes.map((f) => {
              const on = selectedFirmante?.id === f.id;
              const deleting = deletingFirmanteId === f.id;
              return (
                <div
                  key={f.id}
                  className={cn(
                    'flex items-center gap-1 rounded-xl border transition',
                    on
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border',
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFirmanteId((prev) =>
                        prev === f.id ? '' : f.id,
                      )
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition',
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border',
                      )}
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">
                        {f.nombre}
                        {f.esDefault ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                            · default
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[f.cargo, f.cedula ? `C.C. ${f.cedula}` : '', f.ciudad]
                          .filter(Boolean)
                          .join(' · ') || 'Sin datos de documento'}
                      </p>
                    </div>
                    {f.firmaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.firmaUrl}
                        alt={`Firma de ${f.nombre}`}
                        className="h-10 w-24 shrink-0 rounded-md border border-border bg-white object-contain p-0.5"
                      />
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-amber-500/40 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        <PenLine className="h-3 w-3" />
                        Sin imagen
                      </span>
                    )}
                  </button>
                  {!f.esDefault ? (
                    <button
                      type="button"
                      title="Marcar por defecto"
                      onClick={() => void handleSetDefaultFirmante(f.id)}
                      disabled={savingFirmante}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => {
                      setEditingFirmante(f);
                      setFirmanteDialogOpen(true);
                    }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => void handleDeleteFirmante(f.id, f.nombre)}
                    disabled={deleting}
                    className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
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
            {selectedFirmante && !selectedFirmante.firmaUrl ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Este firmante no tiene imagen: el contrato saldrá sin{' '}
                <span className="font-semibold">{'{{Firma}}'}</span>.
              </p>
            ) : null}
          </div>
        )}
        <FirmanteDialog
          open={firmanteDialogOpen}
          onClose={() => {
            setFirmanteDialogOpen(false);
            setEditingFirmante(null);
          }}
          initial={
            editingFirmante
              ? {
                  id: editingFirmante.id,
                  nombre: editingFirmante.nombre,
                  cargo: editingFirmante.cargo ?? '',
                  cedula: editingFirmante.cedula ?? '',
                  ciudad: editingFirmante.ciudad ?? '',
                  firmaUrl: editingFirmante.firmaUrl,
                  esDefault: editingFirmante.esDefault,
                }
              : null
          }
          onSave={handleSaveFirmante}
          saving={savingFirmante}
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
          {field(
            'Ciudad expedición',
            'clientCity',
            'Ej. Bogotá',
            'text',
            MUNICIPIOS_COLOMBIA,
          )}
          <div>
            <label className={fl}>Teléfono</label>
            <PhoneWithCountry
              value={String(draft.clientPhone ?? '')}
              onChange={(next) =>
                setDraft((d) => ({ ...d, clientPhone: next }))
              }
              placeholder="321 245 7666"
              inputClassName={cn(input, 'px-0 focus:ring-0')}
            />
          </div>
          <div>
            <label className={fl}>Número adicional</label>
            <PhoneWithCountry
              value={String(draft.clientPhoneAlt ?? '')}
              onChange={(next) =>
                setDraft((d) => ({ ...d, clientPhoneAlt: next }))
              }
              placeholder="Otro número"
              inputClassName={cn(input, 'px-0 focus:ring-0')}
            />
          </div>
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

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
        {/* Link de soporte de pago: apagado por defecto (Santiago, 23-jul). */}
        <label className="mb-2.5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2.5">
          <input
            type="checkbox"
            checked={enviarLinkSoporte}
            onChange={(e) => setEnviarLinkSoporte(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span className="min-w-0">
            <span className="block text-xs font-bold leading-tight">
              Enviar link para cargar el soporte de pago
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              El cliente sube su comprobante y sigue solo. Al aprobarlo, se crea
              la reserva y le llega la confirmación con el check-in.
            </span>
          </span>
        </label>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!draft.fincaId) {
              toast.error('Selecciona la finca.');
              return;
            }
            if (selectedBankPayload.bankAccounts.length === 0) {
              toast.error(
                selectedBankIds.length > 0
                  ? 'Las cuentas marcadas no tienen datos. Vuelve a seleccionarlas.'
                  : 'Selecciona al menos una cuenta de pago.',
              );
              return;
            }
            setShowPreview(true);
          }}
          disabled={!draft.fincaId}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <FileText className="h-4 w-4" /> Ver y enviar
        </button>
        </div>
      </div>

      {showPreview ? (
        <ContractPreviewModal
          draft={{
            ...draft,
            clientName: fullClientName(draft),
          }}
          selectedBankIds={selectedBankPayload.bankAccountIds}
          selectedBankAccounts={selectedBankPayload.bankAccounts}
          generalPaymentImageUrls={generalPaymentImageUrls}
          enviarLinkSoporte={enviarLinkSoporte}
          firmanteFields={firmanteContractFields}
          conversation={conversation}
          propertyTitle={
            fincas?.find((f) => f._id === draft.fincaId)?.title ??
            draft.fincaTitle
          }
          propertyLocation={
            fincas?.find((f) => f._id === draft.fincaId)?.location
          }
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </div>
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

      {/* Contenido de la herramienta.
          Contrato se mantiene montado (oculto) para no perder el borrador en
          memoria al cambiar de herramienta; además se cachea en localStorage. */}
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className={cn(tool !== 'contrato' && 'hidden')}>
          <ContratoTool conversation={conversation} />
        </div>
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
        {tool === 'semana' && <SemanaTool />}
      </div>
    </aside>
  );
}
