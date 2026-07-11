import type { Doc } from '../_generated/dataModel';

/** Mensajes totales (sin system) para considerar una conversación "casi nueva". */
export const MAX_MESSAGES_FOR_AI = 12;

export type EligibilitySignals = {
  userMessageCount: number;
  advisorMessageCount: number;
  totalMessageCount: number;
};

export type EligibilityResult = {
  eligible: boolean;
  reason?: string;
};

type ConversationForEligibility = Pick<
  Doc<'conversations'>,
  'operationalState' | 'lastSentCatalogPropertyIds' | 'priority' | 'status'
>;

export function countEligibilitySignals(
  messages: Array<Pick<Doc<'messages'>, 'sender' | 'deletedAt' | 'sentByUserId'>>,
): EligibilitySignals {
  let userMessageCount = 0;
  let advisorMessageCount = 0;
  let totalMessageCount = 0;
  for (const m of messages) {
    if (m.deletedAt || m.sender === 'system') continue;
    totalMessageCount++;
    if (m.sender === 'user') userMessageCount++;
    if (m.sender === 'assistant' && m.sentByUserId) advisorMessageCount++;
  }
  return { userMessageCount, advisorMessageCount, totalMessageCount };
}

/** Comprobación rápida (solo campos de la conversación, sin contar mensajes). */
export function isQuickEligibleForAi(
  conversation: ConversationForEligibility,
): EligibilityResult {
  if (conversation.status === 'resolved') {
    return { eligible: false, reason: 'conversacion_resuelta' };
  }
  if (conversation.priority === 'urgent') {
    return { eligible: false, reason: 'escalada_a_humano' };
  }
  const state = conversation.operationalState ?? 'pending_data';
  if (state !== 'pending_data') {
    return { eligible: false, reason: 'proceso_avanzado' };
  }
  if ((conversation.lastSentCatalogPropertyIds?.length ?? 0) > 0) {
    return { eligible: false, reason: 'catalogo_ya_enviado' };
  }
  return { eligible: true };
}

export function isConversationEligibleForAi(
  conversation: ConversationForEligibility,
  signals: EligibilitySignals,
): EligibilityResult {
  const quick = isQuickEligibleForAi(conversation);
  if (!quick.eligible) return quick;
  if (signals.advisorMessageCount > 0) {
    return { eligible: false, reason: 'asesor_ya_participo' };
  }
  if (signals.totalMessageCount > MAX_MESSAGES_FOR_AI) {
    return { eligible: false, reason: 'historial_largo' };
  }
  return { eligible: true };
}

/** Activacion manual desde el panel: solo bloquea conversaciones cerradas. */
export function canManuallyEnableAi(
  conversation: Pick<Doc<'conversations'>, 'status'>,
): EligibilityResult {
  if (conversation.status === 'resolved') {
    return { eligible: false, reason: 'conversacion_resuelta' };
  }
  return { eligible: true };
}

export function ineligibilityLabel(reason: string): string {
  const labels: Record<string, string> = {
    conversacion_resuelta: 'Conversación cerrada',
    escalada_a_humano: 'Escalada a humano',
    proceso_avanzado: 'Ya hay un proceso en curso',
    catalogo_ya_enviado: 'Ya se envió catálogo',
    asesor_ya_participo: 'Un asesor ya participó',
    historial_largo: 'Historial demasiado largo para el bot',
    bot_global_apagado: 'Activa el bot global primero',
    auto_solo_nuevas: 'El bot no se activa solo en este chat',
  };
  return labels[reason] ?? reason;
}
