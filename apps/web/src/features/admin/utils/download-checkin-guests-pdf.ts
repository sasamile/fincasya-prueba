import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CheckinGuestsPdfInput } from "@/features/admin/utils/checkin-guests-pdf.types";
import {
  buildCheckinGuestsPdfFilename,
  CHECKIN_GUESTS_PDF_SUBTITLE,
} from "@/features/admin/utils/checkin-guests-pdf.types";
import {
  formatGuestDocument,
  isMinorGuestDocumentType,
} from "@/features/checkin/utils/guest-document";

type LoadedLogo = { dataUri: string; width: number; height: number };

/**
 * Carga el logo oficial (colibrí horizontal) como data URI + sus dimensiones
 * naturales, para embeberlo en el PDF conservando la relación de aspecto.
 */
async function loadOfficialLogo(): Promise<LoadedLogo | null> {
  try {
    const res = await fetch("/gml/Logo.png", { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUri = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUri) return null;
    return await new Promise<LoadedLogo | null>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          dataUri,
          width: img.naturalWidth || 320,
          height: img.naturalHeight || 58,
        });
      img.onerror = () => resolve(null);
      img.src = dataUri;
    });
  } catch {
    return null;
  }
}

/** Filas de metadatos (etiqueta / valor) de la reserva para la cabecera del PDF. */
function buildMetaRows(input: CheckinGuestsPdfInput): [string, string][] {
  const empleadaLabel = input.needsTeam
    ? "Sí (varias)"
    : input.needsEmpleada
      ? "Sí"
      : "No";

  const rows: ([string, string] | null)[] = [
    ["Propiedad", input.propertyTitle],
    input.propertyLocation ? ["Ubicación", input.propertyLocation] : null,
    ["Titular de la reserva", input.guestName],
    input.contractNumber ? ["Contrato", input.contractNumber] : null,
    ["Entrada", input.checkInDate],
    ["Salida", input.checkOutDate],
    ["Estado del check-in", input.checkinCompleted ? "Completado" : "Pendiente"],
    ["Empleada de servicio", empleadaLabel],
    input.petsAllowed
      ? [
          "Mascotas",
          (input.petCount ?? 0) > 0
            ? `Sí (${input.petCount})`
            : "No van mascotas",
        ]
      : null,
    input.minorsUnder2
      ? ["Menores de 2 años (no listados)", String(input.minorsUnder2)]
      : null,
    input.vehiclePlates?.trim()
      ? ["Placas vehiculares", input.vehiclePlates.trim()]
      : null,
    input.servicesNote?.trim()
      ? ["Nota de servicios", input.servicesNote.trim()]
      : null,
  ];

  return rows.filter((row): row is [string, string] => row !== null);
}

/** Filas (#, nombre, documento) de las personas registradas. */
function buildGuestRows(input: CheckinGuestsPdfInput): string[][] {
  return input.guests.map((guest, index) => {
    const name = guest.nombreCompleto?.trim() || "—";
    const esMenorEdad =
      !guest.esMenor && isMinorGuestDocumentType(guest.tipoDocumento);
    const doc = guest.esMenor
      ? "Menor de 2 años"
      : `${formatGuestDocument(guest.tipoDocumento, guest.cedula)}${
          esMenorEdad ? " · Menor de edad" : ""
        }`;
    return [String(index + 1), name, doc];
  });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

const MARGIN = 40;
const ORANGE: [number, number, number] = [249, 115, 22];

export async function downloadCheckinGuestsPdf(
  input: CheckinGuestsPdfInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(input.guests) || input.guests.length === 0) {
    return { ok: false, error: "No hay invitados registrados para exportar." };
  }

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // --- Cabecera: logo oficial (o texto de respaldo) ---
    const logo = await loadOfficialLogo();
    let cursorY = MARGIN;
    if (logo) {
      const logoHeight = 42;
      const logoWidth = Math.min(
        320,
        (logo.width / logo.height) * logoHeight,
      );
      doc.addImage(
        logo.dataUri,
        "PNG",
        centerX - logoWidth / 2,
        cursorY,
        logoWidth,
        logoHeight,
      );
      cursorY += logoHeight + 16;
    } else {
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("FINCASYA.COM", centerX, cursorY + 14, { align: "center" });
      cursorY += 34;
    }

    // --- Título + subtítulo ---
    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Lista de invitados — Check-in", centerX, cursorY, {
      align: "center",
    });
    cursorY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(CHECKIN_GUESTS_PDF_SUBTITLE, centerX, cursorY, {
      align: "center",
      maxWidth: pageWidth - MARGIN * 2,
    });
    cursorY += 20;

    // --- Tabla de metadatos de la reserva ---
    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: [30, 30, 30] },
      columnStyles: {
        0: {
          cellWidth: (pageWidth - MARGIN * 2) * 0.34,
          fontStyle: "bold",
          fillColor: [245, 245, 245],
        },
      },
      body: buildMetaRows(input),
    });

    // --- Tabla de personas registradas ---
    const afterMetaY =
      (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable?.finalY ?? cursorY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 17, 17);
    doc.text(
      `Personas registradas (${input.guests.length})`,
      MARGIN,
      afterMetaY + 24,
    );

    autoTable(doc, {
      startY: afterMetaY + 32,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      headStyles: { fillColor: ORANGE, textColor: [255, 255, 255], fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 5, textColor: [30, 30, 30] },
      columnStyles: { 0: { cellWidth: 32, halign: "center" } },
      head: [["#", "Nombre completo", "Documento"]],
      body: buildGuestRows(input),
    });

    const filename = buildCheckinGuestsPdfFilename(
      input.propertyTitle,
      input.contractNumber,
    );
    triggerBlobDownload(doc.output("blob"), filename);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo generar el PDF de invitados.",
    };
  }
}
