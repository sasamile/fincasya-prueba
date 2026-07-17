import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * POST /api/bookings/contract-snapshot
 * Body: { contractNumber: string, propertyId: string, payload: object }
 * Guarda/actualiza el borrador del contrato (aún sin reserva en calendario)
 * y lo refleja en la tabla Admin → Contratos (upsert por CR).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      contractNumber?: string;
      propertyId?: string;
      payload?: Record<string, unknown>;
    };
    if (!body.contractNumber || !body.propertyId || !body.payload) {
      return NextResponse.json(
        { error: "Faltan contractNumber, propertyId o payload." },
        { status: 400 },
      );
    }

    const contractNumber = body.contractNumber.trim();
    const payload = body.payload;
    const client = getConvexHttpClient();
    const id = await client.mutation(api.adminContractSnapshots.upsert, {
      contractNumber,
      propertyId: body.propertyId as never,
      payload,
    });

    // Misma fila en `contracts`: regenerar con el mismo CR actualiza, no duplica.
    const multimedia = Array.isArray(payload.multimediaLinks)
      ? (payload.multimediaLinks as Array<{ url?: string; name?: string }>)
      : [];
    let pdfUrl: string | undefined;
    let pdfFilename: string | undefined;
    for (const m of multimedia) {
      const url = String(m?.url ?? "").trim();
      if (!url) continue;
      pdfUrl = url;
      pdfFilename = String(m?.name ?? "").trim() || undefined;
      break;
    }

    try {
      await client.mutation(api.contracts.upsert, {
        contractNumber,
        propertyId: body.propertyId as never,
        clienteNombre: String(payload.nombreCompleto ?? "").trim() || undefined,
        clienteCedula: String(payload.cedula ?? "").trim() || undefined,
        clienteEmail: String(payload.correo ?? "").trim() || undefined,
        clienteTelefono: String(payload.celular ?? "").trim() || undefined,
        valorTotal: Number(payload.precioTotal) || undefined,
        fechaEntrada: payload.fechaEntrada
          ? String(payload.fechaEntrada)
          : undefined,
        fechaSalida: payload.fechaSalida
          ? String(payload.fechaSalida)
          : undefined,
        pdfUrl,
        pdfFilename,
        estado: "borrador",
        origen: "admin",
        draftJson: JSON.stringify(payload),
      });
    } catch (listErr) {
      console.error(
        "[contract-snapshot] no se pudo sincronizar la lista de contratos",
        listErr,
      );
    }

    return NextResponse.json({ id, ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo guardar el borrador del contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
