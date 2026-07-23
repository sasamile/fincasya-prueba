/**
 * Documento de COTIZACIÓN AL PROPIETARIO (Adriana, 22-jul).
 *
 * HTML con la marca que se convierte a PDF (/api/fincas/html-to-pdf) y se envía
 * por correo al dueño. Muestra en cuánto se negoció la finca y los datos de la
 * reserva que el propietario necesita saber.
 */

export type OwnerQuotePayload = {
  propertyTitle: string;
  propertyLocation?: string;
  ownerName?: string;
  contractReference?: string;
  clientName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  guests?: number;
  groupType?: string;
  ownerAmount: number;
  notes?: string;
  issueDate?: string;
};

function esc(v: string | number | undefined | null): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n?: number): string {
  if (!n || n <= 0) return '—';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function fechaLarga(ymd?: string): string {
  const raw = (ymd ?? '').trim();
  if (!raw) return '—';
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d
    .toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase();
}

export function buildOwnerQuoteHtml(
  p: OwnerQuotePayload,
  logoDataUrl: string | null,
): string {
  const logo = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="FincasYa" style="max-width:210px;max-height:70px;object-fit:contain;">`
    : `<div style="font-size:30px;font-weight:800;color:#e46f3d;">FincasYa</div>`;

  const issue = p.issueDate
    ? fechaLarga(p.issueDate)
    : fechaLarga(new Date().toISOString().slice(0, 10));

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:9px 12px;background:#f7e4d8;font-weight:700;width:42%;border:1px solid #e8c9b3;">${esc(label)}</td>
      <td style="padding:9px 12px;border:1px solid #e8c9b3;">${value}</td>
    </tr>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  * { box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; color:#222; margin:0; padding:28px; }
  h1 { font-size:20px; color:#c85a2b; margin:0; }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  .amount { font-size:22px; font-weight:800; color:#c85a2b; }
</style></head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #e46f3d;padding-bottom:14px;margin-bottom:18px;">
    <div>${logo}</div>
    <div style="text-align:right;">
      <h1>Cotización al propietario</h1>
      <div style="font-size:12px;color:#777;">${esc(issue)}</div>
    </div>
  </div>

  <p style="font-size:13px;">Estimado/a <strong>${esc(p.ownerName || 'propietario')}</strong>, ponemos en su conocimiento la siguiente propuesta para su propiedad.</p>

  <table style="margin-bottom:16px;">
    ${row('Propiedad', esc(p.propertyTitle))}
    ${p.propertyLocation ? row('Ubicación', esc(p.propertyLocation)) : ''}
    ${p.contractReference ? row('Reserva N.º', esc(p.contractReference)) : ''}
    ${row('Fecha de ingreso', esc(fechaLarga(p.checkInDate)))}
    ${row('Fecha de salida', esc(fechaLarga(p.checkOutDate)))}
    ${row('Noches', esc(p.nights ? String(p.nights).padStart(2, '0') : '—'))}
    ${row('Número de personas', esc(p.guests ? String(p.guests) : '—'))}
    ${p.groupType ? row('Tipo de grupo', esc(p.groupType)) : ''}
  </table>

  <table style="margin-bottom:16px;">
    ${row('Valor a reconocer al propietario', `<span class="amount">${money(p.ownerAmount)}</span>`)}
  </table>

  ${
    p.notes?.trim()
      ? `<div style="font-size:12px;background:#faf3ee;border:1px solid #e8c9b3;border-radius:8px;padding:12px;margin-bottom:16px;">
          <strong>Observaciones:</strong><br/>${esc(p.notes).replace(/\n/g, '<br/>')}
         </div>`
      : ''
  }

  <p style="font-size:11px;color:#777;line-height:1.5;margin-top:22px;">
    Este documento es una propuesta comercial informativa emitida por FincasYa.com y no
    constituye obligación de pago hasta la confirmación de ambas partes. Los valores no
    incluyen IVA salvo indicación expresa.
  </p>
</body></html>`;
}
