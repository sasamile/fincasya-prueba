/**
 * VENTANA DE 24 HORAS DE WHATSAPP.
 *
 * Meta solo permite mensajes de texto libre dentro de las 24 h siguientes al
 * ÚLTIMO mensaje que escribió el cliente. Pasado ese punto, lo único que entra
 * es una plantilla preaprobada — un texto libre fuera de ventana lo rechaza la
 * API y el cliente nunca se entera.
 *
 * Por eso, al aprobar un pago, el aviso de "reserva confirmada" sale como
 * mensaje normal si estamos dentro de la ventana, o como la plantilla
 * `reserva_confirmada_cr` (con el CR en PDF) si estamos fuera
 * (Santiago, 23-jul).
 *
 * Cuenta SOLO lo que escribió el cliente (`sender: 'user'`): los mensajes que
 * mandamos nosotros no reabren la ventana.
 */

export const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

/**
 * ¿Se puede mandar texto libre?
 *
 * @param ultimoMensajeDelClienteMs cuándo escribió el cliente por última vez
 *        (`undefined` = nunca escribió → no hay ventana).
 * @param ahoraMs momento actual.
 */
export function dentroDeVentana24h(
  ultimoMensajeDelClienteMs: number | undefined | null,
  ahoraMs: number,
): boolean {
  if (!ultimoMensajeDelClienteMs || ultimoMensajeDelClienteMs <= 0) {
    return false;
  }
  const transcurrido = ahoraMs - ultimoMensajeDelClienteMs;
  // Un timestamp futuro (reloj desfasado) cuenta como dentro: es más seguro
  // intentar el texto libre que abrir una plantilla de más.
  if (transcurrido < 0) return true;
  return transcurrido < VENTANA_24H_MS;
}
