/**
 * Resuelve las cuentas seleccionadas del sheet "Generar contrato" (inbox)
 * para el POST del .docx. Compara IDs como string y exige datos útiles.
 */

export type InboxBankAccount = {
  id: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  ownerName?: string;
  ownerCedula?: string;
};

export type BankContractPayload = {
  bankAccountIds: string[];
  bankAccounts: Array<{
    id: string;
    bankName?: string;
    accountType?: string;
    accountNumber?: string;
    ownerName?: string;
    ownerCedula?: string;
  }>;
  /** Campos sueltos (1ª cuenta) por si el cluster multi falla. */
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  idNumber?: string;
};

function hasBankData(a: InboxBankAccount): boolean {
  return Boolean(
    String(a.accountNumber ?? "").trim() ||
      String(a.bankName ?? "").trim() ||
      String(a.ownerName ?? "").trim(),
  );
}

export function resolveSelectedBankPayload(
  accounts: InboxBankAccount[],
  selectedIds: string[],
): BankContractPayload {
  const idSet = new Set(
    selectedIds.map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  const selected = accounts.filter(
    (a) => a?.id != null && idSet.has(String(a.id).trim()) && hasBankData(a),
  );

  const bankAccounts = selected.map((a) => ({
    id: String(a.id),
    bankName: a.bankName,
    accountType: a.accountType,
    accountNumber: a.accountNumber,
    ownerName: a.ownerName,
    ownerCedula: a.ownerCedula,
  }));

  const first = bankAccounts[0];
  return {
    bankAccountIds: bankAccounts.map((a) => a.id),
    bankAccounts,
    ...(first
      ? {
          bankName: first.bankName,
          accountNumber: first.accountNumber,
          accountHolder: first.ownerName,
          idNumber: first.ownerCedula,
        }
      : {}),
  };
}
