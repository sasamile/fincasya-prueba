import { NextResponse } from "next/server";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { getConvexHttpClient, api } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * GET /api/bookings/contract-codes?propertyId=&search=&prefix=&page=&limit=
 * Historial de códigos. `prefix` = CR / CRA / etc. para filtrar la serie.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyIdRaw = (searchParams.get("propertyId") ?? "").trim();
  const search = (searchParams.get("search") ?? "").trim() || undefined;
  const prefix = (searchParams.get("prefix") ?? "").trim() || undefined;
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const limitRaw = Number(searchParams.get("limit") ?? "20");

  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 20;

  try {
    const client = getConvexHttpClient();
    const result = await client.query(api.contractCodeHistory.list, {
      ...(propertyIdRaw
        ? { propertyId: propertyIdRaw as Id<"properties"> }
        : {}),
      ...(search ? { search } : {}),
      ...(prefix ? { prefix } : {}),
      page,
      limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el historial de códigos.";
    console.error("[api/bookings/contract-codes GET]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
