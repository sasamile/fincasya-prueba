export type CheckinBankAccount = {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  ownerName: string;
  ownerCedula: string;
  imageUrl: string | null;
  imageUrls: string[];
  qrOnly?: boolean;
  brebKey?: boolean;
};

export type PaymentHolder = {
  id: string;
  name: string;
  cedula: string;
  accountTypeHint: string;
  accounts: CheckinBankAccount[];
};

function normalizeHolderName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Agrupa por nombre del titular (no por cédula): un titular, varias cuentas/bancos. */
function holderKeyFromName(name: string) {
  return normalizeHolderName(name) || "titular";
}

function pickPrimaryCedula(accounts: CheckinBankAccount[]): string {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    const cedula = account.ownerCedula.trim();
    if (!cedula) continue;
    counts.set(cedula, (counts.get(cedula) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [cedula, count] of counts) {
    if (count > bestCount) {
      best = cedula;
      bestCount = count;
    }
  }
  return best;
}

function pickDisplayName(accounts: CheckinBankAccount[], fallback: string) {
  return accounts.reduce(
    (best, account) => {
      const name = account.ownerName.trim();
      return name.length > best.length ? name : best;
    },
    fallback,
  );
}

export function groupAccountsByHolder(
  accounts: CheckinBankAccount[],
): PaymentHolder[] {
  const map = new Map<string, PaymentHolder>();

  for (const account of accounts) {
    const name = account.ownerName.trim() || "Titular";
    const key = holderKeyFromName(name);

    const existing = map.get(key);
    if (existing) {
      existing.accounts.push(account);
      continue;
    }

    map.set(key, {
      id: key,
      name,
      cedula: account.ownerCedula.trim(),
      accountTypeHint: account.accountType.trim(),
      accounts: [account],
    });
  }

  const holders = Array.from(map.values());
  for (const holder of holders) {
    holder.accounts.sort((a, b) => a.bankName.localeCompare(b.bankName, "es"));
    holder.name = pickDisplayName(holder.accounts, holder.name);
    holder.cedula = pickPrimaryCedula(holder.accounts) || holder.cedula;
  }

  return holders.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatAccountNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return value.trim();
}

type BankBadgeStyle = {
  label: string;
  className: string;
};

export function getBankBadgeStyle(bankName: string): BankBadgeStyle {
  const normalized = bankName.trim().toLowerCase();

  if (normalized.includes("bancolombia")) {
    return {
      label: "BC",
      className:
        "bg-white border border-gray-200 text-[#2C2A29] text-[10px] font-black",
    };
  }
  if (normalized.includes("bbva")) {
    return {
      label: "BBVA",
      className: "bg-[#072146] text-white text-[10px] font-black",
    };
  }
  if (normalized.includes("nequi")) {
    return {
      label: "NEQUI",
      className: "bg-[#200020] text-white text-[10px] font-black",
    };
  }
  if (normalized.includes("daviplata")) {
    return {
      label: "DAV",
      className: "bg-[#E1251B] text-white text-[10px] font-black",
    };
  }
  if (normalized.includes("davivienda")) {
    return {
      label: "DAV",
      className: "bg-[#ED1C24] text-white text-[10px] font-black",
    };
  }

  const initials = bankName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return {
    label: initials || "BAN",
    className: "bg-emerald-700 text-white text-[10px] font-black",
  };
}
