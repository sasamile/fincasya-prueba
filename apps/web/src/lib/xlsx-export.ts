/**
 * Generación de archivos Excel (.xlsx) en el navegador con SheetJS.
 * Se usa en la página de Reportes: libro de movimientos e importación de terceros.
 */
import * as XLSX from "xlsx";

export type MovimientoRow = {
  fecha: string;
  finca: string;
  operacion: string;
  entidad: string;
  ingreso: number;
  egreso: number;
  observaciones: string;
  nombre: string;
  cedula: string;
  /** Desglose: de qué reserva es y quiénes son las partes. */
  reserva?: string;
  cliente?: string;
  clienteCedula?: string;
  propietario?: string;
  propietarioCedula?: string;
};

/** Una fila por reserva: el resumen de negocio que revisa la contadora. */
export type DesgloseReservaRow = {
  reserva: string;
  finca: string;
  ubicacion: string;
  fechaEntrada: string;
  fechaSalida: string;
  noches: number;
  personas: number;
  cliente: string;
  clienteCedula: string;
  clienteTelefono: string;
  propietario: string;
  propietarioCedula: string;
  valorReserva: number;
  cobradoCliente: number;
  reembolsadoCliente: number;
  acordadoPropietario: number;
  pagadoPropietario: number;
  saldoPropietario: number;
  devolucionDeposito: number;
  gananciaFincasya: number;
  estado: string;
};

export type TerceroRow = {
  identificacion: string;
  nombres: string;
  apellidos: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  correo: string;
};

/** Ajusta el ancho de columnas al contenido (aproximado). */
function autofit(rows: Record<string, unknown>[]): { wch: number }[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    const maxLen = rows.reduce((max, r) => {
      const len = String(r[k] ?? "").length;
      return len > max ? len : max;
    }, k.length);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
}

/**
 * Libro de movimientos (ingresos/egresos), con las mismas columnas del formato
 * que usa el equipo: FECHA · NOMBRE (finca) · OPERACIÓN · ENTIDAD · INGRESO ·
 * EGRESO · OBSERVACIONES · NOMBRE (cliente) · CEDULA.
 */
export function exportMovimientosXlsx(
  rows: MovimientoRow[],
  filename: string,
): void {
  const data = rows.map((r) => ({
    FECHA: r.fecha,
    RESERVA: r.reserva ?? "",
    "NOMBRE FINCA": r.finca,
    "OPERACIÓN": r.operacion,
    ENTIDAD: r.entidad,
    INGRESO: r.ingreso || "",
    EGRESO: r.egreso || "",
    OBSERVACIONES: r.observaciones,
    NOMBRE: r.nombre,
    CEDULA: r.cedula,
    CLIENTE: r.cliente ?? "",
    "CÉDULA CLIENTE": r.clienteCedula ?? "",
    PROPIETARIO: r.propietario ?? "",
    "CÉDULA PROPIETARIO": r.propietarioCedula ?? "",
  }));

  const totalIngresos = rows.reduce((s, r) => s + (r.ingreso || 0), 0);
  const totalEgresos = rows.reduce((s, r) => s + (r.egreso || 0), 0);
  data.push({
    FECHA: "",
    RESERVA: "",
    "NOMBRE FINCA": "",
    "OPERACIÓN": "TOTALES",
    ENTIDAD: "",
    INGRESO: totalIngresos || "",
    EGRESO: totalEgresos || "",
    OBSERVACIONES: `Neto: ${totalIngresos - totalEgresos}`,
    NOMBRE: "",
    CEDULA: "",
    CLIENTE: "",
    "CÉDULA CLIENTE": "",
    PROPIETARIO: "",
    "CÉDULA PROPIETARIO": "",
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = autofit(data as Record<string, unknown>[]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  XLSX.writeFile(wb, filename);
}

/**
 * Terceros/clientes en el formato estándar de importación de Siigo Nube.
 * (Encabezados/orden ajustables cuando se tenga la plantilla exacta del cliente.)
 */
export function exportTercerosSiigoXlsx(
  terceros: TerceroRow[],
  filename: string,
): void {
  const data = terceros.map((t) => ({
    "Tipo de persona": "Persona natural",
    "Tipo de identificación": "Cédula de ciudadanía",
    "Identificación": t.identificacion,
    "Nombres": t.nombres,
    "Apellidos": t.apellidos,
    "Ciudad": t.ciudad,
    "Dirección": t.direccion,
    "Teléfono": t.telefono,
    "Correo electrónico": t.correo,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = autofit(data as Record<string, unknown>[]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Terceros");
  XLSX.writeFile(wb, filename);
}

/**
 * DESGLOSE POR RESERVA para la contadora (Adriana, 22-jul).
 *
 * Una fila por reserva con las dos partes (cliente y propietario) y la plata:
 * lo cobrado, lo pagado al dueño, lo devuelto y lo que quedó para FincasYa.
 */
export function exportDesgloseReservasXlsx(
  rows: DesgloseReservaRow[],
  filename: string,
): void {
  const data: Record<string, string | number>[] = rows.map((r) => ({
    RESERVA: r.reserva,
    FINCA: r.finca,
    UBICACIÓN: r.ubicacion,
    "FECHA ENTRADA": r.fechaEntrada,
    "FECHA SALIDA": r.fechaSalida,
    NOCHES: r.noches,
    PERSONAS: r.personas,
    CLIENTE: r.cliente,
    "CÉDULA CLIENTE": r.clienteCedula,
    "TELÉFONO CLIENTE": r.clienteTelefono,
    PROPIETARIO: r.propietario,
    "CÉDULA PROPIETARIO": r.propietarioCedula,
    "VALOR RESERVA": r.valorReserva || "",
    "COBRADO AL CLIENTE": r.cobradoCliente || "",
    "REEMBOLSADO AL CLIENTE": r.reembolsadoCliente || "",
    "ACORDADO CON PROPIETARIO": r.acordadoPropietario || "",
    "PAGADO AL PROPIETARIO": r.pagadoPropietario || "",
    "SALDO AL PROPIETARIO": r.saldoPropietario || "",
    "DEVOLUCIÓN DEPÓSITO": r.devolucionDeposito || "",
    "GANANCIA FINCASYA": r.gananciaFincasya || "",
    ESTADO: r.estado,
  }));

  const suma = (k: keyof DesgloseReservaRow) =>
    rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  data.push({
    RESERVA: "",
    FINCA: "",
    UBICACIÓN: "",
    "FECHA ENTRADA": "",
    "FECHA SALIDA": "",
    NOCHES: "",
    PERSONAS: "",
    CLIENTE: "TOTALES",
    "CÉDULA CLIENTE": "",
    "TELÉFONO CLIENTE": "",
    PROPIETARIO: "",
    "CÉDULA PROPIETARIO": "",
    "VALOR RESERVA": suma("valorReserva") || "",
    "COBRADO AL CLIENTE": suma("cobradoCliente") || "",
    "REEMBOLSADO AL CLIENTE": suma("reembolsadoCliente") || "",
    "ACORDADO CON PROPIETARIO": suma("acordadoPropietario") || "",
    "PAGADO AL PROPIETARIO": suma("pagadoPropietario") || "",
    "SALDO AL PROPIETARIO": suma("saldoPropietario") || "",
    "DEVOLUCIÓN DEPÓSITO": suma("devolucionDeposito") || "",
    "GANANCIA FINCASYA": suma("gananciaFincasya") || "",
    ESTADO: "",
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = autofit(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Desglose reservas");
  XLSX.writeFile(wb, filename);
}
