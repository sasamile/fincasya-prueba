/**
 * Arma el body de POST /api/fincas/{id}/direct-booking-contract
 * a partir de un contrato guardado (lista admin / detalle).
 */
export type SavedContractForDocx = {
  contractNumber: string;
  propertyId?: string;
  propertyTitle?: string;
  propertyLocation?: string;
  clienteNombre?: string;
  clienteCedula?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  clienteCiudad?: string;
  clienteDireccion?: string;
  valorTotal?: number;
  fechaEntrada?: string;
  fechaSalida?: string;
  draftJson?: string;
  origen?: string;
  updatedAt?: number;
};

type DraftShape = {
  fincaId?: string;
  contractCode?: string;
  pricePerNight?: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  guests?: string;
  petCount?: string;
  petDeposit?: string;
  petServiceFee?: string;
  petCleaningFee?: string;
  cleaningFee?: string;
  refundableDeposit?: string;
  extraPersonFee?: string;
  manillaCondominio?: string;
  otherCharges?: string;
  clientName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientCedula?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCity?: string;
  clientAddress?: string;
  clientDocType?: string;
  bankAccountIds?: string[];
  bankAccounts?: unknown[];
};

function parseDraft(draftJson?: string): DraftShape {
  if (!draftJson?.trim()) return {};
  try {
    const parsed = JSON.parse(draftJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as DraftShape;
  } catch {
    /* ignore */
  }
  return {};
}

function numStr(v: unknown, fallback = "0"): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

/**
 * @returns null si falta propertyId (no se puede regenerar el Word).
 */
export function buildDocxRequestFromSavedContract(
  contract: SavedContractForDocx,
): { propertyId: string; body: Record<string, unknown> } | null {
  const draft = parseDraft(contract.draftJson);
  const propertyId = String(
    contract.propertyId || draft.fincaId || "",
  ).trim();
  if (!propertyId) return null;

  const checkIn = String(draft.checkIn || contract.fechaEntrada || "").trim();
  const checkOut = String(draft.checkOut || contract.fechaSalida || "").trim();
  const clientName = String(
    draft.clientName || contract.clienteNombre || "",
  )
    .trim()
    .toUpperCase();

  const body: Record<string, unknown> = {
    outputFormat: "docx",
    propertyId,
    contractNumber: contract.contractNumber,
    nightlyPrice: numStr(draft.pricePerNight),
    totalPrice: numStr(contract.valorTotal ?? draft.pricePerNight),
    clientName,
    clientFirstName: String(draft.clientFirstName || "").trim().toUpperCase(),
    clientLastName: String(draft.clientLastName || "").trim().toUpperCase(),
    clientId: String(draft.clientCedula || contract.clienteCedula || "").trim(),
    clientDocType: String(draft.clientDocType || "CC"),
    clientEmail: String(draft.clientEmail || contract.clienteEmail || "").trim(),
    clientPhone: String(
      draft.clientPhone || contract.clienteTelefono || "",
    ).trim(),
    clientCity: String(draft.clientCity || contract.clienteCiudad || "").trim(),
    clientAddress: String(
      draft.clientAddress || contract.clienteDireccion || "",
    ).trim(),
    checkInDate: checkIn,
    checkOutDate: checkOut,
    checkInTime: String(draft.checkInTime || "15:00"),
    checkOutTime: String(draft.checkOutTime || "12:00"),
    guests: Number(draft.guests) || 1,
    petCount: Number(draft.petCount) || 0,
    petDeposit: Number(draft.petDeposit) || 0,
    petSurcharge: Number(draft.petServiceFee) || 0,
    petCleaningFee: Number(draft.petCleaningFee) || 0,
    cleaningFee: Number(draft.cleaningFee) || 0,
    refundableDeposit: Number(draft.refundableDeposit) || 0,
    manillaCondominio: Number(draft.manillaCondominio) || 0,
    otherCharges: Number(draft.otherCharges) || 0,
    extraPersonFeeLabel: String(draft.extraPersonFee || "").trim() || undefined,
  };

  if (Array.isArray(draft.bankAccountIds) && draft.bankAccountIds.length > 0) {
    body.bankAccountIds = draft.bankAccountIds;
  }
  if (Array.isArray(draft.bankAccounts) && draft.bankAccounts.length > 0) {
    body.bankAccounts = draft.bankAccounts;
  }

  return { propertyId, body };
}

export async function fetchContractDocxBlob(
  contract: SavedContractForDocx,
): Promise<{ blob: Blob; filename: string }> {
  const built = buildDocxRequestFromSavedContract(contract);
  if (!built) {
    throw new Error(
      "Este contrato no tiene finca asociada; no se puede generar el Word.",
    );
  }

  const res = await fetch(
    `/api/fincas/${encodeURIComponent(built.propertyId)}/direct-booking-contract`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(built.body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    fileBase64?: string;
    filename?: string;
    error?: string;
  };
  if (!res.ok || !data.fileBase64) {
    throw new Error(data.error || "No se pudo generar el Word del contrato.");
  }

  const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
  const filename =
    data.filename || `Contrato_${contract.contractNumber}.docx`;
  return {
    blob: new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    filename,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
