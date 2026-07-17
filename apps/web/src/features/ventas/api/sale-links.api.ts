import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { convex } from '@/lib/convex-client';

export interface SaleLink {
  _id: string;
  token: string;
  contractCode?: string;
  propertyId: string;
  createdBy: string;
  createdByName?: string;
  checkIn: number;
  checkOut: number;
  nights: number;
  guests: number;
  checkInTime?: string;
  checkOutTime?: string;
  totalValue: number;
  rentalValue: number;
  depositAmount: number;
  cleaningFee: number;
  petDeposit?: number;
  petSurcharge?: number;
  petCount?: number;
  advancePaymentAmount?: number;
  boldPaymentUrl?: string;
  boldPaymentAmount?: number;
  boldSurchargePercent?: number;
  boldPaymentLinkId?: string;
  boldPaymentStatus?: string;
  checkinClientPaymentProofUploadEnabled?: boolean;
  checkinGuestListUnlocked?: boolean;
  checkinOwnerShareGuestList?: boolean;
  selectedBankAccountIds: string[];
  notes?: string;
  clientStep: number;
  status: 'active' | 'completed' | 'cancelled';
  clientData?: {
    nombre: string;
    cedula: string;
    email: string;
    telefono: string;
    telefonoRespaldo?: string;
    direccion: string;
    ciudad?: string;
    fechaNacimiento?: string;
    cedulaPhotoUrl?: string;
    cedulaPhotoFileName?: string;
    cedulaPhotoMimeType?: string;
    filledAt: number;
  };
  signedContractFileName?: string;
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofMimeType?: string;
  paymentValidated?: boolean;
  paymentValidatedAt?: number;
  paymentValidatedBy?: string;
  contractUrl?: string;
  signedContractUrl?: string;
  crUrl?: string;
  checkinCompleted?: boolean;
  bookingId?: string;
  bookingReference?: string;
  propertyTitle?: string | null;
  propietarioNombre?: string | null;
  propietarioTelefono?: string | null;
  propietarioTratamiento?: string | null;
  ownerOfferAmount?: number;
  ownerOfferSentAt?: number;
  ownerOfferAcceptedAt?: number;
  ownerOfferRejectedAt?: number;
  ownerOfferRejectedReason?: string;
  ownerOfferComment?: string;
  ownerOfferCommentAt?: number;
  ownerPayoutAbono?: number;
  checkinNeedsEmpleada?: boolean;
  checkinNeedsTeam?: boolean;
  checkinServiciosNota?: string;
  horaEntrada?: string;
  checkinObservaciones?: string;
  checkinMascotas?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSaleLinkPayload {
  propertyId: string;
  contractCode: string;
  checkIn: number;
  checkOut: number;
  nights: number;
  guests: number;
  checkInTime?: string;
  checkOutTime?: string;
  totalValue: number;
  rentalValue: number;
  depositAmount: number;
  cleaningFee: number;
  petDeposit?: number;
  petSurcharge?: number;
  petCount?: number;
  /** Abono que debe pagar el cliente (editable; no siempre 50%). */
  advancePaymentAmount: number;
  /** Recargo % informativo/cobrado en Bold (ej. 5). */
  boldSurchargePercent?: number;
  /** Si true, genera el link Bold al crear. */
  generateBoldLink?: boolean;
  /**
   * Origen actual del panel (window.location.origin) para el callback de Bold.
   * Ej: https://fincasya.com · https://www.fincasya.com · http://localhost:3789
   */
  portalOrigin?: string;
  checkinClientPaymentProofUploadEnabled?: boolean;
  checkinGuestListUnlocked?: boolean;
  checkinOwnerShareGuestList?: boolean;
  selectedBankAccountIds: string[];
  notes?: string;
}

export type CreateSaleLinkResult = {
  id: string;
  token: string;
  contractCode?: string;
  boldPaymentUrl?: string;
  boldPaymentAmount?: number;
  boldError?: string;
};

async function resolveCreatedBy(): Promise<{
  createdBy: string;
  createdByName?: string;
}> {
  const { useAuthStore } = await import('@/features/auth/store/auth.store');
  const user = useAuthStore.getState().user;
  const createdBy =
    user?.id?.trim() || user?.email?.trim() || 'admin-panel';
  const createdByName = user?.name?.trim() || undefined;
  return { createdBy, createdByName };
}

export async function listSaleLinks(filters?: {
  createdBy?: string;
  status?: string;
}): Promise<{ rows: SaleLink[] }> {
  const rows = await convex.query(api.saleLinks.listForAdmin, {
    createdBy: filters?.createdBy,
    status: filters?.status,
  });
  return { rows: rows as SaleLink[] };
}

export async function createSaleLink(
  payload: CreateSaleLinkPayload,
): Promise<CreateSaleLinkResult> {
  const { createdBy, createdByName } = await resolveCreatedBy();
  const generateBoldLink = payload.generateBoldLink !== false;
  const portalOrigin =
    payload.portalOrigin?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : undefined);
  const result = await convex.action(api.saleLinks.createWithBold, {
    propertyId: payload.propertyId as Id<'properties'>,
    contractCode: payload.contractCode,
    createdBy,
    createdByName,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    nights: payload.nights,
    guests: payload.guests,
    checkInTime: payload.checkInTime,
    checkOutTime: payload.checkOutTime,
    totalValue: payload.totalValue,
    rentalValue: payload.rentalValue,
    depositAmount: payload.depositAmount,
    cleaningFee: payload.cleaningFee,
    petDeposit: payload.petDeposit,
    petSurcharge: payload.petSurcharge,
    petCount: payload.petCount,
    advancePaymentAmount: payload.advancePaymentAmount,
    boldSurchargePercent: payload.boldSurchargePercent,
    generateBoldLink,
    portalOrigin,
    selectedBankAccountIds: payload.selectedBankAccountIds,
    notes: payload.notes,
    checkinClientPaymentProofUploadEnabled:
      payload.checkinClientPaymentProofUploadEnabled,
    checkinGuestListUnlocked: payload.checkinGuestListUnlocked,
    checkinOwnerShareGuestList: payload.checkinOwnerShareGuestList,
  });
  return {
    id: String(result.id),
    token: result.token,
    contractCode: result.contractCode,
    boldPaymentUrl: result.boldPaymentUrl,
    boldPaymentAmount: result.boldPaymentAmount,
    boldError: result.boldError,
  };
}

export async function updateSaleLink(
  id: string,
  payload: Partial<CreateSaleLinkPayload> & { status?: string },
): Promise<{ ok: boolean }> {
  await convex.mutation(api.saleLinks.update, {
    id: id as Id<'saleLinks'>,
    ...payload,
    propertyId: payload.propertyId
      ? (payload.propertyId as Id<'properties'>)
      : undefined,
    status: payload.status as SaleLink['status'] | undefined,
  });
  return { ok: true };
}

export async function deleteSaleLink(id: string): Promise<{ ok: boolean }> {
  await convex.mutation(api.saleLinks.remove, {
    id: id as Id<'saleLinks'>,
  });
  return { ok: true };
}

/** Fecha ms → "YYYY-MM-DD" en zona horaria de Colombia (evita off-by-one). */
function toYmd(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/**
 * Genera el contrato del link (plantilla QUINTA OLAYA → PDF vía iLovePDF),
 * lo sube a S3 y lo adjunta al link para que el cliente lo vea en su portal.
 * Corre en el navegador del asesor (reutiliza /api/fincas/[id]/direct-booking-contract
 * y /api/admin/upload, ambos con la sesión autenticada del panel).
 */
export async function generateSaleLinkContract(
  link: SaleLink,
): Promise<{ ok: boolean; contractUrl: string; reason?: string }> {
  const client = link.clientData;
  if (!client?.nombre) {
    return { ok: false, contractUrl: '', reason: 'sin_datos_cliente' };
  }

  const nights = Math.max(1, link.nights || 1);
  const nightlyPrice = Math.round((link.rentalValue || 0) / nights);

  // 1) Generar el PDF desde la plantilla.
  const res = await fetch(
    `/api/fincas/${link.propertyId}/direct-booking-contract`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        propertyId: link.propertyId,
        contractNumber: link.contractCode ?? '',
        nightlyPrice: String(nightlyPrice),
        // Solo el arriendo va como "valor" del contrato (igual que reservas).
        totalPrice: String(link.rentalValue || nightlyPrice * nights),
        clientName: client.nombre,
        clientId: client.cedula ?? '',
        clientEmail: client.email ?? '',
        clientPhone: client.telefono ?? '',
        clientCity: client.ciudad ?? '',
        clientAddress: client.direccion ?? '',
        checkInDate: toYmd(link.checkIn),
        checkOutDate: toYmd(link.checkOut),
        checkInTime: link.checkInTime ?? '',
        checkOutTime: link.checkOutTime ?? '',
        guests: link.guests || 1,
        petCount: link.petCount ?? 0,
        cleaningFee: link.cleaningFee ?? 0,
        refundableDeposit: link.depositAmount ?? 0,
        otherCharges: 0,
        manillaCondominio: 0,
        bankAccountIds: link.selectedBankAccountIds,
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    fileBase64?: string;
    filename?: string;
    mimeType?: string;
    error?: string;
  };
  if (!res.ok || !data.fileBase64) {
    throw new Error(data.error || 'No se pudo generar el contrato.');
  }

  // 2) Subir el PDF a S3.
  const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
  const mime = data.mimeType || 'application/pdf';
  const filename = data.filename || `Contrato_${link.contractCode ?? 'FincasYa'}.pdf`;
  const fd = new FormData();
  fd.append('file', new File([bytes], filename, { type: mime }));
  fd.append('folder', 'documents');
  const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const upData = (await up.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!up.ok || !upData.url) {
    throw new Error(upData.error || 'No se pudo subir el contrato.');
  }

  // 3) Adjuntar al link (visible para el cliente).
  const result = (await convex.mutation(api.saleLinks.attachContract, {
    token: link.token,
    contractUrl: upData.url,
  })) as { ok: boolean; contractUrl?: string; reason?: string };
  if (!result.ok) {
    throw new Error(result.reason || 'No se pudo adjuntar el contrato.');
  }
  return { ok: true, contractUrl: upData.url };
}

export async function resetSaleLinkPayment(
  token: string,
): Promise<{ ok: boolean; reason?: string }> {
  return convex.mutation(api.saleLinks.resetPaymentSubmission, { token });
}

export async function setSaleLinkOwnerOffer(
  id: string,
  ownerOfferAmount: number,
): Promise<{ ok: boolean; ownerOfferAmount?: number }> {
  return convex.mutation(api.saleLinks.setOwnerOffer, {
    id: id as Id<'saleLinks'>,
    ownerOfferAmount,
  });
}

export async function markSaleLinkOwnerOfferSent(
  id: string,
): Promise<{ ok: boolean }> {
  return convex.mutation(api.saleLinks.markOwnerOfferSent, {
    id: id as Id<'saleLinks'>,
  });
}

function formatValidatedBy(user?: {
  name?: string | null;
  email?: string | null;
  id?: string | null;
}): string {
  const name = user?.name?.trim();
  const email = user?.email?.trim();
  if (name && email) return `${name} <${email}>`;
  return name || email || user?.id || 'admin panel';
}

export async function validateSaleLinkPaymentAdmin(
  token: string,
  validatedBy?: string,
): Promise<{ ok: boolean; alreadyValidated?: boolean; reason?: string }> {
  let by = validatedBy?.trim();
  if (!by && typeof window !== 'undefined') {
    const { useAuthStore } = await import('@/features/auth/store/auth.store');
    by = formatValidatedBy(useAuthStore.getState().user ?? undefined);
  }
  if (!by) by = 'admin panel';

  return convex.mutation(api.saleLinks.validatePaymentAdmin, {
    token,
    validatedBy: by,
  });
}

/** Consulta Bold por API (sin webhook) y valida si status=PAID. */
export async function syncSaleLinkBoldPayment(
  token: string,
  checkedBy?: string,
): Promise<{
  ok: boolean;
  status?: string;
  paid?: boolean;
  alreadyValidated?: boolean;
  awaitingClientData?: boolean;
  reason?: string;
  error?: string;
}> {
  let by = checkedBy?.trim();
  if (!by && typeof window !== 'undefined') {
    const { useAuthStore } = await import('@/features/auth/store/auth.store');
    by = formatValidatedBy(useAuthStore.getState().user ?? undefined);
  }
  return convex.action(api.saleLinks.syncBoldPaymentStatus, {
    token,
    checkedBy: by || 'admin panel',
  });
}
