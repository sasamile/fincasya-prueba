'use client';

type ConfirmationPayload = {
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
  subtotal?: number;
  rentAmount?: number;
  cleaningFee?: number;
  damageDeposit?: number;
  depositoMascotas?: number;
  petCount?: number;
  petCleaningFee?: number;
  costoMascotas?: number;
  refundableDeposit?: number;
  depositAmount?: number;
  depositDate?: string;
  balanceAmount?: number;
  balanceDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  groupType?: string;
  purpose?: string;
  issueDate?: string;
};

type PaymentMethod =
  | 'bbva'
  | 'bancolombia'
  | 'davivienda'
  | 'nequi'
  | 'pse'
  | 'tarjeta_credito';

function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toIsoDate(value: unknown): string {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function formatDateLong(dateLike: unknown): string {
  const iso = toIsoDate(dateLike);
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  const months = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
  ];
  const monthName = months[Math.max(0, Math.min(11, Number(month) - 1))];
  return `${day} DE ${monthName} DEL ${year}`;
}

function formatDateDisplay(dateLike: unknown): string {
  const iso = toIsoDate(dateLike);
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function formatTimeDisplay(time: string | undefined): string {
  const raw = String(time ?? '').trim();
  if (!raw) return '-';
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;
  let h = Number(match[1]);
  const mm = match[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${mm} ${suffix}`;
}

function formatCurrency(value: number | undefined): string {
  const safe = typeof value === 'number' && isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

async function fetchLogoDataUrl(): Promise<string | null> {
  const candidates = [
    '/contracts/contract-logo.jpg',
    '/contracts/contract-logo.jpeg',
    '/fincasya-negro-logo-reserva.png',
    '/image.png',
    '/fincas-ya-logo.png',
  ];
  for (const src of candidates) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch {
      // try next
    }
  }
  return null;
}

const TERMS_TEXT =
  '*NO SE RECIBE PAGO EN EFECTIVO* El presente documento se asimila en todos sus efectos legales a una letra de cambio seg&uacute;n el art&iacute;culo 774 del c&oacute;digo de comercio condiciones generales; FINCASYA no se compromete a realizar devoluciones de dinero en caso de cancelaciones fortuitas por razones ajenas a nuestra voluntad, se aplazar&aacute; la fecha en caso dado siempre y cuando la novedad sea notificada como m&iacute;nimo siete (7) d&iacute;as h&aacute;biles antes de la fecha de ingreso registrada. *Nos reservamos el derecho de admisi&oacute;n en algunas propiedades. *FINCASYA no se har&aacute; responsable de accidentes ocasionados durante su estancia, tampoco por hurtos o da&ntilde;os ocasionados por terceros. *HORARIOS; check in 10:00am en adelante, check out 03:00pm, el hecho de sobrepasar el horario de salida se entender&aacute; como adicional, con una tarifa establecida por hora y ser&aacute;n descontadas del dep&oacute;sito de seguridad. *Las personas adicionales al n&uacute;mero de personas contratadas se considerar&aacute;n como adicional. *Indicar si hay mascotas en el grupo, el hecho de no recoger las necesidades de sus mascotas ser&aacute; motivo de penalidad, de igual forma las mascotas que se suban a las camas y muebles o que ocasionen da&ntilde;os son conductas que dan para multar al responsable contratante. *Solicitar con anticipaci&oacute;n el servicio de apoyo en cocina o cualquier otro servicio adicional. *Los hu&eacute;spedes se comprometen a entregar el inmueble en &oacute;ptimas condiciones tal como se les fue entregado, los da&ntilde;os que pudieren ocasionarse ser&aacute;n descontados del dep&oacute;sito, si el da&ntilde;o supera el valor del dep&oacute;sito ser&aacute; por cuenta del hu&eacute;sped la reposici&oacute;n del bien averiado teni&eacute;ndose un plazo m&aacute;ximo de cinco (5) d&iacute;as h&aacute;biles para reparar el da&ntilde;o. *El dep&oacute;sito se reintegrar&aacute; bien sea a su salida o al d&iacute;a siguiente de la desocupaci&oacute;n una vez se haya concluido la revisi&oacute;n leg&iacute;tima de la propiedad. *En caso de: perturbar el sector con malas pr&aacute;cticas y desobediencia del c&oacute;digo civil colombiano, ri&ntilde;as, altos decibeles en horas no permitidas, fiestas y eventos clandestinos no autorizados ni contratados, agresiones a las autoridades o a terceros; FINCASYA no tendr&aacute; ning&uacute;n nivel de responsabilidad, las imputaciones, multas y sanciones son y ser&aacute;n enteramente por cuenta y responsabilidad del Contratante. *Todos los valores anteriormente mencionados NO incluyen IVA.';

function buildConfirmationHtml(p: ConfirmationPayload, logoDataUrl: string | null): string {
  const method = (p.paymentMethod ?? 'bancolombia').toLowerCase() as PaymentMethod;
  const paymentMarks: Record<PaymentMethod, string> = {
    bbva: '', bancolombia: '', davivienda: '', nequi: '', pse: '', tarjeta_credito: '',
  };
  if (method in paymentMarks) paymentMarks[method] = 'X';

  const paymentStatusText = p.paymentStatus === 'paid' ? 'PAGADO' : 'PENDIENTE DE PAGO';

  const totalAmount = Number(p.precioTotal ?? p.totalAmount ?? 0);
  const rentAmount = Number(p.rentAmount ?? p.subtotal ?? 0);
  const cleaningFee = Number(p.cleaningFee ?? 0);
  const refundableDeposit = Number(
    p.refundableDeposit ?? (Number(p.damageDeposit ?? 0) + Number(p.depositoMascotas ?? 0))
  );
  const petCleaningFee = Number(p.petCleaningFee ?? 0);
  const depositAmount = Number(p.depositAmount ?? 0);
  const balanceAmount = Number(p.balanceAmount ?? 0);

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="FINCASYA LOGO" style="max-width:250px;max-height:75px;object-fit:contain;">`
    : `<div style="font-size:32px;font-weight:700;color:#e46f3d;">FincasYa</div>`;

  const issueDate = p.issueDate || new Date().toISOString().split('T')[0];

  // Regla Vane 21-jul: el aseo por mascotas va INCLUIDO en "Valor Limpieza
  // General" (p.cleaningFee ya viene sumado) — solo se anota, sin fila aparte.
  const cleaningLabel =
    petCleaningFee > 0
      ? 'Valor Limpieza General (incluye aseo mascotas)'
      : 'Valor Limpieza General';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmaci&oacute;n de Reserva</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      width: 297mm; height: 210mm;
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { background-color: #f9ebe0; }
    .sheet {
      width: 297mm; height: 210mm;
      padding: 8mm 9mm 7mm;
      overflow: hidden;
      background-color: #f9ebe0;
      background-image:
        linear-gradient(115deg, transparent 20%, rgba(226,185,161,0.3) 25%, rgba(226,185,161,0.3) 35%, transparent 40%),
        linear-gradient(115deg, transparent 60%, rgba(226,185,161,0.15) 65%, rgba(226,185,161,0.15) 75%, transparent 80%),
        radial-gradient(circle at 5% 5%, rgba(255,255,255,0.9) 0%, rgba(249,235,224,0.6) 40%, rgba(226,192,173,0.8) 100%);
    }
    .wrapper { width: 100%; }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 4mm; padding: 0 2mm;
    }
    .header-logo { width: 26%; display: flex; align-items: center; }
    .header-title-container { width: 48%; text-align: center; padding-top: 4mm; }
    .header-title { font-size: 26px; color: #7a8288; white-space: nowrap; }
    .header-contact {
      width: 26%; display: flex; justify-content: flex-end; align-items: center;
      font-size: 20px; font-weight: 600; color: #7a8288; white-space: nowrap;
    }
    table {
      width: 100%; border-collapse: collapse;
      background-color: #eaddd1; table-layout: fixed;
    }
    .table-1 { margin-bottom: 5mm; }
    .table-banks, .table-terms { margin-top: -1px; }
    th, td {
      border: 1px solid #000; padding: 6px 10px;
      vertical-align: middle; font-size: 14px; line-height: 1.08; word-wrap: break-word;
    }
    .peach { background-color: #efbc9b; }
    .value-cell, .empty-box { background-color: #eaddd1; }
    .right-align { text-align: right; }
    .terms-text { font-size: 11px; text-align: justify; padding: 10px 14px; line-height: 1.3; }
    .payment-mark { text-align: center; font-weight: 700; font-size: 20px; }
    .status-row td { text-align: center; font-weight: 700; font-size: 15px; padding: 8px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="wrapper">
      <div class="header">
        <div class="header-logo">${logoHtml}</div>
        <div class="header-title-container">
          <div class="header-title">Confirmaci&oacute;n de Reserva N.&ordm; ${esc(p.contractNumber ?? '-')}</div>
        </div>
        <div class="header-contact">3007984139</div>
      </div>

      <table class="table-1">
        <tr>
          <td class="peach" style="width:18%;">NOMBRE</td>
          <td class="value-cell" style="width:46%;">${esc(p.clientName ?? '-')}</td>
          <td class="peach" style="width:11%;">C. C.</td>
          <td class="value-cell" style="width:25%;">${esc(p.clientId ?? '-')}</td>
        </tr>
        <tr>
          <td class="peach">Correo electr&oacute;nico</td>
          <td class="value-cell">${esc(p.clientEmail ?? '-')}</td>
          <td class="peach">Fecha</td>
          <td class="value-cell">${esc(formatDateDisplay(issueDate))}</td>
        </tr>
        <tr>
          <td class="peach">Tel de contacto</td>
          <td class="value-cell">${esc(p.clientPhone ?? '-')}</td>
          <td class="peach">DIRECCI&Oacute;N</td>
          <td class="value-cell">${esc(p.clientAddress ?? '-')}</td>
        </tr>
      </table>

      <table class="table-2">
        <tr>
          <td class="peach" style="width:18%;">Propiedad</td>
          <td class="value-cell" style="width:31%;">${esc(p.propertyName ?? '-')}</td>
          <td colspan="2" class="value-cell" style="width:32%;">Contrato: ${esc(p.contractNumber ?? '-')}</td>
          <td rowspan="6" class="empty-box" style="width:19%;"></td>
        </tr>
        <tr>
          <td class="peach">Ubicaci&oacute;n</td>
          <td colspan="3" class="value-cell">${esc(p.propertyLocation ?? '-')}</td>
        </tr>
        <tr>
          <td class="peach">Fecha de Ingreso</td>
          <td class="value-cell">${esc(formatDateLong(p.checkInDate))}</td>
          <td class="peach" style="width:16%;">Fecha de Salida</td>
          <td class="value-cell" style="width:16%;">${esc(formatDateLong(p.checkOutDate))}</td>
        </tr>
        <tr>
          <td class="peach">Chek In / Chek Out</td>
          <td colspan="3" class="value-cell">${esc(formatTimeDisplay(p.checkInTime))} / ${esc(formatTimeDisplay(p.checkOutTime))}</td>
        </tr>
        <tr>
          <td class="peach">Hu&eacute;spedes</td>
          <td class="value-cell">${esc(String(p.guests ?? 1))}</td>
          <td class="peach">Noches</td>
          <td class="value-cell">${esc(String(p.nights ?? 1).padStart(2, '0'))}</td>
        </tr>
        <tr>
          <td class="peach">Tipo de grupo</td>
          <td class="value-cell">${esc((p.groupType ?? '').trim() || '-')}</td>
          <td colspan="2" class="peach">Prop&oacute;sito estancia</td>
          <td class="value-cell">${esc((p.purpose ?? '').trim() || '-')}</td>
        </tr>
        <tr>
          <td class="peach">Valor Abono</td>
          <td class="value-cell">${esc(formatCurrency(depositAmount))}</td>
          <td colspan="2" class="peach right-align">Valor Alquiler</td>
          <td class="value-cell">${esc(formatCurrency(rentAmount))}</td>
        </tr>
        <tr>
          <td class="peach">Fecha Abono</td>
          <td class="value-cell">${esc(formatDateLong(p.depositDate))}</td>
          <td colspan="2" class="peach right-align">${cleaningLabel}</td>
          <td class="value-cell">${esc(formatCurrency(cleaningFee))}</td>
        </tr>
        <tr>
          <td class="peach">Valor Saldo</td>
          <td class="value-cell">${esc(formatCurrency(balanceAmount))}</td>
          <td colspan="2" class="peach right-align">*Valor Dep&oacute;sito Reembolsable</td>
          <td class="value-cell">${esc(formatCurrency(refundableDeposit))}</td>
        </tr>
        <tr>
          <td class="peach">Fecha Saldo</td>
          <td class="value-cell">${esc(formatDateLong(p.balanceDate))}</td>
          <td colspan="2" class="peach right-align">Valor TOTAL</td>
          <td class="value-cell">${esc(formatCurrency(totalAmount))}</td>
        </tr>
      </table>

      <table class="table-banks">
        <tr>
          <td style="width:10%;">BBVA</td><td style="width:5%;" class="payment-mark">${paymentMarks.bbva}</td>
          <td style="width:12%;">Bancolombia</td><td style="width:5%;" class="payment-mark">${paymentMarks.bancolombia}</td>
          <td style="width:12%;">Davivienda</td><td style="width:5%;" class="payment-mark">${paymentMarks.davivienda}</td>
          <td style="width:10%;">Nequi</td><td style="width:5%;" class="payment-mark">${paymentMarks.nequi}</td>
          <td style="width:8%;">PSE</td><td style="width:5%;" class="payment-mark">${paymentMarks.pse}</td>
          <td style="width:15%;">Tarjeta Cr&eacute;dito</td><td style="width:8%;" class="payment-mark">${paymentMarks.tarjeta_credito}</td>
        </tr>
        <tr class="status-row">
          <td colspan="12">ESTADO DE PAGO: ${esc(paymentStatusText)}</td>
        </tr>
      </table>

      <table class="table-terms">
        <tr>
          <td class="terms-text">${TERMS_TEXT}</td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

export const inboxService = {
  async generateReservationConfirmationPreview(
    _conversationId: string,
    payload: unknown,
  ): Promise<{ blob: Blob; filename: string }> {
    const p = (payload ?? {}) as ConfirmationPayload;

    const logoDataUrl = await fetchLogoDataUrl();
    const html = buildConfirmationHtml(p, logoDataUrl);

    const contractNum = (p.contractNumber ?? 'CONFIRMACION')
      .replace(/[^\w\-]/g, '_')
      .toUpperCase();
    const filename = `CONFIRMACION_${contractNum}.pdf`;

    const res = await fetch('/api/fincas/html-to-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename }),
    });

    if (!res.ok) {
      let msg = `Error ${res.status} generando el PDF de confirmación.`;
      try {
        const err = (await res.json()) as { error?: string };
        if (err?.error) msg = err.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    return { blob, filename };
  },
};
