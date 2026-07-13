import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * POST /api/bookings/check-availability
 * Body: { propertyId: string, fechaEntrada: number(ms), fechaSalida: number(ms) }
 * Respuesta: { available: boolean, conflictingBookings: [...] } (de Convex).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      propertyId?: string;
      fechaEntrada?: number;
      fechaSalida?: number;
      excludeBookingId?: string;
    };
    if (
      !body.propertyId ||
      typeof body.fechaEntrada !== "number" ||
      typeof body.fechaSalida !== "number"
    ) {
      return NextResponse.json(
        { error: "Faltan propertyId, fechaEntrada o fechaSalida." },
        { status: 400 },
      );
    }

    const client = getConvexHttpClient();
    const result = await client.query(api.bookings.checkAvailability, {
      propertyId: body.propertyId as never,
      fechaEntrada: body.fechaEntrada,
      fechaSalida: body.fechaSalida,
      ...(body.excludeBookingId
        ? { excludeBookingId: body.excludeBookingId as never }
        : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo verificar la disponibilidad.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
