'use client';

import { useCallback, useState } from 'react';
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import type { GlobalPricingRule } from '../types/fincas.types';

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
    (args: TArgs, cb?: { onSuccess?: (d: TData) => void; onError?: (e: unknown) => void }) => {
      void mutateAsync(args).then((d) => cb?.onSuccess?.(d)).catch((e) => cb?.onError?.(e));
    },
    [mutateAsync],
  );
  return { mutate, mutateAsync, isPending, isLoading: isPending };
}

export const useGlobalPricingRules = () => {
  const raw = useConvexQuery(api.globalPricing.list);
  return {
    data: raw as GlobalPricingRule[] | undefined,
    isLoading: raw === undefined,
    isFetched: raw !== undefined,
    isError: false as const,
    error: null,
  };
};

export const useCreateGlobalPricingRule = () => {
  const create = useConvexMutation(api.globalPricing.create);
  return useCompatMutation(
    async (payload: Omit<GlobalPricingRule, '_id' | 'createdAt' | 'updatedAt'>) => {
      return await create(payload);
    },
  );
};

export const useUpdateGlobalPricingRule = () => {
  const update = useConvexMutation(api.globalPricing.update);
  return useCompatMutation(
    async ({ id, payload }: { id: string; payload: Partial<GlobalPricingRule> }) => {
      return await update({ id: id as Id<'globalPricing'>, ...payload });
    },
  );
};

export const useDeleteGlobalPricingRule = () => {
  const remove = useConvexMutation(api.globalPricing.remove);
  return useCompatMutation(async (id: string) => {
    return await remove({ id: id as Id<'globalPricing'> });
  });
};
