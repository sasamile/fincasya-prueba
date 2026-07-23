import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/bookings/direct
 * Crea reserva Propiedad Empresa + link Bold (anticipo 50%).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      propertyId?: string;
      nombreCompleto?: string;
      cedula?: string;
      celular?: string;
      celularAdicional?: string;
      correo?: string;
      city?: string;
      address?: string;
      fechaEntrada?: number;
      fechaSalida?: number;
      numeroPersonas?: number;
      numeroMascotas?: number;
      incluirServicio?: boolean;
      portalOrigin?: string;
      purpose?: string;
      groupType?: string;
      isEvento?: boolean;
      eventType?: string;
      eventGuests?: string;
      eventGuestsCount?: string;
      eventServices?: string;
      eventDecoration?: string;
      fechaNacimiento?: string;
      cedulaPhotoUrl?: string;
    };

    if (
      !body.propertyId ||
      !body.nombreCompleto?.trim() ||
      !body.cedula?.trim() ||
      !body.celular?.trim() ||
      !body.correo?.trim() ||
      !body.cedulaPhotoUrl?.trim() ||
      typeof body.fechaEntrada !== "number" ||
      typeof body.fechaSalida !== "number"
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan datos obligatorios (incluye foto de cédula validada).",
        },
        { status: 400 },
      );
    }

    const client = getConvexHttpClient();
    const result = await client.action(api.directBooking.createWithBold, {
      propertyId: body.propertyId as never,
      nombreCompleto: body.nombreCompleto.trim(),
      cedula: body.cedula.trim(),
      celular: body.celular.trim(),
      celularAdicional: body.celularAdicional?.trim() || undefined,
      correo: body.correo.trim(),
      city: body.city?.trim() || undefined,
      address: body.address?.trim() || undefined,
      fechaEntrada: body.fechaEntrada,
      fechaSalida: body.fechaSalida,
      numeroPersonas: Math.max(1, Number(body.numeroPersonas) || 1),
      numeroMascotas: Math.max(0, Number(body.numeroMascotas) || 0),
      incluirServicio: body.incluirServicio === true,
      purpose: body.purpose?.trim() || undefined,
      groupType: body.groupType?.trim() || undefined,
      isEvento: body.isEvento === true,
      eventType: body.eventType?.trim() || undefined,
      eventGuests: body.eventGuests?.trim() || undefined,
      eventGuestsCount: body.eventGuestsCount?.trim() || undefined,
      eventServices: body.eventServices?.trim() || undefined,
      eventDecoration: body.eventDecoration?.trim() || undefined,
      fechaNacimiento: body.fechaNacimiento?.trim() || undefined,
      cedulaPhotoUrl: body.cedulaPhotoUrl.trim(),
      portalOrigin:
        body.portalOrigin?.trim() ||
        new URL(request.url).origin,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la reserva.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
