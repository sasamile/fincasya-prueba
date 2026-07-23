import { NextResponse } from "next/server";
import { htmlToDocx } from "@/lib/server/html-to-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fincas/html-to-docx
 * Body: { html: string; filename?: string }
 * Respuesta: .docx binario (Word) como descarga.
 *
 * Gemelo de /api/fincas/html-to-pdf: el equipo guarda cada documento en los
 * dos formatos para poder editarlo cuando entra un cambio (Adriana, 23-jul).
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
  const filename = rawName.replace(/[^\w\-_.]/g, "_").replace(/\.docx$/i, "");

  try {
    const docx = await htmlToDocx(html);
    return new NextResponse(docx as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Content-Length": String(docx.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el Word.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
