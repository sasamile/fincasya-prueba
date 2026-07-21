/**
 * Extrae fechas / cupo / zona del texto del cliente para prellenar
 * el catálogo automático del inbox.
 */

const MONTH_ALIASES: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

const MONTH_ALT = Object.keys(MONTH_ALIASES).sort((a, b) => b.length - a.length).join('|');

export type CatalogChatHints = {
  fechaEntrada?: string;
  fechaSalida?: string;
  personas?: number;
  zona?: string;
  mascotas?: boolean;
};

function bogotaToday(): { y: number; m: number; d: number } {
  const raw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = raw.split('-').map((x) => Number(x));
  return { y: y!, m: m!, d: d! };
}

function toIso(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return undefined;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthNum(raw: string): number | undefined {
  return MONTH_ALIASES[raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')];
}

/** Elige año: si la entrada ya pasó hace >45 días, usa el siguiente. */
function pickYear(month: number, day: number, preferYear?: number): number {
  const today = bogotaToday();
  let y = preferYear ?? today.y;
  const start = Date.UTC(y, month - 1, day);
  const now = Date.UTC(today.y, today.m - 1, today.d);
  const daysPast = (now - start) / 86400000;
  if (preferYear == null && daysPast > 45) y += 1;
  return y;
}

function parseSpanishRanges(text: string): {
  fechaEntrada?: string;
  fechaSalida?: string;
} {
  const out: { fechaEntrada?: string; fechaSalida?: string } = {};

  // "30 de diciembre al 2 de enero" / "30 dic al 2 ene"
  const cross = new RegExp(
    `\\b(?:del?\\s+)?(\\d{1,2})\\s+(?:d(?:e)?\\s+)?(${MONTH_ALT})\\s+(?:al|a|-)\\s+(\\d{1,2})\\s+(?:d(?:e)?\\s+)?(${MONTH_ALT})(?:\\s+(?:de\\s+)?(20\\d{2}))?\\b`,
    'i',
  );
  const crossMatch = text.match(cross);
  if (crossMatch) {
    const d1 = Number(crossMatch[1]);
    const m1 = monthNum(crossMatch[2]!);
    const d2 = Number(crossMatch[3]);
    const m2 = monthNum(crossMatch[4]!);
    const yearHint = crossMatch[5] ? Number(crossMatch[5]) : undefined;
    if (m1 && m2) {
      let y1 = pickYear(m1, d1, yearHint);
      let y2 = yearHint ?? y1;
      if (m2 < m1 || (m2 === m1 && d2 < d1)) y2 = y1 + 1;
      else if (!yearHint) y2 = y1;
      const a = toIso(y1, m1, d1);
      const b = toIso(y2, m2, d2);
      if (a && b) {
        out.fechaEntrada = a;
        out.fechaSalida = b;
        return out;
      }
    }
  }

  // "16 al 19 de agosto" / "16 al 19 d agosto" / "del 16 al 19 agosto"
  const same = new RegExp(
    `\\b(?:del?\\s+)?(\\d{1,2})\\s*(?:al|-|a)\\s*(\\d{1,2})\\s+(?:d(?:e)?\\s+)?(${MONTH_ALT})(?:\\s+(?:de\\s+)?(20\\d{2}))?\\b`,
    'i',
  );
  const sameMatch = text.match(same);
  if (sameMatch) {
    const d1 = Number(sameMatch[1]);
    const d2 = Number(sameMatch[2]);
    const m = monthNum(sameMatch[3]!);
    const yearHint = sameMatch[4] ? Number(sameMatch[4]) : undefined;
    if (m && d2 >= d1) {
      const y = pickYear(m, d1, yearHint);
      const a = toIso(y, m, d1);
      const b = toIso(y, m, d2);
      if (a && b) {
        out.fechaEntrada = a;
        out.fechaSalida = b;
        return out;
      }
    }
  }

  // "16 de agosto al 19" (salida sin mes → mismo mes)
  const partial = new RegExp(
    `\\b(?:del?\\s+)?(\\d{1,2})\\s+(?:d(?:e)?\\s+)?(${MONTH_ALT})\\s+(?:al|a|-)\\s+(\\d{1,2})(?!\\s+(?:d(?:e)?\\s+)?(?:${MONTH_ALT}))(?:\\s+(?:de\\s+)?(20\\d{2}))?\\b`,
    'i',
  );
  const partialMatch = text.match(partial);
  if (partialMatch) {
    const d1 = Number(partialMatch[1]);
    const m = monthNum(partialMatch[2]!);
    const d2 = Number(partialMatch[3]);
    const yearHint = partialMatch[4] ? Number(partialMatch[4]) : undefined;
    if (m && d2 >= d1) {
      const y = pickYear(m, d1, yearHint);
      const a = toIso(y, m, d1);
      const b = toIso(y, m, d2);
      if (a && b) {
        out.fechaEntrada = a;
        out.fechaSalida = b;
      }
    }
  }

  return out;
}

/** Extrae fechas / cupo / zona aproximados del texto del cliente. */
export function extractCatalogHintsFromChat(text: string): CatalogChatHints {
  const out: CatalogChatHints = {};

  const isos = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]!);
  if (isos.length >= 2) {
    out.fechaEntrada = isos[0];
    out.fechaSalida = isos[1];
  } else {
    const dmys = [
      ...text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/g),
    ];
    if (dmys.length >= 2) {
      const toIsoLocal = (m: RegExpMatchArray) => {
        const d = m[1]!.padStart(2, '0');
        const mo = m[2]!.padStart(2, '0');
        return `${m[3]}-${mo}-${d}`;
      };
      out.fechaEntrada = toIsoLocal(dmys[0]!);
      out.fechaSalida = toIsoLocal(dmys[1]!);
    } else {
      Object.assign(out, parseSpanishRanges(text));
    }
  }

  const pers =
    text.match(/\b(\d{1,3})\s*(?:personas?|pax|gente)\b/i) ||
    text.match(/\bsomos\s+(?:unas?\s+)?(\d{1,3})\b/i) ||
    text.match(/\bpara\s+(\d{1,3})\b/i) ||
    text.match(/\bgrupo\s+de\s+(\d{1,3})\b/i);
  if (pers?.[1]) {
    const n = Number(pers[1]);
    if (n >= 1 && n <= 200) out.personas = n;
  }

  const zones = [
    'Villavicencio',
    'Llanos',
    'Meta',
    'Restrepo',
    'Acacias',
    'Cumaral',
    'Melgar',
    'Girardot',
    'Anapoima',
    'Apulo',
    'Tocaima',
    'Ricaurte',
    'Carmen de Apicalá',
    'Nilo',
    'Villeta',
    'Guaduas',
    'Honda',
    'Mariquita',
    'Ibagué',
    'Bogotá',
    'Cundinamarca',
    'Tolima',
    'Cartagena',
    'Santa Marta',
    'Barú',
    'Coveñas',
    'Tolú',
  ];
  const lower = text.toLowerCase();
  for (const z of zones) {
    if (lower.includes(z.toLowerCase())) {
      out.zona = z === 'Llanos' ? 'Llanos / Meta' : z;
      break;
    }
  }
  if (!out.zona && /\bcerca\s+(?:a|de)\s+bogot/i.test(text)) {
    out.zona = 'cerca a Bogotá';
  }
  if (!out.zona && /\bvillavo\b/i.test(text)) {
    out.zona = 'Villavicencio';
  }

  if (/\bmascotas?\b|\bperr[oa]s?\b|\bgat[oa]s?\b/i.test(text)) {
    out.mascotas = true;
  }

  return out;
}
