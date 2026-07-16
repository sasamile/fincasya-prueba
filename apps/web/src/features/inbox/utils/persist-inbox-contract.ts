import type { Id } from "@fincasya/backend/convex/_generated/dataModel";

/** Campos mínimos del borrador del inbox para registrar el contrato. */
export type InboxContractDraftLike = {
  fincaId: string;
  contractCode: string;
  pricePerNight: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  guests: string;
  extraGuests?: string;
  petCount: string;
  petDeposit?: string;
  petServiceFee?: string;
  petCleaningFee?: string;
  cleaningFee: string;
  refundableDeposit: string;
  extraPersonFee?: string;
  manillaCondominio: string;
  otherCharges: string;
  clientName: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientCedula: string;
  clientPhone: string;
  clientEmail: string;
  clientCity: string;
  clientAddress: string;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`).getTime();
  const b = new Date(`${checkOut}T12:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.max(1, Math.round((b - a) / 86400000));
}

function money(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Arma el payload de `contracts.upsert` para un contrato del inbox. */
export function buildInboxContractUpsertArgs(
  draft: InboxContractDraftLike,
  opts: {
    estado: "generado" | "enviado";
    propertyTitle?: string;
    propertyLocation?: string;
    pdfUrl?: string;
    pdfFilename?: string;
  },
) {
  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const perNight = money(draft.pricePerNight);
  const stay = perNight * nights;
  const extraGuests = Math.max(0, Math.floor(money(draft.extraGuests)));
  const extraPersonRate = money(draft.extraPersonFee);
  const extraPeopleTotal =
    nights > 0 && extraGuests > 0 && extraPersonRate > 0
      ? extraGuests * extraPersonRate * nights
      : 0;
  const valorTotal =
    stay +
    money(draft.petDeposit) +
    money(draft.petServiceFee) +
    money(draft.petCleaningFee) +
    money(draft.cleaningFee) +
    money(draft.refundableDeposit) +
    money(draft.manillaCondominio) +
    money(draft.otherCharges) +
    extraPeopleTotal;

  const contractNumber =
    draft.contractCode.trim() || `INBOX-${Date.now()}`;

  return {
    contractNumber,
    ...(draft.fincaId
      ? { propertyId: draft.fincaId as Id<"properties"> }
      : {}),
    propertyTitle: opts.propertyTitle?.trim() || undefined,
    propertyLocation: opts.propertyLocation?.trim() || undefined,
    clienteNombre: draft.clientName.trim().toUpperCase() || undefined,
    clienteCedula: draft.clientCedula.trim() || undefined,
    clienteEmail: draft.clientEmail.trim() || undefined,
    clienteTelefono: draft.clientPhone.trim() || undefined,
    clienteCiudad: draft.clientCity.trim() || undefined,
    clienteDireccion: draft.clientAddress.trim() || undefined,
    valorTotal: valorTotal > 0 ? valorTotal : undefined,
    fechaEntrada: draft.checkIn || undefined,
    fechaSalida: draft.checkOut || undefined,
    pdfUrl: opts.pdfUrl,
    pdfFilename: opts.pdfFilename,
    estado: opts.estado,
    origen: "inbox" as const,
    draftJson: JSON.stringify({
      ...draft,
      nights,
      valorTotal,
      savedFrom: "inbox",
    }),
  };
}
