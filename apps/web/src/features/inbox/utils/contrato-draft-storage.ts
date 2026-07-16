/**
 * Borrador del formulario "Generar contrato" del inbox, por conversación.
 * Sobrevive al cambiar de chat, de herramienta o al cerrar el panel.
 */

const DRAFT_PREFIX = "fincasya_inbox_contrato_";
/** 14 días: suficiente para una venta en curso, sin llenar localStorage. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type InboxContratoDraftPayload = {
  draft: Record<string, string>;
  selectedBankIds: string[];
  bankTouched: boolean;
  updatedAt: number;
};

function draftKey(conversationId: string) {
  return `${DRAFT_PREFIX}${conversationId}`;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadInboxContratoDraft(
  conversationId: string,
): InboxContratoDraftPayload | null {
  if (!canUseStorage() || !conversationId) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(conversationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxContratoDraftPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.draft) return null;
    if (
      typeof parsed.updatedAt === "number" &&
      Date.now() - parsed.updatedAt > MAX_AGE_MS
    ) {
      window.localStorage.removeItem(draftKey(conversationId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveInboxContratoDraft(
  conversationId: string,
  payload: Omit<InboxContratoDraftPayload, "updatedAt">,
) {
  if (!canUseStorage() || !conversationId) return;
  try {
    const next: InboxContratoDraftPayload = {
      ...payload,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(
      draftKey(conversationId),
      JSON.stringify(next),
    );
  } catch {
    // localStorage puede fallar en modo privado o con cuota llena.
  }
}

export function clearInboxContratoDraft(conversationId: string) {
  if (!canUseStorage() || !conversationId) return;
  try {
    window.localStorage.removeItem(draftKey(conversationId));
  } catch {
    // ignore
  }
}
