export type InboxBankAccount = {
  id: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  ownerName?: string;
  ownerCedula?: string;
  /** Flyer / QR de esta cuenta (se envían con el contrato). */
  imageUrls?: string[];
  imageUrl?: string;
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
    imageUrls?: string[];
  }>;
  /** Campos sueltos (1ª cuenta) por si el cluster multi falla. */
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  idNumber?: string;
};

function accountImages(a: InboxBankAccount): string[] {
  const fromArray = (a.imageUrls ?? []).filter(Boolean);
  if (fromArray.length > 0) return fromArray;
  if (a.imageUrl?.trim()) return [a.imageUrl.trim()];
  return [];
}

function hasBankData(a: InboxBankAccount): boolean {
  return Boolean(
    String(a.accountNumber ?? "").trim() ||
      String(a.bankName ?? "").trim() ||
      String(a.ownerName ?? "").trim() ||
      accountImages(a).length > 0,
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
    imageUrls: accountImages(a),
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

/** URLs únicas de fotos de las cuentas seleccionadas (orden estable). */
export function collectSelectedBankImageUrls(
  accounts: Array<{ imageUrls?: string[] }>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of accounts) {
    for (const url of a.imageUrls ?? []) {
      const u = url.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/**
 * Fotos a enviar con el contrato: primero el flyer general (todas las cuentas),
 * luego fotos específicas de las cuentas seleccionadas (QR, etc.). Sin duplicar.
 */
export function collectContractPaymentImageUrls(args: {
  generalImageUrls?: string[];
  selectedAccounts?: Array<{ imageUrls?: string[] }>;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of args.generalImageUrls ?? []) {
    const u = url.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  for (const u of collectSelectedBankImageUrls(args.selectedAccounts ?? [])) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
