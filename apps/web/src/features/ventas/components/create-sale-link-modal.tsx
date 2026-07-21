"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInCalendarDays, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Check, Home, Loader2, Plus, Link2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  SaleLinkCheckinOptions,
} from "./sale-link-checkin-options";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatPriceInput, parseCOP } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProperties,
  useCalculateStayPrice,
  usePropertyOwnerInfo,
  useUpdatePropertyOwnerInfo,
} from "@/features/fincas/queries/fincas.queries";
import type {
  OwnerBankAccount,
  PropertyOwnerInfo,
} from "@/features/fincas/types/fincas.types";
import {
  groupAccountsByHolder,
  type CheckinBankAccount,
  type PaymentHolder,
} from "@/features/checkin/utils/payment-holders";
import {
  getBankAccountImages,
  syncContractSettingsNow,
  useContractSettingsStore,
  type BankAccount,
} from "@/features/admin/store/contract-settings.store";
import { BankAccountDialog } from "@/features/admin/components/contracts/bank-account-dialog";
import { ContractCodeSellerButtons } from "@/features/admin/components/contracts/contract-code-seller-buttons";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";
import { splitGlobalHolders } from "../utils/payment-holder-groups";
import { createSaleLink } from "../api/sale-links.api";
import { propertyMatchesSearchQuery } from "@/lib/property/property-search";

type BankDialogTarget = "fincasya" | "hernan" | "owner" | "other";

const schema = z
  .object({
    propertyId: z.string().min(1, "Selecciona una finca"),
    contractCode: z
      .string()
      .trim()
      .min(2, "Ingresa la codificación (CR / contrato)")
      .max(32, "Máximo 32 caracteres"),
    checkIn: z.date({ error: "Selecciona fecha de entrada" }).optional(),
    checkOut: z.date({ error: "Selecciona fecha de salida" }).optional(),
    checkInTime: z.string(),
    checkOutTime: z.string(),
    guests: z.number().min(1, "Mínimo 1 persona"),
    totalValue: z.number().min(1, "Ingresa el valor total"),
    rentalValue: z.number().min(0),
    depositAmount: z.number().min(0),
    cleaningFee: z.number().min(0),
    petDeposit: z.number().min(0),
    petSurcharge: z.number().min(0),
    petCount: z.number().min(0),
    /** Abono que el cliente debe pagar (editable). */
    advancePaymentAmount: z.number().min(0, "Ingresa el abono"),
    boldSurchargePercent: z.number().min(0).max(30),
    generateBoldLink: z.boolean(),
    selectedBankAccountIds: z.array(z.string()),
    notes: z.string(),
    checkinClientPaymentProofUploadEnabled: z.boolean(),
    checkinGuestListUnlocked: z.boolean(),
    checkinOwnerShareGuestList: z.boolean(),
    /** Id del firmante del catálogo (vacío = sin firma en el contrato). */
    firmanteId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.checkIn) {
      ctx.addIssue({
        code: "custom",
        message: "Selecciona fecha de entrada",
        path: ["checkIn"],
      });
    }
    if (!data.checkOut) {
      ctx.addIssue({
        code: "custom",
        message: "Selecciona fecha de salida",
        path: ["checkOut"],
      });
    }
    if (data.totalValue > 0 && data.advancePaymentAmount < 1000) {
      ctx.addIssue({
        code: "custom",
        message: "El abono mínimo es $1.000",
        path: ["advancePaymentAmount"],
      });
    }
    if (data.advancePaymentAmount > data.totalValue && data.totalValue > 0) {
      ctx.addIssue({
        code: "custom",
        message: "El abono no puede superar el valor total",
        path: ["advancePaymentAmount"],
      });
    }
    // Con Bold basta el link; sin Bold hace falta al menos una cuenta para transferencia.
    if (
      !data.generateBoldLink &&
      data.selectedBankAccountIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Selecciona al menos una cuenta bancaria (o activa Bold)",
        path: ["selectedBankAccountIds"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const OWNER_ACCOUNT_PREFIX = "owner:";

const DEFAULT_VALUES: FormValues = {
  propertyId: "",
  contractCode: "",
  checkInTime: "10:00",
  checkOutTime: "16:00",
  guests: 1,
  totalValue: 0,
  rentalValue: 0,
  depositAmount: 0,
  cleaningFee: 0,
  petDeposit: 0,
  petSurcharge: 0,
  petCount: 0,
  advancePaymentAmount: 0,
  boldSurchargePercent: 0,
  generateBoldLink: true,
  selectedBankAccountIds: [],
  notes: "",
  checkinClientPaymentProofUploadEnabled: true,
  checkinGuestListUnlocked: false,
  checkinOwnerShareGuestList: true,
  firmanteId: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /** `inbox` = tema oscuro WhatsApp, más compacto (desde admin/inbox). */
  variant?: "admin" | "inbox";
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

function parseMoneyLabel(value?: string): number {
  if (!value) return 0;
  return parseInt(String(value).replace(/\D/g, ""), 10) || 0;
}

function buildOwnerBankAccounts(
  ownerInfo: PropertyOwnerInfo,
): CheckinBankAccount[] {
  const propietarioNombre = ownerInfo.propietarioNombre?.trim() ?? "";
  const propietarioCedula = ownerInfo.propietarioCedula?.trim() ?? "";

  const rows = ownerInfo.bankAccounts?.length
    ? ownerInfo.bankAccounts
    : ownerInfo.bankName || ownerInfo.accountNumber
      ? [
          {
            id: "primary",
            bankName: ownerInfo.bankName,
            accountNumber: ownerInfo.accountNumber,
            accountType: "",
            accountHolderName: propietarioNombre,
          },
        ]
      : [];

  return rows
    .filter((row) => row.bankName?.trim() || row.accountNumber?.trim())
    .map((row) => ({
      id: `${OWNER_ACCOUNT_PREFIX}${row.id}`,
      bankName: String(row.bankName ?? "").trim(),
      accountType: String(row.accountType ?? "Ahorros").trim() || "Ahorros",
      accountNumber: String(row.accountNumber ?? "").trim(),
      ownerName:
        String(row.accountHolderName ?? "").trim() || propietarioNombre,
      ownerCedula: propietarioCedula,
      imageUrl: null,
      imageUrls: [],
    }));
}

function holderCheckState(
  accountIds: string[],
  selectedAccountIds: string[],
): boolean | "indeterminate" {
  const selected = accountIds.filter((id) => selectedAccountIds.includes(id));
  if (selected.length === 0) return false;
  if (selected.length === accountIds.length) return true;
  return "indeterminate";
}

function PaymentHoldersAccordion({
  holders,
  sectionPrefix,
  selectedBankIds,
  globalAccountImages,
  onToggleAccount,
  onToggleHolder,
}: {
  holders: PaymentHolder[];
  sectionPrefix: string;
  selectedBankIds: string[];
  globalAccountImages?: Map<string, string>;
  onToggleAccount: (id: string, checked: boolean) => void;
  onToggleHolder: (holderId: string, checked: boolean) => void;
}) {
  const defaultOpen = useMemo(() => {
    const withSelection = holders
      .filter((holder) =>
        holder.accounts.some((account) =>
          selectedBankIds.includes(account.id),
        ),
      )
      .map((holder) => `${sectionPrefix}-${holder.id}`);
    if (withSelection.length > 0) return withSelection;
    return holders.slice(0, 1).map((holder) => `${sectionPrefix}-${holder.id}`);
  }, [holders, selectedBankIds, sectionPrefix]);

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
        const holderChecked = holderCheckState(accountIds, selectedBankIds);
        const selectedCount = accountIds.filter((id) =>
          selectedBankIds.includes(id),
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
                id={`sale-holder-${accordionValue}`}
                checked={holderChecked}
                onCheckedChange={(value) =>
                  onToggleHolder(holder.id, value === true)
                }
                onClick={(event) => event.stopPropagation()}
                className="mt-2.5"
              />
              <AccordionTrigger className="flex-1 py-2 hover:no-underline [&>svg]:text-emerald-700">
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
              <div className="ml-3 space-y-2 border-l-2 border-emerald-500/25 pl-3">
                {holder.accounts.map((account) => {
                  const checked = selectedBankIds.includes(account.id);
                  const previewImage = globalAccountImages?.get(account.id);
                  const extra = account as CheckinBankAccount & {
                    qrOnly?: boolean;
                    brebKey?: boolean;
                  };

                  return (
                    <div
                      key={account.id}
                      className={cn(
                        "flex min-w-0 items-start gap-3 rounded-xl border border-border p-3 transition-colors",
                        checked
                          ? "border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20"
                          : "border-border/50 bg-background/60",
                      )}
                    >
                      <Checkbox
                        id={`sale-acc-${account.id}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          onToggleAccount(account.id, value === true)
                        }
                        className="mt-2"
                      />
                      {previewImage ? (
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                          <img
                            src={previewImage}
                            alt={`QR ${account.bankName}`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <BankLogoBadge bankName={account.bankName} />
                      )}
                      <Label
                        htmlFor={`sale-acc-${account.id}`}
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
                          {previewImage ? (
                            <Badge variant="secondary" className="text-[9px]">
                              QR
                            </Badge>
                          ) : null}
                          {extra.qrOnly ? (
                            <Badge variant="secondary" className="text-[9px]">
                              Solo QR
                            </Badge>
                          ) : null}
                          {extra.brebKey ? (
                            <Badge variant="secondary" className="text-[9px]">
                              Bre-B
                            </Badge>
                          ) : null}
                        </div>
                        <p className="font-mono text-xs text-foreground">
                          {extra.qrOnly || !account.accountNumber?.trim()
                            ? account.accountNumber?.trim() || "Solo QR"
                            : account.accountNumber}
                        </p>
                      </Label>
                    </div>
                  );
                })}
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
  selectedBankIds,
  globalAccountImages,
  onToggleAccount,
  onToggleHolder,
  onAddAccount,
  addLabel,
  emptyHint,
  headerExtra,
}: {
  title: string;
  description?: string;
  badge?: string;
  holders: PaymentHolder[];
  sectionPrefix: string;
  selectedBankIds: string[];
  globalAccountImages?: Map<string, string>;
  onToggleAccount: (id: string, checked: boolean) => void;
  onToggleHolder: (holderId: string, checked: boolean) => void;
  onAddAccount?: () => void;
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
          selectedBankIds={selectedBankIds}
          globalAccountImages={globalAccountImages}
          onToggleAccount={onToggleAccount}
          onToggleHolder={onToggleHolder}
        />
      ) : emptyHint ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : null}
    </div>
  );
}

export function CreateSaleLinkModal({
  open,
  onOpenChange,
  onCreated,
  variant = "admin",
}: Props) {
  const isInbox = variant === "inbox";
  const [propertySearch, setPropertySearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankDialogTarget, setBankDialogTarget] =
    useState<BankDialogTarget>("fincasya");

  const { data: propertiesData, isLoading: isLoadingProperties } =
    useProperties({ limit: 200 });
  const bankAccounts = useContractSettingsStore((s) => s.bankAccounts);
  const firmantes = useContractSettingsStore((s) => s.firmantes);
  const addBankAccount = useContractSettingsStore((s) => s.addBankAccount);
  const adminSettings = useContractSettingsStore((s) => s.adminSettings);
  const updateOwnerInfo = useUpdatePropertyOwnerInfo();
  const lastPropertyIdRef = useRef<string>("");
  const [advanceManual, setAdvanceManual] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  const checkIn = form.watch("checkIn");
  const checkOut = form.watch("checkOut");
  const rentalValue = form.watch("rentalValue");
  const depositAmount = form.watch("depositAmount");
  const cleaningFee = form.watch("cleaningFee");
  const petSurcharge = form.watch("petSurcharge");
  const petDeposit = form.watch("petDeposit");
  const petCount = form.watch("petCount");
  const guests = form.watch("guests");
  const selectedPropertyId = form.watch("propertyId");
  const selectedBankIds = form.watch("selectedBankAccountIds");
  const totalValue = form.watch("totalValue");
  const advancePaymentAmount = form.watch("advancePaymentAmount");
  const boldSurchargePercent = form.watch("boldSurchargePercent");
  const generateBoldLink = form.watch("generateBoldLink");
  const selectedFirmanteId = form.watch("firmanteId");

  const selectedFirmante = useMemo(
    () =>
      selectedFirmanteId
        ? (firmantes.find((f) => f.id === selectedFirmanteId) ?? null)
        : null,
    [firmantes, selectedFirmanteId],
  );

  useEffect(() => {
    if (open) {
      lastPropertyIdRef.current = "";
      setAdvanceManual(false);
      form.reset(DEFAULT_VALUES);
      setPropertySearch("");
      // Prefiere el firmante marcado como default (si tiene imagen).
      const def = useContractSettingsStore
        .getState()
        .firmantes.find((f) => f.esDefault && f.firmaUrl);
      if (def) {
        form.setValue("firmanteId", def.id);
      }
    }
  }, [open, form]);

  const { data: ownerInfo } = usePropertyOwnerInfo(selectedPropertyId);

  const checkInStr = checkIn ? format(checkIn, "yyyy-MM-dd") : "";
  const checkOutStr = checkOut ? format(checkOut, "yyyy-MM-dd") : "";

  const { data: stayPriceData, isFetching: isFetchingPrice } =
    useCalculateStayPrice(
      selectedPropertyId,
      checkInStr,
      checkOutStr,
      guests < 1 ? 1 : guests,
      petCount,
    );

  const selectedProperty = useMemo(
    () => propertiesData?.properties?.find((p) => p.id === selectedPropertyId),
    [propertiesData?.properties, selectedPropertyId],
  );

  const filteredProperties = useMemo(() => {
    const list = propertiesData?.properties ?? [];
    if (!propertySearch.trim()) return list;
    return list.filter((p) =>
      propertyMatchesSearchQuery(
        { title: p.title ?? "", code: p.code },
        propertySearch,
        ["title", "code"],
      ),
    );
  }, [propertiesData?.properties, propertySearch]);

  const globalBankAccounts = useMemo(
    () =>
      bankAccounts.map((account) => ({
        id: account.id,
        bankName: account.bankName,
        accountType: account.accountType,
        accountNumber: account.accountNumber,
        ownerName: account.ownerName,
        ownerCedula: account.ownerCedula,
        imageUrl: getBankAccountImages(account)[0] ?? null,
        imageUrls: getBankAccountImages(account),
        qrOnly: account.qrOnly,
        brebKey: account.brebKey,
      })),
    [bankAccounts],
  );

  const ownerBankAccounts = useMemo(
    () => (ownerInfo ? buildOwnerBankAccounts(ownerInfo) : []),
    [ownerInfo],
  );

  const globalHolders = useMemo(
    () => groupAccountsByHolder(globalBankAccounts),
    [globalBankAccounts],
  );

  const { fincasya: fincasyaHolders, hernan: hernanHolders, other: otherHolders } =
    useMemo(() => splitGlobalHolders(globalHolders), [globalHolders]);

  // Misma empresa: Angela y Hernán son titulares del catálogo empresa (no
  // bloques separados — las cuentas de Hernán = cuentas de la empresa).
  const empresaHolders = useMemo(
    () =>
      [...fincasyaHolders, ...hernanHolders].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
    [fincasyaHolders, hernanHolders],
  );

  const ownerHolders = useMemo(
    () => groupAccountsByHolder(ownerBankAccounts),
    [ownerBankAccounts],
  );

  const globalAccountImages = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of bankAccounts) {
      map.set(account.id, getBankAccountImages(account)[0] ?? "");
    }
    return map;
  }, [bankAccounts]);

  const nights =
    checkIn && checkOut
      ? Math.max(0, differenceInCalendarDays(checkOut, checkIn))
      : 0;

  // Al seleccionar finca: aseo y depósito desde la propiedad (o defaults globales)
  useEffect(() => {
    if (!selectedPropertyId || !selectedProperty) return;

    const propertyChanged = lastPropertyIdRef.current !== selectedPropertyId;
    lastPropertyIdRef.current = selectedPropertyId;

    const cleaningFromProp = Number(selectedProperty.depositoAseo ?? 0);
    const depositFromProp = Number(
      selectedProperty.depositoDanosReembolsable ?? 0,
    );

    const cleaning =
      cleaningFromProp > 0
        ? cleaningFromProp
        : parseMoneyLabel(adminSettings.cleaningFee) || 100_000;

    const deposit =
      depositFromProp > 0
        ? depositFromProp
        : parseMoneyLabel(adminSettings.securityDeposit) || 200_000;

    form.setValue("cleaningFee", cleaning);
    form.setValue("depositAmount", deposit);

    if (propertyChanged) {
      form.setValue("rentalValue", 0);
      form.setValue("petDeposit", 0);
      form.setValue("petSurcharge", 0);
      form.setValue("petCount", 0);
    }
  }, [selectedPropertyId, selectedProperty, adminSettings, form]);

  // Alquiler y mascotas según fechas + API de precios
  useEffect(() => {
    if (!selectedPropertyId || nights <= 0) return;

    const apiSubtotal = Number(stayPriceData?.subtotal ?? 0);
    const nightly = Number(selectedProperty?.priceBase ?? 0);

    if (apiSubtotal > 0) {
      form.setValue("rentalValue", apiSubtotal);
    } else if (nightly > 0) {
      form.setValue("rentalValue", nightly * nights);
    }

    const pets = stayPriceData?.pets;
    if (petCount > 0) {
      const refundable = Number(pets?.refundable ?? 0);
      const serviceFee = Number(pets?.serviceFee ?? 0);
      const petCleaning = Number(pets?.cleaningFee ?? 0);

      // Regla unificada 21-jul: depósito $100.000 POR CADA mascota; ingreso
      // $30.000 desde la 2ª + aseo $70.000 con 2+.
      form.setValue(
        "petDeposit",
        refundable > 0 ? refundable : petCount * 100_000,
      );
      form.setValue(
        "petSurcharge",
        serviceFee + petCleaning > 0
          ? serviceFee + petCleaning
          : Math.max(0, petCount - 1) * 30_000 + (petCount >= 2 ? 70_000 : 0),
      );
    } else {
      form.setValue("petDeposit", 0);
      form.setValue("petSurcharge", 0);
    }
  }, [
    selectedPropertyId,
    selectedProperty,
    nights,
    stayPriceData,
    petCount,
    form,
  ]);

  // Total = alquiler + limpieza + depósito + mascotas
  useEffect(() => {
    const total =
      (rentalValue || 0) +
      (depositAmount || 0) +
      (cleaningFee || 0) +
      (petSurcharge || 0) +
      (petDeposit || 0);
    form.setValue("totalValue", total);
  }, [rentalValue, depositAmount, cleaningFee, petSurcharge, petDeposit, form]);

  // Abono por defecto = 50% del total, hasta que el asesor lo edite a mano.
  useEffect(() => {
    if (advanceManual) return;
    const half = Math.round((totalValue || 0) / 2);
    form.setValue("advancePaymentAmount", half > 0 ? half : 0);
  }, [totalValue, advanceManual, form]);

  const boldChargeAmount = useMemo(() => {
    const base = Math.max(0, advancePaymentAmount || 0);
    const pct = Math.max(0, boldSurchargePercent || 0);
    return Math.round(base * (1 + pct / 100));
  }, [advancePaymentAmount, boldSurchargePercent]);

  const advancePercent =
    totalValue > 0
      ? Math.round(((advancePaymentAmount || 0) / totalValue) * 100)
      : 0;

  const onSubmit = async (values: FormValues) => {
    const { checkIn: inDate, checkOut: outDate } = values;
    if (!inDate || !outDate) return;

    setSubmitting(true);
    try {
      const result = await createSaleLink({
        propertyId: values.propertyId,
        contractCode: values.contractCode.trim().toUpperCase(),
        checkIn: inDate.getTime(),
        checkOut: outDate.getTime(),
        nights,
        guests: Math.max(1, values.guests),
        checkInTime: values.checkInTime || undefined,
        checkOutTime: values.checkOutTime || undefined,
        totalValue: values.totalValue,
        rentalValue: values.rentalValue,
        depositAmount: values.depositAmount,
        cleaningFee: values.cleaningFee,
        petDeposit: values.petDeposit || undefined,
        petSurcharge: values.petSurcharge || undefined,
        petCount: values.petCount || undefined,
        advancePaymentAmount: values.advancePaymentAmount,
        boldSurchargePercent: values.boldSurchargePercent || undefined,
        generateBoldLink: values.generateBoldLink,
        portalOrigin: window.location.origin,
        selectedBankAccountIds: values.selectedBankAccountIds,
        notes: values.notes || undefined,
        checkinClientPaymentProofUploadEnabled:
          values.checkinClientPaymentProofUploadEnabled,
        checkinGuestListUnlocked: values.checkinGuestListUnlocked,
        checkinOwnerShareGuestList: values.checkinOwnerShareGuestList,
        firmanteId: selectedFirmante?.id,
        firmaArrendadorUrl: selectedFirmante?.firmaUrl || undefined,
      });

      const saleUrl = `${window.location.origin}/venta/${result.token}`;
      await navigator.clipboard.writeText(saleUrl).catch(() => {});

      if (result.boldPaymentUrl) {
        toast.success(
          `Link de venta copiado. Bold listo por ${formatCOP(result.boldPaymentAmount ?? boldChargeAmount)}.`,
          { duration: 6000 },
        );
      } else if (result.boldError) {
        toast.warning(
          `Link de venta creado. Bold no se generó: ${result.boldError}`,
          { duration: 8000 },
        );
      } else {
        toast.success("¡Link de venta creado y copiado!");
      }

      form.reset(DEFAULT_VALUES);
      setAdvanceManual(false);
      setPropertySearch("");
      onCreated();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })
          ?.response?.data?.error ??
        (err instanceof Error ? err.message : null) ??
        "Error al crear el link";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBankAccount = (id: string, checked: boolean) => {
    const current = form.getValues("selectedBankAccountIds");
    if (checked) {
      form.setValue("selectedBankAccountIds", [...new Set([...current, id])]);
      return;
    }
    form.setValue(
      "selectedBankAccountIds",
      current.filter((x) => x !== id),
    );
  };

  const toggleHolderAccounts = (
    holders: PaymentHolder[],
    holderId: string,
    checked: boolean,
  ) => {
    const holder = holders.find((item) => item.id === holderId);
    if (!holder) return;
    const ids = holder.accounts.map((account) => account.id);
    const current = form.getValues("selectedBankAccountIds");
    form.setValue(
      "selectedBankAccountIds",
      checked
        ? [...new Set([...current, ...ids])]
        : current.filter((id) => !ids.includes(id)),
    );
  };

  const bankDialogPrefill = useMemo(() => {
    if (bankDialogTarget === "owner") {
      return {
        ownerName: ownerInfo?.propietarioNombre?.trim() ?? "",
        ownerCedula: ownerInfo?.propietarioCedula?.trim() ?? "",
      };
    }
    if (bankDialogTarget === "hernan") {
      const holder = hernanHolders[0];
      return holder
        ? { ownerName: holder.name, ownerCedula: holder.cedula }
        : { ownerName: "Hernán Aguilera Gomez" };
    }
    if (bankDialogTarget === "fincasya") {
      const holder = fincasyaHolders[0];
      return holder
        ? { ownerName: holder.name, ownerCedula: holder.cedula }
        : { ownerName: "Angela María Campos Galeano" };
    }
    return null;
  }, [bankDialogTarget, ownerInfo, fincasyaHolders, hernanHolders]);

  const openBankDialog = (target: BankDialogTarget) => {
    setBankDialogTarget(target);
    setBankDialogOpen(true);
  };

  const closeBankDialog = () => {
    setBankDialogOpen(false);
  };

  const handleSaveOwnerBankAccount = async (data: Omit<BankAccount, "id">) => {
    if (!selectedPropertyId) {
      toast.error("Selecciona una finca primero");
      return;
    }

    const newAccount: OwnerBankAccount = {
      id: crypto.randomUUID(),
      bankName: data.bankName.trim(),
      accountNumber: data.accountNumber.trim(),
      ...(data.accountType?.trim()
        ? { accountType: data.accountType.trim() }
        : {}),
      ...(data.ownerName?.trim()
        ? { accountHolderName: data.ownerName.trim() }
        : {}),
    };

    const existingAccounts = (ownerInfo?.bankAccounts ?? [])
      .map((account) => ({
        id: account.id,
        bankName: account.bankName.trim(),
        accountNumber: account.accountNumber.trim(),
        ...(account.accountType?.trim()
          ? { accountType: account.accountType.trim() }
          : {}),
        ...(account.accountHolderName?.trim()
          ? { accountHolderName: account.accountHolderName.trim() }
          : {}),
      }))
      .filter(
        (account) => account.bankName.length > 0 || account.accountNumber.length > 0,
      );

    const primaryBank = existingAccounts[0] ?? newAccount;

    try {
      await updateOwnerInfo.mutateAsync({
        id: selectedPropertyId,
        payload: {
          ownerUserId: ownerInfo?.ownerUserId ?? "",
          rutNumber: ownerInfo?.rutNumber ?? "",
          bankName: primaryBank.bankName,
          accountNumber: primaryBank.accountNumber,
          bankAccounts: [...existingAccounts, newAccount],
          rntNumber: ownerInfo?.rntNumber ?? "",
          propietarioNombre: ownerInfo?.propietarioNombre ?? "",
          propietarioTratamiento: ownerInfo?.propietarioTratamiento ?? "",
          propietarioTelefono: ownerInfo?.propietarioTelefono ?? "",
          propietarioCedula: ownerInfo?.propietarioCedula ?? "",
          propietarioCorreo: ownerInfo?.propietarioCorreo ?? "",
          checkinUbicacionUrl: ownerInfo?.checkinUbicacionUrl ?? "",
          checkinWazeUrl: ownerInfo?.checkinWazeUrl ?? "",
          checkinIndicacionesLlegada: ownerInfo?.checkinIndicacionesLlegada ?? "",
          checkinRecomendaciones: ownerInfo?.checkinRecomendaciones ?? "",
        },
      });
      toggleBankAccount(`${OWNER_ACCOUNT_PREFIX}${newAccount.id}`, true);
      closeBankDialog();
      toast.success("Cuenta del propietario agregada");
    } catch {
      toast.error("No se pudo guardar la cuenta del propietario");
    }
  };

  const handleSaveEmpresaBankAccount = async (data: Omit<BankAccount, "id">) => {
    const payload =
      bankDialogPrefill?.ownerName?.trim()
        ? {
            ...data,
            ownerName: bankDialogPrefill.ownerName.trim(),
            ownerCedula: (bankDialogPrefill.ownerCedula ?? data.ownerCedula).trim(),
          }
        : data;

    const beforeIds = new Set(
      useContractSettingsStore.getState().bankAccounts.map((account) => account.id),
    );
    addBankAccount(payload);

    try {
      await syncContractSettingsNow();
    } catch {
      // La cuenta queda en el store local aunque falle la sincronización remota.
    }

    const created = useContractSettingsStore
      .getState()
      .bankAccounts.find((account) => !beforeIds.has(account.id));

    if (created) {
      toggleBankAccount(created.id, true);
    }

    closeBankDialog();
    toast.success("Cuenta agregada al catálogo empresa");
  };

  const handleBankDialogSave = (data: Omit<BankAccount, "id">) => {
    if (bankDialogTarget === "owner") {
      void handleSaveOwnerBankAccount(data);
      return;
    }
    void handleSaveEmpresaBankAccount(data);
  };

  const hasAnyBankHolders =
    empresaHolders.length > 0 ||
    otherHolders.length > 0 ||
    ownerHolders.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(92vh,820px)] w-[min(96vw,44rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
            isInbox
              ? "inbox z-100 border-border bg-card text-foreground shadow-md"
              : "border-border bg-background shadow-md",
          )}
        >
        <DialogHeader
          className={cn(
            "shrink-0 space-y-1 border-b border-border px-5 py-4 text-left sm:px-6",
            isInbox ? "bg-card" : "bg-background",
          )}
        >
          <DialogTitle className="text-base font-semibold tracking-tight">
            Crear link de venta
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            El cliente completa datos, ve el abono acordado y puede pagar por
            transferencia o Bold.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="scrollbar-hide min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6">
            {/* Finca — mismo patrón que contrato */}
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Finca *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger className="group h-auto! min-h-12 w-full whitespace-normal rounded-xl border border-border bg-background py-2 pl-2.5 pr-9 text-left **:data-[slot=select-value]:line-clamp-none **:data-[slot=select-value]:items-start **:data-[slot=select-value]:whitespace-normal">
                        <div className="flex min-h-0 w-full min-w-0 items-center gap-2.5 text-left">
                          {selectedProperty ? (
                            <>
                              <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border">
                                {selectedProperty.images?.[0] ? (
                                  <img
                                    src={selectedProperty.images[0]}
                                    alt={selectedProperty.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-muted">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
                                <span className="line-clamp-1 text-left text-sm font-bold leading-snug">
                                  {selectedProperty.title}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  {selectedProperty.code || "Sin código"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <SelectValue placeholder="Selecciona una finca..." />
                          )}
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      position="popper"
                      sideOffset={4}
                      className={cn(
                        "z-200 w-(--radix-select-trigger-width) overflow-hidden rounded-xl p-2",
                        isInbox &&
                          "inbox min-h-0! max-h-[min(16rem,var(--radix-select-content-available-height))] border-border bg-card text-foreground",
                      )}
                    >
                      <div className="sticky top-0 z-10 mb-2 border-b border-border bg-popover p-2">
                        <Input
                          placeholder="Buscar fincas por nombre o código..."
                          value={propertySearch}
                          onChange={(e) => setPropertySearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="max-h-[240px] space-y-1 overflow-y-auto">
                        {isLoadingProperties ? (
                          <div className="flex flex-col items-center gap-2 p-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Cargando inventario...
                            </span>
                          </div>
                        ) : filteredProperties.length === 0 ? (
                          <div className="p-6 text-center text-xs text-muted-foreground">
                            No se encontraron fincas.
                          </div>
                        ) : (
                          filteredProperties.map((property) => (
                            <SelectItem
                              key={property.id}
                              value={property.id}
                              className="cursor-pointer rounded-lg py-2.5 pl-2 pr-8"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border">
                                  {property.images?.[0] ? (
                                    <img
                                      src={property.images[0]}
                                      alt={property.title}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-muted">
                                      <Home className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  <span className="line-clamp-2 font-semibold leading-snug">
                                    {property.title}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {property.code || "Sin código"}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contractCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Codificación (CR / contrato) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: CR 291, CRA 12"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                      className="font-semibold tracking-wide"
                    />
                  </FormControl>
                  <ContractCodeSellerButtons
                    onAssign={(code) => field.onChange(code)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Usa las iniciales del vendedor para el siguiente número, o
                    escríbelo a mano. Este código va en el contrato, la CR y la
                    reserva.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="checkIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Check-in *</FormLabel>
                    <Popover modal>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-9 w-full justify-start rounded-md border border-border bg-background px-3 text-left text-sm font-normal shadow-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:border-ring data-[state=open]:bg-background",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4 shrink-0 opacity-50" />
                            <span className="truncate">
                              {field.value
                                ? format(field.value, "d MMM yyyy", { locale: es })
                                : "Seleccionar"}
                            </span>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className={cn(
                          "z-200 h-fit w-auto overflow-hidden rounded-xl border border-border p-0 shadow-xl",
                          isInbox
                            ? "inbox min-h-0! h-fit! bg-popover text-popover-foreground"
                            : "bg-popover text-popover-foreground",
                        )}
                        align="start"
                        sideOffset={6}
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(d) => {
                            field.onChange(d);
                            if (d && checkOut && d >= checkOut) {
                              form.setValue("checkOut", addDays(d, 1));
                            }
                          }}
                          disabled={(date) => date < startOfDay(new Date())}
                          locale={es}
                          initialFocus
                          className="rounded-xl bg-transparent"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Check-out *</FormLabel>
                    <Popover modal>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-9 w-full justify-start rounded-md border border-border bg-background px-3 text-left text-sm font-normal shadow-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:border-ring data-[state=open]:bg-background",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4 shrink-0 opacity-50" />
                            <span className="truncate">
                              {field.value
                                ? format(field.value, "d MMM yyyy", { locale: es })
                                : "Seleccionar"}
                            </span>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className={cn(
                          "z-200 h-fit w-auto overflow-hidden rounded-xl border border-border p-0 shadow-xl",
                          isInbox
                            ? "inbox min-h-0! h-fit! bg-popover text-popover-foreground"
                            : "bg-popover text-popover-foreground",
                        )}
                        align="start"
                        sideOffset={6}
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            checkIn
                              ? date <= startOfDay(checkIn)
                              : date < startOfDay(new Date())
                          }
                          locale={es}
                          initialFocus
                          className="rounded-xl bg-transparent"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {nights > 0 && (
              <p className="-mt-2 text-xs text-muted-foreground">{nights} noches</p>
            )}

            {/* Horas + Personas */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="checkInTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Hora entrada</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checkOutTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Hora salida</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Personas *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={field.value < 1 ? "" : String(field.value)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          field.onChange(digits === "" ? 0 : Number(digits));
                        }}
                        onBlur={() => {
                          if (form.getValues("guests") < 1) {
                            form.setValue("guests", 1);
                          }
                          field.onBlur();
                        }}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Valores */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Desglose de valores</p>
                {isFetchingPrice && selectedPropertyId && nights > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Calculando precios...
                  </span>
                )}
              </div>
              {selectedPropertyId && nights > 0 && (
                <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {nights} {nights === 1 ? "noche" : "noches"}
                  {selectedProperty?.priceBase
                    ? ` · base ${formatCOP(selectedProperty.priceBase)}/noche`
                    : ""}
                  {stayPriceData?.subtotal
                    ? ` · alquiler calculado: ${formatCOP(stayPriceData.subtotal)}`
                    : ""}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="petCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Núm. mascotas</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={field.value === 0 ? "" : String(field.value)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            field.onChange(digits === "" ? 0 : Number(digits));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {(
                  [
                    ["rentalValue", "Alquiler *"],
                    ["depositAmount", "Depósito garantía"],
                    ["cleaningFee", "Limpieza/aseo"],
                    ["petSurcharge", "Recargo mascotas"],
                    ["petDeposit", "Depósito mascotas"],
                  ] as const
                ).map(([name, label]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={formatPriceInput(field.value)}
                            onChange={(e) =>
                              field.onChange(parseCOP(e.target.value))
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        {name === "rentalValue" && nights > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            Alquiler por {nights}{" "}
                            {nights === 1 ? "noche" : "noches"}
                          </p>
                        )}
                        {name === "rentalValue" && <FormMessage />}
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <FormField
                control={form.control}
                name="totalValue"
                render={({ field }) => (
                  <FormItem className="mt-3">
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      Valor total
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-11 rounded-lg font-semibold"
                        value={formatPriceInput(field.value)}
                        onChange={(e) =>
                          field.onChange(parseCOP(e.target.value))
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    {field.value > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCOP(field.value)}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Abono + Bold */}
            <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Abono del cliente
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Define cuánto debe pagar ahora. No tiene que ser el 50%.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="advancePaymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Abono a pagar *</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-11 rounded-lg"
                          value={formatPriceInput(field.value)}
                          onChange={(e) => {
                            setAdvanceManual(true);
                            field.onChange(parseCOP(e.target.value));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {totalValue > 0
                          ? `${advancePercent}% del total · saldo ${formatCOP(Math.max(0, totalValue - (advancePaymentAmount || 0)))}`
                          : "Se sugiere 50% al calcular el total"}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="boldSurchargePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Recargo Bold (%)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-11 rounded-lg"
                          placeholder="0"
                          value={field.value === 0 ? "" : String(field.value)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.]/g, "");
                            field.onChange(raw === "" ? 0 : Number(raw));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Ej. 5 si cobras recargo por tarjeta
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="generateBoldLink"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 space-y-0 rounded-lg border border-border bg-background p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        className="mt-0.5"
                      />
                    </FormControl>
                    <div className="min-w-0 flex-1 space-y-1">
                      <FormLabel className="flex items-center gap-1.5 text-sm font-medium leading-none">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        Generar link Bold automáticamente
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {generateBoldLink
                          ? `Se creará un cobro Bold por ${formatCOP(boldChargeAmount)} al guardar.`
                          : "Solo se crea el link de venta (transferencia)."}
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {generateBoldLink && advancePaymentAmount > 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Bold cobrará{" "}
                    <span className="font-semibold text-foreground">
                      {formatCOP(boldChargeAmount)}
                    </span>
                    {boldSurchargePercent > 0
                      ? ` (abono + ${boldSurchargePercent}%)`
                      : ""}
                    . Requiere{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                      BOLD_IDENTIDAD_KEY
                    </code>
                    en Convex.
                  </span>
                </div>
              ) : null}
            </section>

            <Separator />

            {/* Opciones de check-in (mismas que al enviar /checkin) */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">
                  Check-in del cliente
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Qué ve el turista cuando llega al paso de check-in del link.
                </p>
              </div>
              <SaleLinkCheckinOptions
                value={{
                  checkinClientPaymentProofUploadEnabled:
                    form.watch("checkinClientPaymentProofUploadEnabled"),
                  checkinGuestListUnlocked: form.watch(
                    "checkinGuestListUnlocked",
                  ),
                  checkinOwnerShareGuestList: form.watch(
                    "checkinOwnerShareGuestList",
                  ),
                }}
                onChange={(next) => {
                  form.setValue(
                    "checkinClientPaymentProofUploadEnabled",
                    next.checkinClientPaymentProofUploadEnabled,
                  );
                  form.setValue(
                    "checkinGuestListUnlocked",
                    next.checkinGuestListUnlocked,
                  );
                  form.setValue(
                    "checkinOwnerShareGuestList",
                    next.checkinOwnerShareGuestList,
                  );
                }}
              />
            </section>

            <Separator />

            {/* Firma del arrendador */}
            <FormField
              control={form.control}
              name="firmanteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">
                    Firma en el contrato
                    <span className="ml-1 font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Se usa en la preview del cliente y al generar el contrato.
                    El catálogo se gestiona en Ajustes globales → Firmantes.
                  </p>
                  {firmantes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                      No hay firmantes. Cárgalos en Configuración → Contrato →
                      Firmantes. Puedes crear el link sin firma.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => field.onChange("")}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
                          !field.value
                            ? "border-primary/50 bg-primary/5"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                            !field.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {!field.value ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">Sin firma</p>
                          <p className="text-[11px] text-muted-foreground">
                            El contrato sale sin imagen sobre ARRENDADOR
                          </p>
                        </div>
                      </button>
                      {firmantes.map((f) => {
                        const on = field.value === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() =>
                              field.onChange(on ? "" : f.id)
                            }
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
                              on
                                ? "border-primary/50 bg-primary/5"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                                on
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {on ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold">
                                {f.nombre}
                                {f.esDefault ? (
                                  <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                                    · default
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {[
                                  f.cargo,
                                  f.cedula ? `C.C. ${f.cedula}` : "",
                                  f.ciudad,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Sin datos"}
                                {!f.firmaUrl ? " · sin imagen" : ""}
                              </p>
                            </div>
                            {f.firmaUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.firmaUrl}
                                alt={`Firma ${f.nombre}`}
                                className="h-10 w-16 shrink-0 rounded border border-border bg-white object-contain p-0.5"
                              />
                            ) : null}
                          </button>
                        );
                      })}
                      {selectedFirmante && !selectedFirmante.firmaUrl ? (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          Este firmante no tiene imagen de firma; el contrato
                          saldrá sin la firma del arrendador.
                        </p>
                      ) : null}
                    </div>
                  )}
                </FormItem>
              )}
            />

            <Separator />

            {/* Cuentas bancarias */}
            <FormField
              control={form.control}
              name="selectedBankAccountIds"
              render={() => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">
                    Cuentas bancarias para el pago
                    {generateBoldLink ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        (opcional con Bold)
                      </span>
                    ) : (
                      " *"
                    )}
                  </FormLabel>
                  {generateBoldLink ? (
                    <p className="text-xs text-muted-foreground">
                      Puedes crear el link solo con Bold, o sumar una o más
                      cuentas para transferencia.
                    </p>
                  ) : null}
                  {!hasAnyBankHolders && !selectedPropertyId ? (
                    <p className="text-sm text-muted-foreground">
                      Selecciona una finca o agrega cuentas en{" "}
                      <strong>Configuración → Contrato</strong>.
                    </p>
                  ) : (
                    <div className="scrollbar-hide max-h-52 space-y-3 overflow-x-hidden overflow-y-auto">
                      <HolderSection
                        title="Empresa"
                        description="Cuentas de FincasYa (Angela y Hernán — mismo catálogo empresa)"
                        badge="Empresa"
                        holders={empresaHolders}
                        sectionPrefix="empresa"
                        selectedBankIds={selectedBankIds}
                        globalAccountImages={globalAccountImages}
                        onToggleAccount={toggleBankAccount}
                        onToggleHolder={(holderId, checked) =>
                          toggleHolderAccounts(
                            empresaHolders,
                            holderId,
                            checked,
                          )
                        }
                        onAddAccount={
                          empresaHolders.length > 0
                            ? () => openBankDialog("fincasya")
                            : undefined
                        }
                        addLabel="Cuenta empresa"
                        emptyHint="Sin cuentas de empresa. Agrega una con el botón."
                        headerExtra={
                          empresaHolders.length === 0 ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-lg border-border/60 px-2 text-[10px] font-bold"
                                onClick={() => openBankDialog("fincasya")}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Cuenta empresa
                              </Button>
                            </div>
                          ) : undefined
                        }
                      />

                      {otherHolders.length > 0 ? (
                        <>
                          <Separator />
                          <HolderSection
                            title="Otros titulares"
                            description="Cuentas de empresa con otro titular"
                            holders={otherHolders}
                            sectionPrefix="other"
                            selectedBankIds={selectedBankIds}
                            globalAccountImages={globalAccountImages}
                            onToggleAccount={toggleBankAccount}
                            onToggleHolder={(holderId, checked) =>
                              toggleHolderAccounts(
                                otherHolders,
                                holderId,
                                checked,
                              )
                            }
                            onAddAccount={() => openBankDialog("other")}
                            addLabel="Nueva cuenta"
                          />
                        </>
                      ) : null}

                      {selectedPropertyId ? (
                        <>
                          <Separator />
                          <HolderSection
                            title="Propietario de la finca"
                            description={
                              ownerInfo?.propietarioNombre?.trim()
                                ? `Cuentas de ${ownerInfo.propietarioNombre.trim()}`
                                : "Cuentas del dueño de la propiedad seleccionada"
                            }
                            badge="Propietario"
                            holders={ownerHolders}
                            sectionPrefix="owner"
                            selectedBankIds={selectedBankIds}
                            onToggleAccount={toggleBankAccount}
                            onToggleHolder={(holderId, checked) =>
                              toggleHolderAccounts(
                                ownerHolders,
                                holderId,
                                checked,
                              )
                            }
                            onAddAccount={() => openBankDialog("owner")}
                            addLabel="Cuenta propietario"
                            emptyHint="Sin cuentas del propietario. Agrega una con el botón."
                          />
                        </>
                      ) : null}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Notas de negociación (internas)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles del acuerdo, descuentos aplicados, etc."
                      rows={2}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="min-h-16 resize-none text-sm"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            </div>

            <DialogFooter
              className={cn(
                "shrink-0 gap-2 border-t border-border px-5 py-4 sm:px-6",
                isInbox ? "bg-card" : "bg-background",
              )}
            >
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-lg"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando…
                  </>
                ) : generateBoldLink ? (
                  "Crear link + Bold"
                ) : (
                  "Crear y copiar link"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <BankAccountDialog
      open={bankDialogOpen}
      onClose={closeBankDialog}
      prefill={bankDialogPrefill}
      lockHolderFields={bankDialogTarget !== "other"}
      onSave={handleBankDialogSave}
      contentClassName={
        isInbox ? "inbox z-110 border-border bg-card text-foreground" : undefined
      }
    />
    </>
  );
}
