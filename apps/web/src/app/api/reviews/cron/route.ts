import { NextRequest, NextResponse } from "next/server";
import { updateGoogleReviewsAction } from "@/features/landing/actions/reviews.actions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await updateGoogleReviewsAction();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Reseñas actualizadas correctamente",
        count: result.count,
        lastUpdate: result.lastUpdate,
        source: result.source,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "Ocurrió un error desconocido durante la actualización",
      },
      { status: 500 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    console.error("[Cron] Error fatal:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
