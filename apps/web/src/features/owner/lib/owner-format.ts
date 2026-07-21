/** Utilidades de formato del panel del propietario. */

const TZ = "America/Bogota";

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export function formatDateLong(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(ms));
}

/** Noches entre entrada y salida (mínimo 1). */
export function nightsBetween(fromMs: number, toMs: number): number {
  return Math.max(1, Math.round((toMs - fromMs) / 86_400_000));
}

/**
 * Etiqueta relativa de la entrada: "Hoy", "Mañana", "En 5 días" o null si ya
 * pasó. Se calcula sobre días calendario en Bogotá, no sobre milisegundos.
 */
export function daysUntilLabel(ms: number, now = Date.now()): string | null {
  const dayKey = (t: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t));
  const start = Date.parse(`${dayKey(now)}T00:00:00Z`);
  const target = Date.parse(`${dayKey(ms)}T00:00:00Z`);
  const diff = Math.round((target - start) / 86_400_000);
  if (diff < 0) return null;
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `En ${diff} días`;
}

/** Documentos legales que el propietario debe cargar por finca. */
export const OWNER_DOC_FIELDS = [
  { key: "idCopyUrl", label: "Cédula", hint: "Documento de identidad" },
  {
    key: "bankCertificationUrl",
    label: "Certificación bancaria",
    hint: "Para los pagos",
  },
  { key: "rntPdfUrl", label: "RNT", hint: "Registro Nacional de Turismo" },
  {
    key: "chamberOfCommerceUrl",
    label: "Cámara de comercio",
    hint: "Si aplica",
  },
] as const;

export type OwnerDocKey = (typeof OWNER_DOC_FIELDS)[number]["key"];
/** El backend devuelve null cuando el documento no se ha cargado. */
export type OwnerDocuments = Partial<
  Record<OwnerDocKey, string | null | undefined>
>;

/** Cuántos documentos hay cargados de los requeridos. */
export function countDocs(documents: OwnerDocuments | undefined): {
  done: number;
  total: number;
} {
  const total = OWNER_DOC_FIELDS.length;
  const done = OWNER_DOC_FIELDS.filter((f) => documents?.[f.key]).length;
  return { done, total };
}
