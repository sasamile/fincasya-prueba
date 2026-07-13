import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * GET /api/bookings/by-contract?contractNumber=...
 * Busca primero una reserva real por número de contrato; si no existe, cae al
 * borrador (snapshot). Respuesta: el objeto (con isContractSnapshot en snapshots)
 * o { error } 404 si no hay nada.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractNumber = (searchParams.get("contractNumber") ?? "").trim();
  if (!contractNumber) {
    return NextResponse.json(
      { error: "Falta el número de contrato." },
      { status: 400 },
    );
  }

  try {
    const client = getConvexHttpClient();

    const booking = await client.query(api.bookings.getByContractNumber, {
      contractNumber,
    });
    if (booking) return NextResponse.json(booking);

    const snapshot = await client.query(
      api.adminContractSnapshots.getByContractNumber,
      { contractNumber },
    );
    if (snapshot) return NextResponse.json(snapshot);

    return NextResponse.json(
      { error: "No se encontró una reserva ni un borrador con ese contrato." },
      { status: 404 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo buscar el contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
