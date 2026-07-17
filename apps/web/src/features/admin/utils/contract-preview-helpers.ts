import type { FincaData } from "./contract-utils";
import { numberToSpanishTextCO } from "./contract-number-words";
import {
  formatFincaFeaturesPlain,
  formatHabitacionesContractLine,
} from "@/lib/server/contract-values";

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function formatSpanishContractGenerationDate(d = new Date()): string {
  return `${d.getDate()} dias del mes de ${MONTHS_ES[d.getMonth()]} del ${d.getFullYear()}`;
}

export function formatSpanishContractStayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return "";
  const monthIndex = Number(m) - 1;
  const monthName = MONTHS_ES[monthIndex];
  if (!monthName) return "";
  return `${Number(day)} de ${monthName.toLowerCase()} del ${y}`;
}

/** @deprecated Usar formatSpanishContractStayDate en contratos. */
export function isoDateToDdMmYyyy(iso: string): string {
  if (!iso) return "";
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return "";
  return `${day}/${m}/${y}`;
}

type PreviewProperty = {
  title: string;
  location?: string;
  code?: string;
  capacity?: number;
  features?: unknown[];
  zoneOrder?: string[];
};

type PreviewFormSlice = {
  contractNumber: string;
  clientName: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientId: string;
  clientDocType?: string;
  clientDocIssuedAt?: string;
  clientEmail: string;
  clientPhone: string;
  clientCity: string;
  clientAddress: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  /** Opcional: override del # de habitaciones; si vacío se cuentan zonas. */
  habitaciones?: string;
};

/**
 * Texto de habitaciones para {{caracteristicasDeFinca}} (ej. "09 HABITACIONES").
 * @deprecated Preferir formatHabitacionesContractLine / formatFincaFeaturesPlain.
 */
export function formatHabitacionesText(value: string | undefined | null): string {
  return formatHabitacionesContractLine(value);
}

/** Opcional: datos guardados en admin para {{nombrePropietario}} y cédula en el contrato. */
export type ContractOwnerOverrideInput = {
  nombreCompleto?: string;
  cedula?: string;
  ciudadCedula?: string;
};

/** Deducciones no alojamiento antes de calcular valor por noche. */
export type ContractNonAccommodationCharges = {
  cleaningFee: number;
  refundableDeposit: number;
  petDeposit: number;
  manillaCondominio: number;
  otherCharges: number;
};

export function sumNonAccommodationCharges(
  charges: ContractNonAccommodationCharges,
): number {
  return (
    charges.cleaningFee +
    charges.refundableDeposit +
    charges.petDeposit +
    charges.manillaCondominio +
    charges.otherCharges
  );
}

/** Valor por noche = (total contrato − cargos no alojamiento) / noches */
export function computeNightlyPriceFromContractTotal(
  contractTotalCop: number,
  nights: number,
  charges: ContractNonAccommodationCharges,
): number {
  if (nights <= 0) return 0;
  const total = Math.max(0, Math.round(contractTotalCop));
  const accommodation = Math.max(
    0,
    total - sumNonAccommodationCharges(charges),
  );
  return Math.round(accommodation / nights);
}

export function buildReservationPreviewFincaData(
  property: PreviewProperty | null | undefined,
  ownerDisplayName: string,
  form: PreviewFormSlice,
  nights: number,
  contractTotalCop: number,
  formatCop: (n: number) => string,
  // Se mantiene por compatibilidad de firma; ya no se detallan las camas.
  _formatFincaFeatures: (features: unknown[]) => string,
  contractOwnerOverride?: ContractOwnerOverrideInput | null,
): Partial<FincaData> {
  const n = Math.max(0, nights);
  const total = Math.max(0, Math.round(contractTotalCop));

  // Habitaciones (zonas o override) + amenidades de la finca.
  const caracteristicasPlain = formatFincaFeaturesPlain(property?.features || [], {
    habitaciones: form.habitaciones,
    zoneOrder: property?.zoneOrder,
  });
  const caracteristicasHtml = caracteristicasPlain
    ? caracteristicasPlain
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            `<div style="margin: 0 0 4px 0; text-align: left !important;">${line}</div>`,
        )
        .join("")
    : "";

  const nombreManual = contractOwnerOverride?.nombreCompleto?.trim();
  const cedulaManual = contractOwnerOverride?.cedula?.trim();
  const ciudadCedulaManual = contractOwnerOverride?.ciudadCedula?.trim();

  const nombrePropietario =
    nombreManual || ownerDisplayName.trim() || "—";
  const cedulaPropietario = cedulaManual || "—";
  const ciudadCedulaPropietario = ciudadCedulaManual || "—";

  const clienteNombre =
    `${form.clientFirstName ?? ""} ${form.clientLastName ?? ""}`.trim() ||
    form.clientName.trim() ||
    "—";

  return {
    nombreFinca: property?.title || "—",
    municipioFinca: property?.location || "—",
    nombrePropietario,
    capacidadDePersonas: String(property?.capacity ?? 0),
    caracteristicasDeFinca: caracteristicasHtml,
    precioNumerico: formatCop(total),
    precioLetras: numberToSpanishTextCO(total, true),
    codigoContrato:
      form.contractNumber.trim() ||
      `C${property?.code || "XXXX"}-01`,
    cedulaPropietario,
    ciudadCedulaPropietario,
    contratoNumero: form.contractNumber.trim() || `C${property?.code || "XXXX"}-01`,
    fechaGeneracion: formatSpanishContractGenerationDate(),
    clienteNombre: clienteNombre.toUpperCase(),
    clienteNombres: (form.clientFirstName || "").trim().toUpperCase() || "—",
    clienteApellidos: (form.clientLastName || "").trim().toUpperCase() || "—",
    clienteCedula: form.clientId.trim() || "—",
    tipoDocumento: (form.clientDocType || "CC").trim().toUpperCase(),
    fechaExpedicion: form.clientDocIssuedAt?.trim() || "—",
    fechaExpedicionCedula: form.clientDocIssuedAt?.trim() || "—",
    ciudadCliente: form.clientCity.trim() || "—",
    clientCorreo: form.clientEmail.trim() || "—",
    clienteCelular: form.clientPhone.trim() || "—",
    direccionCliente: form.clientAddress.trim() || "—",
    nochesTexto: numberToSpanishTextCO(n, false),
    nochesNumero: String(n || 1),
    diasTexto: numberToSpanishTextCO(Math.max(1, n), false),
    diasNumero: String(Math.max(1, n)),
    fechaLlegadaMini: formatSpanishContractStayDate(form.checkInDate) || "—",
    fechaSalidaMini: formatSpanishContractStayDate(form.checkOutDate) || "—",
    horaLlegada: form.checkInTime.trim() || "—",
    horaSalida: form.checkOutTime.trim() || "—",
  };
}
