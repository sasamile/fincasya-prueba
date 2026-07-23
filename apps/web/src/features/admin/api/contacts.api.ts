'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import { convex } from '@/lib/convex-client';

export async function listContacts(args?: {
  search?: string;
  limit?: number;
}) {
  return convex.query(api.contacts.list, {
    search: args?.search,
    limit: args?.limit ?? 2000,
  });
}

export async function getContactWithHistory(contactId: string) {
  return convex.query(api.contacts.getWithHistory, {
    contactId: contactId as Id<'contacts'>,
  });
}

export async function updateContact(
  contactId: string,
  patch: {
    name?: string;
    cedula?: string;
    email?: string;
    city?: string;
    address?: string;
    phoneAlt?: string;
    fechaNacimiento?: string;
    crmType?: 'lead' | 'client';
  },
) {
  return convex.mutation(api.contacts.update, {
    contactId: contactId as Id<'contacts'>,
    ...patch,
  });
}

export async function setContactTags(contactId: string, tags: string[]) {
  return convex.mutation(api.contacts.setTagsForContact, {
    contactId: contactId as Id<'contacts'>,
    tags,
  });
}

export async function deleteContact(contactId: string) {
  return convex.mutation(api.contacts.removeContact, {
    contactId: contactId as Id<'contacts'>,
  });
}

export async function listCrmContacts(args?: {
  search?: string;
  streakFilter?: string;
  birthdayMonth?: boolean;
  page?: number;
  pageSize?: number;
}) {
  return convex.query(api.crmContacts.listForCrm, {
    search: args?.search,
    streakFilter: args?.streakFilter as
      | 'frecuente'
      | 'intermedio'
      | 'nuevo'
      | 'inactivo'
      | 'all'
      | undefined,
    birthdayMonth: args?.birthdayMonth,
    page: args?.page,
    pageSize: args?.pageSize,
  });
}

export async function listBroadcastTemplates() {
  return convex.query(api.campaignBroadcast.listTemplates, {});
}

export async function sendBroadcast(args: {
  contactIds: string[];
  templateKey: string;
  logToInbox?: boolean;
  sentByUserId?: string;
}) {
  return convex.action(api.campaignBroadcast.sendBroadcast, {
    contactIds: args.contactIds as Id<'contacts'>[],
    templateKey: args.templateKey,
    logToInbox: args.logToInbox,
    sentByUserId: args.sentByUserId,
  });
}

export async function getWhatsappTemporalSettings() {
  const current = await convex.query(api.whatsappTemporalMessage.getCurrent, {});
  const active = await convex.query(api.whatsappTemporalMessage.getActive, {});
  return { ...current, active: active.active };
}

export async function setWhatsappTemporalSettings(args: {
  enabled: boolean;
  content: string;
  validUntil: number | null;
  updatedByUserId?: string;
}) {
  return convex.mutation(api.whatsappTemporalMessage.upsert, {
    enabled: args.enabled,
    content: args.content,
    validUntil: args.validUntil ?? undefined,
    updatedByUserId: args.updatedByUserId,
  });
}
