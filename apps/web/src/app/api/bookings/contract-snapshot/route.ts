import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * POST /api/bookings/contract-snapshot
 * Body: { contractNumber: string, propertyId: string, payload: object }
 * Guarda/actualiza el borrador del contrato (aún sin reserva en calendario)
 * en `adminContractSnapshots`. No crea fila en Gestor de contratos ni consume
 * numeración CR: eso ocurre al generar/enviar el contrato final.
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

    return NextResponse.json({ id, ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo guardar el borrador del contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
