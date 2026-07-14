'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export async function getNotificationSettings() {
  return convex.query(api.notificationSettings.get, {});
}

/** Guarda la lista única de correos de administrador (todas las alertas). */
export async function setAdminEmails(emails: string[]) {
  return convex.mutation(api.notificationSettings.setAdminEmails, {
    emails,
  });
}
