import "server-only";

/**
 * Convierte HTML en un .docx EDITABLE (Word).
 *
 * El equipo necesita cada documento en los dos formatos: el PDF para enviar y
 * el Word para corregir cuando entra un cambio de último momento —una mascota
 * confirmada, una persona adicional— sin rehacer todo (Adriana/Vane, 23-jul).
 *
 * `html-to-docx` lee sobre todo estilos INLINE (los bloques <style> con clases
 * se pierden), así que el HTML que se le pase debe traer bordes, sombreado y
 * anchos en el atributo `style` de cada celda. Devuelve un Buffer en Node.
 */
export async function htmlToDocx(html: string): Promise<Buffer> {
  // Import dinámico: el paquete es CommonJS/UMD y solo debe cargarse en el
  // runtime Node de la ruta, nunca en el bundle del cliente.
  const mod = (await import("html-to-docx")) as unknown as {
    default: (
      html: string,
      headerHtml?: string | null,
      options?: Record<string, unknown>,
      footerHtml?: string | null,
    ) => Promise<Buffer | ArrayBuffer | Blob>;
  };
  const HTMLtoDOCX = mod.default;

  const result = await HTMLtoDOCX(
    html,
    null,
    {
      orientation: "landscape",
      margins: { top: 720, right: 720, bottom: 720, left: 720 },
      font: "Calibri",
      fontSize: 20, // HIP (half-point) → 10pt
      table: { row: { cantSplit: true } },
    },
    null,
  );

  if (Buffer.isBuffer(result)) return result;
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  // Blob (por si corre en un runtime que lo devuelve así).
  const arrayBuffer = await (result as Blob).arrayBuffer();
  return Buffer.from(arrayBuffer);
}
