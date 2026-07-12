'use client';

/**
 * Compat parcial con FincasYaWeb `features/inbox/api/inbox.api`.
 *
 * En prueba solo se usa `inboxService.generateReservationConfirmationPreview`
 * desde `contracts-reservation-section`. En FincasYaWeb ese método genera un PDF
 * con Puppeteer en el backend Nest — pipeline que TODAVÍA no se porta a Convex.
 * Se deja como stub que falla con mensaje claro (en vez de romper el build o
 * fingir que funciona). Cuando se porte la generación de PDF de contratos,
 * reemplazar este método por la implementación real (route handler + PDF).
 */

export const inboxService = {
  async generateReservationConfirmationPreview(
    _conversationId: string,
    _payload: unknown,
  ): Promise<{ blob: Blob; filename: string }> {
    throw new Error(
      'La previsualización de confirmación de reserva (PDF) todavía no está portada a fincasya-prueba.',
    );
  },
};
