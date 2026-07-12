/**
 * Festivos de Colombia (calendario civil) en formato YYYY-MM-DD, zona Bogotá.
 * Portado de fincasya-new. Uso: detectar "puente festivo" para exigir mínimo
 * 2 noches (no se puede reservar 1 sola noche en un puente).
 *
 * Calendario 2025–2027 (traslados Ley Emiliani). Revisar cada año contra la
 * fuente oficial (Presidencia / MinTrabajo).
 */
const CO_PUBLIC_HOLIDAYS = new Set<string>([
  // 2025
  '2025-01-01', '2025-01-06', '2025-03-24', '2025-03-30', '2025-04-17',
  '2025-04-18', '2025-05-01', '2025-06-02', '2025-06-23', '2025-06-30',
  '2025-07-20', '2025-08-07', '2025-08-18', '2025-10-13', '2025-11-03',
  '2025-11-17', '2025-12-08', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
  '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
  '2026-11-16', '2026-12-08', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-29', '2027-04-01',
  '2027-04-02', '2027-05-01', '2027-05-17', '2027-06-07', '2027-06-14',
  '2027-06-21', '2027-07-05', '2027-07-20', '2027-08-07', '2027-08-16',
  '2027-10-18', '2027-11-01', '2027-11-15', '2027-12-08', '2027-12-25',
]);

export function isColombiaPublicHolidayYmd(ymd: string): boolean {
  return CO_PUBLIC_HOLIDAYS.has(ymd);
}

/** Suma (o resta) días a una fecha YYYY-MM-DD, en calendario civil (sin TZ). */
export function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Noches entre dos fechas YYYY-MM-DD (0 si inválidas o salida <= entrada). */
export function countNightsYmd(checkInYmd: string, checkOutYmd: string): number {
  const a = Date.parse(`${checkInYmd}T12:00:00-05:00`);
  const b = Date.parse(`${checkOutYmd}T12:00:00-05:00`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Todas las fechas YYYY-MM-DD entre a y b, inclusive (cap defensivo de 40 días). */
function ymdRangeInclusive(a: string, b: string): string[] {
  const out: string[] = [];
  let cur = a;
  for (let i = 0; i < 40 && cur <= b; i++) {
    out.push(cur);
    cur = ymdAddDays(cur, 1);
  }
  return out;
}

/**
 * ¿El rango de fechas cae en un PUENTE FESTIVO? Es puente si hay un festivo del
 * calendario colombiano dentro de la ventana {checkIn-1 … checkOut+1}. Cubre:
 *   - Sábado→Domingo con Lunes festivo (puente Emiliani clásico).
 *   - Domingo→Lunes festivo.
 *   - Viernes festivo→Sábado, Jueves→Viernes festivo (Semana Santa), etc.
 *   - Cualquier estadía que incluya o linde con un festivo.
 */
export function detectPuenteFestivo(
  checkInYmd: string,
  checkOutYmd: string,
): { puente: boolean; holidayYmd: string | null } {
  if (!checkInYmd || !checkOutYmd) return { puente: false, holidayYmd: null };
  const window = [
    ymdAddDays(checkInYmd, -1),
    ...ymdRangeInclusive(checkInYmd, checkOutYmd),
    ymdAddDays(checkOutYmd, 1),
  ];
  for (const d of window) {
    if (isColombiaPublicHolidayYmd(d)) return { puente: true, holidayYmd: d };
  }
  return { puente: false, holidayYmd: null };
}

/** Nombre humano del festivo (día de la semana + fecha larga) para el mensaje. */
export function humanHolidayEs(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt);
}
