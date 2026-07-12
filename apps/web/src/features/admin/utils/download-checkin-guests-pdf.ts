import type { CheckinGuestsPdfInput } from "@/features/admin/utils/checkin-guests-pdf.types";
import {
  buildCheckinGuestsPdfFilename,
  CHECKIN_GUESTS_PDF_SUBTITLE,
} from "@/features/admin/utils/checkin-guests-pdf.types";
import {
  formatGuestDocument,
  isMinorGuestDocumentType,
} from "@/features/checkin/utils/guest-document";

const PDF_DOCUMENT_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif;
    font-size: 11pt;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .contract-doc-root {
    text-align: justify;
    text-justify: inter-word;
  }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 4pt 8pt; }
`;

/** Logo de respaldo (texto) si no se pudo cargar el logo oficial. */
const LOGO_HTML_FALLBACK = `
<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e8e8;">
  <div style="width:92px;height:92px;border-radius:50%;background:#1f1f1f;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:8px;box-sizing:border-box;">
    <div style="font-size:8.5px;font-weight:800;line-height:1.05;">FINCAS<span style="color:#f97316">YA</span>.COM</div>
    <div style="font-size:6.5px;opacity:0.88;margin-top:4px;">VIVE EL LLANO</div>
  </div>
</div>`.trim();

/** Cabecera con el logo oficial en alta resolución (colibrí horizontal). Cae al texto si falla. */
function buildLogoHtml(logoDataUri: string | null): string {
  if (!logoDataUri) return LOGO_HTML_FALLBACK;
  return `
<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e8e8;text-align:center;">
  <img src="${logoDataUri}" alt="FincasYa" style="display:inline-block;height:58px;width:auto;max-width:320px;" />
</div>`.trim();
}

/** Carga el logo oficial en alta resolución como data URI para embeberlo en el PDF. */
async function fetchOfficialLogoDataUri(): Promise<string | null> {
  try {
    const res = await fetch("/gml/Logo.png", { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCheckinGuestsPdfHtmlClient(
  input: CheckinGuestsPdfInput,
  logoDataUri: string | null,
): string {
  const rows = input.guests
    .map((guest, index) => {
      const name = guest.nombreCompleto?.trim() || "—";
      const esMenorEdad =
        !guest.esMenor && isMinorGuestDocumentType(guest.tipoDocumento);
      const doc = guest.esMenor
        ? "Menor de 2 años"
        : `${formatGuestDocument(guest.tipoDocumento, guest.cedula)}${
            esMenorEdad ? " · Menor de edad" : ""
          }`;
      return `
        <tr>
          <td style="border:1px solid #ddd;text-align:center;width:36px;">${index + 1}</td>
          <td style="border:1px solid #ddd;">${escapeHtml(name)}</td>
          <td style="border:1px solid #ddd;">${escapeHtml(doc)}</td>
        </tr>`;
    })
    .join("");

  const empleadaLabel = input.needsTeam
    ? "Sí (varias)"
    : input.needsEmpleada
      ? "Sí"
      : "No";

  const metaRows = [
    ["Propiedad", input.propertyTitle],
    input.propertyLocation ? ["Ubicación", input.propertyLocation] : null,
    ["Titular de la reserva", input.guestName],
    input.contractNumber ? ["Contrato", input.contractNumber] : null,
    ["Entrada", input.checkInDate],
    ["Salida", input.checkOutDate],
    [
      "Estado del check-in",
      input.checkinCompleted ? "Completado" : "Pendiente",
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
      ? ["Menores de 2 años (no listados)", String(input.minorsUnder2)]
      : null,
    input.vehiclePlates?.trim()
      ? ["Placas vehiculares", input.vehiclePlates.trim()]
      : null,
    input.servicesNote?.trim()
      ? ["Nota de servicios", input.servicesNote.trim()]
      : null,
  ]
    .filter(Boolean)
    .map(
      (row) => `
        <tr>
          <th style="border:1px solid #ddd;background:#f5f5f5;text-align:left;width:34%;">${escapeHtml(row![0])}</th>
          <td style="border:1px solid #ddd;">${escapeHtml(row![1])}</td>
        </tr>`,
    )
    .join("");

  const inner = `
    <h1 style="font-size:16pt;margin:0 0 8pt 0;text-align:center;">Lista de invitados — Check-in</h1>
    <p style="text-align:center;color:#555;margin:0 0 18pt 0;font-size:10pt;">
      ${escapeHtml(CHECKIN_GUESTS_PDF_SUBTITLE)}
    </p>
    <table style="margin-bottom:18pt;">
      <tbody>${metaRows}</tbody>
    </table>
    <h2 style="font-size:12pt;margin:0 0 8pt 0;">Personas registradas (${input.guests.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="border:1px solid #ddd;background:#f5f5f5;width:36px;">#</th>
          <th style="border:1px solid #ddd;background:#f5f5f5;text-align:left;">Nombre completo</th>
          <th style="border:1px solid #ddd;background:#f5f5f5;text-align:left;">Documento</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="3" style="border:1px solid #ddd;text-align:center;color:#666;">Sin invitados registrados</td></tr>`}
      </tbody>
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>${PDF_DOCUMENT_CSS}</style>
</head>
<body>
${buildLogoHtml(logoDataUri)}
<div class="contract-doc-root">
${inner}
</div>
</body>
</html>`;
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

async function parsePdfError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: string;
    } | null;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
  }
  const text = await response.text().catch(() => "");
  return text.slice(0, 300) || `Error ${response.status}`;
}

export async function downloadCheckinGuestsPdf(
  input: CheckinGuestsPdfInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(input.guests) || input.guests.length === 0) {
    return { ok: false, error: "No hay invitados registrados para exportar." };
  }

  const logoDataUri = await fetchOfficialLogoDataUri();
  const html = buildCheckinGuestsPdfHtmlClient(input, logoDataUri);
  const filename = buildCheckinGuestsPdfFilename(
    input.propertyTitle,
    input.contractNumber,
  );

  // Renderizado 100% en el navegador (sin backend Nest): se abre la hoja de
  // invitados en una ventana y se dispara la impresión, donde el usuario puede
  // "Guardar como PDF". Evita el "Failed to fetch" del backend inexistente.
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) {
    return {
      ok: false,
      error:
        "El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e inténtalo de nuevo.",
    };
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  try {
    printWindow.document.title = filename.replace(/\.pdf$/i, "");
  } catch {
    /* algunos navegadores restringen el title tras write; no es crítico */
  }

  const doPrint = () => {
    printWindow.focus();
    printWindow.print();
  };
  // Espera breve para que carguen el logo y estilos antes de imprimir.
  if (printWindow.document.readyState === "complete") {
    window.setTimeout(doPrint, 500);
  } else {
    printWindow.addEventListener("load", () => window.setTimeout(doPrint, 500));
  }

  return { ok: true };
}
