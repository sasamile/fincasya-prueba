'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export async function getNotificationSettings() {
  return convex.query(api.notificationSettings.get, {});
}

export async function setPaymentReceiptEmails(emails: string[]) {
  return convex.mutation(api.notificationSettings.setPaymentReceiptEmails, {
    emails,
  });
}
