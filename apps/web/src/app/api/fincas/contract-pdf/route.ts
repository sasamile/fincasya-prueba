import { NextResponse } from "next/server";
import { htmlToPdf } from "@/lib/server/html-to-pdf";
import { wrapContractHtmlForPdf } from "@/features/admin/utils/contract-pdf-shell";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/contract-pdf
 * Body: { html: string (fragmento editado del contrato), filename?: string }
 *
 * Envuelve el fragmento con el shell del contrato (logo + estilos, server-only
 * por node:fs) y genera el PDF con Puppeteer. Usado por el modal de preview
 * editable del inbox.
 */
export async function POST(request: Request) {
  let body: { html?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const fragment = typeof body.html === "string" ? body.html : "";
  if (!fragment.trim()) {
    return NextResponse.json(
      { error: "Falta el contenido del contrato." },
      { status: 400 },
    );
  }

  const rawName =
    typeof body.filename === "string" && body.filename.trim()
      ? body.filename.trim()
      : "contrato";
  const filename = rawName.replace(/[^\w\-_.]/g, "_").replace(/\.pdf$/i, "");

  try {
    const full = wrapContractHtmlForPdf(fragment);
    const pdf = await htmlToPdf(full);
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
