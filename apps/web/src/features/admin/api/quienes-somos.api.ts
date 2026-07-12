'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';
import {
  uploadInternalPageImage,
  uploadInternalPageVideo,
} from '@/features/admin/api/internal-pages-media.api';
import type {
  QuienesSomosData,
  UpdateQuienesSomosPayload,
} from '@/features/admin/types/quienes-somos.types';

export async function fetchQuienesSomos(): Promise<QuienesSomosData | null> {
  const data = await convex.query(api.quienes_somos.get, {});
  return (data ?? null) as QuienesSomosData | null;
}

export async function updateQuienesSomos(
  payload: UpdateQuienesSomosPayload,
): Promise<string> {
  await convex.mutation(api.quienes_somos.update, payload);
  return 'ok';
}

export async function uploadQuienesSomosImages(
  files: File[],
): Promise<string[]> {
  return Promise.all(files.map((file) => uploadInternalPageImage(file)));
}

export async function uploadQuienesSomosVideo(file: File): Promise<string> {
  return uploadInternalPageVideo(file);
}
