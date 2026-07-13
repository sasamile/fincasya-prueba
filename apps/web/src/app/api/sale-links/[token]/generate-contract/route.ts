import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/sale-links/{token}/generate-contract
 *
 * Genera el contrato del link de venta desde la plantilla QUINTA OLAYA y lo
 * adjunta al link para que el cliente lo descargue en su portal. Corre del lado
 * del servidor (confiable, sin depender del navegador del asesor): reutiliza los
 * endpoints ya existentes (direct-booking-contract → PDF, admin/upload → S3) y
 * la mutation saleLinks.attachContract.
 *
 * Idempotente: si el link ya tiene contrato, lo devuelve sin regenerar.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = new URL(_request.url).origin;

  try {
    const convex = getConvexHttpClient();
    const link = await convex.query(api.saleLinks.getPublicByToken, { token });

    if (!link) {
      return NextResponse.json({ error: "Link no encontrado." }, { status: 404 });
    }
    if (link.contractUrl) {
      return NextResponse.json({ ok: true, contractUrl: link.contractUrl });
    }
    if (!link.paymentValidated) {
      return NextResponse.json(
        { error: "El pago aún no está validado." },
        { status: 409 },
      );
    }
    const client = link.clientData;
    if (!client?.nombre) {
      return NextResponse.json(
        { error: "El cliente aún no ha enviado sus datos." },
        { status: 409 },
      );
    }

    const nights = Math.max(1, link.nights || 1);
    const nightlyPrice = Math.round((link.rentalValue || 0) / nights);
    const ymd = (ms: number) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(ms));

    // 1) Generar el PDF desde la plantilla (endpoint existente).
    const genRes = await fetch(
      `${origin}/api/fincas/${link.property?.id ?? ""}/direct-booking-contract`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: link.property?.id,
          contractNumber: link.contractCode ?? "",
          nightlyPrice: String(nightlyPrice),
          totalPrice: String(link.rentalValue || nightlyPrice * nights),
          clientName: client.nombre,
          clientId: client.cedula ?? "",
          clientEmail: client.email ?? "",
          clientPhone: client.telefono ?? "",
          clientCity: client.ciudad ?? "",
          clientAddress: client.direccion ?? "",
          checkInDate: ymd(link.checkIn),
          checkOutDate: ymd(link.checkOut),
          checkInTime: link.checkInTime ?? "",
          checkOutTime: link.checkOutTime ?? "",
          guests: link.guests || 1,
          petCount: link.petCount ?? 0,
          cleaningFee: link.cleaningFee ?? 0,
          refundableDeposit: link.depositAmount ?? 0,
          otherCharges: 0,
          manillaCondominio: 0,
          bankAccountIds: link.selectedBankAccountIds ?? [],
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

    // 2) Subir el PDF a S3 (endpoint existente).
    const bytes = Buffer.from(genData.fileBase64, "base64");
    const mime = genData.mimeType || "application/pdf";
    const filename =
      genData.filename || `Contrato_${link.contractCode ?? "FincasYa"}.pdf`;
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

    // 3) Adjuntar al link (visible para el cliente).
    const attach = (await convex.mutation(api.saleLinks.attachContract, {
      token,
      contractUrl: upData.url,
    })) as { ok: boolean; contractUrl?: string; reason?: string };
    if (!attach.ok) {
      return NextResponse.json(
        { error: attach.reason || "No se pudo adjuntar el contrato." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, contractUrl: upData.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
