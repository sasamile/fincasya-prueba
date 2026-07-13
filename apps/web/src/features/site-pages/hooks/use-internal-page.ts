'use client';

import { useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';

export function useInternalPageContent<T>(pageId: string, fallback: T) {
  const raw = useQuery(api.internalPages.getById, { pageId });
  const loading = raw === undefined;
  const data = (raw ?? fallback) as T;
  return { data, loading };
}

export function useQuienesSomosContent() {
  const raw = useQuery(api.quienes_somos.get, {});
  return { data: raw ?? null, loading: raw === undefined };
}
