import type { PaymentHolder } from "@/features/checkin/utils/payment-holders";

export type CompanyHolderGroup = "fincasya" | "hernan" | "other";

function normalizeHolderName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Clasifica titulares del catálogo global (empresa). */
export function classifyCompanyHolder(holderName: string): CompanyHolderGroup {
  const n = normalizeHolderName(holderName);
  if (n.includes("hernan") || n.includes("aguilera")) return "hernan";
  if (n.includes("angela") || n.includes("campos")) return "fincasya";
  return "other";
}

export function splitGlobalHolders(holders: PaymentHolder[]) {
  const fincasya: PaymentHolder[] = [];
  const hernan: PaymentHolder[] = [];
  const other: PaymentHolder[] = [];

  for (const holder of holders) {
    const group = classifyCompanyHolder(holder.name);
    if (group === "fincasya") fincasya.push(holder);
    else if (group === "hernan") hernan.push(holder);
    else other.push(holder);
  }

  return { fincasya, hernan, other };
}

export function normalizeOwnerName(name: string) {
  return normalizeHolderName(name);
}

/** Indica si una cuenta pertenece al propietario de la finca (por cédula o nombre). */
export function matchesPropertyOwner(
  account: { ownerName?: string; ownerCedula?: string },
  owner: { nombre: string; cedula: string } | null,
): boolean {
  if (!owner) return false;
  const cedula = account.ownerCedula?.trim();
  const name = normalizeHolderName(account.ownerName ?? "");
  if (owner.cedula && cedula === owner.cedula.trim()) return true;
  if (owner.nombre && name === normalizeHolderName(owner.nombre)) return true;
  return false;
}

export function isEmpresaAccount(account: { ownerName?: string }): boolean {
  const group = classifyCompanyHolder(account.ownerName ?? "");
  return group === "fincasya" || group === "hernan";
}
