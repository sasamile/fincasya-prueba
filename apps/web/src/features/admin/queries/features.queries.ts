'use client';

import { useCallback, useState } from 'react';
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import type {
  CreateIconPayload,
  IconographyItem,
  UpdateIconPayload,
} from '../types/features.types';

async function uploadFeatureIcon(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'features');
  const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
  const body = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? `Error subiendo icono (${res.status})`);
  }
  return body.url;
}

function useCompatMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutateAsync = useCallback(
    async (args: TArgs): Promise<TData> => {
      setIsPending(true);
      setIsError(false);
      setError(null);
      try {
        return await fn(args);
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
    (
      args: TArgs,
      callbacks?: {
        onSuccess?: (data: TData) => void;
        onError?: (e: unknown) => void;
      },
    ) => {
      void mutateAsync(args)
        .then((data) => callbacks?.onSuccess?.(data))
        .catch((e) => callbacks?.onError?.(e));
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, isLoading: isPending, isError, error };
}

export function useIconography() {
  const raw = useConvexQuery(api.features.listIcons);
  return {
    data: raw as IconographyItem[] | undefined,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
  };
}

export function useCreateIcon() {
  const create = useConvexMutation(api.features.createIcon);
  return useCompatMutation(async (payload: CreateIconPayload) => {
    let iconUrl: string | undefined;
    if (payload.icon) iconUrl = await uploadFeatureIcon(payload.icon);
    const id = await create({
      name: payload.name,
      emoji: payload.emoji,
      iconUrl,
    });
    return { _id: id, name: payload.name ?? '', emoji: payload.emoji, iconUrl } as IconographyItem;
  });
}

export function useBulkUploadIcons() {
  const bulk = useConvexMutation(api.features.bulkCreateIcons);
  return useCompatMutation(async (files: File[]) => {
    const icons = await Promise.all(
      files
        .filter((f) => f.name.toLowerCase().endsWith('.svg'))
        .map(async (file) => ({
          name: file.name.replace(/\.svg$/i, ''),
          iconUrl: await uploadFeatureIcon(file),
        })),
    );
    await bulk({ icons });
    return icons as unknown as IconographyItem[];
  });
}

export function useUpdateIcon() {
  const update = useConvexMutation(api.features.updateIcon);
  return useCompatMutation(
    async ({ id, payload }: { id: string; payload: UpdateIconPayload }) => {
      let iconUrl: string | undefined;
      if (payload.icon) iconUrl = await uploadFeatureIcon(payload.icon);
      await update({
        id: id as Id<'iconography'>,
        name: payload.name,
        emoji: payload.emoji,
        iconUrl,
      });
      return { _id: id, name: payload.name ?? '', emoji: payload.emoji, iconUrl } as IconographyItem;
    },
  );
}

export function useDeleteIcon() {
  const remove = useConvexMutation(api.features.removeIcon);
  return useCompatMutation(async (id: string) => {
    await remove({ id: id as Id<'iconography'> });
  });
}
