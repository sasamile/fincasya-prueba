'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export async function fetchInternalPage<T>(pageId: string): Promise<T | null> {
  const data = await convex.query(api.internalPages.getById, { pageId });
  return (data ?? null) as T | null;
}

export async function updateInternalPage<T>(
  pageId: string,
  payload: T,
): Promise<T> {
  const data = await convex.mutation(api.internalPages.upsert, {
    pageId,
    content: payload,
  });
  return data as T;
}
