import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  type ReportBookingRow,
  shortenClientName,
  colombiaDayBounds,
  formatDateInputValue,
  resolveReportDeposit,
} from "./report-csv";

const BOGOTA_TZ = "America/Bogota";

const HEADERS = [
  "CR",
  "Finca",
  "Cliente",
  "Entrada",
  "Salida",
  "¿Pagó?",
  "¿Llegó?",
  "¿Pagó propietario?",
  "Banco",
  "Monto",
  "Depósito",
] as const;

/** Anchos de columna (CR más ancho para lectura cómoda). */
const COL_WIDTHS = [18, 30, 28, 14, 14, 12, 12, 18, 22, 16, 16];

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3864" },
};

const ROW_FILL_WHITE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};

const ROW_FILL_GRAY: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8E8E8" },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFBFBFBF" } },
  left: { style: "thin", color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
  right: { style: "thin", color: { argb: "FFBFBFBF" } },
};

function triLabel(v?: boolean): string {
  if (v === true) return "Sí";
  if (v === false) return "No";
  return "";
}

function fmtDate(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BOGOTA_TZ,
  }).format(new Date(ms));
}

function fmtMoney(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (n <= 0) return "";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(n);
}

function sheetLabelFromRange(from: Date, to: Date): string {
  const fromKey = formatDateInputValue(from);
  const toKey = formatDateInputValue(to);
  const fromD = new Date(`${fromKey}T12:00:00-05:00`);
  const toD = new Date(`${toKey}T12:00:00-05:00`);
  const fromLabel = format(fromD, "d MMM", { locale: es });
  const toLabel = format(toD, "d MMM", { locale: es });
  return fromKey === toKey
    ? `Reservas ${fromLabel}`
    : `Reservas ${fromLabel} - ${toLabel}`;
}

function rowToValues(r: ReportBookingRow): string[] {
  const sheet = r.reconciliationSheet ?? {};
  return [
    String(r.reference ?? r.id),
    r.propertyTitle,
    shortenClientName(r.clienteNombre, 32),
    fmtDate(r.fechaEntrada),
    fmtDate(r.fechaSalida),
    triLabel(sheet.turistaPago),
    triLabel(sheet.turistaLlego),
    triLabel(sheet.propietarioPago),
    r.banco?.trim() ?? "",
    fmtMoney(r.monto ?? r.turistaPagado ?? r.precioTotal),
    fmtMoney(resolveReportDeposit(r)),
  ];
}

function sortRows(rows: ReportBookingRow[]): ReportBookingRow[] {
  return [...rows].sort(
    (a, b) =>
      a.fechaEntrada - b.fechaEntrada ||
      a.propertyTitle.localeCompare(b.propertyTitle, "es") ||
      String(a.reference ?? a.id).localeCompare(
        String(b.reference ?? b.id),
        "es",
      ),
  );
}

type SheetChunk = { name: string; rows: ReportBookingRow[] };

function buildSheetChunk(
  rows: ReportBookingRow[],
  from: Date,
  to: Date,
): SheetChunk {
  return { name: sheetLabelFromRange(from, to), rows: sortRows(rows) };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 36;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });
}

function styleDataRow(row: ExcelJS.Row, rowIndex: number) {
  row.height = 32;
  const fill = rowIndex % 2 === 0 ? ROW_FILL_WHITE : ROW_FILL_GRAY;
  row.eachCell((cell, colNumber) => {
    cell.fill = fill;
    cell.font = { size: 12, bold: colNumber === 1 };
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === 1 || colNumber >= 6 ? "center" : "left",
      wrapText: colNumber <= 3,
    };
    cell.border = THIN_BORDER;
  });
}

function addSheet(workbook: ExcelJS.Workbook, chunk: SheetChunk) {
  const safeName = chunk.name.slice(0, 31);
  const ws = workbook.addWorksheet(safeName);

  ws.columns = COL_WIDTHS.map((width) => ({ width }));

  const headerRow = ws.addRow([...HEADERS]);
  styleHeaderRow(headerRow);

  chunk.rows.forEach((r, i) => {
    const dataRow = ws.addRow(rowToValues(r));
    styleDataRow(dataRow, i);
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function colombiaDayRangeBounds(
  from: Date,
  to: Date,
): { dateFrom: number; dateTo: number } {
  const start = from.getTime() <= to.getTime() ? from : to;
  const end = from.getTime() <= to.getTime() ? to : from;
  const { dateFrom } = colombiaDayBounds(start);
  const { dateTo } = colombiaDayBounds(end);
  return { dateFrom, dateTo };
}

export async function downloadStyledDailyReservationsExcel(
  from: Date,
  to: Date,
  rows: ReportBookingRow[],
): Promise<{ filename: string; rowCount: number }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FincasYa";
  workbook.created = new Date();

  const chunk = buildSheetChunk(rows, from, to);
  if (chunk.rows.length === 0) {
    throw new Error("No hay reservas para exportar.");
  }

  addSheet(workbook, chunk);

  const fromYmd = formatDateInputValue(from);
  const toYmd = formatDateInputValue(to);

  const filename =
    fromYmd === toYmd
      ? `reservas-${fromYmd}.xlsx`
      : `reservas-${fromYmd}_a_${toYmd}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, filename);
  return { filename, rowCount: rows.length };
}
