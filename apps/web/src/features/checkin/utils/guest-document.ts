export const GUEST_DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "RC", label: "Registro civil" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PA", label: "Pasaporte" },
] as const;

export type GuestDocumentType = (typeof GUEST_DOCUMENT_TYPES)[number]["value"];

export const GUEST_DOCUMENT_LABELS: Record<GuestDocumentType, string> =
  Object.fromEntries(
    GUEST_DOCUMENT_TYPES.map((t) => [t.value, t.label]),
  ) as Record<GuestDocumentType, string>;

export const DEFAULT_GUEST_DOCUMENT_TYPE: GuestDocumentType = "CC";

export function normalizeGuestDocumentType(
  value?: string | null,
): GuestDocumentType {
  const upper = String(value ?? "")
    .trim()
    .toUpperCase();
  return (
    GUEST_DOCUMENT_TYPES.find((t) => t.value === upper)?.value ??
    DEFAULT_GUEST_DOCUMENT_TYPE
  );
}

export function formatGuestDocument(
  tipo?: string | null,
  numero?: string | null,
): string {
  const docType = normalizeGuestDocumentType(tipo);
  const number = String(numero ?? "").trim();
  if (!number) return "Sin documento";
  return `${docType} ${number}`;
}

export function isNumericGuestDocumentType(tipo?: string | null): boolean {
  const docType = normalizeGuestDocumentType(tipo);
  return docType === "CC" || docType === "TI" || docType === "RC" || docType === "CE";
}

/** Documentos que corresponden a menores de edad: Tarjeta de identidad y Registro civil. */
export function isMinorGuestDocumentType(tipo?: string | null): boolean {
  const docType = normalizeGuestDocumentType(tipo);
  return docType === "TI" || docType === "RC";
}

export function sanitizeGuestDocumentNumber(
  tipo: string,
  value: string,
): string {
  const docType = normalizeGuestDocumentType(tipo);
  if (docType === "PA") {
    return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
  return value.replace(/\D/g, "");
}

const MIN_NUMERIC_DOC_LENGTH = 5;
const MAX_NUMERIC_DOC_LENGTH = 10;
const MIN_PASSPORT_LENGTH = 6;

function isTrivialNumericPattern(digits: string): boolean {
  if (digits.length < 2) return false;
  if (/^(\d)\1+$/.test(digits)) return true;

  let ascending = true;
  for (let i = 1; i < digits.length; i++) {
    if (Number(digits[i]) !== Number(digits[i - 1]) + 1) {
      ascending = false;
      break;
    }
  }
  if (ascending) return true;

  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    if (Number(digits[i]) !== Number(digits[i - 1]) - 1) {
      descending = false;
      break;
    }
  }
  return descending;
}

export function validateGuestDocument(
  tipo?: string | null,
  numero?: string | null,
): string | null {
  const number = String(numero ?? "").trim();
  if (!number) return "Falta el número de documento.";
  const docType = normalizeGuestDocumentType(tipo);
  if (isNumericGuestDocumentType(docType)) {
    if (!/^\d+$/.test(number)) {
      return "El documento debe contener solo números.";
    }
    if (number.length < MIN_NUMERIC_DOC_LENGTH) {
      return `El documento debe tener al menos ${MIN_NUMERIC_DOC_LENGTH} dígitos.`;
    }
    if (number.length > MAX_NUMERIC_DOC_LENGTH) {
      return `El documento no puede tener más de ${MAX_NUMERIC_DOC_LENGTH} dígitos.`;
    }
    if (isTrivialNumericPattern(number)) {
      return "El número de documento no parece válido (evita secuencias o dígitos repetidos).";
    }
    return null;
  }
  if (docType === "PA") {
    if (!/^[A-Z0-9]+$/.test(number)) {
      return "El pasaporte solo puede tener letras y números.";
    }
    if (number.length < MIN_PASSPORT_LENGTH) {
      return `El pasaporte debe tener al menos ${MIN_PASSPORT_LENGTH} caracteres.`;
    }
  }
  return null;
}

/** Parsea "Nombre TI 123456" o "Nombre CC 123" desde observaciones guardadas. */
export function parseGuestFromObservacionesText(text: string): {
  nombreCompleto: string;
  cedula: string;
  tipoDocumento: GuestDocumentType;
} {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^(.*?)(?:\s+(CC|TI|RC|CE|PA)\s+([A-Za-z0-9]+))?$/,
  );
  return {
    nombreCompleto: (match?.[1] ?? trimmed).trim(),
    tipoDocumento: normalizeGuestDocumentType(match?.[2]),
    cedula: match?.[3] ?? "",
  };
}
