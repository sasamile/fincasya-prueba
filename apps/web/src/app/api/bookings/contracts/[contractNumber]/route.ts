import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * GET /api/bookings/contracts/{contractNumber}
 * Devuelve el registro de contrato (draftJson, valorTotal, etc.) o null.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractNumber: string }> },
) {
  const { contractNumber } = await params;
  const code = decodeURIComponent(contractNumber ?? "").trim();
  if (!code) {
    return NextResponse.json(
      { error: "Falta el número de contrato." },
      { status: 400 },
    );
  }

  try {
    const client = getConvexHttpClient();
    const contract = await client.query(api.contracts.get, {
      contractNumber: code,
    });
    return NextResponse.json(contract ?? null);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo obtener el contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
