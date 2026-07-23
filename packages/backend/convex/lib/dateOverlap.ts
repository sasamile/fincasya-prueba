/**
 * Cruce de rangos de fechas [entrada, salida).
 *
 * La salida de una estadía PUEDE ser la entrada de la siguiente: ese día la
 * finca se desocupa y se vuelve a ocupar, no es un choque. Por eso la
 * comparación es estricta en los dos extremos.
 *
 * Vive aparte porque la usan el candado de links de venta (una finca, unas
 * fechas, un solo link) y el calendario — y era la regla que más fácil se
 * escribía al revés.
 */
export function seCruzan(
  aEntrada: number,
  aSalida: number,
  bEntrada: number,
  bSalida: number,
): boolean {
  return aEntrada < bSalida && aSalida > bEntrada;
}
