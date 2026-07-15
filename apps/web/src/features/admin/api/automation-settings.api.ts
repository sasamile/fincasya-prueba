'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export type MessageSchedule = {
  key: string;
  hourCO: number;
  anchor: 'checkin' | 'checkout' | 'weekday';
  offsetDays: number;
  weekday?: number;
};

export type AutomationSettings = {
  scheduledMessagingEnabled: boolean;
  scheduledMessagesDisabled: string[];
  schedules: MessageSchedule[];
  scheduleLabels: Record<string, string>;
  updatedAt: number | null;
};

export async function getAutomationSettings(): Promise<AutomationSettings> {
  return convex.query(api.automationSettings.get, {}) as Promise<AutomationSettings>;
}

export async function setScheduledMessagingEnabled(
  enabled: boolean,
  updatedByUserId?: string,
): Promise<AutomationSettings> {
  return convex.mutation(api.automationSettings.setScheduledMessagingEnabled, {
    enabled,
    updatedByUserId,
  }) as Promise<AutomationSettings>;
}

export async function setScheduledMessageTypeDisabled(
  key: string,
  disabled: boolean,
  updatedByUserId?: string,
): Promise<AutomationSettings> {
  return convex.mutation(api.automationSettings.setScheduledMessageTypeDisabled, {
    key,
    disabled,
    updatedByUserId,
  }) as Promise<AutomationSettings>;
}

export async function setMessageSchedule(
  schedule: MessageSchedule,
  updatedByUserId?: string,
): Promise<AutomationSettings> {
  return convex.mutation(api.automationSettings.setMessageSchedule, {
    schedule,
    updatedByUserId,
  }) as Promise<AutomationSettings>;
}

/** Registra (o re-envía a aprobación) las plantillas de check-in en YCloud/Meta. */
export async function registerCheckinTemplatesToYcloud(onlyKeys?: string[]) {
  return convex.action(api.checkinMessaging.registerCheckinTemplates, {
    onlyKeys,
  }) as Promise<
    Array<{
      key: string;
      name: string;
      ok: boolean;
      status?: number;
      error?: string;
    }>
  >;
}

/** Guarda el cuerpo editable de una plantilla oficial (override en Convex). */
export async function upsertWhatsappTemplateOverride(args: {
  key: string;
  bodyText: string;
  footer?: string | null;
}) {
  return convex.mutation(api.whatsappTemplateOverrides.upsert, args) as Promise<{
    ok: true;
    isCustomized: boolean;
  }>;
}
