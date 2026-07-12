/**
 * Compat con FincasYaWeb `features/admin/api/payment-images.api`:
 * subía imágenes de comprobante/QR al Nest; aquí van al bucket S3 vía
 * `/api/admin/upload`. Usado por bank-account-dialog y contract-firmantes.
 */

export const uploadPaymentImages = async (files: File[]): Promise<string[]> => {
  return Promise.all(
    files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'images');
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const body = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? `Error subiendo imagen (${res.status})`);
      }
      return body.url;
    }),
  );
};
