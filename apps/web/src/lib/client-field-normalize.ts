/** Normaliza texto de datos del cliente (contratos, reservas). */
export function toClientFieldUpper(value: string): string {
  return value.toLocaleUpperCase("es-CO");
}
