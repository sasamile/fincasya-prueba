import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { applyWordTemplateReplacements } from "@/lib/server/contract-docx";

/**
 * CONFIRMACIÓN DE RESERVA (CR) DESDE LA PLANTILLA OFICIAL .docx.
 *
 * Mismo mecanismo del contrato: la plantilla maestra vive en
 * `assets/contracts/default-cr-template.docx` y aquí solo se rellenan sus
 * placeholders `{{...}}`. Antes el CR se dibujaba con HTML a mano y no
 * coincidía con el diseño del equipo (Santiago, 23-jul: "toca hacer esa
 * plantilla para todos los CR").
 *
 * La plantilla la armó el equipo a partir del CR 2706. Al canonizarla se le
 * corrigieron dos cosas (ver commit): "Fecha Abono" reusaba el token de
 * "Fecha de Ingreso" (salía la misma fecha en las dos celdas) y el recuadro
 * grande de la derecha no tenía placeholder, así que las observaciones que
 * escribe el asesor se perdían.
 */

/** Datos del CR que llegan del panel (mismos campos del modal del inbox). */
export type CrTemplatePayload = {
  contractNumber?: string;
  clientName?: string;
  clientId?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  propertyName?: string;
  propertyLocation?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  guests?: number;
  nights?: number;
  precioTotal?: number;
  totalAmount?: number;
  rentAmount?: number;
  subtotal?: number;
  cleaningFee?: number;
  damageDeposit?: number;
  depositoMascotas?: number;
  refundableDeposit?: number;
  depositAmount?: number;
  depositDate?: string;
  balanceAmount?: number;
  balanceDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  issueDate?: string;
  observaciones?: string;
};

/** Condiciones generales del CR (texto plano, para el recuadro `{{data}}`). */
const TERMS_TEXT =
  "*NO SE RECIBE PAGO EN EFECTIVO* El presente documento se asimila en todos sus efectos legales a una letra de cambio según el artículo 774 del código de comercio condiciones generales; FINCASYA no se compromete a realizar devoluciones de dinero en caso de cancelaciones fortuitas por razones ajenas a nuestra voluntad, se aplazará la fecha en caso dado siempre y cuando la novedad sea notificada como mínimo siete (7) días hábiles antes de la fecha de ingreso registrada. *Nos reservamos el derecho de admisión en algunas propiedades. *FINCASYA no se hará responsable de accidentes ocasionados durante su estancia, tampoco por hurtos o daños ocasionados por terceros. *HORARIOS; check in 10:00am en adelante, check out 03:00pm, el hecho de sobrepasar el horario de salida se entenderá como adicional, con una tarifa establecida por hora y serán descontadas del depósito de seguridad. *Las personas adicionales al número de personas contratadas se considerarán como adicional. *Indicar si hay mascotas en el grupo, el hecho de no recoger las necesidades de sus mascotas será motivo de penalidad, de igual forma las mascotas que se suban a las camas y muebles o que ocasionen daños son conductas que dan para multar al responsable contratante. *Solicitar con anticipación el servicio de apoyo en cocina o cualquier otro servicio adicional. *Los huéspedes se comprometen a entregar el inmueble en óptimas condiciones tal como se les fue entregado, los daños que pudieren ocasionarse serán descontados del depósito, si el daño supera el valor del depósito será por cuenta del huésped la reposición del bien averiado teniéndose un plazo máximo de cinco (5) días hábiles para reparar el daño. *El depósito se reintegrará bien sea a su salida o al día siguiente de la desocupación una vez se haya concluido la revisión legítima de la propiedad. *En caso de: perturbar el sector con malas prácticas y desobediencia del código civil colombiano, riñas, altos decibeles en horas no permitidas, fiestas y eventos clandestinos no autorizados ni contratados, agresiones a las autoridades o a terceros; FINCASYA no tendrá ningún nivel de responsabilidad, las imputaciones, multas y sanciones son y serán enteramente por cuenta y responsabilidad del Contratante. *Todos los valores anteriormente mencionados NO incluyen IVA.";

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function toIsoDate(value: unknown): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

/** "2026-08-07" → "07 DE AGOSTO DEL 2026" (formato del CR). */
function formatDateLong(dateLike: unknown): string {
  const iso = toIsoDate(dateLike);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  const mes = MESES[Math.max(0, Math.min(11, Number(month) - 1))];
  return `${day} DE ${mes} DEL ${year}`;
}

/** "2026-08-07" → "07/08/2026". */
function formatDateShort(dateLike: unknown): string {
  const iso = toIsoDate(dateLike);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** "10:00" → "10:00 AM" (deja intacto lo que ya viene con sufijo). */
function formatTime(time: string | undefined): string {
  const raw = String(time ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;
  let h = Number(match[1]);
  const mm = match[2];
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${mm} ${suffix}`;
}

/** 3700000 → "3.700.000" (sin símbolo: la plantilla ya rotula el valor). */
function formatCop(value: number | undefined): string {
  const safe = typeof value === "number" && isFinite(value) ? value : 0;
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

/**
 * Placeholders de la plantilla. Los nombres son los que el equipo escribió en
 * el .docx — no se cambian aquí (ej. `{{bva}}` es Davivienda y `{{valor}}` es
 * el saldo); si se renombran en el Word, hay que actualizar este mapa.
 */
export function buildCrTemplateValues(
  p: CrTemplatePayload,
): Record<string, string> {
  const metodo = (p.paymentMethod ?? "bancolombia").toLowerCase();
  const marca = (m: string) => (metodo === m ? "X" : "");

  const total = Number(p.precioTotal ?? p.totalAmount ?? 0);
  const alquiler = Number(p.rentAmount ?? p.subtotal ?? 0);
  const aseo = Number(p.cleaningFee ?? 0);
  const reembolso = Number(
    p.refundableDeposit ??
      Number(p.damageDeposit ?? 0) + Number(p.depositoMascotas ?? 0),
  );
  const abono = Number(p.depositAmount ?? 0);
  const saldo = Number(p.balanceAmount ?? 0);

  const estadoPago =
    p.paymentStatus === "paid" ? "PAGADO" : "PENDIENTE DE PAGO";
  const horas = [formatTime(p.checkInTime), formatTime(p.checkOutTime)]
    .filter(Boolean)
    .join(" / ");

  return {
    cr: p.contractNumber ?? "",
    "nombre-mayusculas": (p.clientName ?? "").toUpperCase(),
    cedula: p.clientId ?? "",
    correo: p.clientEmail ?? "",
    fecha: formatDateShort(p.issueDate || new Date().toISOString().slice(0, 10)),
    telefono: p.clientPhone ?? "",
    direccion: p.clientAddress ?? "",

    finca: p.propertyName ?? "",
    "numero-contrato": p.contractNumber ?? "",
    "ubicacion-finca": p.propertyLocation ?? "",
    "ingreso-dd-de-mes-aa": formatDateLong(p.checkInDate),
    "salida-dd-de-mes-aa": formatDateLong(p.checkOutDate),
    horas,
    personas: p.guests ? String(p.guests) : "",
    noches: p.nights ? String(p.nights).padStart(2, "0") : "",

    abono: formatCop(abono),
    alquiler: formatCop(alquiler),
    /** Fecha del abono — token propio (antes chocaba con el de ingreso). */
    "fecha-abono": formatDateLong(p.depositDate),
    aseo: formatCop(aseo),
    /** "Valor Saldo" en la plantilla. */
    valor: formatCop(saldo),
    rembolso: formatCop(reembolso),
    /** "Fecha Saldo" en la plantilla. */
    "ingreso-dd-de-mes-aa-fecha": formatDateLong(p.balanceDate),
    total: formatCop(total),

    // Medios de pago: la X va en la columna elegida.
    bbva: marca("bbva"),
    banco: marca("bancolombia"),
    bva: marca("davivienda"),
    nequi: marca("nequi"),
    pse: marca("pse"),
    tarjeta: marca("tarjeta_credito"),

    /** Franja inferior: estado de pago + condiciones generales. */
    data: `ESTADO DE PAGO: ${estadoPago}\n${TERMS_TEXT}`,
    observaciones: (p.observaciones ?? "").trim(),
  };
}

let cachedTemplate: Buffer | null = null;
let cachedPath: string | null = null;
let cachedMtimeMs = -1;

/**
 * Plantilla maestra del CR. Igual que el contrato: se cachea y se invalida
 * sola si alguien la edita en Word (cambia el mtime).
 */
export async function loadCrTemplate(): Promise<Buffer> {
  const envPath = process.env.DEFAULT_CR_DOCX_PATH?.trim();
  const candidates = [
    envPath,
    path.join(process.cwd(), "assets", "contracts", "default-cr-template.docx"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const st = await fs.stat(p);
      if (cachedTemplate && cachedPath === p && cachedMtimeMs === st.mtimeMs) {
        return cachedTemplate;
      }
      const buf = await fs.readFile(p);
      if (buf.length < 2 || buf.subarray(0, 2).toString() !== "PK") {
        throw new Error("La plantilla del CR no es un .docx válido.");
      }
      cachedTemplate = buf;
      cachedPath = p;
      cachedMtimeMs = st.mtimeMs;
      return buf;
    } catch {
      // siguiente candidato
    }
  }
  throw new Error(
    "No se encontró la plantilla del CR (assets/contracts/default-cr-template.docx).",
  );
}

/** Rellena la plantilla del CR y devuelve el .docx resultante. */
export function fillCrDocx(
  templateBytes: Buffer,
  values: Record<string, string>,
): Buffer {
  const zip = new PizZip(templateBytes);
  const targets = Object.keys(zip.files).filter(
    (name) =>
      name === "word/document.xml" ||
      /^word\/header\d+\.xml$/.test(name) ||
      /^word\/footer\d+\.xml$/.test(name),
  );

  for (const name of targets) {
    const raw = zip.file(name)?.asText();
    if (raw == null) continue;
    zip.file(name, applyWordTemplateReplacements(raw, values));
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
