/**
 * Detección de "fuera de horario de atención" (zona America/Bogota, con
 * festivos de Colombia). El horario es configurable por tipo de día.
 */
import { isColombiaPublicHolidayYmd } from './colombiaPublicHolidays';

export type DayHours = { open: string; close: string };
export type Schedule = {
  weekday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  holiday: DayHours;
};

/** Horario por defecto (el que dio el negocio). */
export const DEFAULT_SCHEDULE: Schedule = {
  weekday: { open: '07:00', close: '18:30' },
  saturday: { open: '07:00', close: '16:00' },
  sunday: { open: '09:00', close: '16:00' },
  holiday: { open: '09:00', close: '14:00' },
};

/** Cliente CON historial, fuera de horario ({nombre} = "Sr./Sra. Nombre"). */
export const DEFAULT_RETURNING_MSG = `Hola {nombre}, buenas noches, gusto saludarte nuevamente 🌙✅

A esta hora nuestro equipo ya no se encuentra en horario de atención, pero no te preocupes: déjanos un audio o cuéntanos por este medio tu solicitud, y apenas retomemos seguimos contigo.
Y si estás alojado en una de nuestras propiedades y necesitas asistencia, indícanoslo por aquí y lo más pronto posible estaremos contigo ☺️✅`;

/** Cierre para cliente NUEVO fuera de horario (se envía al final de la atención). */
export const DEFAULT_NEW_CLOSING_MSG = `👋 ¡Gracias por comunicarte con FincasYa.com! 🏡

Hemos recibido tu solicitud.

En este momento nuestro equipo de expertos se encuentra fuera del horario de atención. Si deseas agregar más información, puedes responder a este chat o enviarnos un audio. Uno de nuestros expertos retomará tu solicitud y continuará brindándote atención tan pronto iniciemos nuestra próxima jornada laboral.`;

/**
 * Dedup por tiempo: cada mensaje de fuera de horario sale máximo una vez por
 * "noche". 18h cubre la ventana más larga (sáb 15:30 → dom 9:00 = 17.5h) sin
 * callar al cliente que vuelve la noche siguiente (>24h).
 */
export const OUT_OF_HOURS_DEDUP_MS = 18 * 60 * 60 * 1000;

/** Minutos desde medianoche de "HH:MM"; null si no es válido. */
function toMinutes(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Fecha (YYYY-MM-DD), día de semana (0=Dom..6=Sáb) y minutos, en zona Bogotá. */
function bogotaParts(nowMs: number): {
  ymd: string;
  weekday: number;
  minutes: number;
} {
  const d = new Date(nowMs);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  // Día de semana desde la fecha (Colombia no tiene horario de verano).
  const weekday = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return { ymd, weekday, minutes: hour * 60 + minute };
}

function resolveSchedule(schedule?: Partial<Schedule> | null): Schedule {
  return {
    weekday: schedule?.weekday ?? DEFAULT_SCHEDULE.weekday,
    saturday: schedule?.saturday ?? DEFAULT_SCHEDULE.saturday,
    sunday: schedule?.sunday ?? DEFAULT_SCHEDULE.sunday,
    holiday: schedule?.holiday ?? DEFAULT_SCHEDULE.holiday,
  };
}

/** "18:30" → "6:30 p. m." (formato Colombia). */
function to12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

/** Bloque de texto "🕒 Horario de atención…" a partir del schedule (single source). */
export function formatScheduleText(schedule?: Partial<Schedule> | null): string {
  const s = resolveSchedule(schedule);
  const range = (d: DayHours) => `${to12h(d.open)} a ${to12h(d.close)}`;
  return [
    '🕒 Horario de atención',
    `📅 Lunes a viernes: ${range(s.weekday)}`,
    `📅 Sábados: ${range(s.saturday)}`,
    `📅 Domingos: ${range(s.sunday)}`,
    `📅 Festivos: ${range(s.holiday)}`,
  ].join('\n');
}

/** ¿Estamos FUERA del horario de atención en este momento (Colombia)? */
export function isOutOfHours(
  nowMs: number,
  schedule?: Partial<Schedule> | null,
): boolean {
  const sch = resolveSchedule(schedule);
  const { ymd, weekday, minutes } = bogotaParts(nowMs);
  let day: DayHours;
  if (isColombiaPublicHolidayYmd(ymd)) day = sch.holiday;
  else if (weekday === 0) day = sch.sunday;
  else if (weekday === 6) day = sch.saturday;
  else day = sch.weekday;
  const open = toMinutes(day.open);
  const close = toMinutes(day.close);
  // Sin config válida → asumimos ABIERTO (no bloquear por error de datos).
  if (open == null || close == null) return false;
  return minutes < open || minutes >= close;
}
