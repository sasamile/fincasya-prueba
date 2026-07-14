/**
 * Programación de mensajes automáticos (hora Colombia + ancla relativa).
 * Defaults = comportamiento histórico del cron 9:00 AM.
 */

export type ScheduleAnchor = 'checkin' | 'checkout' | 'weekday';

export type MessageSchedule = {
  key: string;
  /** Hora local Colombia 0–23 */
  hourCO: number;
  anchor: ScheduleAnchor;
  /** Días antes del check-in o check-out (0 = el mismo día). */
  offsetDays: number;
  /** Solo si anchor === 'weekday': 0=dom … 1=lun … 6=sáb */
  weekday?: number;
};

export const DEFAULT_SCHEDULES: Record<string, MessageSchedule> = {
  tourist_departure: {
    key: 'tourist_departure',
    hourCO: 9,
    anchor: 'checkout',
    offsetDays: 0,
  },
  tourist_checkin_start: {
    key: 'tourist_checkin_start',
    hourCO: 9,
    anchor: 'checkin',
    offsetDays: 3,
  },
  tourist_checkin_pending: {
    key: 'tourist_checkin_pending',
    hourCO: 9,
    anchor: 'checkin',
    offsetDays: 1,
  },
  tourist_travel_tomorrow: {
    key: 'tourist_travel_tomorrow',
    hourCO: 9,
    anchor: 'checkin',
    offsetDays: 1,
  },
  owner_arrival_tomorrow: {
    key: 'owner_arrival_tomorrow',
    hourCO: 9,
    anchor: 'checkin',
    offsetDays: 1,
  },
  owner_week_reminder: {
    key: 'owner_week_reminder',
    hourCO: 9,
    anchor: 'weekday',
    offsetDays: 0,
    weekday: 1, // lunes
  },
  booking_reminder_email: {
    key: 'booking_reminder_email',
    hourCO: 8,
    anchor: 'checkin',
    offsetDays: 3,
  },
};

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

export function formatHourCO(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

export function formatScheduleLabel(s: MessageSchedule): string {
  const hour = formatHourCO(s.hourCO);
  if (s.anchor === 'weekday') {
    const day = WEEKDAY_SHORT[s.weekday ?? 1] ?? 'Lun';
    return `${day} ${hour}`;
  }
  if (s.anchor === 'checkout') {
    if (s.offsetDays === 0) return `${hour} · día de salida`;
    if (s.offsetDays === 1) return `${hour} · día antes de la salida`;
    return `${hour} · ${s.offsetDays} días antes de la salida`;
  }
  if (s.offsetDays === 0) return `${hour} · día de ingreso`;
  if (s.offsetDays === 1) return `${hour} · día antes del ingreso`;
  return `${hour} · ${s.offsetDays} días antes del ingreso`;
}

export function mergeSchedules(
  overrides: MessageSchedule[] | null | undefined,
): Record<string, MessageSchedule> {
  const out: Record<string, MessageSchedule> = { ...DEFAULT_SCHEDULES };
  for (const raw of overrides ?? []) {
    if (!raw?.key || !(raw.key in DEFAULT_SCHEDULES)) continue;
    const base = DEFAULT_SCHEDULES[raw.key]!;
    const hourCO = Math.min(23, Math.max(0, Math.floor(Number(raw.hourCO))));
    const offsetDays = Math.min(
      30,
      Math.max(0, Math.floor(Number(raw.offsetDays ?? base.offsetDays))),
    );
    const weekday =
      raw.weekday == null
        ? base.weekday
        : Math.min(6, Math.max(0, Math.floor(Number(raw.weekday))));
    out[raw.key] = {
      key: raw.key,
      hourCO: Number.isFinite(hourCO) ? hourCO : base.hourCO,
      anchor: base.anchor,
      offsetDays: Number.isFinite(offsetDays) ? offsetDays : base.offsetDays,
      ...(base.anchor === 'weekday' ? { weekday: weekday ?? 1 } : {}),
    };
  }
  return out;
}

/** Hora actual 0–23 en America/Bogota. */
export function bogotaHourNow(now = new Date()): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      hour12: false,
    }).format(now),
    10,
  );
}

/** Weekday 0=dom…6=sáb en America/Bogota. */
export function bogotaWeekdayNow(now = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? 0;
}
