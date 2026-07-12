import { format } from "date-fns";
import { es } from "date-fns/locale";
import { propietarioTratoLabel } from "@/lib/owner-salutation";

export type OwnerWhatsAppMessageInput = {
  reference: string;
  propertyTitle: string;
  propietarioNombre?: string | null;
  propietarioTratamiento?: string | null;
  fechaEntrada: number;
  fechaSalida: number;
  horaEntrada?: string | null;
  numeroPersonas: number;
  valorAcordado: number;
  abonoPropietario?: number;
  checkinCompleted?: boolean;
  checkinNeedsEmpleada?: boolean;
  checkinNeedsTeam?: boolean;
  checkinServiciosNota?: string | null;
  checkinObservaciones?: string | null;
  checkinMascotas?: number;
  requiresGuestList?: boolean;
  showGuestListToOwner?: boolean;
  appBaseUrl?: string;
};

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

export function toWhatsAppPhone(phone: string): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

export function buildOwnerWhatsAppMessage(
  input: OwnerWhatsAppMessageInput,
): string {
  const appBase = (input.appBaseUrl ?? "https://fincasya.com").replace(
    /\/$/,
    "",
  );
  const ref = input.reference;
  const finca = input.propertyTitle || "tu finca";
  const ownerParts = (input.propietarioNombre ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const ownerNombreApellido = ownerParts.slice(0, 2).join(" ");
  const trato = propietarioTratoLabel(input.propietarioTratamiento);
  const saludo = ownerNombreApellido
    ? `Hola, ${trato} ${ownerNombreApellido} 👋\n`
    : `Hola 👋\n`;

  const valorAcordado = Math.max(0, Math.floor(input.valorAcordado || 0));
  const abonoProp = Math.max(0, Math.floor(input.abonoPropietario || 0));
  const saldoProp = Math.max(0, valorAcordado - abonoProp);
  const saldoLinea =
    valorAcordado > 0
      ? `💵 Saldo pendiente por pagarte: *${fmtCOP(saldoProp)}* (total ${fmtCOP(valorAcordado)}, abono ${fmtCOP(abonoProp)}).\n\n`
      : "";

  const fecha = format(new Date(input.fechaEntrada), "EEEE d 'de' MMMM", {
    locale: es,
  });
  const fechaSalida = format(new Date(input.fechaSalida), "EEEE d 'de' MMMM", {
    locale: es,
  });
  const horaRaw = String(input.horaEntrada ?? "").trim();
  const horaMatch = /^(\d{1,2}):(\d{2})$/.exec(horaRaw);
  let hora = "";
  if (horaMatch) {
    let h = parseInt(horaMatch[1], 10);
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    hora = `${h}:${horaMatch[2]} ${ap}`;
  } else if (horaRaw) {
    hora = horaRaw;
  }

  const guestListRequired = input.requiresGuestList !== false;
  const showGuestListToOwner = input.showGuestListToOwner !== false;
  const listadoListo = input.checkinCompleted === true;
  const link = `${appBase}/anfitrion/${encodeURIComponent(ref)}`;

  const empleadaSolicitada = input.checkinNeedsTeam
    ? "Sí, varias"
    : input.checkinNeedsEmpleada
      ? "Sí"
      : null;
  const serviciosNota = String(input.checkinServiciosNota ?? "").trim();
  const numMascotas = Math.max(0, Math.floor(input.checkinMascotas ?? 0));
  const obsTurista = String(input.checkinObservaciones ?? "").trim();

  const solicitudesLineas = [
    empleadaSolicitada
      ? `🧹 Empleada de servicio: ${empleadaSolicitada}${serviciosNota ? ` — "${serviciosNota}"` : ""}`
      : serviciosNota
        ? `🧹 Servicio solicitado: "${serviciosNota}"`
        : "",
    numMascotas > 0
      ? `🐾 Mascotas: sí, van ${numMascotas} mascota${numMascotas === 1 ? "" : "s"}`
      : "",
    obsTurista ? `📝 Nota del turista: ${obsTurista}` : "",
  ].filter(Boolean);

  const solicitudesBloque =
    solicitudesLineas.length > 0
      ? `🔔 *Lo que pidió el turista:*\n${solicitudesLineas.join("\n")}\n\n`
      : "";

  return (
    saludo +
    (guestListRequired && showGuestListToOwner
      ? `Tienes una reserva en tu finca *${finca}*. En este enlace encontrarás la *lista de invitados, placas de vehículos, posible hora de llegada* y toda la información de tu reserva.\n\n`
      : `Tienes una reserva en tu finca *${finca}*. En este enlace encontrarás *placas de vehículos, posible hora de llegada* y toda la información de tu reserva.\n\n`) +
    `📅 Entrada: ${fecha} · Salida: ${fechaSalida}\n` +
    `👥 Personas: ${input.numeroPersonas}\n` +
    (hora
      ? `🕒 Hora de llegada: ${hora}\n`
      : `🕒 Hora de llegada: aún sin confirmar (la validamos con el turista).\n`) +
    `\n` +
    saldoLinea +
    (guestListRequired && showGuestListToOwner
      ? listadoListo
        ? `📋 Mira el estado del check-in y *descarga el PDF de invitados* aquí 👉\n${link}\n\n`
        : `📋 El listado de invitados lo enviaremos máximo 24 h antes de la llegada. Míralo aquí 👉\n${link}\n\n`
      : `📋 Mira el estado de tu reserva aquí 👉\n${link}\n\n`) +
    solicitudesBloque +
    `🔑 ¿Quién recibe a los turistas ese día? Déjanos el nombre y contacto en el enlace.\n\n` +
    `🔄 Siempre puedes entrar aquí a validar el estado de tu reserva.\n` +
    `💬 Cualquier duda, escríbenos por *Soporte*. 🏡 FincasYa`
  );
}
