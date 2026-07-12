"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useContractSettingsStore,
  BankAccount,
  ContractClause,
} from "../../store/contract-settings.store";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  CopMoneyInput,
  toStoredCopLabel,
} from "@/features/admin/components/contracts/cop-money-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FormSection } from "../shared/form-section";
import {
  Landmark,
  ListChecks,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  RotateCcw,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import {
  previewContractHtmlFragment,
  type FincaData,
} from "../../utils/contract-utils";
import { BankAccountDialog } from "./bank-account-dialog";
import { ContractFirmantesSection } from "./contract-firmantes-section";

interface ClauseEditorDialogProps {
  open: boolean;
  clause: ContractClause | null;
  /** Datos del formulario de reserva para sustituir {{...}} en la vista previa del editor. */
  clausePreviewFincaData: Partial<FincaData> | null;
  onClose: () => void;
  onSave: (id: string, content: string) => void;
}

function ClauseEditorDialog({
  open,
  clause,
  clausePreviewFincaData,
  onClose,
  onSave,
}: ClauseEditorDialogProps) {
  const [content, setContent] = useState(clause?.content || "");
  const adminSettings = useContractSettingsStore((s) => s.adminSettings);

  const resolvedPreview = useMemo(
    () =>
      previewContractHtmlFragment(
        content,
        adminSettings,
        clausePreviewFincaData ?? {},
      ),
    [content, adminSettings, clausePreviewFincaData],
  );

  /** Vista “cliente”: sin sintaxis `{{ }}`; lo no sustituido se ve como … (solo visual). */
  const clientPreviewHtml = useMemo(
    () => resolvedPreview.replace(/\{\{\s*[\w]+\s*\}\}/g, "…"),
    [resolvedPreview],
  );

  useEffect(() => {
    if (clause) setContent(clause.content);
  }, [clause]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl p-6 sm:max-h-[92vh]">
        <DialogHeader className="shrink-0 pr-8 pb-3">
          <DialogTitle className="text-base font-bold">
            Editar cláusula — {clause?.romanNumeral}: {clause?.label}
          </DialogTitle>
          <p className="pt-1 text-xs font-normal leading-relaxed text-muted-foreground">
            Lo principal es el <strong>texto ya sustituido</strong> como lo verá el contrato
            con los datos del formulario y la finca. Los marcadores{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{{ }}`}</code>{" "}
            solo existen en la plantilla (abajo, si necesitas editar el texto fuente).
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-semibold text-foreground">
                Texto con datos actuales
              </p>
              <p className="text-[10px] text-muted-foreground">
                Vista solo visual; lo pendiente aparece como … (no se guarda así).
              </p>
            </div>
            <div className="max-h-[min(52vh,480px)] min-h-[200px] overflow-y-auto overscroll-contain px-4 py-3 sm:max-h-[min(56vh,520px)]">
              <div
                className="prose prose-sm max-w-none text-foreground leading-relaxed [&_li]:my-1 [&_ol]:my-2 [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: clientPreviewHtml }}
              />
            </div>
          </div>

          <Collapsible defaultOpen={false} className="group/cclause shrink-0">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-between gap-2 rounded-xl border-dashed px-3 text-xs font-semibold"
              >
                Editar plantilla y marcadores
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/cclause:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
              <div className="mt-2 max-h-[min(36vh,360px)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-muted/15 p-2">
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  className="min-h-[200px] rounded-lg border-0"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="mt-4 shrink-0 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (clause) onSave(clause.id, content);
              onClose();
            }}
            className="rounded-xl"
          >
            Guardar cláusula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const labelClass =
  "ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-400";
const inputClass =
  "h-14 rounded-2xl border border-zinc-200 bg-zinc-50/90 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500";
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
    clauses,
    updateAdminSettings,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
    toggleContractBankAccountId,
    setContractBankAccountIds,
    toggleClause,
    updateClause,
    resetClauses,
  } = useContractSettingsStore();

  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [clauseEditorOpen, setClauseEditorOpen] = useState(false);
  const [editingClause, setEditingClause] = useState<ContractClause | null>(
    null,
  );

  const enabledCount = clauses.filter((c) => c.enabled).length;

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
      <ClauseEditorDialog
        open={clauseEditorOpen}
        clause={editingClause}
        clausePreviewFincaData={clausePreviewFincaData}
        onClose={() => {
          setClauseEditorOpen(false);
          setEditingClause(null);
        }}
        onSave={(id, content) => {
          updateClause(id, { content });
          sileo.success({ title: "Cláusula actualizada", fill: "#f0fdf4" });
        }}
      />

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

      <FormSection
        title="Cláusulas del contrato"
        description="Activa, desactiva o edita el texto de cada cláusula"
        icon={ListChecks}
        gradientFrom="from-emerald-500/10"
        iconBg="bg-emerald-600 text-white"
        iconShadow="shadow-emerald-500/20"
        textColor="text-emerald-600 dark:text-emerald-200"
        defaultOpen={false}
        className={sectionShell}
        customHeaderActions={
          <button
            type="button"
            onClick={() => {
              resetClauses();
              sileo.success({
                title: "Cláusulas restauradas",
                fill: "#f0fdf4",
              });
            }}
            className="mr-2 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurar
          </button>
        }
      >
        <div className="space-y-2 p-1">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary" className="text-[10px] font-black">
              {enabledCount}/{clauses.length} activas
            </Badge>
          </div>
          {[...clauses]
            .sort((a, b) => a.order - b.order)
            .map((clause) => (
              <div
                key={clause.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 transition-all",
                  clause.enabled
                    ? "border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/90"
                    : "border-dashed border-zinc-300 bg-zinc-50/80 opacity-80 dark:border-zinc-600 dark:bg-zinc-900/50",
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <Switch
                  checked={clause.enabled}
                  onCheckedChange={() => toggleClause(clause.id)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {clause.romanNumeral}.{" "}
                    </span>
                    {clause.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingClause(clause);
                    setClauseEditorOpen(true);
                  }}
                  className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  title="Editar contenido"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            ))}
          <p className="pt-2 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
            Los cambios se reflejan al instante en la vista previa del contrato debajo.
          </p>
        </div>
      </FormSection>
      </div>
    </>
  );
}
