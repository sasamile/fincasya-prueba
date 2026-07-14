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
    "NOMBRE FINCA": r.finca,
    "OPERACIÓN": r.operacion,
    ENTIDAD: r.entidad,
    INGRESO: r.ingreso || "",
    EGRESO: r.egreso || "",
    OBSERVACIONES: r.observaciones,
    NOMBRE: r.nombre,
    CEDULA: r.cedula,
  }));

  const totalIngresos = rows.reduce((s, r) => s + (r.ingreso || 0), 0);
  const totalEgresos = rows.reduce((s, r) => s + (r.egreso || 0), 0);
  data.push({
    FECHA: "",
    "NOMBRE FINCA": "",
    "OPERACIÓN": "TOTALES",
    ENTIDAD: "",
    INGRESO: totalIngresos || "",
    EGRESO: totalEgresos || "",
    OBSERVACIONES: `Neto: ${totalIngresos - totalEgresos}`,
    NOMBRE: "",
    CEDULA: "",
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
