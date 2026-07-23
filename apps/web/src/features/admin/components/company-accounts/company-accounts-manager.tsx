"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ExternalLink,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";
import {
  groupAccountsByHolder,
  type CheckinBankAccount,
} from "@/features/checkin/utils/payment-holders";
import {
  isEmpresaAccount,
  splitGlobalHolders,
} from "@/features/checkin/utils/payment-holder-groups";
import {
  BankAccountDialog,
  type BankAccountPrefill,
} from "@/features/admin/components/contracts/bank-account-dialog";
import {
  type BankAccount,
  getBankAccountImages,
  syncContractSettingsNow,
  useContractSettingsStore,
} from "@/features/admin/store/contract-settings.store";

function toCheckinAccounts(accounts: BankAccount[]): CheckinBankAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    bankName: account.bankName,
    accountType: account.accountType ?? "",
    accountNumber: account.accountNumber ?? "",
    ownerName: account.ownerName ?? "",
    ownerCedula: account.ownerCedula ?? "",
    imageUrl: account.imageUrl ?? null,
    imageUrls: getBankAccountImages(account),
    qrOnly: account.qrOnly,
    brebKey: account.brebKey,
  }));
}

export function CompanyAccountsManager() {
  const {
    bankAccounts,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
  } = useContractSettingsStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [prefill, setPrefill] = useState<BankAccountPrefill | null>(null);
  const [lockHolder, setLockHolder] = useState(false);
  const [saving, setSaving] = useState(false);

  const empresaAccounts = useMemo(
    () => bankAccounts.filter(isEmpresaAccount),
    [bankAccounts],
  );

  const bankAccountById = useMemo(
    () => new Map(empresaAccounts.map((account) => [account.id, account])),
    [empresaAccounts],
  );

  const { fincasya, hernan } = useMemo(
    () =>
      splitGlobalHolders(groupAccountsByHolder(toCheckinAccounts(empresaAccounts))),
    [empresaAccounts],
  );

  const empresaHolders = useMemo(
    () =>
      [...fincasya, ...hernan].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
    [fincasya, hernan],
  );

  const openNew = (holderPrefill?: BankAccountPrefill) => {
    setEditing(null);
    setPrefill(holderPrefill ?? null);
    setLockHolder(Boolean(holderPrefill?.ownerName?.trim()));
    setDialogOpen(true);
  };

  const openEdit = (account: BankAccount) => {
    setEditing(account);
    setPrefill(null);
    setLockHolder(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setPrefill(null);
    setLockHolder(false);
  };

  const handleSave = async (data: Omit<BankAccount, "id">) => {
    const payload =
      prefill?.ownerName?.trim() && !editing
        ? {
            ...data,
            ownerName: prefill.ownerName.trim(),
            ownerCedula: (prefill.ownerCedula ?? data.ownerCedula).trim(),
          }
        : data;

    setSaving(true);
    try {
      if (editing) {
        updateBankAccount(editing.id, payload);
      } else {
        addBankAccount(payload);
      }
      await syncContractSettingsNow();
      toast.success(
        editing
          ? "Cuenta empresa actualizada"
          : "Cuenta empresa agregada al catálogo",
      );
      closeDialog();
    } catch {
      toast.error("No se pudo guardar en el servidor. Revisa la conexión.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (
      !window.confirm(
        "¿Eliminar esta cuenta del catálogo empresa? Dejará de aparecer en reservas, ventas y check-in.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      removeBankAccount(id);
      await syncContractSettingsNow();
      toast.success("Cuenta empresa eliminada");
    } catch {
      toast.error("No se pudo eliminar en el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Landmark className="h-5 w-5 text-primary" />
            </span>
            Cuentas empresa
          </h1>
          <p className="mt-1 ml-11 text-sm text-muted-foreground">
            Catálogo de FincasYa (Angela y Hernán). Lo que configures aquí sale
            en Pagos de reservas, links de venta y check-in — sin abrir una
            reserva.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 rounded-lg"
          onClick={() => openNew()}
          disabled={saving}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Cuenta empresa
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Empresa
              </p>
              <Badge
                variant="secondary"
                className="border border-border/60 text-[9px] font-semibold"
              >
                Empresa
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cuentas de FincasYa (Angela y Hernán — mismo catálogo empresa)
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {empresaAccounts.length} cuenta
            {empresaAccounts.length === 1 ? "" : "s"}
          </p>
        </div>

        {empresaHolders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay cuentas empresa. Agrega una con el titular de Angela o
              Hernán para que aparezca en Pagos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
              onClick={() => openNew()}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Primera cuenta empresa
            </Button>
          </div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={empresaHolders
              .slice(0, 2)
              .map((holder) => `empresa-${holder.id}`)}
            className="space-y-2"
          >
            {empresaHolders.map((holder) => (
              <AccordionItem
                key={holder.id}
                value={`empresa-${holder.id}`}
                className="overflow-hidden rounded-xl border border-border/70 bg-background/80 px-0 last:border-b"
              >
                <AccordionTrigger className="px-3 py-2 hover:no-underline [&>svg]:text-foreground">
                  <div className="min-w-0 flex-1 text-left">
                    <span className="text-sm font-bold">{holder.name}</span>
                    <p className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                      {holder.cedula ? `C.C. ${holder.cedula}` : "Sin cédula"}
                      {" · "}
                      {holder.accounts.length} cuenta
                      {holder.accounts.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2 pt-1">
                  <div className="ml-1 space-y-2 border-l-2 border-border pl-3">
                    {holder.accounts.map((ref) => {
                      const account = bankAccountById.get(ref.id);
                      if (!account) return null;
                      const images = getBankAccountImages(account);
                      return (
                        <div
                          key={account.id}
                          className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/60 p-3"
                        >
                          <BankLogoBadge
                            bankName={account.bankName}
                            brebKey={account.brebKey}
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold">
                                {account.bankName}
                              </span>
                              {account.accountType ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {account.accountType}
                                </span>
                              ) : null}
                              {images.length > 0 ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px]"
                                >
                                  QR
                                </Badge>
                              ) : null}
                              {account.qrOnly ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px]"
                                >
                                  Solo QR
                                </Badge>
                              ) : null}
                              {account.brebKey ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px]"
                                >
                                  Bre-B
                                </Badge>
                              ) : null}
                            </div>
                            <p className="font-mono text-xs text-foreground">
                              {account.qrOnly || !account.accountNumber?.trim()
                                ? account.accountNumber?.trim() || "Solo QR"
                                : account.accountNumber}
                            </p>
                            {images.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {images.map((url) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={url}
                                    src={url}
                                    alt=""
                                    className="h-12 w-12 rounded-lg border border-border object-cover"
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="pt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                Sin foto — edita y carga el flyer
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(account)}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                              aria-label="Editar cuenta"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRemove(account.id)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                              aria-label="Eliminar cuenta"
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-full rounded-xl border border-dashed border-border text-[11px] font-bold text-foreground hover:bg-muted/30"
                      onClick={() =>
                        openNew({
                          ownerName: holder.name,
                          ownerCedula: holder.cedula || undefined,
                        })
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Agregar otra cuenta bancaria
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        En cada reserva, en la pestaña Pagos, marcas cuáles de estas cuentas
        mostrar al cliente.
        <Link
          href="/admin/reservations"
          className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
        >
          Ir a Reservas
          <ExternalLink className="h-3 w-3" />
        </Link>
      </p>

      <BankAccountDialog
        open={dialogOpen}
        onClose={closeDialog}
        initial={editing}
        prefill={prefill}
        lockHolderFields={lockHolder}
        onSave={(data) => {
          void handleSave(data);
        }}
      />
    </div>
  );
}
