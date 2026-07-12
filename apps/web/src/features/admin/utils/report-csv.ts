export type ReconciliationSheet = {
  turistaPago?: boolean;
  turistaLlego?: boolean;
  propietarioPago?: boolean;
  checkinListo?: boolean;
  notas?: string;
  updatedAt?: number;
  updatedBy?: string;
};

export type OwnerPayoutReport = {
  valorAcordado?: number | null;
  abono?: number | null;
  valor?: number | null;
  fecha?: string | null;
  medio?: string | null;
  abonos?: Array<{
    id: string;
    amount: number;
    fecha?: string | null;
    medio?: string | null;
    createdAt: number;
    actor?: string | null;
  }> | null;
};

export type ReportBookingRow = {
  id: string;
  propertyId?: string;
  reference: string | null;
  propertyTitle: string;
  propietarioNombre: string | null;
  numeroPersonas: number;
  invitadosRegistrados?: number;
  valorAlquiler?: number;
  descuentos?: number;
  valorNetoAlquiler?: number;
  deposito?: number;
  aseo?: number;
  netoAlquiler: number;
  precioTotal: number;
  turistaPagado?: number;
  turistaPendiente?: number;
  valorOfertaPropietario?: number;
  propietarioPagado?: number;
  ganancia?: number;
  fechaEntrada: number;
  fechaSalida: number;
  status: string;
  paymentStatus: string;
  clienteNombre: string;
  checkinCompleted?: boolean;
  ownerPayout: OwnerPayoutReport | null;
  reconciliationSheet?: ReconciliationSheet | null;
  banco?: string;
  monto?: number;
};

const BOGOTA_TZ = "America/Bogota";

/** Fecha de calendario local (sin desfase UTC del input type="date"). */
export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

export function formatDateInputValue(day: Date): string {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calendarDateToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Inicio y fin del día en Colombia (para filtrar ingresos del día). */
export function colombiaDayBounds(day: Date): { dateFrom: number; dateTo: number } {
  const ymd = formatDateInputValue(day);
  return {
    dateFrom: new Date(`${ymd}T00:00:00.000-05:00`).getTime(),
    dateTo: new Date(`${ymd}T23:59:59.999-05:00`).getTime(),
  };
}

/** Abrevia nombre del cliente para caber en la plantilla operativa. */
export function shortenClientName(name: string, maxLen = 28): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (upper.length <= maxLen) return upper;

  const parts = upper.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const short = `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
    if (short.length <= maxLen) return short;
  }

  return `${upper.slice(0, Math.max(1, maxLen - 1))}…`;
}

/** Depósito para reportes cuando el campo guardado viene en 0 (reservas legacy). */
export function resolveReportDeposit(row: ReportBookingRow): number {
  const garantia = Number(row.deposito) || 0;
  if (garantia > 0) return garantia;

  const total = Number(row.precioTotal) || 0;
  const neto = Number(row.valorNetoAlquiler ?? row.netoAlquiler) || 0;
  const aseo = Number(row.aseo) || 0;

  if (total > 0 && neto > 0) {
    const implied = Math.max(0, total - neto - aseo);
    if (implied > 0) return implied;
  }

  return 0;
}

function fmtMoney(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (n <= 0) return "";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(ms));
}

/** Excel en español (Colombia) usa punto y coma, no coma. */
const CSV_SEP = ";";

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",;\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function rowsToCsv(headers: string[], rows: string[][]): string {
  const lines = [
    `sep=${CSV_SEP}`,
    headers.map(csvCell).join(CSV_SEP),
    ...rows.map((row) => row.map(csvCell).join(CSV_SEP)),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function triLabel(v?: boolean): string {
  if (v === true) return "Sí";
  if (v === false) return "No";
  return "";
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReportSheetData = {
  headers: string[];
  rows: string[][];
  sheetName: string;
};

function yieldReconciliationHeaders(): string[] {
  return [
    "CR",
    "Finca",
    "Cliente",
    "Entrada",
    "Salida",
    "Pax reserva",
    "Invitados check-in",
    "Valor alquiler",
    "Descuentos",
    "Neto alquiler turista (sin depósito/aseo)",
    "Depósito",
    "Aseo",
    "Total reserva",
    "Turista pagado",
    "Turista pendiente",
    "Oferta propietario",
    "Propietario pagado",
    "Ganancia",
    "¿Pagó?",
    "¿Llegó?",
    "¿Pagó propietario?",
    "Check-in OK",
    "Notas",
  ];
}

function yieldReconciliationRows(rows: ReportBookingRow[]): string[][] {
  return rows.map((r) => {
    const sheet = r.reconciliationSheet ?? {};
    return [
      r.reference ?? r.id,
      r.propertyTitle,
      r.clienteNombre,
      fmtDate(r.fechaEntrada),
      fmtDate(r.fechaSalida),
      String(r.numeroPersonas),
      String(r.invitadosRegistrados ?? 0),
      String(r.valorAlquiler ?? r.netoAlquiler),
      String(r.descuentos ?? 0),
      String(r.valorNetoAlquiler ?? r.netoAlquiler),
      String(r.deposito ?? 0),
      String(r.aseo ?? 0),
      String(r.precioTotal),
      String(r.turistaPagado ?? 0),
      String(r.turistaPendiente ?? 0),
      String(r.valorOfertaPropietario ?? 0),
      String(r.propietarioPagado ?? 0),
      String(r.ganancia ?? 0),
      triLabel(sheet.turistaPago),
      triLabel(sheet.turistaLlego),
      triLabel(sheet.propietarioPago),
      triLabel(sheet.checkinListo),
      sheet.notas ?? "",
    ];
  });
}

export function buildYieldReconciliationSheetData(
  rows: ReportBookingRow[],
): ReportSheetData {
  return {
    headers: yieldReconciliationHeaders(),
    rows: yieldReconciliationRows(rows),
    sheetName: "Cuadro rendimientos",
  };
}

export function buildYieldReconciliationCsv(rows: ReportBookingRow[]): string {
  const { headers, rows: data } = buildYieldReconciliationSheetData(rows);
  return rowsToCsv(headers, data);
}

export function buildReservationsCsv(rows: ReportBookingRow[]): string {
  return buildYieldReconciliationCsv(rows);
}

function dailyReservationsHeaders(): string[] {
  return [
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
  ];
}

function dailyReservationsRows(rows: ReportBookingRow[]): string[][] {
  return rows.map((r) => {
    const sheet = r.reconciliationSheet ?? {};
    return [
      r.reference ?? r.id,
      r.propertyTitle,
      shortenClientName(r.clienteNombre),
      fmtDate(r.fechaEntrada),
      fmtDate(r.fechaSalida),
      triLabel(sheet.turistaPago),
      triLabel(sheet.turistaLlego),
      triLabel(sheet.propietarioPago),
      r.banco?.trim() ?? "",
      fmtMoney(r.monto ?? r.turistaPagado ?? r.precioTotal),
      fmtMoney(resolveReportDeposit(r)),
    ];
  });
}

export function buildDailyReservationsSheetData(
  rows: ReportBookingRow[],
): ReportSheetData {
  const sorted = [...rows].sort(
    (a, b) =>
      a.propertyTitle.localeCompare(b.propertyTitle, "es") ||
      String(a.reference ?? a.id).localeCompare(
        String(b.reference ?? b.id),
        "es",
      ),
  );

  return {
    headers: dailyReservationsHeaders(),
    rows: dailyReservationsRows(sorted),
    sheetName: "Reservas del día",
  };
}

export async function downloadDailyReservationsExcel(
  from: Date,
  to: Date,
  rows: ReportBookingRow[],
): Promise<{ filename: string; rowCount: number }> {
  const { downloadStyledDailyReservationsExcel } = await import(
    "./daily-reservations-excel"
  );
  return downloadStyledDailyReservationsExcel(from, to, rows);
}

function resolveOwnerAbonos(op: OwnerPayoutReport | null) {
  if (!op) return [] as Array<{
    amount: number;
    fecha?: string | null;
    medio?: string | null;
    index: number;
  }>;

  if (Array.isArray(op.abonos) && op.abonos.length > 0) {
    return op.abonos.map((a, i) => ({
      amount: a.amount,
      fecha: a.fecha,
      medio: a.medio,
      index: i + 1,
    }));
  }

  const amount = Number(op.abono || op.valor || 0);
  if (amount > 0) {
    return [
      {
        amount,
        fecha: op.fecha,
        medio: op.medio,
        index: 1,
      },
    ];
  }

  return [];
}

function ownerPayoutsHeaders(): string[] {
  return [
    "Finca",
    "Propietario",
    "CR",
    "Fecha entrada",
    "Valor acordado",
    "Abono #",
    "Valor abono",
    "Fecha abono",
    "Medio",
    "Saldo pendiente",
  ];
}

function ownerPayoutsRows(rows: ReportBookingRow[]): string[][] {
  const data: string[][] = [];

  for (const r of rows) {
    const op = r.ownerPayout;
    const valorAcordado = Number(op?.valorAcordado || 0);
    const abonos = resolveOwnerAbonos(op);

    if (abonos.length === 0) {
      if (valorAcordado <= 0) continue;
      data.push([
        r.propertyTitle,
        r.propietarioNombre ?? "",
        r.reference ?? r.id,
        fmtDate(r.fechaEntrada),
        String(valorAcordado),
        "",
        "",
        "",
        "",
        String(valorAcordado),
      ]);
      continue;
    }

    const totalPagado = abonos.reduce((s, a) => s + a.amount, 0);
    const saldo = Math.max(0, valorAcordado - totalPagado);

    for (const abono of abonos) {
      data.push([
        r.propertyTitle,
        r.propietarioNombre ?? "",
        r.reference ?? r.id,
        fmtDate(r.fechaEntrada),
        String(valorAcordado),
        String(abono.index),
        String(abono.amount),
        abono.fecha ?? "",
        abono.medio ?? "",
        String(saldo),
      ]);
    }
  }

  return data;
}

export function buildOwnerPayoutsSheetData(
  rows: ReportBookingRow[],
): ReportSheetData {
  return {
    headers: ownerPayoutsHeaders(),
    rows: ownerPayoutsRows(rows),
    sheetName: "Pagos propietario",
  };
}

export function buildOwnerPayoutsCsv(rows: ReportBookingRow[]): string {
  const { headers, rows: data } = buildOwnerPayoutsSheetData(rows);
  return rowsToCsv(headers, data);
}

export async function downloadReportExcel(
  filename: string,
  sheet: ReportSheetData,
): Promise<void> {
  const XLSX = await import("xlsx");
  const aoa = [sheet.headers, ...sheet.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = sheet.headers.map((header, colIndex) => ({
    wch: Math.min(
      48,
      Math.max(
        header.length + 2,
        ...sheet.rows.map((row) => String(row[colIndex] ?? "").length),
      ),
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
