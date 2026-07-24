"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation as useConvexMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  Copy,
  CreditCard,
  Home,
  Landmark,
  Link2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";
import {
  type BankAccount,
  getBankAccountImages,
  syncContractSettingsNow,
  useContractSettingsStore,
} from "@/features/admin/store/contract-settings.store";
import {
  BankAccountDialog,
  type BankAccountPrefill,
} from "@/features/admin/components/contracts/bank-account-dialog";
import {
  fetchCheckinLink,
  fetchCheckinShareMessage,
  openWhatsAppWithMessage,
  type PaymentBreakdownLine,
} from "@/features/admin/utils/payment-whatsapp-message";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";
import {
  groupAccountsByHolder,
  type PaymentHolder,
} from "@/features/checkin/utils/payment-holders";
import {
  classifyCompanyHolder,
  isEmpresaAccount,
  splitGlobalHolders,
} from "@/features/checkin/utils/payment-holder-groups";
import {
  fetchPropertyOwnerInfo,
  updatePropertyOwnerInfo,
} from "@/features/fincas/api/fincas.api";
import type {
  OwnerBankAccount,
  PropertyOwnerInfo,
} from "@/features/fincas/types/fincas.types";

type BankDialogTarget = "owner" | "fincasya" | "hernan";

const paymentPortalApiUrl = (reference: string) =>
  `/api/payment/${encodeURIComponent(reference)}`;

export type PaymentPortalReceipt = {
  id: string;
  bankAccountId?: string;
  bankName?: string;
  amount?: number;
  receiptUrl: string;
  fileName?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: number;
};

type OwnerAccountsOption = {
  propertyId: string;
  propertyTitle: string;
  propertyCode: string | null;
  propietarioNombre: string;
  propietarioCedula: string;
  bankAccounts: Array<{
    id?: string;
    bankName: string;
    accountNumber: string;
    accountType: string;
    accountHolderName: string;
    brebKey?: boolean;
  }>;
};

function isBreBAccount(input: {
  bankName?: string;
  accountNumber?: string;
  brebKey?: boolean;
}): boolean {
  if (input.brebKey === true) return true;
  if (/bre[- ]?b/i.test(input.bankName ?? "")) return true;
  const bank = (input.bankName ?? "").trim();
  const number = (input.accountNumber ?? "").trim();
  return !bank && /^@/.test(number);
}

function normalizeBankAccountFields<
  T extends {
    bankName?: string;
    accountNumber?: string;
    accountType?: string;
    brebKey?: boolean;
  },
>(account: T): T & { bankName: string; accountType: string; brebKey?: boolean } {
  const brebKey = isBreBAccount(account);
  return {
    ...account,
    bankName: brebKey ? "Bre-B" : String(account.bankName ?? "").trim(),
    accountType: brebKey ? "" : String(account.accountType ?? "").trim(),
    brebKey: brebKey || undefined,
  };
}

/** Clave natural para no duplicar cuentas al importarlas. */
const accountKey = (a: {
  bankName?: string;
  accountNumber?: string;
  ownerCedula?: string;
}) =>
  `${(a.bankName ?? "").trim().toLowerCase()}|${(a.accountNumber ?? "")
    .trim()
    .toLowerCase()}|${(a.ownerCedula ?? "").trim().toLowerCase()}`;

export interface ReservationPaymentMethodsSectionProps {
  bookingId: string;
  bookingReference?: string;
  propertyId?: string;
  clientName?: string;
  clientPhone?: string;
  propertyName?: string;
  checkInDate?: string;
  breakdown: PaymentBreakdownLine[];
  total: number;
  receipts?: PaymentPortalReceipt[];
  initialBankAccountIds?: string[];
  /** Cuentas propias de esta reserva (importadas de un propietario), no del catálogo global. */
  initialExtraBankAccounts?: BankAccount[];
  initialBoldLink?: string;
  initialBoldSurcharge?: number;
  /** Si true, el cliente puede subir comprobantes en el check-in. */
  clientPaymentProofUploadEnabled?: boolean;
  onClientPaymentProofUploadChange?: (enabled: boolean) => void;
  className?: string;
}

const fmtCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

function holderCheckState(
  accountIds: string[],
  selectedAccountIds: string[],
): boolean | "indeterminate" {
  const selected = accountIds.filter((id) => selectedAccountIds.includes(id));
  if (selected.length === 0) return false;
  if (selected.length === accountIds.length) return true;
  return "indeterminate";
}

function buildOwnerOptionFromProperty(
  propertyId: string,
  propertyTitle: string,
  ownerInfo: PropertyOwnerInfo,
): OwnerAccountsOption | null {
  const propietarioNombre = ownerInfo.propietarioNombre?.trim() ?? "";
  const propietarioCedula = ownerInfo.propietarioCedula?.trim() ?? "";
  let bankAccounts: OwnerAccountsOption["bankAccounts"] = [];

  if (ownerInfo.bankAccounts?.length) {
    bankAccounts = ownerInfo.bankAccounts
      .map((account) =>
        normalizeBankAccountFields({
          id: account.id,
          bankName: String(account.bankName ?? "").trim(),
          accountNumber: String(account.accountNumber ?? "").trim(),
          accountType: String(account.accountType ?? "").trim(),
          accountHolderName:
            String(account.accountHolderName ?? "").trim() || propietarioNombre,
          brebKey: account.brebKey,
        }),
      )
      .filter((account) => account.bankName || account.accountNumber)
      .map((account) => ({
        id: account.id,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        accountHolderName: account.accountHolderName,
        brebKey: account.brebKey,
      }));
  } else if (ownerInfo.bankName || ownerInfo.accountNumber) {
    bankAccounts = [
      {
        bankName: String(ownerInfo.bankName ?? "").trim(),
        accountNumber: String(ownerInfo.accountNumber ?? "").trim(),
        accountType: "",
        accountHolderName: propietarioNombre,
      },
    ];
  }

  if (bankAccounts.length === 0) return null;

  return {
    propertyId,
    propertyTitle,
    propertyCode: null,
    propietarioNombre,
    propietarioCedula,
    bankAccounts,
  };
}

function toCheckinAccounts(accounts: BankAccount[]) {
  return accounts.map((account) => {
    const normalized = normalizeBankAccountFields(account);
    return {
      id: account.id,
      bankName: normalized.bankName,
      accountType: normalized.accountType,
      accountNumber: account.accountNumber,
      ownerName: account.ownerName,
      ownerCedula: account.ownerCedula,
      imageUrl: getBankAccountImages(account)[0] ?? null,
      imageUrls: getBankAccountImages(account),
      qrOnly: account.qrOnly,
      brebKey: normalized.brebKey,
    };
  });
}

function PaymentHoldersAccordion({
  holders,
  sectionPrefix,
  selectedAccountIds,
  bankAccountById,
  onToggleAccount,
  onToggleHolder,
  onEditAccount,
  onRemoveAccount,
  onAddAccountForHolder,
}: {
  holders: PaymentHolder[];
  sectionPrefix: string;
  selectedAccountIds: string[];
  bankAccountById: Map<string, BankAccount>;
  onToggleAccount: (id: string, checked: boolean) => void;
  onToggleHolder: (holderId: string, checked: boolean) => void;
  onEditAccount: (account: BankAccount) => void;
  onRemoveAccount: (id: string) => void;
  onAddAccountForHolder?: (holder: PaymentHolder) => void;
}) {
  const defaultOpen = useMemo(() => {
    const withSelection = holders
      .filter((holder) =>
        holder.accounts.some((account) =>
          selectedAccountIds.includes(account.id),
        ),
      )
      .map((holder) => `${sectionPrefix}-${holder.id}`);
    if (withSelection.length > 0) return withSelection;
    return holders.slice(0, 1).map((holder) => `${sectionPrefix}-${holder.id}`);
  }, [holders, selectedAccountIds, sectionPrefix]);

  if (holders.length === 0) return null;

  return (
    <Accordion
      key={`${sectionPrefix}-${holders.map((holder) => holder.id).join("|")}`}
      type="multiple"
      defaultValue={defaultOpen}
      className="space-y-2"
    >
      {holders.map((holder) => {
        const accountIds = holder.accounts.map((account) => account.id);
        const holderChecked = holderCheckState(accountIds, selectedAccountIds);
        const selectedCount = accountIds.filter((id) =>
          selectedAccountIds.includes(id),
        ).length;
        const accordionValue = `${sectionPrefix}-${holder.id}`;

        return (
          <AccordionItem
            key={accordionValue}
            value={accordionValue}
            className="overflow-hidden rounded-xl border border-border/70 bg-background/80 px-0 last:border-b"
          >
            <div className="flex items-start gap-2 border-b border-border/60 bg-muted/20 px-3 py-2">
              <Checkbox
                id={`pay-holder-${accordionValue}`}
                checked={holderChecked}
                onCheckedChange={(value) =>
                  onToggleHolder(holder.id, value === true)
                }
                onClick={(event) => event.stopPropagation()}
                className="mt-2.5"
              />
              <AccordionTrigger className="flex-1 py-2 hover:no-underline [&>svg]:text-foreground">
                <div className="min-w-0 flex-1 text-left">
                  <span className="text-sm font-bold">{holder.name}</span>
                  <p className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                    {holder.cedula ? `C.C. ${holder.cedula}` : "Sin cédula"}
                    {" · "}
                    {holder.accounts.length} cuenta
                    {holder.accounts.length === 1 ? "" : "s"}
                    {" · "}
                    {selectedCount} seleccionada
                    {selectedCount === 1 ? "" : "s"}
                  </p>
                </div>
              </AccordionTrigger>
            </div>

            <AccordionContent className="px-2 pb-2 pt-2">
              <div className="ml-3 space-y-2 border-l-2 border-border pl-3">
                {holder.accounts.map((accountRef) => {
                  const account = bankAccountById.get(accountRef.id);
                  if (!account) return null;
                  const checked = selectedAccountIds.includes(account.id);
                  const accountImages = getBankAccountImages(account);

                  return (
                    <div
                      key={account.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                        checked
                          ? "border-foreground/40 bg-muted/40"
                          : "border-border/50 bg-background/60",
                      )}
                    >
                      <Checkbox
                        id={`pay-acc-${account.id}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          onToggleAccount(account.id, value === true)
                        }
                        className="mt-2"
                      />
                      <BankLogoBadge
                        bankName={account.bankName}
                        brebKey={account.brebKey}
                      />
                      <Label
                        htmlFor={`pay-acc-${account.id}`}
                        className="min-w-0 flex-1 cursor-pointer space-y-0.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">
                            {account.bankName}
                          </span>
                          {account.accountType ? (
                            <span className="text-[10px] text-muted-foreground">
                              {account.accountType}
                            </span>
                          ) : null}
                          {accountImages.length > 0 ? (
                            <Badge variant="secondary" className="text-[9px]">
                              QR
                            </Badge>
                          ) : null}
                          {account.qrOnly ? (
                            <Badge variant="secondary" className="text-[9px]">
                              Solo QR
                            </Badge>
                          ) : null}
                          {account.brebKey ? (
                            <Badge variant="secondary" className="text-[9px]">
                              Bre-B
                            </Badge>
                          ) : null}
                        </div>
                        <p className="font-mono text-xs text-foreground">
                          {account.qrOnly || !account.accountNumber?.trim()
                            ? account.accountNumber?.trim() || "Solo QR"
                            : account.accountNumber}
                        </p>
                      </Label>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditAccount(account)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveAccount(account.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {onAddAccountForHolder ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full rounded-xl border border-dashed border-border text-[11px] font-bold text-foreground hover:bg-muted/30 hover:text-foreground"
                    onClick={() => onAddAccountForHolder(holder)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Agregar otra cuenta bancaria
                  </Button>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function HolderSection({
  title,
  description,
  badge,
  holders,
  sectionPrefix,
  selectedAccountIds,
  bankAccountById,
  onToggleAccount,
  onToggleHolder,
  onEditAccount,
  onRemoveAccount,
  onAddAccount,
  onAddAccountForHolder,
  addLabel,
  emptyHint,
  headerExtra,
}: {
  title: string;
  description?: string;
  badge?: string;
  holders: PaymentHolder[];
  sectionPrefix: string;
  selectedAccountIds: string[];
  bankAccountById: Map<string, BankAccount>;
  onToggleAccount: (id: string, checked: boolean) => void;
  onToggleHolder: (holders: PaymentHolder[], holderId: string, checked: boolean) => void;
  onEditAccount: (account: BankAccount) => void;
  onRemoveAccount: (id: string) => void;
  onAddAccount?: () => void;
  onAddAccountForHolder?: (holder: PaymentHolder) => void;
  addLabel?: string;
  emptyHint?: string;
  headerExtra?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {title}
            </p>
            {badge ? (
              <Badge
                variant="secondary"
                className="border border-border/60 text-[9px] font-semibold"
              >
                {badge}
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {onAddAccount ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 rounded-lg border-border/60 px-2 text-[10px] font-bold"
            onClick={onAddAccount}
          >
            <Plus className="mr-1 h-3 w-3" />
            {addLabel ?? "Agregar"}
          </Button>
        ) : null}
      </div>
      {headerExtra}
      {holders.length > 0 ? (
        <PaymentHoldersAccordion
          holders={holders}
          sectionPrefix={sectionPrefix}
          selectedAccountIds={selectedAccountIds}
          bankAccountById={bankAccountById}
          onToggleAccount={onToggleAccount}
          onToggleHolder={(holderId, checked) =>
            onToggleHolder(holders, holderId, checked)
          }
          onEditAccount={onEditAccount}
          onRemoveAccount={onRemoveAccount}
          onAddAccountForHolder={onAddAccountForHolder}
        />
      ) : emptyHint ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : null}
    </div>
  );
}

export function ReservationPaymentMethodsSection({
  bookingId,
  bookingReference,
  propertyId,
  clientName,
  clientPhone,
  propertyName,
  checkInDate,
  breakdown,
  total,
  receipts = [],
  initialBankAccountIds,
  initialExtraBankAccounts,
  initialBoldLink,
  initialBoldSurcharge,
  clientPaymentProofUploadEnabled = true,
  onClientPaymentProofUploadChange,
  className,
}: ReservationPaymentMethodsSectionProps) {
  const {
    bankAccounts: globalBankAccounts,
    primaryBankAccountId,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
  } = useContractSettingsStore();

  const [uploadEnabled, setUploadEnabled] = useState(
    clientPaymentProofUploadEnabled,
  );
  const [savingUploadToggle, setSavingUploadToggle] = useState(false);

  useEffect(() => {
    setUploadEnabled(clientPaymentProofUploadEnabled);
  }, [clientPaymentProofUploadEnabled, bookingId]);

  const handleToggleUpload = async (enabled: boolean) => {
    setUploadEnabled(enabled);
    setSavingUploadToggle(true);
    try {
      await axios.post(`/api/bookings/${bookingId}/payment-proof-upload`, {
        enabled,
      });
      onClientPaymentProofUploadChange?.(enabled);
      toast.success(
        enabled
          ? "El cliente ya puede subir soportes en el check-in"
          : "Subida deshabilitada: el cliente enviará por WhatsApp",
      );
    } catch {
      setUploadEnabled(!enabled);
      toast.error("No se pudo guardar la preferencia de soportes");
    } finally {
      setSavingUploadToggle(false);
    }
  };

  const savePortalConfig = useConvexMutation(
    api.paymentPortal.savePaymentPortalConfig,
  );

  // Cuentas propias de ESTA reserva (importadas de un propietario), no van al catálogo global.
  const [extraAccounts, setExtraAccounts] = useState<BankAccount[]>(() =>
    (initialExtraBankAccounts ?? []).map((account) =>
      normalizeBankAccountFields(account),
    ),
  );

  useEffect(() => {
    if (!initialExtraBankAccounts?.length) return;
    setExtraAccounts(
      initialExtraBankAccounts.map((account) =>
        normalizeBankAccountFields(account),
      ),
    );
  }, [initialExtraBankAccounts]);

  // Catálogo global + extras de esta reserva. Todo lo que se muestra/resuelve usa esta lista.
  const bankAccounts = useMemo(
    () => [...globalBankAccounts, ...extraAccounts],
    [globalBankAccounts, extraAccounts],
  );

  const [portalReceipts, setPortalReceipts] =
    useState<PaymentPortalReceipt[]>(receipts);

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [boldLink, setBoldLink] = useState(initialBoldLink ?? "");
  const [boldSurcharge, setBoldSurcharge] = useState(
    initialBoldSurcharge != null ? String(initialBoldSurcharge) : "5",
  );
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankDialogTarget, setBankDialogTarget] =
    useState<BankDialogTarget>("owner");
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [accountPrefill, setAccountPrefill] =
    useState<BankAccountPrefill | null>(null);
  const [propertyOwnerInfo, setPropertyOwnerInfo] =
    useState<PropertyOwnerInfo | null>(null);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [isCopyingMessage, setIsCopyingMessage] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const [loadingPropertyAccounts, setLoadingPropertyAccounts] = useState(false);
  const [propertyAccountsLoaded, setPropertyAccountsLoaded] = useState(false);

  const bankAccountById = useMemo(
    () => new Map(bankAccounts.map((account) => [account.id, account])),
    [bankAccounts],
  );

  useEffect(() => {
    setPortalReceipts(receipts);
  }, [receipts]);

  const loadPortalReceipts = useCallback(async () => {
    const ref = bookingReference?.trim();
    if (!ref) return;
    try {
      const res = await fetch(paymentPortalApiUrl(ref));
      if (!res.ok) return;
      const data = (await res.json()) as {
        receipts?: PaymentPortalReceipt[];
      };
      if (Array.isArray(data.receipts)) setPortalReceipts(data.receipts);
    } catch {
      /* opcional */
    }
  }, [bookingReference]);

  useEffect(() => {
    void loadPortalReceipts();
    const interval = setInterval(() => void loadPortalReceipts(), 30_000);
    return () => clearInterval(interval);
  }, [loadPortalReceipts]);

  const paymentHolders = useMemo(
    () => groupAccountsByHolder(toCheckinAccounts(globalBankAccounts)),
    [globalBankAccounts],
  );

  const { fincasya: fincasyaHolders, hernan: hernanHolders } = useMemo(
    () => splitGlobalHolders(paymentHolders),
    [paymentHolders],
  );

  const ownerMeta = useMemo(() => {
    const nombre = propertyOwnerInfo?.propietarioNombre?.trim() ?? "";
    const cedula = propertyOwnerInfo?.propietarioCedula?.trim() ?? "";
    if (!nombre && !cedula) return null;
    return { nombre, cedula };
  }, [propertyOwnerInfo]);

  const ownerExtraAccounts = extraAccounts;

  const ownerHolders = useMemo(
    () => groupAccountsByHolder(toCheckinAccounts(ownerExtraAccounts)),
    [ownerExtraAccounts],
  );

  const empresaHolders = useMemo(
    () =>
      [...fincasyaHolders, ...hernanHolders].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
    [fincasyaHolders, hernanHolders],
  );

  const isAllowedAccountId = useCallback(
    (id: string) => {
      const global = globalBankAccounts.find((account) => account.id === id);
      if (global) return isEmpresaAccount(global);
      return extraAccounts.some((account) => account.id === id);
    },
    [globalBankAccounts, extraAccounts],
  );

  // Inicializa la selección UNA sola vez (solo propietario + empresa).
  const selectionInitialized = useRef(false);
  useEffect(() => {
    if (selectionInitialized.current) return;
    if (globalBankAccounts.length === 0 && ownerExtraAccounts.length === 0) return;

    const filterAllowed = (ids: string[]) =>
      ids.filter((id) => isAllowedAccountId(id));

    if (initialBankAccountIds !== undefined) {
      setSelectedAccountIds(filterAllowed(initialBankAccountIds));
      selectionInitialized.current = true;
      return;
    }

    const empresaIds = globalBankAccounts
      .filter(isEmpresaAccount)
      .map((account) => account.id);
    const ownerIds = ownerExtraAccounts.map((account) => account.id);
    const defaultIds =
      primaryBankAccountId && isAllowedAccountId(primaryBankAccountId)
        ? [primaryBankAccountId]
        : [...new Set([...empresaIds, ...ownerIds])];
    setSelectedAccountIds(defaultIds);
    selectionInitialized.current = true;
  }, [
    globalBankAccounts,
    ownerExtraAccounts,
    primaryBankAccountId,
    initialBankAccountIds,
    isAllowedAccountId,
  ]);

  useEffect(() => {
    setSelectedAccountIds((prev) => {
      const filtered = prev.filter((id) => isAllowedAccountId(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [isAllowedAccountId]);

  const selectedAccounts = useMemo(
    () => bankAccounts.filter((account) => selectedAccountIds.includes(account.id)),
    [bankAccounts, selectedAccountIds],
  );

  const persistPortalConfig = useCallback(async () => {
    if (!bookingId) return;
    try {
      await syncContractSettingsNow();
      const link = boldLink.trim();
      const surcharge = Number.parseFloat(boldSurcharge);
      // Solo persistir cuentas extra del propietario de esta finca.
      const selectedExtra = ownerExtraAccounts.filter((account) =>
        selectedAccountIds.includes(account.id),
      );
      const allowedGlobalIds = selectedAccountIds.filter((id) =>
        globalBankAccounts.some(
          (account) => account.id === id && isEmpresaAccount(account),
        ),
      );
      await savePortalConfig({
        bookingId: bookingId as Id<"bookings">,
        bankAccountIds: [...allowedGlobalIds, ...selectedExtra.map((a) => a.id)],
        paymentMediaIds: [],
        extraBankAccounts: selectedExtra,
        boldLink: link || undefined,
        boldSurcharge:
          link && Number.isFinite(surcharge) ? surcharge : undefined,
      });
    } catch {
      /* silencioso */
    }
  }, [bookingId, selectedAccountIds, ownerExtraAccounts, globalBankAccounts, boldLink, boldSurcharge, savePortalConfig]);

  useEffect(() => {
    const timer = window.setTimeout(() => persistPortalConfig(), 400);
    return () => window.clearTimeout(timer);
  }, [selectedAccountIds, boldLink, boldSurcharge, persistPortalConfig]);

  // Flush del guardado pendiente al desmontar (cerrar el detalle de la reserva
  // o navegar): evita perder la última cuenta creada —p.ej. una llave Bre-B—
  // si el editor se cierra antes de que corra el debounce de 400ms.
  const persistPortalConfigRef = useRef(persistPortalConfig);
  useEffect(() => {
    persistPortalConfigRef.current = persistPortalConfig;
  }, [persistPortalConfig]);
  useEffect(
    () => () => {
      void persistPortalConfigRef.current();
    },
    [],
  );

  const toggleAccount = (id: string, checked: boolean) => {
    setSelectedAccountIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  };

  const toggleHolder = (
    holders: PaymentHolder[],
    holderId: string,
    checked: boolean,
  ) => {
    const holder = holders.find((item) => item.id === holderId);
    if (!holder) return;
    const ids = holder.accounts.map((account) => account.id);
    setSelectedAccountIds((prev) =>
      checked
        ? [...new Set([...prev, ...ids])]
        : prev.filter((id) => !ids.includes(id)),
    );
  };

  useEffect(() => {
    if (!propertyId) {
      setPropertyOwnerInfo(null);
      return;
    }
    void fetchPropertyOwnerInfo(propertyId).then(setPropertyOwnerInfo);
  }, [propertyId]);

  const shareInput = useMemo(
    () => ({
      bookingId,
      reference: bookingReference?.trim() || "",
      clientName,
      propertyName,
      checkInDate,
      breakdown,
      total,
    }),
    [
      bookingId,
      bookingReference,
      clientName,
      propertyName,
      checkInDate,
      breakdown,
      total,
    ],
  );

  const handleCopyLink = async () => {
    setIsCopyingLink(true);
    try {
      await persistPortalConfig();
      const link = await fetchCheckinLink(bookingId);
      if (!link) {
        toast.error("No se pudo obtener el link de check-in.");
        return;
      }
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast.success("Link de check-in copiado");
    } catch {
      toast.error("No se pudo copiar el link.");
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleCopyMessage = async () => {
    if (selectedAccountIds.length === 0) {
      toast.error("Marca al menos una cuenta para el cliente.");
      return;
    }
    setIsCopyingMessage(true);
    try {
      await persistPortalConfig();
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const message = await fetchCheckinShareMessage(shareInput);
      if (!message) {
        toast.error("No se pudo armar el mensaje.");
        return;
      }
      await navigator.clipboard.writeText(message);
      setMessageCopied(true);
      window.setTimeout(() => setMessageCopied(false), 2000);
      toast.success("Mensaje copiado (resumen + cuentas + check-in)");
    } catch {
      toast.error("No se pudo copiar el mensaje.");
    } finally {
      setIsCopyingMessage(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (selectedAccountIds.length === 0) {
      toast.error("Marca al menos una cuenta para el cliente.");
      return;
    }
    try {
      await persistPortalConfig();
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const message = await fetchCheckinShareMessage(shareInput);
      if (!message) {
        toast.error("No se pudo armar el mensaje.");
        return;
      }
      openWhatsAppWithMessage(message, clientPhone);
      toast.success(
        clientPhone
          ? "WhatsApp abierto con el mensaje"
          : "WhatsApp abierto — elige el contacto",
      );
    } catch {
      toast.error("No se pudo abrir WhatsApp.");
    }
  };

  const pendingReceipts = portalReceipts.filter((r) => r.status === "pending");

  const bankDialogPrefill = useCallback(
    (target: BankDialogTarget): BankAccountPrefill | null => {
      if (target === "owner") {
        return {
          ownerName: ownerMeta?.nombre ?? "",
          ownerCedula: ownerMeta?.cedula ?? "",
        };
      }
      if (target === "hernan") {
        const holder = hernanHolders[0];
        return holder
          ? { ownerName: holder.name, ownerCedula: holder.cedula }
          : { ownerName: "Hernán Aguilera Gomez" };
      }
      if (target === "fincasya") {
        const holder = fincasyaHolders[0];
        return holder
          ? { ownerName: holder.name, ownerCedula: holder.cedula }
          : { ownerName: "Angela María Campos Galeano" };
      }
      return null;
    },
    [ownerMeta, hernanHolders, fincasyaHolders],
  );

  const openNewAccount = (
    target: BankDialogTarget,
    prefill?: BankAccountPrefill | null,
  ) => {
    setBankDialogTarget(target);
    setEditingBank(null);
    setAccountPrefill(prefill ?? bankDialogPrefill(target));
    setBankDialogOpen(true);
  };

  const openEmpresaAccount = (holder: PaymentHolder) => {
    const group = classifyCompanyHolder(holder.name);
    openNewAccount(group === "hernan" ? "hernan" : "fincasya", {
      ownerName: holder.name,
      ownerCedula: holder.cedula,
    });
  };

  const openOwnerAccountForHolder = (holder: PaymentHolder) => {
    openNewAccount("owner", {
      ownerName: holder.name,
      ownerCedula: holder.cedula,
    });
  };

  const importPropertyOwnerAccounts = useCallback(
    (option: OwnerAccountsOption, opts?: { silent?: boolean }) => {
      const existingByKey = new Map(
        bankAccounts.map((a) => [accountKey(a), a.id]),
      );
      const toAdd: BankAccount[] = [];
      const idsToSelect: string[] = [];

      for (const acc of option.bankAccounts) {
        const holderName =
          acc.accountHolderName?.trim() || option.propietarioNombre || "";
        const normalized = normalizeBankAccountFields(acc);
        const candidate: BankAccount = {
          id: acc.id?.trim() || crypto.randomUUID(),
          bankName: normalized.bankName,
          accountType: normalized.accountType,
          accountNumber: acc.accountNumber,
          ownerName: holderName,
          ownerCedula: option.propietarioCedula,
          imageUrls: [],
          brebKey: normalized.brebKey,
        };
        const key = accountKey(candidate);
        const existingId = existingByKey.get(key);
        if (existingId) {
          idsToSelect.push(existingId);
        } else {
          toAdd.push(candidate);
          idsToSelect.push(candidate.id);
          existingByKey.set(key, candidate.id);
        }
      }

      if (toAdd.length > 0) setExtraAccounts((prev) => [...prev, ...toAdd]);
      setSelectedAccountIds((prev) => [
        ...new Set([...prev, ...idsToSelect].filter(isAllowedAccountId)),
      ]);

      if (!opts?.silent) {
        const added = toAdd.length;
        const reused = idsToSelect.length - added;
        toast.success(
          added > 0
            ? `${added} cuenta(s) del propietario agregada(s)${reused > 0 ? ` (${reused} ya existía/n)` : ""}`
            : "Esas cuentas ya estaban; quedaron marcadas",
        );
      }

      return { added: toAdd.length, selected: idsToSelect.length };
    },
    [bankAccounts, isAllowedAccountId],
  );

  const loadPropertyOwnerAccounts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!propertyId) return false;
      setLoadingPropertyAccounts(true);
      try {
        const ownerInfo = await fetchPropertyOwnerInfo(propertyId);
        setPropertyOwnerInfo(ownerInfo);
        if (!ownerInfo) {
          if (!opts?.silent) {
            toast.message(
              "Esta finca no tiene cuentas registradas en la ficha del propietario.",
            );
          }
          return false;
        }
        const option = buildOwnerOptionFromProperty(
          propertyId,
          propertyName?.trim() || "Finca",
          ownerInfo,
        );
        if (!option) {
          if (!opts?.silent) {
            toast.message(
              "Esta finca no tiene cuentas registradas en la ficha del propietario.",
            );
          }
          return false;
        }
        importPropertyOwnerAccounts(option, opts);
        setPropertyAccountsLoaded(true);
        return true;
      } catch {
        if (!opts?.silent) {
          toast.error("No se pudieron cargar las cuentas de la finca.");
        }
        return false;
      } finally {
        setLoadingPropertyAccounts(false);
      }
    },
    [propertyId, propertyName, importPropertyOwnerAccounts],
  );

  const ownerInfoSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!propertyId) {
      ownerInfoSyncedRef.current = null;
      return;
    }
    if (!propertyOwnerInfo) return;
    if (ownerInfoSyncedRef.current === propertyId) return;
    if ((initialExtraBankAccounts?.length ?? 0) > 0) {
      ownerInfoSyncedRef.current = propertyId;
      setPropertyAccountsLoaded(true);
      return;
    }

    const option = buildOwnerOptionFromProperty(
      propertyId,
      propertyName?.trim() || "Finca",
      propertyOwnerInfo,
    );
    if (!option) return;

    ownerInfoSyncedRef.current = propertyId;
    importPropertyOwnerAccounts(option, { silent: true });
    setPropertyAccountsLoaded(true);
  }, [propertyId, propertyOwnerInfo, propertyName, importPropertyOwnerAccounts, initialExtraBankAccounts]);

  const isExtraAccount = (id: string) => extraAccounts.some((a) => a.id === id);

  const persistOwnerBankAccounts = async (
    nextAccounts: OwnerBankAccount[],
  ) => {
    if (!propertyId || !propertyOwnerInfo) return false;
    const primaryBank = nextAccounts[0];
    await updatePropertyOwnerInfo({
      id: propertyId,
      payload: {
        ownerUserId: propertyOwnerInfo.ownerUserId ?? "",
        rutNumber: propertyOwnerInfo.rutNumber ?? "",
        bankName: primaryBank?.bankName ?? "",
        accountNumber: primaryBank?.accountNumber ?? "",
        bankAccounts: nextAccounts,
        rntNumber: propertyOwnerInfo.rntNumber ?? "",
        propietarioNombre: propertyOwnerInfo.propietarioNombre ?? "",
        propietarioTratamiento: propertyOwnerInfo.propietarioTratamiento ?? "",
        propietarioTelefono: propertyOwnerInfo.propietarioTelefono ?? "",
        propietarioCedula: propertyOwnerInfo.propietarioCedula ?? "",
        propietarioCorreo: propertyOwnerInfo.propietarioCorreo ?? "",
        checkinUbicacionUrl: propertyOwnerInfo.checkinUbicacionUrl ?? "",
        checkinWazeUrl: propertyOwnerInfo.checkinWazeUrl ?? "",
        checkinIndicacionesLlegada:
          propertyOwnerInfo.checkinIndicacionesLlegada ?? "",
        checkinRecomendaciones: propertyOwnerInfo.checkinRecomendaciones ?? "",
      },
    });
    setPropertyOwnerInfo((prev) =>
      prev ? { ...prev, bankAccounts: nextAccounts } : prev,
    );
    return true;
  };

  const handleRemoveAccount = async (id: string) => {
    if (isExtraAccount(id)) {
      const removed = extraAccounts.find((a) => a.id === id);
      setExtraAccounts((prev) => prev.filter((a) => a.id !== id));
      setSelectedAccountIds((prev) => prev.filter((x) => x !== id));

      if (propertyId && propertyOwnerInfo && removed) {
        const removedKey = `${removed.bankName.trim().toLowerCase()}|${removed.accountNumber
          .trim()
          .toLowerCase()}`;
        const nextOwnerAccounts = (propertyOwnerInfo.bankAccounts ?? []).filter(
          (account) => {
            if (account.id && account.id === id) return false;
            const key = `${String(account.bankName ?? "")
              .trim()
              .toLowerCase()}|${String(account.accountNumber ?? "")
              .trim()
              .toLowerCase()}`;
            return key !== removedKey;
          },
        );
        try {
          await persistOwnerBankAccounts(nextOwnerAccounts);
          toast.success("Cuenta eliminada de la reserva y de la ficha");
        } catch {
          toast.message(
            "Se quitó de la reserva, pero no se pudo borrar de la ficha de la finca.",
          );
        }
      }
      return;
    }
    removeBankAccount(id);
    toast.success("Cuenta eliminada del catálogo");
  };

  const openEditAccount = (account: BankAccount) => {
    setAccountPrefill(null);
    setEditingBank(account);
    setBankDialogOpen(true);
  };

  const closeBankDialog = () => {
    setBankDialogOpen(false);
    setEditingBank(null);
    setAccountPrefill(null);
  };

  const handleSaveAccount = async (data: Omit<BankAccount, "id">) => {
    const normalizedData = normalizeBankAccountFields(data);
    const prefill = accountPrefill ?? bankDialogPrefill(bankDialogTarget);
    const payload =
      prefill?.ownerName?.trim() && !editingBank
        ? {
            ...normalizedData,
            ownerName: prefill.ownerName.trim(),
            ownerCedula: (prefill.ownerCedula ?? normalizedData.ownerCedula).trim(),
          }
        : normalizedData;

    if (editingBank) {
      if (isExtraAccount(editingBank.id)) {
        setExtraAccounts((prev) =>
          prev.map((a) =>
            a.id === editingBank.id ? { ...a, ...payload } : a,
          ),
        );
      } else {
        updateBankAccount(editingBank.id, payload);
      }
      closeBankDialog();
      return;
    }

    if (bankDialogTarget === "owner") {
      const sharedId = crypto.randomUUID();
      const newAccount: BankAccount = {
        id: sharedId,
        ...payload,
        imageUrls: payload.imageUrls ?? [],
      };
      setExtraAccounts((prev) => [...prev, newAccount]);
      setSelectedAccountIds((prev) => [...new Set([...prev, newAccount.id])]);

      if (propertyId && propertyOwnerInfo) {
        const newOwnerAccount: OwnerBankAccount = {
          id: sharedId,
          bankName: payload.bankName.trim(),
          accountNumber: payload.accountNumber.trim(),
          ...(payload.brebKey ? { brebKey: true } : {}),
          ...(payload.accountType?.trim() && !payload.brebKey
            ? { accountType: payload.accountType.trim() }
            : {}),
          ...(payload.ownerName?.trim()
            ? { accountHolderName: payload.ownerName.trim() }
            : {}),
        };
        const existingAccounts = (propertyOwnerInfo.bankAccounts ?? [])
          .map((account) => {
            const normalized = normalizeBankAccountFields({
              id: account.id,
              bankName: account.bankName.trim(),
              accountNumber: account.accountNumber.trim(),
              accountType: account.accountType?.trim(),
              accountHolderName: account.accountHolderName?.trim(),
              brebKey: account.brebKey,
            });
            return {
              id: account.id,
              bankName: normalized.bankName,
              accountNumber: account.accountNumber.trim(),
              ...(normalized.brebKey ? { brebKey: true } : {}),
              ...(normalized.accountType
                ? { accountType: normalized.accountType }
                : {}),
              ...(account.accountHolderName?.trim()
                ? { accountHolderName: account.accountHolderName.trim() }
                : {}),
            };
          })
          .filter(
            (account) =>
              account.bankName.length > 0 || account.accountNumber.length > 0,
          );
        try {
          await persistOwnerBankAccounts([...existingAccounts, newOwnerAccount]);
          toast.success("Cuenta del propietario guardada en la finca");
        } catch {
          toast.message(
            "Cuenta agregada a la reserva; no se pudo guardar en la ficha de la finca.",
          );
        }
      } else {
        toast.success("Cuenta del propietario agregada a la reserva");
      }
      closeBankDialog();
      return;
    }

    const beforeIds = new Set(
      useContractSettingsStore.getState().bankAccounts.map((a) => a.id),
    );
    addBankAccount(payload);
    const created = useContractSettingsStore
      .getState()
      .bankAccounts.find((account) => !beforeIds.has(account.id));

    if (created) {
      setSelectedAccountIds((prev) => [...new Set([...prev, created.id])]);
    }
    closeBankDialog();
  };

  const hasAnyAccountSections =
    Boolean(propertyId) ||
    ownerHolders.length > 0 ||
    empresaHolders.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background p-4 space-y-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-foreground" />
            <h4 className="text-sm font-bold text-foreground">
              Medios de pago · Check-in
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Elige las cuentas del propietario de esta finca y las de empresa
            (Angela y Hernán). Al crear una cuenta nueva del propietario, queda
            guardada en su ficha.
          </p>
        </div>
      </div>

      {!hasAnyAccountSections && bankAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">
            No hay cuentas bancarias configuradas
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {propertyId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg text-xs font-bold"
                onClick={() => openNewAccount("owner")}
              >
                <Plus className="w-3 h-3 mr-1" />
                Cuenta del propietario
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs font-bold"
              onClick={() => openNewAccount("fincasya")}
            >
              <Plus className="w-3 h-3 mr-1" />
              Cuenta empresa
            </Button>
          </div>
        </div>
      ) : (
        <div className="scrollbar-hide max-h-128 space-y-4 overflow-x-hidden overflow-y-auto">
          {propertyId ? (
            <>
              <HolderSection
                title="Propietario de la finca"
                description={
                  ownerMeta?.nombre
                    ? `Cuentas de ${ownerMeta.nombre}`
                    : "Cuentas del dueño de esta propiedad"
                }
                badge="Propietario"
                holders={ownerHolders}
                sectionPrefix="owner"
                selectedAccountIds={selectedAccountIds}
                bankAccountById={bankAccountById}
                onToggleAccount={toggleAccount}
                onToggleHolder={toggleHolder}
                onEditAccount={openEditAccount}
                onRemoveAccount={handleRemoveAccount}
                onAddAccount={() => openNewAccount("owner")}
                onAddAccountForHolder={openOwnerAccountForHolder}
                addLabel="Nueva cuenta"
                emptyHint="Sin cuentas del propietario. Carga las de la finca o crea una nueva (queda en la ficha del propietario)."
                headerExtra={
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 rounded-xl border-border text-[11px] font-bold text-foreground hover:bg-muted/30 hover:text-foreground"
                        disabled={loadingPropertyAccounts}
                        onClick={() => void loadPropertyOwnerAccounts()}
                      >
                        {loadingPropertyAccounts ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Home className="mr-1.5 h-4 w-4" />
                        )}
                        Usar cuentas de la finca
                      </Button>
                    </div>
                    {propertyAccountsLoaded ? (
                      <p className="text-[10px] text-muted-foreground">
                        Cuentas de la finca cargadas en esta reserva.
                      </p>
                    ) : null}
                  </div>
                }
              />
              <Separator />
            </>
          ) : null}

          <HolderSection
            title="Empresa"
            description="Cuentas de FincasYa (Angela y Hernán — mismo catálogo empresa)"
            badge="Empresa"
            holders={empresaHolders}
            sectionPrefix="empresa"
            selectedAccountIds={selectedAccountIds}
            bankAccountById={bankAccountById}
            onToggleAccount={toggleAccount}
            onToggleHolder={toggleHolder}
            onEditAccount={openEditAccount}
            onRemoveAccount={handleRemoveAccount}
            onAddAccount={() => openNewAccount("fincasya")}
            onAddAccountForHolder={openEmpresaAccount}
            addLabel="Cuenta empresa"
            emptyHint="Sin cuentas de empresa. Configúralas en Cuentas empresa o agrégalas aquí."
            headerExtra={
              <p className="text-[10px] text-muted-foreground">
                Catálogo global:{" "}
                <Link
                  href="/admin/cuentas-empresa"
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  configurar cuentas empresa
                </Link>{" "}
                sin abrir una reserva.
              </p>
            }
          />

          <p className="text-[10px] text-muted-foreground">
            {selectedAccounts.length === 0
              ? "Sin cuentas marcadas — el cliente no verá medios de pago en el check-in."
              : `${selectedAccounts.length} cuenta(s) marcada(s) para esta reserva.`}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Tarjeta de crédito (Bold)
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Pega el link de pago Bold de esta reserva. El cliente verá un botón
          “Pagar” en el check-in. Deja el link vacío para no mostrar esta opción.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://checkout.bold.co/payment/..."
            value={boldLink}
            onChange={(e) => setBoldLink(e.target.value)}
            className="flex-1 rounded-xl h-10 text-sm"
          />
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={boldSurcharge}
              onChange={(e) => setBoldSurcharge(e.target.value)}
              className="w-20 rounded-xl h-10 text-sm"
            />
            <span className="text-xs font-semibold text-muted-foreground">
              % recargo
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/80 p-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Enviar al cliente
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "rounded-xl h-10 text-xs font-semibold flex-1 min-w-[130px]",
              linkCopied &&
                "border-foreground bg-muted text-foreground",
            )}
            onClick={() => void handleCopyLink()}
            disabled={isCopyingLink}
          >
            {isCopyingLink ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : linkCopied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Link copiado
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Copiar link check-in
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "rounded-xl h-10 text-xs font-semibold flex-1 min-w-[130px]",
              messageCopied &&
                "border-foreground bg-muted text-foreground",
            )}
            onClick={() => void handleCopyMessage()}
            disabled={isCopyingMessage}
          >
            {isCopyingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : messageCopied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copiar mensaje
              </>
            )}
          </Button>
          <Button
            type="button"
            className="rounded-xl h-10 text-xs font-semibold flex-1 min-w-[140px] bg-foreground hover:bg-foreground/90 text-background"
            onClick={() => void handleShareWhatsApp()}
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
            Abrir WhatsApp
          </Button>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/60">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Permitir subir soportes de pago
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {uploadEnabled
                  ? "El cliente ve y carga comprobantes en el check-in / portal."
                  : "Apagado: WhatsApp (sigue viendo soportes ya cargados)."}
              </p>
            </div>
            <Switch
              checked={uploadEnabled}
              onCheckedChange={(v) => void handleToggleUpload(v)}
              disabled={savingUploadToggle}
              className="shrink-0"
            />
          </label>

          {portalReceipts.length > 0 ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Soportes del cliente ({pendingReceipts.length} pendiente
                {pendingReceipts.length === 1 ? "" : "s"})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {portalReceipts.map((r) => (
                  <a
                    key={r.id}
                    href={r.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-border overflow-hidden bg-background hover:border-foreground/40 transition-colors"
                  >
                    <img
                      src={r.receiptUrl}
                      alt={r.fileName || "Comprobante"}
                      className="w-full aspect-4/3 object-cover"
                    />
                    <div className="px-2 py-1.5 space-y-0.5">
                      <p className="text-[10px] font-bold truncate">
                        {r.bankName || "Pago"}
                        {r.amount ? ` · ${fmtCOP(r.amount)}` : ""}
                      </p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] capitalize",
                          r.status === "pending" &&
                            "bg-muted text-muted-foreground",
                          r.status === "approved" && "bg-muted text-foreground",
                        )}
                      >
                        {r.status === "pending" ? "En revisión" : r.status}
                      </Badge>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Aún no hay soportes cargados por el cliente.
            </p>
          )}
        </div>

      <BankAccountDialog
        open={bankDialogOpen}
        onClose={closeBankDialog}
        initial={editingBank}
        prefill={accountPrefill}
        lockHolderFields={Boolean(accountPrefill?.ownerName?.trim() && !editingBank)}
        knownHolders={[...ownerHolders, ...empresaHolders].map((h) => ({
          name: h.name,
          cedula: h.cedula || undefined,
        }))}
        onSave={handleSaveAccount}
      />
    </div>
  );
}
