import { NextResponse } from "next/server";
import { htmlToPdf } from "@/lib/server/html-to-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/html-to-pdf
 * Body: { html: string; filename?: string }
 * Respuesta: PDF binario (application/pdf) como descarga.
 *
 * Réplica del endpoint de fincasya-new (Nest) dentro de Next, para no depender
 * de un backend externo. Sin autenticación: se usa desde Server Actions/flujos
 * internos del panel.
 */
export async function POST(request: Request) {
  let body: { html?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido: se esperaba JSON con { html }." },
      { status: 400 },
    );
  }

  const html = typeof body.html === "string" ? body.html : "";
  if (!html.trim()) {
    return NextResponse.json(
      { error: "Falta el HTML del documento." },
      { status: 400 },
    );
  }

  const rawName =
    typeof body.filename === "string" && body.filename.trim()
      ? body.filename.trim()
      : "documento";
  const filename = rawName.replace(/[^\w\-_.]/g, "_").replace(/\.pdf$/i, "");

  try {
    const pdf = await htmlToPdf(html);
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
