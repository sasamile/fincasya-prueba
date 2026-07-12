const HOUR_MS = 60 * 60 * 1000;
const BOGOTA_OFFSET_MS = 5 * HOUR_MS;

function parseHourMinute(hora?: string | null): { h: number; m: number } {
  const raw = String(hora ?? "").trim();
  if (!raw) return { h: 16, m: 0 };

  const m24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return {
      h: Math.min(23, Math.max(0, parseInt(m24[1], 10))),
      m: Math.min(59, Math.max(0, parseInt(m24[2], 10))),
    };
  }

  const m12 = raw.match(
    /^(\d{1,2}):(\d{2})\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)$/i,
  );
  if (m12) {
    let h = parseInt(m12[1], 10) % 12;
    if (/p/i.test(m12[3])) h += 12;
    return { h, m: Math.min(59, Math.max(0, parseInt(m12[2], 10))) };
  }

  return { h: 16, m: 0 };
}

function departureTimestampMs(
  fechaSalida: number,
  horaSalida?: string | null,
): number {
  const DAY = 24 * HOUR_MS;
  const dayIndex = Math.floor((fechaSalida - BOGOTA_OFFSET_MS) / DAY);
  const dayStartUtc = dayIndex * DAY + BOGOTA_OFFSET_MS;
  const { h, m } = parseHourMinute(horaSalida);
  return dayStartUtc + h * HOUR_MS + m * 60 * 1000;
}

/** Tras la hora de salida el portal de check-in ya no debe estar disponible. */
export function isReservationEndedForCheckin(
  fechaSalida: number,
  horaSalida?: string | null,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(fechaSalida) || fechaSalida <= 0) return false;
  return now >= departureTimestampMs(fechaSalida, horaSalida);
}
