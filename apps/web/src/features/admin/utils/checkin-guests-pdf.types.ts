export type CheckinGuestRow = {
  nombreCompleto?: string;
  cedula?: string;
  tipoDocumento?: string;
  esMenor?: boolean;
};

export type CheckinGuestsPdfInput = {
  propertyTitle: string;
  propertyLocation?: string;
  guestName: string;
  contractNumber?: string;
  checkInDate: string;
  checkOutDate: string;
  guests: CheckinGuestRow[];
  minorsUnder2?: number;
  vehiclePlates?: string;
  petsAllowed?: boolean;
  petCount?: number;
  needsEmpleada?: boolean;
  needsTeam?: boolean;
  servicesNote?: string;
  checkinCompleted?: boolean;
};

export function buildCheckinGuestsPdfFilename(
  propertyTitle: string,
  contractNumber?: string,
): string {
  const slug = (contractNumber || propertyTitle || "checkin")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `Invitados_${slug}.pdf`;
}

export const CHECKIN_GUESTS_PDF_SUBTITLE =
  "Fincas Ya está disponible 24 horas para apoyarte durante tu estadía. Guarda este documento y compártelo al ingresar.";
