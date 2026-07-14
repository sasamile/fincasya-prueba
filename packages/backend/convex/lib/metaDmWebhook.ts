/** Detecta si un evento messaging del webhook es Instagram DM o Messenger. */
export function inferDmPlatformFromWebhook(args: {
  pageId: string;
  igUserId?: string;
  senderId?: string;
  recipientId?: string;
  isInstagramEcho?: boolean;
  webhookObject?: string;
}): 'messenger' | 'instagram' {
  if (args.webhookObject === 'instagram') return 'instagram';

  const { pageId, igUserId, senderId, recipientId, isInstagramEcho } = args;
  if (!igUserId) return 'messenger';

  // Instagram DM: recipient es la cuenta profesional de IG (no el Page ID).
  if (recipientId === igUserId || senderId === igUserId || isInstagramEcho) {
    return 'instagram';
  }

  // Messenger: recipient es el Page ID.
  if (recipientId === pageId) return 'messenger';

  return 'messenger';
}

export function normalizeWebhookTimestamp(ts: unknown): number {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return Date.now();
  return ts > 1e12 ? ts : ts * 1000;
}
