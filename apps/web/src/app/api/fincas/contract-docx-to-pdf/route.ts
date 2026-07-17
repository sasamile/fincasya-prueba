import { NextResponse } from "next/server";
import { convertDocxToPdfDetailed } from "@/lib/server/docx-to-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/contract-docx-to-pdf
 *
 * Recibe un .docx (multipart, campo `file`) —normalmente el contrato editado
 * en el editor Word del navegador (SuperDoc)— y lo convierte a PDF con la misma
 * ruta que el resto del sistema (iLovePDF / LibreOffice). Devuelve el PDF en
 * base64 para subirlo y enviarlo por WhatsApp.
 */
export async function POST(request: Request) {
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json(
      { error: "Falta el archivo .docx (campo `file`)." },
      { status: 400 },
    );
  }

  try {
    const docx = Buffer.from(await file.arrayBuffer());
    if (docx.length < 2 || docx.subarray(0, 2).toString() !== "PK") {
      return NextResponse.json(
        { error: "El archivo no es un .docx válido." },
        { status: 400 },
      );
    }

    const { pdf, error } = await convertDocxToPdfDetailed(docx);
    if (!pdf) {
      console.error("[contract-docx-to-pdf]", error);
      return NextResponse.json(
        {
          error:
            error ||
            "No se pudo convertir a PDF. Revisa las credenciales ILOVEPDF en Vercel (Production) o instala LibreOffice en local.",
        },
        { status: 503 },
      );
    }

    const baseName = (file.name || "contrato").replace(/\.docx$/i, "");
    return NextResponse.json({
      success: true,
      fileBase64: pdf.toString("base64"),
      filename: `${baseName}.pdf`,
      mimeType: "application/pdf",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error convirtiendo a PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
