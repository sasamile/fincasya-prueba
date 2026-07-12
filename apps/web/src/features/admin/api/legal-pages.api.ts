'use client';

import {
  fetchInternalPage,
  updateInternalPage,
} from '@/features/admin/api/internal-pages.api';

export async function fetchLegalPage<T>(pageId: string): Promise<T | null> {
  return fetchInternalPage<T>(pageId);
}

export async function updateLegalPage<T>(
  pageId: string,
  payload: T,
): Promise<T> {
  return updateInternalPage(pageId, payload);
}
