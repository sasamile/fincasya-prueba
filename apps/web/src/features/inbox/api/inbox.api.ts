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
  /** Texto libre del recuadro grande del CR (notas, cifras, lo que sea). */
  observaciones?: string;
};

/*
 * El CR ya NO se dibuja con HTML aquí: sale de la plantilla oficial .docx
 * (assets/contracts/default-cr-template.docx) vía /api/fincas/cr-pdf y
 * /api/fincas/cr-docx. Ver lib/server/cr-docx.ts.
 */

/** Nombre base del archivo del CR a partir del código del contrato. */
function crFilename(p: ConfirmationPayload, ext: 'pdf' | 'docx'): string {
  const contractNum = (p.contractNumber ?? 'CONFIRMACION')
    .replace(/[^\w\-]/g, '_')
    .toUpperCase();
  return `CONFIRMACION_${contractNum}.${ext}`;
}

/** Mensaje de error del endpoint (o uno genérico). */
async function errorDeRespuesta(res: Response, fallback: string) {
  try {
    const err = (await res.json()) as { error?: string };
    if (err?.error) return new Error(err.error);
  } catch {
    /* ignore */
  }
  return new Error(`${fallback} (error ${res.status})`);
}

export const inboxService = {
  /**
   * PDF del CR. Sale de la PLANTILLA OFICIAL .docx del equipo (Santiago,
   * 23-jul), igual que el contrato — antes se dibujaba con HTML aparte y no
   * coincidía con el diseño.
   */
  async generateReservationConfirmationPreview(
    _conversationId: string,
    payload: unknown,
  ): Promise<{ blob: Blob; filename: string }> {
    const p = (payload ?? {}) as ConfirmationPayload;
    const filename = crFilename(p, 'pdf');

    const res = await fetch('/api/fincas/cr-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });

    if (!res.ok) {
      throw await errorDeRespuesta(res, 'No se pudo generar el PDF del CR');
    }

    const blob = await res.blob();
    return { blob, filename };
  },

  /**
   * Mismo CR pero en Word (.docx) editable. El equipo guarda cada confirmación
   * en los dos formatos porque siempre entra algún ajuste (Adriana, 23-jul).
   */
  async generateReservationConfirmationDocx(
    _conversationId: string,
    payload: unknown,
  ): Promise<{ blob: Blob; filename: string }> {
    const p = (payload ?? {}) as ConfirmationPayload;
    const filename = crFilename(p, 'docx');

    const res = await fetch('/api/fincas/cr-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });

    if (!res.ok) {
      throw await errorDeRespuesta(res, 'No se pudo generar el Word del CR');
    }

    const blob = await res.blob();
    return { blob, filename };
  },
};
