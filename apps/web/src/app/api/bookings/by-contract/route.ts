import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * GET /api/bookings/by-contract?contractNumber=...
 * Busca en tres lugares, en orden: la reserva real, el borrador del generador
 * de admin (snapshot) y, por último, la tabla de contratos — ahí viven los que
 * se generan desde el INBOX, que antes no aparecían en «Confirmar pago».
 * Respuesta: el objeto (marcado con isContractSnapshot o isContractRecord según
 * de dónde salga) o { error } 404 si no hay nada.
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

    const contract = await client.query(
      api.contracts.getBookingLikeByContractNumber,
      { contractNumber },
    );
    if (contract) return NextResponse.json(contract);

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
