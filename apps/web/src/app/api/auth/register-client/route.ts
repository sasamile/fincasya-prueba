import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * POST /api/auth/register-client
 * Alta pública de cuenta cliente (rol `client`) con datos de contrato.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
      documentId?: string;
      city?: string;
      address?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    const documentId = body.documentId?.trim() ?? "";
    if (!email.includes("@") || !name || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Nombre, correo válido y contraseña de al menos 8 caracteres son obligatorios.",
        },
        { status: 400 },
      );
    }
    if (documentId.length < 4) {
      return NextResponse.json(
        { error: "La cédula es obligatoria (mínimo 4 caracteres)." },
        { status: 400 },
      );
    }
    if (phone.length < 7) {
      return NextResponse.json(
        { error: "El celular es obligatorio." },
        { status: 400 },
      );
    }

    const client = getConvexHttpClient();
    const result = await client.action(api.ownerAuth.provisionUserLogin, {
      email,
      name,
      password,
      role: "client",
      phone,
      documentId,
    });

    // city/address no viven en Better Auth user; se guardan en la reserva.
    return NextResponse.json({
      ok: true,
      userId: result.userId,
      created: result.created,
      city: body.city?.trim() || undefined,
      address: body.address?.trim() || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta.";
    const status =
      /ya está|already|exist|registrad/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
