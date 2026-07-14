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

/** Día de la semana (0=domingo … 6=sábado) de una fecha YYYY-MM-DD. */
function dayOfWeekYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function isWeekendYmd(ymd: string): boolean {
  const dow = dayOfWeekYmd(ymd);
  return dow === 0 || dow === 6;
}

/**
 * Bloque de puente de un festivo: el festivo extendido sobre los fines de
 * semana y festivos contiguos, y arrancando desde el VIERNES (regla del
 * equipo: lunes 20 festivo → el puente es viernes 17, sábado 18, domingo 19
 * y lunes 20 — reservar 1 sola noche dentro de ese bloque no se permite).
 */
export function puenteBlockForHoliday(holidayYmd: string): {
  start: string;
  end: string;
} {
  let start = holidayYmd;
  for (let i = 0; i < 10; i++) {
    const prev = ymdAddDays(start, -1);
    if (isWeekendYmd(prev) || isColombiaPublicHolidayYmd(prev)) start = prev;
    else break;
  }
  // El puente cuenta desde el viernes: si el bloque arranca en sábado, se
  // incluye el viernes anterior (la gente viaja desde el viernes).
  if (dayOfWeekYmd(start) === 6) start = ymdAddDays(start, -1);
  let end = holidayYmd;
  for (let i = 0; i < 10; i++) {
    const next = ymdAddDays(end, 1);
    if (isWeekendYmd(next) || isColombiaPublicHolidayYmd(next)) end = next;
    else break;
  }
  return { start, end };
}

/**
 * ¿La estadía cae en un PUENTE FESTIVO? Es puente si alguna NOCHE de la
 * estadía (checkIn … checkOut-1) cae dentro del bloque de puente de un
 * festivo colombiano. Cubre:
 *   - Viernes→Sábado con Lunes festivo (el puente arranca el viernes).
 *   - Sábado→Domingo con Lunes festivo (puente Emiliani clásico).
 *   - Domingo→Lunes festivo, Viernes festivo→Sábado, Semana Santa, etc.
 */
export function detectPuenteFestivo(
  checkInYmd: string,
  checkOutYmd: string,
): { puente: boolean; holidayYmd: string | null } {
  if (!checkInYmd || !checkOutYmd) return { puente: false, holidayYmd: null };
  const lastNight = ymdAddDays(checkOutYmd, -1);
  if (lastNight < checkInYmd) return { puente: false, holidayYmd: null };
  // Festivos cercanos: un bloque de puente se extiende como mucho unos días
  // alrededor de la estadía (viernes previo, festivos encadenados).
  const scan = ymdRangeInclusive(
    ymdAddDays(checkInYmd, -5),
    ymdAddDays(checkOutYmd, 5),
  );
  for (const d of scan) {
    if (!isColombiaPublicHolidayYmd(d)) continue;
    const block = puenteBlockForHoliday(d);
    // ¿Alguna noche de la estadía se solapa con el bloque del puente?
    if (checkInYmd <= block.end && lastNight >= block.start) {
      return { puente: true, holidayYmd: d };
    }
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
