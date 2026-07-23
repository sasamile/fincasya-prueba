/**
 * Copy oficial al cliente cuando se crea un link de venta (/venta/:token).
 */

export function buildSaleLinkInviteMessage(saleUrl: string): string {
  const url = saleUrl.trim();
  return (
    `¡Excelente! 🎉 Ya puedes continuar con el proceso de tu reserva.\n\n` +
    `A continuación encontrarás el enlace donde podrás diligenciar tus datos, ` +
    `revisar la información de la reserva y previsualizar nuestro contrato antes de continuar.\n\n` +
    `Una vez completes el proceso y registres el pago, verificaremos la información ` +
    `y te enviaremos la confirmación oficial de tu reserva. ✅\n\n` +
    `🔗 ${url}`
  );
}

export function saleLinkPublicUrl(token: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://fincasya.com');
  return `${base.replace(/\/$/, '')}/venta/${token}`;
}
