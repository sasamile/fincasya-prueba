import { NextResponse } from "next/server";
import {
  buildCrTemplateValues,
  fillCrDocx,
  loadCrTemplate,
  type CrTemplatePayload,
} from "@/lib/server/cr-docx";
import { convertDocxToPdfDetailed } from "@/lib/server/docx-to-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/cr-pdf
 * Body: el payload del CR (mismos campos del modal del inbox).
 * Respuesta: PDF de la confirmación.
 *
 * El PDF sale de la MISMA plantilla .docx que el Word (plantilla → docx →
 * PDF), para que lo que recibe el cliente sea idéntico al diseño del equipo.
 * Antes el PDF se dibujaba con HTML aparte y no coincidía.
 */
export async function POST(request: Request) {
  let payload: CrTemplatePayload;
  try {
    payload = (await request.json()) as CrTemplatePayload;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const contractNum = (payload?.contractNumber ?? "CONFIRMACION")
    .replace(/[^\w-]/g, "_")
    .toUpperCase();

  try {
    const template = await loadCrTemplate();
    const docx = fillCrDocx(template, buildCrTemplateValues(payload));

    const { pdf, error } = await convertDocxToPdfDetailed(docx);
    if (!pdf) {
      return NextResponse.json(
        {
          error:
            error ||
            "No se pudo convertir el CR a PDF. Revisa las credenciales ILOVEPDF en Vercel (Production) o instala LibreOffice en local.",
        },
        { status: 503 },
      );
    }

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CONFIRMACION_${contractNum}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el CR.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
