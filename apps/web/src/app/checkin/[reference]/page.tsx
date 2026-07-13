import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckinPageContent } from "@/features/checkin/components/checkin-page-content";
import {
  buildCheckinOgImageUrl,
  CHECKIN_EXPIRED_REDIRECT_URL,
  fetchCheckinPortalSummary,
  isCheckinPortalExpired,
} from "@/features/checkin/api/checkin-portal.api";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ reference: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const summary = await fetchCheckinPortalSummary(reference);

  const title = summary?.propertyTitle
    ? `Check-in · ${summary.propertyTitle}`
    : "Check-in | FincasYa";
  const description = summary
    ? `Completa el check-in de tu reserva en ${summary.propertyTitle} con FincasYa.`
    : "Completa tu check-in de reserva en FincasYa.";
  const optimizedImageUrl = buildCheckinOgImageUrl(
    summary?.propertyCoverImageUrl,
  );
  const pageUrl = `https://fincasya.com/checkin/${encodeURIComponent(reference)}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/checkin/${reference}`,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "FincasYa",
      images: [
        {
          url: optimizedImageUrl,
          width: 800,
          height: 418,
          alt: summary?.propertyTitle ?? "Check-in FincasYa",
          type: "image/jpeg",
        },
      ],
      locale: "es_CO",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [optimizedImageUrl],
    },
    other: {
      image: optimizedImageUrl,
      thumbnail: optimizedImageUrl,
    },
  };
}

export default async function CheckinPage({ params }: Props) {
  const { reference } = await params;
  if (await isCheckinPortalExpired(reference)) {
    redirect(CHECKIN_EXPIRED_REDIRECT_URL);
  }
  return <CheckinPageContent />;
}
