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

const MARGIN = 36;
const PAGE_W = 595.28; // A4 pt

const BRAND = {
  emerald: [33, 192, 99] as [number, number, number],
  emeraldDark: [18, 128, 68] as [number, number, number],
  orange: [254, 74, 25] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

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

function buildMetaRows(input: CheckinGuestsPdfInput): [string, string][] {
  const empleadaLabel = input.needsTeam
    ? "Sí (varias)"
    : input.needsEmpleada
      ? "Sí"
      : "No";

  const rows: ([string, string] | null)[] = [
    ["Titular", input.guestName],
    input.propertyLocation ? ["Ubicación", input.propertyLocation] : null,
    [
      "Estado",
      input.checkinCompleted ? "Completado ✓" : "Pendiente",
    ],
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
      ? ["Menores de 2 años", String(input.minorsUnder2)]
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

function drawHeaderBand(doc: jsPDF, logo: LoadedLogo | null): number {
  const bandH = 88;
  doc.setFillColor(...BRAND.emeraldDark);
  doc.rect(0, 0, PAGE_W, bandH, "F");

  doc.setFillColor(...BRAND.orange);
  doc.rect(0, bandH - 4, PAGE_W, 4, "F");

  let cursorY = 22;

  if (logo) {
    const logoH = 34;
    const logoW = Math.min(260, (logo.width / logo.height) * logoH);
    const logoX = (PAGE_W - logoW) / 2;
    doc.setFillColor(...BRAND.white);
    doc.roundedRect(logoX - 10, cursorY - 6, logoW + 20, logoH + 12, 6, 6, "F");
    doc.addImage(logo.dataUri, "PNG", logoX, cursorY, logoW, logoH);
    cursorY += logoH + 18;
  } else {
    doc.setTextColor(...BRAND.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("FINCASYA.COM", PAGE_W / 2, cursorY + 10, { align: "center" });
    cursorY += 28;
  }

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Lista de invitados · Check-in", PAGE_W / 2, cursorY, {
    align: "center",
  });

  return bandH + 20;
}

function drawContractBadge(
  doc: jsPDF,
  contractNumber: string | undefined,
  y: number,
): number {
  if (!contractNumber?.trim()) return y;

  const label = `CR ${contractNumber.trim()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const textW = doc.getTextWidth(label);
  const padX = 14;
  const badgeW = textW + padX * 2;
  const badgeH = 22;
  const badgeX = (PAGE_W - badgeW) / 2;

  doc.setFillColor(...BRAND.emerald);
  doc.roundedRect(badgeX, y, badgeW, badgeH, 11, 11, "F");
  doc.setTextColor(...BRAND.white);
  doc.text(label, PAGE_W / 2, y + 15, { align: "center" });

  return y + badgeH + 16;
}

function drawPropertyHero(doc: jsPDF, input: CheckinGuestsPdfInput, y: number): number {
  const contentW = PAGE_W - MARGIN * 2;

  doc.setFillColor(...BRAND.surface);
  doc.roundedRect(MARGIN, y, contentW, 54, 8, 8, "F");
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, y, contentW, 54, 8, 8, "S");

  doc.setTextColor(...BRAND.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("PROPIEDAD", MARGIN + 14, y + 16);

  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(
    input.propertyTitle,
    contentW - 28,
  ) as string[];
  doc.text(titleLines.slice(0, 2), MARGIN + 14, y + 32);

  return y + 54 + 14;
}

function drawDateCards(
  doc: jsPDF,
  checkIn: string,
  checkOut: string,
  y: number,
): number {
  const gap = 12;
  const cardW = (PAGE_W - MARGIN * 2 - gap) / 2;
  const cardH = 48;

  const cards: Array<{ label: string; value: string; x: number }> = [
    { label: "ENTRADA", value: checkIn, x: MARGIN },
    { label: "SALIDA", value: checkOut, x: MARGIN + cardW + gap },
  ];

  for (const card of cards) {
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.6);
    doc.roundedRect(card.x, y, cardW, cardH, 6, 6, "FD");

    doc.setFillColor(...BRAND.emerald);
    doc.rect(card.x, y, 4, cardH, "F");

    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(card.label, card.x + 14, y + 16);

    doc.setTextColor(...BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(card.value, card.x + 14, y + 34);
  }

  return y + cardH + 18;
}

function drawFooter(doc: jsPDF, y: number) {
  const footerY = Math.max(y + 24, 780);
  doc.setDrawColor(...BRAND.emerald);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY);

  doc.setTextColor(...BRAND.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(CHECKIN_GUESTS_PDF_SUBTITLE, PAGE_W / 2, footerY + 14, {
    align: "center",
    maxWidth: PAGE_W - MARGIN * 2,
  });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.emeraldDark);
  doc.text("fincasya.com · Soporte 24 horas", PAGE_W / 2, footerY + 30, {
    align: "center",
  });
}

export async function downloadCheckinGuestsPdf(
  input: CheckinGuestsPdfInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(input.guests) || input.guests.length === 0) {
    return { ok: false, error: "No hay invitados registrados para exportar." };
  }

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const logo = await loadOfficialLogo();

    let cursorY = drawHeaderBand(doc, logo);
    cursorY = drawContractBadge(doc, input.contractNumber, cursorY);
    cursorY = drawPropertyHero(doc, input, cursorY);
    cursorY = drawDateCards(doc, input.checkInDate, input.checkOutDate, cursorY);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN, right: MARGIN },
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
        textColor: BRAND.ink,
        lineColor: BRAND.line,
        lineWidth: 0.4,
      },
      columnStyles: {
        0: {
          cellWidth: (PAGE_W - MARGIN * 2) * 0.36,
          fontStyle: "bold",
          textColor: BRAND.muted,
        },
      },
      body: buildMetaRows(input),
    });

    const afterMetaY =
      (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable?.finalY ?? cursorY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.ink);
    doc.text(
      `Personas registradas (${input.guests.length})`,
      MARGIN,
      afterMetaY + 22,
    );

    autoTable(doc, {
      startY: afterMetaY + 30,
      margin: { left: MARGIN, right: MARGIN },
      theme: "striped",
      headStyles: {
        fillColor: BRAND.emeraldDark,
        textColor: BRAND.white,
        fontSize: 9,
        fontStyle: "bold",
        cellPadding: 7,
      },
      alternateRowStyles: { fillColor: BRAND.surface },
      styles: {
        fontSize: 9,
        cellPadding: 7,
        textColor: BRAND.ink,
        lineColor: BRAND.line,
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 28, halign: "center", fontStyle: "bold" },
        1: { cellWidth: "auto" },
        2: { cellWidth: "auto" },
      },
      head: [["#", "Nombre completo", "Documento"]],
      body: buildGuestRows(input),
    });

    const afterGuestsY =
      (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable?.finalY ?? afterMetaY;
    drawFooter(doc, afterGuestsY);

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
