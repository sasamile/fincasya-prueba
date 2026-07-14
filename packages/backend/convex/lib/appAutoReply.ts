/**
 * Respuestas AUTOMÁTICAS de la app de WhatsApp Business (mensaje de ausencia /
 * bienvenida configurado en la app). Llegan por el echo de coexistencia como
 * si fueran mensajes del equipo, pero NO las escribe una persona: no detienen
 * el bot, no cuentan como Experto y no entran al historial del agente.
 * Los patrones se comparan en minúsculas y sin tildes (startsWith).
 * Si el equipo cambia el texto del mensaje de ausencia en la app, agregarlo aquí.
 */
export const APP_AUTO_REPLY_PATTERNS = [
  // Mensaje de ausencia actual del equipo:
  'gracias por tu mensaje. en este momento no estamos disponibles',
  // Textos por defecto de WhatsApp Business (ES/EN):
  'gracias por tu mensaje. no estamos disponibles',
  'no podemos responder en este momento',
  'thank you for your message. we are currently unavailable',
];

export function isAppAutoReply(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return APP_AUTO_REPLY_PATTERNS.some((p) => t.startsWith(p));
}
