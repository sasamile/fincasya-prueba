/**
 * Helpers de fecha/calendario para reservas, en hora de Colombia (negocio).
 * Lógica pura sin acceso a Convex — reutilizable y testeable de forma aislada.
 */

/** Fecha calendario YYYY-MM-DD en hora de Colombia (negocio). */
export function calendarDateColombia(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date(ms));
}

export function todayColombia(): string {
  return calendarDateColombia(Date.now());
}

/**
 * Impide reservas con entrada o salida ya pasadas (calendario Colombia) o rango inválido.
 */
export function assertBookingDatesAreFuture(args: {
  fechaEntrada: number;
  fechaSalida: number;
  fechaCheckOut?: number;
}): void {
  if (
    !Number.isFinite(args.fechaEntrada) ||
    !Number.isFinite(args.fechaSalida)
  ) {
    throw new Error('Las fechas de la reserva no son válidas.');
  }
  const salidaEfectiva = args.fechaCheckOut ?? args.fechaSalida;
  if (!Number.isFinite(salidaEfectiva)) {
    throw new Error('La fecha de salida no es válida.');
  }
  if (salidaEfectiva <= args.fechaEntrada) {
    throw new Error(
      'La fecha de salida debe ser posterior a la fecha de entrada.',
    );
  }
  const today = todayColombia();
  const diaEntrada = calendarDateColombia(args.fechaEntrada);
  const diaSalida = calendarDateColombia(salidaEfectiva);
  // No se permite check-in hoy ni en pasado — mínimo mañana.
  if (diaEntrada <= today) {
    throw new Error(
      'La fecha de entrada debe ser a partir de mañana (no se acepta ingreso el mismo día, hora Colombia).',
    );
  }
  if (diaSalida < today) {
    throw new Error(
      'La fecha de salida no puede ser anterior a hoy (hora Colombia).',
    );
  }
}
