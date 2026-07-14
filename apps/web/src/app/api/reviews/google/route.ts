import { NextResponse } from "next/server";
import { getGoogleReviews } from "@/features/landing/actions/reviews.actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getGoogleReviews();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Reviews] Error al servir reseñas cacheadas:", error);
    return NextResponse.json({
      reviews: [],
      averageRating: 5,
      totalCount: 0,
      placeName: "FincasYa",
      lastUpdate: new Date().toISOString(),
      isError: true,
    });
  }
}
