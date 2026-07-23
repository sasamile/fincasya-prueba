import { NextResponse } from "next/server";
import {
  buildCrTemplateValues,
  fillCrDocx,
  loadCrTemplate,
  type CrTemplatePayload,
} from "@/lib/server/cr-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/cr-docx
 * Body: el payload del CR (mismos campos del modal del inbox).
 * Respuesta: .docx de la confirmación armado con la plantilla oficial.
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
    return new NextResponse(docx as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="CONFIRMACION_${contractNum}.docx"`,
        "Content-Length": String(docx.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el CR.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
