import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-server";
import { type ReservationConfirmationData } from "@/lib/server/reservation-confirmation-html";
import {
  buildCrTemplateValues,
  fillCrDocx,
  loadCrTemplate,
} from "@/lib/server/cr-docx";
import { convertDocxToPdfDetailed } from "@/lib/server/docx-to-pdf";
import { computeConfirmationFinancials } from "@/lib/server/confirmation-financials";
import { carpetaDeContrato } from "@/lib/contract-folder";

export const runtime = "nodejs";
export const maxDuration = 60;

const ymd = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));

function formatGroupTypeLabel(raw: unknown): string {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  if (v === "FAMILIAR") return "Familiar";
  if (v === "AMIGOS") return "Amigos";
  if (v === "EMPRESA") return "Empresa";
  return String(raw).trim();
}

/**
 * POST /api/sale-links/{token}/generate-cr
 *
 * Genera la Confirmación de Reserva (CR) del link (HTML → PDF), la sube a S3 y
 * la adjunta al link (crUrl) para que el cliente la descargue al instante.
 * Idempotente: si ya existe, la devuelve.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = new URL(request.url).origin;

  try {
    const convex = getConvexHttpClient();
    const link = await convex.query(api.saleLinks.getPublicByToken, { token });

    if (!link) {
      return NextResponse.json({ error: "Link no encontrado." }, { status: 404 });
    }
    if (link.crUrl) {
      // Re-adjunta para sincronizar con Gestor de contratos (idempotente).
      await convex.mutation(api.saleLinks.attachCr, {
        token,
        crUrl: link.crUrl,
      });
      return NextResponse.json({ ok: true, crUrl: link.crUrl });
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

    const checkInDate = ymd(link.checkIn);
    const checkOutDate = ymd(link.checkOut);
    const today = ymd(Date.now());
    const depositAmount = Math.round((link.totalValue || 0) * 0.5);
    const balanceAmount = Math.max((link.totalValue || 0) - depositAmount, 0);

    const financials = computeConfirmationFinancials({
      precioTotal: link.totalValue || 0,
      subtotal: link.rentalValue || 0,
      petSurcharge: link.petSurcharge,
      cleaningFee: link.cleaningFee || 0,
      damageDeposit: link.depositAmount || 0,
      petCount: link.petCount,
      depositoMascotas: link.petDeposit,
    });

    const data: ReservationConfirmationData = {
      contractNumber: link.contractCode ?? "",
      clientName: client.nombre,
      clientId: client.cedula ?? "",
      clientEmail: client.email ?? "",
      issueDate: today,
      clientPhone: client.telefono ?? "",
      clientAddress: client.direccion ?? "",
      propertyName: link.property?.title ?? "",
      propertyLocation: link.property?.location ?? "",
      checkInDate,
      checkOutDate,
      checkInTime: link.checkInTime ?? "10:00",
      checkOutTime: link.checkOutTime ?? "16:00",
      guests: link.guests || 1,
      nights: link.nights || 1,
      depositAmount,
      depositDate: today,
      balanceAmount,
      balanceDate: checkInDate,
      rentAmount: financials.rentAmount,
      cleaningFee: financials.cleaningFee,
      petCleaningFee: financials.petCleaningFee,
      refundableDeposit: financials.refundableDeposit,
      totalAmount: financials.totalAmount,
      paymentMethod: "bancolombia",
      paymentStatus: "paid",
      groupType:
        formatGroupTypeLabel(
          (link as { groupType?: string }).groupType ??
            (client as { groupType?: string }).groupType,
        ) || "Familiar",
      purpose:
        String(
          (link as { purpose?: string }).purpose ??
            (client as { purpose?: string }).purpose ??
            "",
        ).trim() || "Descanso",
    };

    // TODOS los CR salen de la plantilla oficial .docx (Santiago, 23-jul):
    // plantilla → docx → PDF, igual que el CR del inbox.
    const template = await loadCrTemplate();
    const docx = fillCrDocx(template, buildCrTemplateValues(data));
    const { pdf, error: pdfError } = await convertDocxToPdfDetailed(docx);
    if (!pdf?.length) {
      return NextResponse.json(
        { error: pdfError || "No se pudo generar la confirmación." },
        { status: 502 },
      );
    }

    // Subir a S3 (endpoint interno existente).
    const filename = `CR_${(link.contractCode || "FincasYa").replace(/[^\w-]+/g, "_")}.pdf`;
    const fd = new FormData();
    fd.append(
      "file",
      new File([new Uint8Array(pdf)], filename, { type: "application/pdf" }),
    );
    fd.append("folder", "documents");
    // A LA CARPETA DEL CÓDIGO (Santiago, 23-jul): venga del link de venta o del
    // inbox, cada documento vive en documents/{codificación}/{subcarpeta}. Antes
    // el CR del link caía suelto en la raíz y no salía en Documentos.
    const carpeta = link.contractCode?.trim()
      ? carpetaDeContrato(link.contractCode)
      : null;
    if (carpeta) fd.append("subpath", `${carpeta}/confirmaciones`);
    const up = await fetch(`${origin}/api/admin/upload`, {
      method: "POST",
      body: fd,
    });
    const upData = (await up.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!up.ok || !upData.url) {
      return NextResponse.json(
        { error: upData.error || "No se pudo subir la confirmación." },
        { status: 502 },
      );
    }

    const attach = (await convex.mutation(api.saleLinks.attachCr, {
      token,
      crUrl: upData.url,
    })) as { ok: boolean; crUrl?: string; reason?: string };
    if (!attach.ok) {
      return NextResponse.json(
        { error: attach.reason || "No se pudo adjuntar la confirmación." },
        { status: 500 },
      );
    }

    // Registrarlo para que aparezca en Documentos (el subpath solo lo ubica en
    // S3; el explorador lee de contractDocuments). Si falla, el CR igual salió.
    if (link.contractCode?.trim()) {
      try {
        await convex.mutation(api.contractDocuments.registerDocument, {
          contractNumber: link.contractCode.trim(),
          tipo: "confirmacion",
          estado: "enviado",
          url: upData.url,
          filename,
        });
      } catch (err) {
        console.error("[generate-cr] no se pudo archivar el CR", err);
      }
    }

    return NextResponse.json({ ok: true, crUrl: upData.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando la confirmación.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
