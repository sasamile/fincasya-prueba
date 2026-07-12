export const COLOMBIAN_BANKS = [
  "Bancolombia",
  "BBVA Colombia",
  "Davivienda",
  "Banco de Bogotá",
  "Banco de Occidente",
  "Banco AV Villas",
  "Scotiabank Colpatria",
  "Banco Agrario",
  "Banco Caja Social",
  "Itaú",
  "Banco Popular",
  "Banco Falabella",
  "Banco Pichincha",
  "Banco GNB Sudameris",
  "Bancoomeva",
  "Banco Finandina",
  "Banco W",
  "Lulo Bank",
  "Nu Colombia",
  "Nequi",
  "Daviplata",
] as const;

export const TRADITIONAL_ACCOUNT_TYPES = [
  "Cuenta de Ahorros",
  "Cuenta Corriente",
] as const;

export const WALLET_ACCOUNT_TYPE = "Número celular" as const;

/** Tipos válidos para bancos tradicionales (compatibilidad). */
export const BANK_ACCOUNT_TYPES = TRADITIONAL_ACCOUNT_TYPES;

export const BANK_OTHER_VALUE = "__otro__";

export function isWalletBank(bankName: string): boolean {
  const normalized = bankName.trim().toLowerCase();
  return normalized.includes("nequi") || normalized.includes("daviplata");
}

export function getAccountTypesForBank(bankName: string): readonly string[] {
  if (isWalletBank(bankName)) {
    return [WALLET_ACCOUNT_TYPE];
  }
  return TRADITIONAL_ACCOUNT_TYPES;
}

export function defaultAccountTypeForBank(bankName: string): string {
  if (isWalletBank(bankName)) return WALLET_ACCOUNT_TYPE;
  return TRADITIONAL_ACCOUNT_TYPES[0];
}

export function normalizeAccountTypeForBank(
  bankName: string,
  accountType?: string,
): string {
  const trimmed = accountType?.trim() ?? "";
  const allowed = getAccountTypesForBank(bankName);

  const match = allowed.find(
    (type) => type.toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) return match;

  if (
    trimmed.toLowerCase() === "nequi" ||
    trimmed.toLowerCase() === "daviplata"
  ) {
    return isWalletBank(bankName)
      ? WALLET_ACCOUNT_TYPE
      : TRADITIONAL_ACCOUNT_TYPES[0];
  }

  return defaultAccountTypeForBank(bankName);
}

export function resolveBankSelectValue(bankName: string): string {
  const normalized = bankName.trim();
  if (!normalized) return "";
  const match = COLOMBIAN_BANKS.find(
    (bank) => bank.toLowerCase() === normalized.toLowerCase(),
  );
  return match ?? BANK_OTHER_VALUE;
}

export function isCustomBankValue(value: string): boolean {
  return value === BANK_OTHER_VALUE;
}
