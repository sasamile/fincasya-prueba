import { NextResponse } from "next/server";
import { htmlToPdf } from "@/lib/server/html-to-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/{id}/direct-booking-contract
 *
 * Genera el PDF del contrato directo. El frontend ya renderiza el HTML del
 * contrato (vista previa) y lo envía como `customHtml`; aquí solo lo pasamos
 * por Puppeteer. Devuelve el PDF en base64 (forma que espera el front).
 */
export async function POST(request: Request) {
  let body: { customHtml?: unknown; contractNumber?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const html = typeof body.customHtml === "string" ? body.customHtml : "";
  if (!html.trim()) {
    return NextResponse.json(
      {
        error:
          "Falta el HTML del contrato (customHtml). Revisa la vista previa antes de generar.",
      },
      { status: 400 },
    );
  }

  const rawName =
    typeof body.contractNumber === "string" && body.contractNumber.trim()
      ? `contrato-${body.contractNumber.trim()}`
      : "contrato";
  const filename = `${rawName.replace(/[^\w\-_.]/g, "_")}.pdf`;

  try {
    const pdf = await htmlToPdf(html);
    return NextResponse.json({
      success: true,
      fileBase64: pdf.toString("base64"),
      filename,
      mimeType: "application/pdf",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
