'use client';

/**
 * Compat con FincasYaWeb `features/fincas/api/fincas.api`: los componentes que
 * llaman de forma imperativa (no como hooks) a `fetchPropertyOwnerInfo` /
 * `updatePropertyOwnerInfo` siguen funcionando. Habla directo con Convex vía
 * `ConvexHttpClient` (navegador) y sube archivos al bucket S3 vía
 * `/api/admin/upload`. Es el mismo comportamiento que los hooks equivalentes en
 * `features/fincas/queries/fincas.queries.ts`, pero como funciones sueltas.
 */
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import type { PropertyOwnerInfo } from '../types/fincas.types';

let convexClient: ConvexHttpClient | null = null;
function getClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL no configurada');
  if (!convexClient) convexClient = new ConvexHttpClient(url);
  return convexClient;
}

async function uploadToS3(file: File, folder: 'images' | 'documents'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? `Error subiendo archivo (${res.status})`);
  }
  return body.url;
}

export const fetchPropertyOwnerInfo = async (
  id: string,
): Promise<PropertyOwnerInfo | null> => {
  const info = await getClient().query(api.adminProperties.getOwnerInfo, {
    propertyId: id,
  });
  return (info ?? null) as PropertyOwnerInfo | null;
};

/** Claves del patch de owner info aceptadas por la mutation de Convex. */
const OWNER_PATCH_KEYS = [
  'ownerUserId',
  'rutNumber',
  'bankName',
  'accountNumber',
  'bankAccounts',
  'rntNumber',
  'propietarioNombre',
  'propietarioTratamiento',
  'propietarioTelefono',
  'propietarioCedula',
  'propietarioCorreo',
  'checkinUbicacionUrl',
  'checkinWazeUrl',
  'checkinIndicacionesLlegada',
  'checkinRecomendaciones',
  'checkinUbicacionImageUrl',
  'checkinUbicacionImageUrls',
  'bankCertificationUrl',
  'idCopyUrl',
  'rntPdfUrl',
  'chamberOfCommerceUrl',
] as const;

export const updatePropertyOwnerInfo = async ({
  id,
  payload,
  files,
}: {
  id: string;
  payload: Partial<PropertyOwnerInfo> & {
    checkinUbicacionImageOrder?: string[];
  };
  files?: {
    bankCertification?: File;
    idCopy?: File;
    rntPdf?: File;
    chamberOfCommerce?: File;
    checkinUbicacionImage?: File;
    checkinUbicacionImages?: File[];
  };
}): Promise<string> => {
  const patch: Record<string, unknown> = {};
  const source = payload as Record<string, unknown>;
  for (const key of OWNER_PATCH_KEYS) {
    if (source[key] !== undefined) patch[key] = source[key];
  }

  if (files?.bankCertification) {
    patch.bankCertificationUrl = await uploadToS3(files.bankCertification, 'documents');
  }
  if (files?.idCopy) patch.idCopyUrl = await uploadToS3(files.idCopy, 'documents');
  if (files?.rntPdf) patch.rntPdfUrl = await uploadToS3(files.rntPdf, 'documents');
  if (files?.chamberOfCommerce) {
    patch.chamberOfCommerceUrl = await uploadToS3(files.chamberOfCommerce, 'documents');
  }
  if (files?.checkinUbicacionImage) {
    patch.checkinUbicacionImageUrl = await uploadToS3(files.checkinUbicacionImage, 'images');
  }

  // Galería de llegada: el orden trae URLs existentes + tokens "__new__"
  // que se reemplazan (en orden) por los archivos nuevos subidos.
  if (Array.isArray(payload.checkinUbicacionImageOrder)) {
    const newUrls: string[] = [];
    for (const file of files?.checkinUbicacionImages ?? []) {
      newUrls.push(await uploadToS3(file, 'images'));
    }
    let nextNew = 0;
    patch.checkinUbicacionImageUrls = payload.checkinUbicacionImageOrder
      .map((token) => (token === '__new__' ? newUrls[nextNew++] : token))
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
  }

  return await getClient().mutation(api.adminProperties.updateOwnerInfo, {
    propertyId: id as Id<'properties'>,
    patch,
  });
};
