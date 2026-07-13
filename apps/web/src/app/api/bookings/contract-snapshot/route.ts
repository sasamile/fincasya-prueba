import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * POST /api/bookings/contract-snapshot
 * Body: { contractNumber: string, propertyId: string, payload: object }
 * Guarda/actualiza el borrador del contrato (aún sin reserva en calendario).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      contractNumber?: string;
      propertyId?: string;
      payload?: unknown;
    };
    if (!body.contractNumber || !body.propertyId || !body.payload) {
      return NextResponse.json(
        { error: "Faltan contractNumber, propertyId o payload." },
        { status: 400 },
      );
    }

    const client = getConvexHttpClient();
    const id = await client.mutation(api.adminContractSnapshots.upsert, {
      contractNumber: body.contractNumber,
      propertyId: body.propertyId as never,
      payload: body.payload,
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
