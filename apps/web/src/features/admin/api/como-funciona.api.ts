'use client';

import {
  fetchInternalPage,
  updateInternalPage,
} from '@/features/admin/api/internal-pages.api';
import type {
  ComoFuncionaData,
  UpdateComoFuncionaPayload,
} from '@/features/admin/types/como-funciona.types';

const PAGE_ID = 'como-funciona';

export async function fetchComoFunciona(): Promise<ComoFuncionaData | null> {
  return fetchInternalPage<ComoFuncionaData>(PAGE_ID);
}

export async function updateComoFunciona(
  payload: UpdateComoFuncionaPayload,
): Promise<string> {
  await updateInternalPage(PAGE_ID, payload);
  return 'ok';
}
