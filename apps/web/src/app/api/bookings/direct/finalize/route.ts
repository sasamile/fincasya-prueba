import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";
export const maxDuration = 90;

type Body = {
  reference?: string;
};

/**
 * POST /api/bookings/direct/finalize
 * Tras el pago Bold: marca pagado, genera contrato PDF, adjunta y envía email.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const body = (await request.json()) as Body;
    const reference = body.reference?.trim();
    if (!reference) {
      return NextResponse.json({ error: "Falta reference." }, { status: 400 });
    }

    const convex = getConvexHttpClient();
    const booking = await convex.query(api.directBooking.getByReferencePublic, {
      reference,
    });
    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
    }

    if (booking.contractUrl) {
      return NextResponse.json({
        ok: true,
        contractUrl: booking.contractUrl,
        contractCode: booking.contractCode,
        alreadyDone: true,
      });
    }

    await convex.mutation(api.directBooking.markPaid, { reference });

    const nights = Math.max(
      1,
      Math.round(
        (booking.fechaSalida - booking.fechaEntrada) / (24 * 60 * 60 * 1000),
      ),
    );
    const nightly = Math.round((booking.subtotal || 0) / nights) || 0;
    const ymd = (ms: number) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(ms));

    const contractCode = booking.contractCode || reference;
    const genRes = await fetch(
      `${origin}/api/fincas/${booking.propertyId}/direct-booking-contract`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: booking.propertyId,
          contractNumber: contractCode,
          nightlyPrice: String(nightly),
          totalPrice: String(booking.subtotal || booking.precioTotal || 0),
          clientName: booking.nombreCompleto,
          clientId: booking.cedula ?? "",
          clientEmail: booking.correo ?? "",
          clientPhone: booking.celular ?? "",
          checkInDate: ymd(booking.fechaEntrada),
          checkOutDate: ymd(booking.fechaSalida),
          guests: booking.numeroPersonas || 1,
          petCount: booking.numeroMascotas ?? 0,
          refundableDeposit: booking.depositoGarantia ?? 0,
          cleaningFee: 0,
          otherCharges: 0,
          manillaCondominio: 0,
        }),
      },
    );
    const genData = (await genRes.json().catch(() => ({}))) as {
      fileBase64?: string;
      filename?: string;
      mimeType?: string;
      error?: string;
    };
    if (!genRes.ok || !genData.fileBase64) {
      return NextResponse.json(
        { error: genData.error || "No se pudo generar el contrato." },
        { status: 502 },
      );
    }

    const bytes = Buffer.from(genData.fileBase64, "base64");
    const mime = genData.mimeType || "application/pdf";
    const filename =
      genData.filename || `Contrato_${contractCode}.pdf`;
    const fd = new FormData();
    fd.append("file", new File([bytes], filename, { type: mime }));
    fd.append("folder", "documents");
    const upRes = await fetch(`${origin}/api/admin/upload`, {
      method: "POST",
      body: fd,
    });
    const upData = (await upRes.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!upRes.ok || !upData.url) {
      return NextResponse.json(
        { error: upData.error || "No se pudo subir el contrato." },
        { status: 502 },
      );
    }

    await convex.mutation(api.directBooking.attachContractUrl, {
      reference,
      contractUrl: upData.url,
    });

    const emailResult = await convex.action(api.directBooking.emailContract, {
      toEmail: booking.correo,
      toName: booking.nombreCompleto,
      contractCode,
      propertyTitle: booking.propertyTitle,
      contractUrl: upData.url,
    });

    return NextResponse.json({
      ok: true,
      contractUrl: upData.url,
      contractCode,
      email: emailResult,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error finalizando la reserva.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
