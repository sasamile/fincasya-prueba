'use client';

import { useCallback, useState } from 'react';
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

export type PropertyCategory =
  | 'ECONOMICA'
  | 'ESTANDAR'
  | 'PREMIUM'
  | 'LUJO'
  | 'ECOTURISMO'
  | 'CON_PISCINA'
  | 'CERCA_BOGOTA'
  | 'GRUPOS_GRANDES'
  | 'VIP';

export interface CategoryZoneTemplateFeature {
  _id: string;
  zoneTemplateId: string;
  iconographyId: string;
  alias?: string;
  quantity?: number;
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryZoneTemplate {
  _id: string;
  propertyCategory: PropertyCategory;
  name: string;
  order?: number;
  createdAt: number;
  updatedAt: number;
  features: CategoryZoneTemplateFeature[];
}

function useCompatMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(
    async (args: TArgs) => {
      setIsPending(true);
      try {
        return await fn(args);
      } finally {
        setIsPending(false);
      }
    },
    [fn],
  );
  const mutate = useCallback(
    (args: TArgs, cb?: { onSuccess?: () => void; onError?: () => void }) => {
      void mutateAsync(args).then(() => cb?.onSuccess?.()).catch(() => cb?.onError?.());
    },
    [mutateAsync],
  );
  return { mutate, mutateAsync, isPending, isLoading: isPending };
}

export function useAllCategoryZoneTemplates() {
  const raw = useConvexQuery(api.categoryZoneTemplates.listAll);
  return {
    data: raw as CategoryZoneTemplate[] | undefined,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
    refetch: () => Promise.resolve(),
  };
}

export function useCreateCategoryZoneTemplate() {
  const create = useConvexMutation(api.categoryZoneTemplates.createTemplate);
  return useCompatMutation(async ({ name }: { name: string }) => {
    return await create({
      propertyCategory: 'ESTANDAR',
      name,
    });
  });
}

export function useUpdateCategoryZoneTemplate() {
  const update = useConvexMutation(api.categoryZoneTemplates.updateTemplate);
  return useCompatMutation(
    async ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; order?: number };
    }) => {
      await update({
        id: id as Id<'propertyCategoryZoneTemplates'>,
        ...body,
      });
    },
  );
}

export function useDeleteCategoryZoneTemplate() {
  const remove = useConvexMutation(api.categoryZoneTemplates.deleteTemplate);
  return useCompatMutation(async ({ id }: { id: string }) => {
    await remove({ id: id as Id<'propertyCategoryZoneTemplates'> });
  });
}

export function useAddCategoryZoneTemplateFeature() {
  const add = useConvexMutation(api.categoryZoneTemplates.addTemplateFeature);
  return useCompatMutation(
    async ({
      zoneTemplateId,
      body,
    }: {
      zoneTemplateId: string;
      body: { iconographyId: string; alias?: string; quantity?: number };
    }) => {
      await add({
        zoneTemplateId: zoneTemplateId as Id<'propertyCategoryZoneTemplates'>,
        iconographyId: body.iconographyId as Id<'iconography'>,
        alias: body.alias,
        quantity: body.quantity,
      });
    },
  );
}

export function useUpdateCategoryZoneTemplateFeature() {
  const update = useConvexMutation(api.categoryZoneTemplates.updateTemplateFeature);
  return useCompatMutation(
    async ({
      id,
      body,
    }: {
      id: string;
      body: {
        alias?: string;
        order?: number;
        iconographyId?: string;
        quantity?: number;
      };
    }) => {
      await update({
        id: id as Id<'propertyCategoryZoneFeatures'>,
        alias: body.alias,
        order: body.order,
        iconographyId: body.iconographyId as Id<'iconography'> | undefined,
        quantity: body.quantity,
      });
    },
  );
}

export function useDeleteCategoryZoneTemplateFeature() {
  const remove = useConvexMutation(api.categoryZoneTemplates.removeTemplateFeature);
  return useCompatMutation(async ({ id }: { id: string }) => {
    await remove({ id: id as Id<'propertyCategoryZoneFeatures'> });
  });
}
