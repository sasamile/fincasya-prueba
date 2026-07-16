/**
 * Respuestas AUTOMÁTICAS de la app de WhatsApp Business (mensaje de ausencia /
 * bienvenida configurado en la app). Llegan por el echo de coexistencia como
 * si fueran mensajes del equipo, pero NO las escribe una persona: no detienen
 * el bot, no cuentan como Experto y no entran al historial del agente.
 * Los patrones se comparan en minúsculas, sin tildes y sin emojis/puntuación
 * al inicio (así detectamos plantillas que abren con "👋 ¡Hola! ...").
 * Si el equipo cambia el texto del mensaje de ausencia en la app, agregarlo aquí.
 */

/** Coinciden por el INICIO del texto (tras limpiar emojis/puntuación). */
export const APP_AUTO_REPLY_PATTERNS = [
  // Mensaje de ausencia actual del equipo:
  'gracias por tu mensaje. en este momento no estamos disponibles',
  // Textos por defecto de WhatsApp Business (ES/EN):
  'gracias por tu mensaje. no estamos disponibles',
  'no podemos responder en este momento',
  'thank you for your message. we are currently unavailable',
  // Plantilla de bienvenida/ausencia de FincasYa (abre con "👋 ¡Hola! ..."):
  'hola! gracias por comunicarte con fincasya',
];

/**
 * Coinciden si el texto CONTIENE la frase (para plantillas largas con
 * encabezado variable). Deben ser frases muy distintivas de un automático.
 */
export const APP_AUTO_REPLY_CONTAINS = [
  'en este momento nos encontramos fuera de nuestro horario de atencion',
  'estaremos felices de ayudarte tan pronto regresemos',
];

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // quita emojis, símbolos y puntuación al inicio para comparar el texto real
    .replace(/^[^\p{L}\d]+/u, '');
}

export function isAppAutoReply(text: string): boolean {
  const t = normalize(text);
  if (APP_AUTO_REPLY_PATTERNS.some((p) => t.startsWith(p))) return true;
  return APP_AUTO_REPLY_CONTAINS.some((p) => t.includes(p));
}
