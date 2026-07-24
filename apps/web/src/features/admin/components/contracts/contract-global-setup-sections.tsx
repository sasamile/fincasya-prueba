"use client";

import { useEffect, useState } from "react";
import {
  useContractSettingsStore,
  BankAccount,
} from "../../store/contract-settings.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CopMoneyInput,
  toStoredCopLabel,
} from "@/features/admin/components/contracts/cop-money-input";
import { FormSection } from "../shared/form-section";
import { Landmark, Plus, Trash2, Pencil, Settings2 } from "lucide-react";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import { type FincaData } from "../../utils/contract-utils";
import { BankAccountDialog } from "./bank-account-dialog";
import { ContractFirmantesSection } from "./contract-firmantes-section";

const labelClass =
  "ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-400";
const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/90 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500";
const sectionShell =
  "rounded-2xl border border-zinc-200 bg-zinc-50/50 shadow-none md:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900/45";

export type ContractGlobalSetupSectionsProps = {
  /** Si se pasa (p. ej. desde Contratos y reserva), el editor de cláusulas muestra vista previa con datos reales. */
  clausePreviewFincaData?: Partial<FincaData> | null;
  /**
   * Solo cláusulas (sin administrador ni cuentas bancarias).
   * Útil en el modal del inbox donde el recaudo ya se edita aparte y duplicaría la UI.
   */
  hideAdminAndBankSections?: boolean;
  /**
   * En el modal de contrato del inbox: aseo de esta reserva (mismo valor que el resumen de cobro).
   * Si se define, el campo «Aseo final» edita la reserva y no solo la plantilla global.
   */
  reservationCleaningFee?: string;
  onReservationCleaningFeeChange?: (digitsOnly: string) => void;
  /** Mismo valor que «Depósito por daños» en el resumen (esta reserva). */
  reservationSecurityDeposit?: string;
  onReservationSecurityDepositChange?: (digitsOnly: string) => void;
  /** Monto calculado por mascotas en esta reserva (solo lectura orientativa). */
  reservationPetDepositCop?: number;
  /** Total del contrato calculado automáticamente (suma de partidas). */
  reservationContractTotal?: string;
  onReservationContractTotalChange?: (digitsOnly: string) => void;
  reservationSuggestedContractTotalCop?: number;
  onReservationContractTotalUseSuggested?: () => void;
  reservationContractTotalError?: string;
};

export function ContractGlobalSetupSections({
  clausePreviewFincaData = null,
  hideAdminAndBankSections = false,
  reservationCleaningFee,
  onReservationCleaningFeeChange,
  reservationSecurityDeposit,
  onReservationSecurityDepositChange,
  reservationPetDepositCop,
  reservationContractTotal,
  onReservationContractTotalChange,
  reservationSuggestedContractTotalCop,
  onReservationContractTotalUseSuggested,
  reservationContractTotalError,
}: ContractGlobalSetupSectionsProps) {
  const {
    adminSettings,
    bankAccounts,
    contractBankAccountIds,
    updateAdminSettings,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
    toggleContractBankAccountId,
    setContractBankAccountIds,
  } = useContractSettingsStore();

  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  useEffect(() => {
    if (bankAccounts.length === 0) return;
    const selectedValid = contractBankAccountIds.filter((id) =>
      bankAccounts.some((a) => a.id === id),
    );
    if (selectedValid.length > 0) return;
    setContractBankAccountIds([bankAccounts[0].id]);
  }, [bankAccounts, contractBankAccountIds, setContractBankAccountIds]);

  return (
    <>
      {!hideAdminAndBankSections ? (
        <BankAccountDialog
          open={bankDialogOpen}
          initial={editingBank}
          knownHolders={bankAccounts.map((a) => ({
            name: a.ownerName,
            cedula: a.ownerCedula || undefined,
          }))}
          onClose={() => {
            setBankDialogOpen(false);
            setEditingBank(null);
          }}
          onSave={(data) => {
            if (editingBank) {
              updateBankAccount(editingBank.id, data);
              sileo.success({ title: "Cuenta actualizada", fill: "#f0fdf4" });
            } else {
              addBankAccount(data);
              sileo.success({ title: "Cuenta agregada", fill: "#f0fdf4" });
            }
          }}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:gap-4">
      {!hideAdminAndBankSections ? (
        <>
      <FormSection
        title="Administrador y cargos del contrato"
        description="Nombre del operador, multas y valores fijos que salen en el texto"
        icon={Settings2}
        gradientFrom="from-violet-500/10"
        iconBg="bg-violet-600 text-white"
        iconShadow="shadow-violet-500/20"
        textColor="text-violet-600 dark:text-violet-200"
        defaultOpen={false}
        className={sectionShell}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 p-1">
          <div className="space-y-2 md:col-span-2">
            <Label className={labelClass}>Nombre completo</Label>
            <Input
              value={adminSettings.adminName}
              onChange={(e) =>
                updateAdminSettings({ adminName: e.target.value })
              }
              className={inputClass}
              placeholder="Nombre del administrador"
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Cédula</Label>
            <Input
              value={adminSettings.adminCedula}
              onChange={(e) =>
                updateAdminSettings({ adminCedula: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Ciudad cédula</Label>
            <Input
              value={adminSettings.adminCity}
              onChange={(e) =>
                updateAdminSettings({ adminCity: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>
              Aseo final
              {onReservationCleaningFeeChange ? " (esta reserva)" : ""}
            </Label>
            <CopMoneyInput
              value={
                onReservationCleaningFeeChange
                  ? (reservationCleaningFee ?? "")
                  : adminSettings.cleaningFee
              }
              onChange={(digits) => {
                if (onReservationCleaningFeeChange) {
                  onReservationCleaningFeeChange(digits);
                } else {
                  updateAdminSettings({ cleaningFee: toStoredCopLabel(digits) });
                }
              }}
              className={inputClass}
              placeholder="0"
            />
            {onReservationCleaningFeeChange ? (
              <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Cobro único de aseo: se suma en el total a pagar del resumen y
                aparece en el texto del contrato.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Persona extra / noche</Label>
            <CopMoneyInput
              value={adminSettings.extraPersonFee}
              onChange={(digits) =>
                updateAdminSettings({ extraPersonFee: toStoredCopLabel(digits) })
              }
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Depósito mascota (texto en contrato)</Label>
            <CopMoneyInput
              value={
                reservationPetDepositCop != null && reservationPetDepositCop > 0
                  ? String(reservationPetDepositCop)
                  : adminSettings.petDeposit
              }
              readOnly={
                reservationPetDepositCop != null && reservationPetDepositCop > 0
              }
              onChange={(digits) => {
                if (
                  reservationPetDepositCop != null &&
                  reservationPetDepositCop > 0
                ) {
                  return;
                }
                updateAdminSettings({ petDeposit: toStoredCopLabel(digits) });
              }}
              className={inputClass}
              placeholder="0"
            />
            {reservationPetDepositCop != null && reservationPetDepositCop > 0 ? (
              <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Calculado por esta reserva ({reservationPetDepositCop.toLocaleString("es-CO")} COP). Va al resumen y al contrato.
              </p>
            ) : (
              <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Valor por defecto en el texto si no hay mascotas en la reserva.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>
              Depósito por daños
              {onReservationSecurityDepositChange ? " (esta reserva)" : ""}
            </Label>
            <CopMoneyInput
              value={
                onReservationSecurityDepositChange
                  ? (reservationSecurityDeposit ?? "")
                  : adminSettings.securityDeposit
              }
              onChange={(digits) => {
                if (onReservationSecurityDepositChange) {
                  onReservationSecurityDepositChange(digits);
                } else {
                  updateAdminSettings({
                    securityDeposit: toStoredCopLabel(digits),
                  });
                }
              }}
              className={inputClass}
              placeholder="0"
            />
            {onReservationSecurityDepositChange ? (
              <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Depósito reembolsable por daños. Puedes ajustarlo según la
                negociación; se suma al total del contrato.
              </p>
            ) : null}
          </div>

          {onReservationContractTotalChange ? (
            <div className="space-y-2 md:col-span-2">
              <Label className={labelClass}>Valor total del contrato</Label>
              <CopMoneyInput
                value={reservationContractTotal ?? ""}
                onChange={onReservationContractTotalChange}
                className={inputClass}
                placeholder="0"
              />
              <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Se calcula solo según las partidas; puedes ajustarlo si la
                negociación queda en más o menos.
              </p>
              {reservationSuggestedContractTotalCop != null &&
                reservationSuggestedContractTotalCop > 0 &&
                Number(reservationContractTotal || 0) !==
                  Math.round(reservationSuggestedContractTotalCop) &&
                onReservationContractTotalUseSuggested ? (
                  <button
                    type="button"
                    className="text-left text-[11px] font-semibold text-violet-600 hover:underline dark:text-violet-300"
                    onClick={onReservationContractTotalUseSuggested}
                  >
                    Usar total calculado: $
                    {Math.round(
                      reservationSuggestedContractTotalCop,
                    ).toLocaleString("es-CO")}
                  </button>
                ) : null}
              {reservationContractTotalError ? (
                <p className="ml-1 text-xs font-semibold text-red-500">
                  {reservationContractTotalError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </FormSection>

      <ContractFirmantesSection />

      <FormSection
        title="Cuentas bancarias"
        description="Marca las cuentas que deben aparecer en el contrato (una o más)."
        icon={Landmark}
        gradientFrom="from-sky-500/10"
        iconBg="bg-sky-600 text-white"
        iconShadow="shadow-sky-500/20"
        textColor="text-sky-600 dark:text-sky-200"
        defaultOpen={false}
        className={sectionShell}
      >
        <div className="space-y-4 p-1">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingBank(null);
                setBankDialogOpen(true);
              }}
              className="h-9 gap-1.5 rounded-xl border-0 bg-sky-600 px-3 text-xs font-bold text-white shadow-none hover:bg-sky-500 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
            >
              <Plus className="w-3 h-3" />
              Agregar cuenta
            </Button>
          </div>

          {bankAccounts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-300 py-10 text-center dark:border-zinc-600">
              <Landmark className="mx-auto mb-3 h-8 w-8 text-zinc-400 dark:text-zinc-500" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-100">
                No hay cuentas configuradas
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Agrega cuentas y marca una o más para incluirlas en el contrato
              </p>
            </div>
          ) : (
            <>
            {contractBankAccountIds.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Marca al menos 1 cuenta con «Incluir en contrato» para generar el PDF.
              </p>
            )}
            <div className="space-y-2">
              {bankAccounts.map((account) => {
                const inContract = contractBankAccountIds.includes(account.id);
                return (
                <div
                  key={account.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3 transition-all",
                    inContract
                      ? "border-sky-300 bg-sky-50/90 dark:border-sky-500 dark:bg-sky-950/50"
                      : "border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/90",
                  )}
                >
                  <Checkbox
                    id={`bank-contract-${account.id}`}
                    checked={inContract}
                    onCheckedChange={() => toggleContractBankAccountId(account.id)}
                    className="mt-1.5 shrink-0"
                  />
                  <Label
                    htmlFor={`bank-contract-${account.id}`}
                    className="flex-1 min-w-0 cursor-pointer space-y-0.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {account.bankName}
                      </p>
                      {account.accountType && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-[9px] font-bold",
                            inContract
                              ? "border-sky-400/70 bg-sky-950/70 text-sky-50 dark:border-sky-400/60 dark:bg-sky-950/80 dark:text-sky-100"
                              : "border-zinc-500 bg-zinc-200 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100",
                          )}
                        >
                          {account.accountType}
                        </Badge>
                      )}
                      {inContract && (
                        <Badge className="text-[9px] font-bold rounded-md bg-sky-600 text-white border-0">
                          En contrato
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {account.accountNumber}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {account.ownerName} · C.C. {account.ownerCedula}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      Incluir en contrato
                    </p>
                  </Label>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBank(account);
                        setBankDialogOpen(true);
                      }}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBankAccount(account.id)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-500/15 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
            </>
          )}
        </div>
      </FormSection>
        </>
      ) : null}

      {/* La sección "Cláusulas del contrato" se quitó (Vane 21-jul): el texto
          del contrato se revisa y corrige directo en el editor Word (paso
          Editar / modal del inbox), que es la fuente final del PDF. Las
          cláusulas del store siguen alimentando la plantilla base. */}
      </div>
    </>
  );
}
