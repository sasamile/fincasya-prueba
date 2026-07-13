/**
 * Filtrado y ordenamiento en memoria para el listado de reservas (`bookings.list`).
 * Lógica pura sobre un array ya cargado — sin acceso a Convex.
 */
import type { Doc, Id } from '../../_generated/dataModel';

export type BookingListFilterArgs = {
  month?: string;
  year?: string;
  isDirect?: boolean;
  userEmail?: string;
  cursor?: Id<'bookings'>;
};

/**
 * Aplica los filtros de año/mes (vista calendario), reserva directa, correo y
 * cursor de paginación, y ordena por fecha de creación (más recientes primero).
 */
export function applyBookingListFilters(
  bookings: Doc<'bookings'>[],
  args: BookingListFilterArgs,
): Doc<'bookings'>[] {
  let filtered = bookings;

  // Filtrar por año (vista meses del calendario admin)
  if (args.year && !args.month) {
    const year = parseInt(args.year, 10);
    const startMs = new Date(year, 0, 1).getTime();
    const endMs = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    filtered = filtered.filter(
      (b) => b.fechaEntrada <= endMs && b.fechaSalida >= startMs,
    );
  } else if (args.month && args.year) {
    const year = parseInt(args.year, 10);
    const month = parseInt(args.month, 10) - 1; // 0-based
    const startMs = new Date(year, month, 1).getTime();
    const endMs = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    filtered = filtered.filter(
      (b) => b.fechaEntrada <= endMs && b.fechaSalida >= startMs,
    );
  }

  if (args.isDirect !== undefined) {
    filtered = filtered.filter((b) => b.isDirect === args.isDirect);
  }

  if (args.userEmail !== undefined) {
    filtered = filtered.filter((b) => b.correo === args.userEmail);
  }

  // Aplicar cursor si existe (filtrar manualmente después de obtener los resultados)
  if (args.cursor) {
    filtered = filtered.filter((b) => b._id > args.cursor!);
  }

  // Ordenar por fecha de creación (más recientes primero)
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}
