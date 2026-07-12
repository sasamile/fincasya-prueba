/**
 * Sugerencias de etiquetas para el inbox (WhatsApp).
 * Cada conversación puede tener varias etiquetas y además strings personalizados.
 */
export const INBOX_SUGGESTED_TAGS = [
  "Fin de año",
  "Navidad",
  "fin de semana",
  "Grupo amigos",
  "Evento",
  "Referido",
  "cliente problemático",
  "Pago pendiente",
  "Buen negocio",
  "Puente festivo",
  "20 personas fin de año",
  "Clientes de venta",
  "Alquiler mensual",
] as const;

export type InboxSuggestedTag = (typeof INBOX_SUGGESTED_TAGS)[number];

/** Etiquetas automáticas del bot — no mostrar como chips en el listado. */
export const INBOX_SYSTEM_TAGS = [
  "continuidad-asesor",
  "emergencia",
  "intencion-cierre",
  "oportunidad-prioritaria",
  "urgente-fuera-horario",
] as const;

export function isSuggestedInboxTag(s: string): boolean {
  return (INBOX_SUGGESTED_TAGS as readonly string[]).includes(s);
}

export function isSystemInboxTag(s: string): boolean {
  return (INBOX_SYSTEM_TAGS as readonly string[]).includes(s);
}

/** Etiquetas visibles para el asesor (excluye automáticas del bot). */
export function visibleInboxTags(tags: string[] | undefined | null): string[] {
  return (tags ?? []).filter((t) => !isSystemInboxTag(t));
}
