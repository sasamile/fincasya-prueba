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
  selectedBankAccountIds: string[];
  notes?: string;
  clientStep: number;
  status: 'active' | 'completed' | 'cancelled';
  clientData?: {
    nombre: string;
    cedula: string;
    email: string;
    telefono: string;
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
  selectedBankAccountIds: string[];
  notes?: string;
}

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
): Promise<{ id: string; token: string }> {
  const { createdBy, createdByName } = await resolveCreatedBy();
  const result = await convex.mutation(api.saleLinks.create, {
    ...payload,
    propertyId: payload.propertyId as Id<'properties'>,
    createdBy,
    createdByName,
  });
  return { id: String(result.id), token: result.token };
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

/** Generación de contrato: requiere acción server-side (pendiente de migrar). */
export async function generateSaleLinkContract(
  token: string,
): Promise<{ ok: boolean; contractUrl: string }> {
  throw new Error(
    `generateSaleLinkContract(${token}) aún no está migrado a Convex actions`,
  );
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
