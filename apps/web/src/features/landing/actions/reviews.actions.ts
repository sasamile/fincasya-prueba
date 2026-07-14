"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import GOOGLE_REVIEWS_FALLBACK from "@/features/landing/data/google-reviews.json";
import type { GoogleReviewsData } from "@/features/landing/types/google-reviews.types";
import { getConvexHttpClient, api } from "@/lib/convex-server";

const PLACE_ID = "ChIJG4_vBAAxPo4Ryi9hgNA8vso";
const SERPAPI_KEY = process.env.SERPAPI_API_KEY;
const MAX_PAGES = 10;
const JSON_PATH = path.join(
  process.cwd(),
  "src/features/landing/data/google-reviews.json",
);
const CONVEX_PAGE_ID = "google-reviews";

interface SerpApiReview {
  review_id?: string;
  user?: {
    name?: string;
    thumbnail?: string;
    link?: string;
    local_guide?: boolean;
  };
  rating?: number;
  date?: string;
  iso_date?: string;
  snippet?: string;
  likes?: number;
  images?: Array<string | { thumbnail?: string; image?: string }>;
  response?: {
    snippet?: string;
    date?: string;
  };
}

interface SerpApiResponse {
  place_info?: {
    title?: string;
    rating?: number;
    reviews?: number;
  };
  reviews?: SerpApiReview[];
  serpapi_pagination?: {
    next_page_token?: string;
  };
  error?: string;
}

function asReviewsData(value: unknown): GoogleReviewsData {
  const fallback = GOOGLE_REVIEWS_FALLBACK as GoogleReviewsData;
  if (!value || typeof value !== "object") return fallback;
  const data = value as Partial<GoogleReviewsData>;
  return {
    reviews: Array.isArray(data.reviews) ? data.reviews : fallback.reviews,
    totalFetched: data.totalFetched ?? fallback.totalFetched,
    averageRating: data.averageRating ?? fallback.averageRating,
    totalCount: data.totalCount ?? fallback.totalCount,
    placeName: data.placeName ?? fallback.placeName,
    lastUpdate: data.lastUpdate ?? fallback.lastUpdate,
  };
}

function extractPhotoUrl(
  img: string | { thumbnail?: string; image?: string },
): string | null {
  if (typeof img === "string") return img;
  return img.image ?? img.thumbnail ?? null;
}

async function readCachedReviews(): Promise<GoogleReviewsData> {
  try {
    const client = getConvexHttpClient();
    const fromConvex = await client.query(api.internalPages.getById, {
      pageId: CONVEX_PAGE_ID,
    });
    if (fromConvex) return asReviewsData(fromConvex);
  } catch {
    // Convex no disponible: usar JSON embebido.
  }

  return asReviewsData(GOOGLE_REVIEWS_FALLBACK);
}

async function persistReviews(data: GoogleReviewsData) {
  try {
    const client = getConvexHttpClient();
    await client.mutation(api.internalPages.upsert, {
      pageId: CONVEX_PAGE_ID,
      content: data,
    });
  } catch (error) {
    console.warn("[Reviews] No se pudo guardar en Convex:", error);
  }

  try {
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn("[Reviews] No se pudo escribir JSON local:", error);
  }

  revalidatePath("/");
  revalidatePath("/admin/reviews");
}

async function fetchReviewsPage(
  nextPageToken?: string,
): Promise<SerpApiResponse> {
  const params = new URLSearchParams({
    engine: "google_maps_reviews",
    place_id: PLACE_ID,
    hl: "es",
    sort_by: "qualityScore",
    api_key: SERPAPI_KEY!,
  });

  if (nextPageToken) {
    params.set("next_page_token", nextPageToken);
    params.set("num", "20");
  }

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function getGoogleReviews(): Promise<GoogleReviewsData> {
  return readCachedReviews();
}

export async function updateGoogleReviewsAction(): Promise<
  | {
      success: true;
      count: number;
      lastUpdate: string;
      source: string;
      averageRating: number;
    }
  | { success: false; error: string }
> {
  if (!SERPAPI_KEY) {
    return {
      success: false,
      error:
        "SERPAPI_API_KEY no configurada. Configúrala en Vercel o usa un cron externo con la clave.",
    };
  }

  try {
    const allReviews: SerpApiReview[] = [];
    let placeInfo: SerpApiResponse["place_info"] | undefined;
    let nextPageToken: string | undefined;
    let page = 0;

    do {
      const data = await fetchReviewsPage(nextPageToken);
      if (data.error) throw new Error(data.error);

      if (page === 0 && data.place_info) {
        placeInfo = data.place_info;
      }

      if (data.reviews?.length) {
        allReviews.push(...data.reviews);
      } else {
        break;
      }

      nextPageToken = data.serpapi_pagination?.next_page_token;
      page++;
    } while (nextPageToken && page < MAX_PAGES);

    const liveReviews = allReviews.map((review, index) => {
      const photos = (review.images || [])
        .map(extractPhotoUrl)
        .filter((url): url is string => url !== null);

      return {
        id: review.review_id || `live-${index}`,
        name: review.user?.name || "Cliente Satisfecho",
        role: review.user?.local_guide
          ? "Local Guide · Reseña de Google"
          : "Reseña de Google",
        location: review.date || "Reciente",
        isoDate: review.iso_date || null,
        quote: review.snippet || "",
        rating: review.rating || 5,
        likes: review.likes || 0,
        image:
          review.user?.thumbnail ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            review.user?.name || "C",
          )}&background=random&color=fff`,
        profileUrl: review.user?.link || null,
        photos,
        ownerResponse: review.response?.snippet
          ? {
              text: review.response.snippet,
              date: review.response.date || null,
            }
          : null,
      };
    });

    const finalData: GoogleReviewsData = {
      reviews: liveReviews,
      totalFetched: liveReviews.length,
      averageRating: placeInfo?.rating || 5,
      totalCount: placeInfo?.reviews || liveReviews.length,
      placeName: placeInfo?.title || "FincasYa",
      lastUpdate: new Date().toISOString(),
    };

    await persistReviews(finalData);

    return {
      success: true,
      count: finalData.totalCount,
      lastUpdate: finalData.lastUpdate,
      source: "serpapi",
      averageRating: finalData.averageRating,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Reviews Action] Error al actualizar reseñas:", message);
    return { success: false, error: message };
  }
}
