'use client';

/**
 * Capa de compatibilidad: expone los MISMOS hooks que FincasYaWeb
 * (`features/fincas/queries/fincas.queries.ts`, react-query + REST Nest)
 * pero implementados sobre Convex (`adminProperties.ts`). Así los
 * componentes del panel admin se portan sin cambios.
 *
 * - Queries: shape `{ data, isLoading, isFetched, isError, error }`.
 *   Convex es reactivo: no hay invalidation manual; los datos se refrescan solos.
 * - Mutations: shape `{ mutate, mutateAsync, isPending, isLoading, isError, error }`.
 * - Archivos: se suben al bucket S3 de FincasYa vía `/api/admin/upload`
 *   (server-side, mismas carpetas que el Nest de fincasya-new) y se guarda
 *   la URL pública — idéntica al resto de imágenes ya migradas.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import type {
  PaginatedResponse,
  PropertiesParams,
  PropertyOwnerInfo,
  PropertyResponse,
  UpdatePropertyPayload,
} from '../types/fincas.types';

// ─── Normalización (copia de normalizeProperty de fincas.api) ───

export function normalizeProperty(p: any): PropertyResponse {
  return {
    ...p,
    id: p._id || p.id,
    featuredIcons: (p.featuredIcons || []).map(String),
    price: p.priceBase || p.price || 0,
    priceBase: p.priceBase || p.price || 0,
    priceOriginal: p.priceOriginal ?? 0,
    rating: p.rating ?? 0,
    isFavorite: p.isFavorite ?? false,
    active: p.active ?? true,
    reviewsCount: p.reviewsCount ?? 0,
    coordinates:
      p.coordinates ??
      (p.lat !== undefined && p.lng !== undefined
        ? { lat: p.lat, lng: p.lng }
        : { lat: 0, lng: 0 }),
    features:
      p.features?.map((f: any) =>
        typeof f === 'object'
          ? {
              name: f.name,
              iconId: f.iconId || f._id || f.id || undefined,
              iconUrl: f.iconUrl,
              emoji: f.emoji,
              quantity:
                f.quantity != null && Number(f.quantity) >= 1
                  ? Math.floor(Number(f.quantity))
                  : undefined,
              zone: f.zone,
              zoneTemplateSourceId: f.zoneTemplateSourceId ?? undefined,
            }
          : { name: f },
      ) || [],
    images:
      Array.isArray(p.images) && p.images.length > 0
        ? p.images
        : p.image
          ? [p.image]
          : [],
    imageItems: Array.isArray(p.imageItems) ? p.imageItems : undefined,
    zoneOrder: p.zoneOrder || [],
    catalogFilterTags: Array.isArray(p.catalogFilterTags)
      ? p.catalogFilterTags
      : undefined,
    departamentos: Array.isArray(p.departamentos) ? p.departamentos : undefined,
    marketplaceForSale: p.marketplaceForSale === true,
    salePriceCop:
      p.salePriceCop != null && Number.isFinite(Number(p.salePriceCop))
        ? Number(p.salePriceCop)
        : undefined,
    saleSquareMeters:
      p.saleSquareMeters != null && Number.isFinite(Number(p.saleSquareMeters))
        ? Number(p.saleSquareMeters)
        : undefined,
    saleDescription:
      typeof p.saleDescription === 'string' ? p.saleDescription : undefined,
  };
}

// ─── Utilidades compat ───

type MutateCallbacks<TData, TArgs> = {
  onSuccess?: (data: TData, variables: TArgs) => void;
  onError?: (error: unknown, variables: TArgs) => void;
  onSettled?: (
    data: TData | undefined,
    error: unknown,
    variables: TArgs,
  ) => void;
};

/** Emula la API de useMutation de react-query v5 sobre una función async. */
function useCompatMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutateAsync = useCallback(
    async (args: TArgs): Promise<TData> => {
      setIsPending(true);
      setIsError(false);
      setIsSuccess(false);
      setError(null);
      try {
        const result = await fn(args);
        setIsSuccess(true);
        return result;
      } catch (e) {
        setIsError(true);
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [fn],
  );

  const mutate = useCallback(
    (args: TArgs, callbacks?: MutateCallbacks<TData, TArgs>) => {
      void mutateAsync(args)
        .then((data) => {
          callbacks?.onSuccess?.(data, args);
          callbacks?.onSettled?.(data, null, args);
        })
        .catch((e) => {
          callbacks?.onError?.(e, args);
          callbacks?.onSettled?.(undefined, e, args);
        });
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    isPending,
    isLoading: isPending,
    isError,
    isSuccess,
    error,
    reset: () => {
      setIsError(false);
      setIsSuccess(false);
      setError(null);
    },
  };
}

/** Carpetas del bucket S3 (mismas que usaba el Nest de fincasya-new). */
type UploadFolder = 'images' | 'videos' | 'documents' | 'features';

/**
 * Sube un archivo al bucket S3 vía el route handler `/api/admin/upload`
 * y devuelve la URL pública (`https://{bucket}.s3.{region}.amazonaws.com/...`).
 */
async function uploadFileToS3(
  file: File,
  folder: UploadFolder = 'images',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    body: formData,
  });
  const body = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? `Error subiendo archivo (${res.status})`);
  }
  return body.url;
}

/** Claves aceptadas por el validador `propertyPatchFields` del backend. */
const PATCH_KEYS = [
  'title',
  'description',
  'location',
  'departamentos',
  'capacity',
  'eventCapacity',
  'eventPackagePrice',
  'code',
  'slug',
  'type',
  'category',
  'priceBase',
  'priceBaja',
  'priceMedia',
  'priceAlta',
  'priceOriginal',
  'rating',
  'isFavorite',
  'pricing',
  'lat',
  'lng',
  'features',
  'video',
  'visible',
  'active',
  'reservable',
  'visibleInWhatsAppCatalog',
  'marketplaceForSale',
  'salePriceCop',
  'saleSquareMeters',
  'saleDescription',
  'featuredIcons',
  'contractTemplateUrl',
  'zoneOrder',
  'allowsPets',
  'requiresGuestList',
  'allowsEventsContent',
  'familyOnly',
  'serviceStaffAvailable',
  'serviceStaffMandatory',
  'serviceStaffPrice',
  'depositoDanosReembolsable',
  'depositoAseo',
  'manillaCondominio',
  'catalogFilterTags',
  'propietarioNombre',
  'propietarioTratamiento',
  'propietarioTelefono',
  'propietarioCedula',
  'propietarioCorreo',
] as const;

const NUMERIC_PATCH_KEYS = new Set([
  'capacity',
  'eventCapacity',
  'eventPackagePrice',
  'priceBase',
  'priceBaja',
  'priceMedia',
  'priceAlta',
  'priceOriginal',
  'rating',
  'lat',
  'lng',
  'salePriceCop',
  'saleSquareMeters',
  'serviceStaffPrice',
  'depositoDanosReembolsable',
  'depositoAseo',
  'manillaCondominio',
]);

/**
 * Convierte UpdatePropertyPayload en el patch que acepta Convex:
 * whitelista claves, coerciona numéricos que lleguen como string y
 * traduce coordinates → lat/lng.
 */
function sanitizePatch(payload: UpdatePropertyPayload): Record<string, unknown> {
  const source: Record<string, unknown> = { ...payload };
  if (payload.coordinates) {
    source.lat = payload.lat ?? payload.coordinates.lat;
    source.lng = payload.lng ?? payload.coordinates.lng;
  }
  const patch: Record<string, unknown> = {};
  for (const key of PATCH_KEYS) {
    let value = source[key];
    if (value === undefined) continue;
    if (NUMERIC_PATCH_KEYS.has(key)) {
      if (value === '' || value === null) continue;
      const num = Number(value);
      if (!Number.isFinite(num)) continue;
      value = num;
    }
    patch[key] = value;
  }
  return patch;
}

// ─── Queries ───

export function useProperties(_params: PropertiesParams = {}) {
  const raw = useConvexQuery(api.adminProperties.listAll);
  const data = useMemo<PaginatedResponse<PropertyResponse> | undefined>(() => {
    if (raw === undefined) return undefined;
    const properties = raw.map(normalizeProperty);
    return { properties, data: properties, hasMore: false, total: properties.length };
  }, [raw]);
  return {
    data,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
  };
}

export function useProperty(id: string) {
  const raw = useConvexQuery(
    api.adminProperties.getById,
    id ? { id } : 'skip',
  );
  const data = useMemo(
    () => (raw == null ? undefined : normalizeProperty(raw)),
    [raw],
  );
  return {
    data,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
  };
}

export function usePropertyOwnerInfo(id: string) {
  const raw = useConvexQuery(
    api.adminProperties.getOwnerInfo,
    id ? { propertyId: id } : 'skip',
  );
  return {
    data: (raw ?? null) as PropertyOwnerInfo | null,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
  };
}

export function usePropertyReservations(propertyId: string) {
  const raw = useConvexQuery(
    api.adminProperties.listBookingsByProperty,
    propertyId ? { propertyId } : 'skip',
  );
  return {
    data: raw,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
  };
}

// ─── Mutations ───

export function useCreateProperty() {
  const createFn = useConvexMutation(api.adminProperties.create);
  const addImageFn = useConvexMutation(api.adminProperties.addImage);
  const setVideoFn = useConvexMutation(api.adminProperties.setVideo);

  return useCompatMutation(
    useCallback(
      async (payload: UpdatePropertyPayload): Promise<PropertyResponse> => {
        const patch = sanitizePatch(payload);
        if (payload.contractTemplateFile) {
          patch.contractTemplateUrl = await uploadFileToS3(
            payload.contractTemplateFile,
            'documents',
          );
        }
        const created = await createFn({ patch });
        const id = String(created._id);
        if (payload.files?.length) {
          for (const file of payload.files) {
            const url = await uploadFileToS3(file, 'images');
            await addImageFn({ propertyId: id, url });
          }
        }
        if (payload.videoFile) {
          const url = await uploadFileToS3(payload.videoFile, 'videos');
          await setVideoFn({ propertyId: id, url });
        }
        return normalizeProperty(created);
      },
      [createFn, addImageFn, setVideoFn],
    ),
  );
}

export function useUpdateProperty() {
  const updateFn = useConvexMutation(api.adminProperties.update);
  const addImageFn = useConvexMutation(api.adminProperties.addImage);
  const setVideoFn = useConvexMutation(api.adminProperties.setVideo);

  return useCompatMutation(
    useCallback(
      async ({
        id,
        payload,
      }: {
        id: string;
        payload: UpdatePropertyPayload;
      }): Promise<PropertyResponse> => {
        const patch = sanitizePatch(payload);
        if (payload.contractTemplateFile) {
          patch.contractTemplateUrl = await uploadFileToS3(
            payload.contractTemplateFile,
            'documents',
          );
        }
        const updated = await updateFn({ id, patch });
        if (payload.files?.length) {
          for (const file of payload.files) {
            const url = await uploadFileToS3(file, 'images');
            await addImageFn({ propertyId: id, url });
          }
        }
        if (payload.videoFile) {
          const url = await uploadFileToS3(payload.videoFile, 'videos');
          await setVideoFn({ propertyId: id, url });
        }
        return normalizeProperty(updated);
      },
      [updateFn, addImageFn, setVideoFn],
    ),
  );
}

export function useDeleteProperty() {
  const removeFn = useConvexMutation(api.adminProperties.remove);
  return useCompatMutation(
    useCallback(async (id: string) => removeFn({ id }), [removeFn]),
  );
}

export function useAddPropertyImage() {
  const addImageFn = useConvexMutation(api.adminProperties.addImage);
  return useCompatMutation(
    useCallback(
      async ({ id, file }: { id: string; file: File }) => {
        const url = await uploadFileToS3(file, 'images');
        return await addImageFn({ propertyId: id, url });
      },
      [addImageFn],
    ),
  );
}

export function useDeletePropertyImage() {
  const deleteImageFn = useConvexMutation(api.adminProperties.deleteImage);
  return useCompatMutation(
    useCallback(
      async ({ imageId }: { imageId: string }) => deleteImageFn({ imageId }),
      [deleteImageFn],
    ),
  );
}

export function useReorderPropertyImages() {
  const reorderFn = useConvexMutation(api.adminProperties.reorderImages);
  return useCompatMutation(
    useCallback(
      async ({
        id,
        imageOrders,
      }: {
        id: string;
        imageOrders: { id: string; order: number }[];
      }) => reorderFn({ propertyId: id, imageOrders }),
      [reorderFn],
    ),
  );
}

export function useUploadPropertyVideo() {
  const setVideoFn = useConvexMutation(api.adminProperties.setVideo);
  return useCompatMutation(
    useCallback(
      async ({ id, videoFile }: { id: string; videoFile: File }) => {
        const url = await uploadFileToS3(videoFile, 'videos');
        return await setVideoFn({ propertyId: id, url });
      },
      [setVideoFn],
    ),
  );
}

export function useDeletePropertyVideo() {
  const clearVideoFn = useConvexMutation(api.adminProperties.clearVideo);
  return useCompatMutation(
    useCallback(
      async ({ id }: { id: string }) => clearVideoFn({ propertyId: id }),
      [clearVideoFn],
    ),
  );
}

export function useLinkPropertyFeature() {
  const linkFn = useConvexMutation(api.adminProperties.linkFeature);
  return useCompatMutation(
    useCallback(
      async ({
        id,
        name,
        featureId,
      }: {
        id: string;
        name: string;
        featureId?: string;
      }) => linkFn({ propertyId: id, name, featureId }),
      [linkFn],
    ),
  );
}

export function useUnlinkPropertyFeature() {
  const unlinkFn = useConvexMutation(api.adminProperties.unlinkFeature);
  return useCompatMutation(
    useCallback(
      async ({
        id,
        name,
        featureId,
      }: {
        id: string;
        name: string;
        featureId?: string;
      }) => unlinkFn({ propertyId: id, name, featureId }),
      [unlinkFn],
    ),
  );
}

/** Claves del patch de owner info aceptadas por el backend. */
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

export function useUpdatePropertyOwnerInfo() {
  const updateOwnerFn = useConvexMutation(api.adminProperties.updateOwnerInfo);

  return useCompatMutation(
    useCallback(
      async ({
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
        // Documentos del propietario (RUT, cédula, RNT, cámara) van a
        // `documents/`; las fotos de llegada del check-in a `images/`.
        const uploadAndResolve = (file: File, folder: UploadFolder = 'documents') =>
          uploadFileToS3(file, folder);

        const patch: Record<string, unknown> = {};
        const source = payload as Record<string, unknown>;
        for (const key of OWNER_PATCH_KEYS) {
          if (source[key] !== undefined) patch[key] = source[key];
        }

        if (files?.bankCertification) {
          patch.bankCertificationUrl = await uploadAndResolve(
            files.bankCertification,
          );
        }
        if (files?.idCopy) {
          patch.idCopyUrl = await uploadAndResolve(files.idCopy);
        }
        if (files?.rntPdf) {
          patch.rntPdfUrl = await uploadAndResolve(files.rntPdf);
        }
        if (files?.chamberOfCommerce) {
          patch.chamberOfCommerceUrl = await uploadAndResolve(
            files.chamberOfCommerce,
          );
        }
        if (files?.checkinUbicacionImage) {
          patch.checkinUbicacionImageUrl = await uploadAndResolve(
            files.checkinUbicacionImage,
            'images',
          );
        }

        // Galería de llegada: el orden trae URLs existentes + tokens "__new__"
        // que se reemplazan (en orden) por los archivos nuevos subidos.
        if (Array.isArray(payload.checkinUbicacionImageOrder)) {
          const newUrls: string[] = [];
          for (const file of files?.checkinUbicacionImages ?? []) {
            newUrls.push(await uploadAndResolve(file, 'images'));
          }
          let nextNew = 0;
          patch.checkinUbicacionImageUrls = payload.checkinUbicacionImageOrder
            .map((token) =>
              token === '__new__' ? newUrls[nextNew++] : token,
            )
            .filter((u): u is string => typeof u === 'string' && u.length > 0);
        }

        return await updateOwnerFn({ propertyId: id, patch });
      },
      [updateOwnerFn],
    ),
  );
}

// ─── Tab order (/admin/reorder) ───

export function useTabOrder(tabId: string) {
  const raw = useConvexQuery(
    api.fincas.getTabOrder,
    tabId ? { tabId } : 'skip',
  );
  return {
    data: raw,
    isLoading: raw === undefined && !!tabId,
    isFetched: raw !== undefined || !tabId,
    isError: false as const,
    error: null,
  };
}

export function useUpdateTabOrder() {
  const mutateFn = useConvexMutation(api.fincas.updateTabOrder);
  return useCompatMutation(
    async ({
      tabId,
      propertyIds,
    }: {
      tabId: string;
      propertyIds: string[];
    }) => {
      return await mutateFn({
        tabId,
        propertyIds: propertyIds as Id<'properties'>[],
      });
    },
  );
}

export function useCalculateStayPrice(
  id: string,
  fechaEntrada: string,
  fechaSalida: string,
  numeroPersonas?: number,
  numeroMascotas?: number,
) {
  const enabled = !!id && !!fechaEntrada && !!fechaSalida;
  const raw = useConvexQuery(
    api.fincas.calculateStayPrice,
    enabled
      ? {
          propertyId: id as Id<'properties'>,
          fechaEntrada,
          fechaSalida,
          numeroPersonas,
          numeroMascotas,
        }
      : 'skip',
  );
  return {
    data: raw,
    isLoading: enabled && raw === undefined,
    // Convex resuelve reactivo; `isFetching` (compat react-query) refleja la
    // primera carga pendiente para spinners que lo consultan.
    isFetching: enabled && raw === undefined,
    isFetched: !enabled || raw !== undefined,
    isError: false as const,
    error: null,
  };
}

/**
 * Compat con FincasYaWeb: allí devolvía la lista de usuarios con rol
 * "propietario" (para un dropdown al armar contratos). En prueba los datos del
 * propietario viven en la finca (`propietarioNombre`, `propertyOwnerInfo`), no
 * en una tabla de usuarios — Better Auth solo tiene asesores/admins. Devuelve
 * lista vacía: el formulario de contrato usa los datos del propietario de la
 * finca directamente, no un preset de usuario.
 */
export function usePropietarios(_options: Record<string, unknown> = {}) {
  return {
    data: [] as Array<{ id: string; name?: string; email?: string }>,
    isLoading: false,
    isFetched: true,
    isError: false as const,
    error: null,
  };
}
