/**
 * Mensaje de "reserva confirmada" que sale al APROBAR el pago.
 *
 * Es el mismo contenido por los dos caminos (Santiago, 23-jul):
 *  - dentro de la ventana de 24 h → texto libre (esta función);
 *  - fuera → plantilla `reserva_confirmada_cr`, que recibe estos mismos datos
 *    como variables y lleva el CR como documento adjunto.
 *
 * Vive aparte de la acción para poder probarlo sin tocar la base.
 */

export type ReservaConfirmadaDatos = {
  nombreCliente: string;
  codigoReserva: string;
  nombreFinca: string;
  fechaEntrada: string;
  fechaSalida: string;
  valorPagado: string;
  linkCheckin: string;
};

/** Variables de la plantilla, en el ORDEN de sus `paramKeys`. */
export function paramsPlantillaReservaConfirmada(
  d: ReservaConfirmadaDatos,
): string[] {
  return [
    d.nombreCliente,
    d.codigoReserva,
    d.nombreFinca,
    d.fechaEntrada,
    d.fechaSalida,
    d.valorPagado,
    d.linkCheckin,
  ];
}

/** Texto libre (dentro de las 24 h). Mismo contenido que la plantilla. */
export function mensajeReservaConfirmada(d: ReservaConfirmadaDatos): string {
  const lineas = [
    `¡Hola, ${d.nombreCliente}! Tu reserva quedó confirmada ✅`,
    '',
    `📄 Confirmación N.º ${d.codigoReserva}`,
    `🏡 ${d.nombreFinca}`,
    `📅 Entrada: ${d.fechaEntrada} · Salida: ${d.fechaSalida}`,
  ];
  if (d.valorPagado) lineas.push(`💰 Pago recibido: ${d.valorPagado}`);
  lineas.push(
    '',
    'Adjunta encontrarás tu confirmación de reserva. Para completar tu check-in y registrar a tus invitados, entra aquí:',
    d.linkCheckin,
    '',
    '¡Te esperamos! 💚',
  );
  return lineas.join('\n');
}
