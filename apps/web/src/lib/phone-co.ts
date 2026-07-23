/**
 * Teléfonos colombianos: cómo se GUARDAN y cómo se MUESTRAN.
 *
 * WhatsApp entrega el número con el indicativo pegado ("573212457666") y así
 * se guardaba y se imprimía en el contrato. Adriana (22-jul) pidió verlo con
 * el prefijo separado: "+57 321 245 7666".
 *
 * Ojo con la asimetría, es a propósito:
 * - `phoneDigitsCo` es lo que va a la BASE DE DATOS. Los contactos se buscan
 *   por `phone` con índice y se cruzan por dígitos; si guardáramos el número
 *   ya formateado, un mismo cliente terminaría duplicado.
 * - `formatPhoneCo` es solo para MOSTRAR (formularios) e IMPRIMIR (contrato).
 */

/** Solo los dígitos, con indicativo 57 al frente. Formato de almacenamiento. */
export function phoneDigitsCo(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `57${digits}`;
  if (digits.startsWith("57") && digits.length === 12) return digits;
  // Número extranjero o incompleto: se respeta tal cual llegó.
  return digits;
}

/**
 * "+57 321 245 7666" para mostrar e imprimir. Si el número no es colombiano
 * (o está incompleto) se devuelve el texto original sin inventar prefijos.
 */
export function formatPhoneCo(raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  let local = "";
  if (digits.length === 10) local = digits;
  else if (digits.startsWith("57") && digits.length === 12) local = digits.slice(2);
  else return value;
  return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
