import { Suspense } from "react";
import type { Metadata } from "next";
import { VentaPageContent } from "@/features/ventas/components/venta-page-content";
import { api, getConvexHttpClient } from "@/lib/convex-server";
import { buildOgMetadata } from "@/lib/og-image";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ validated?: string; bold?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  try {
    const client = getConvexHttpClient();
    const link = await client.query(api.saleLinks.getPublicByToken, { token });
    const property = link?.property ?? null;
    const title = property?.title
      ? `Reserva · ${property.title} | FincasYa`
      : "Reserva tu estadía | FincasYa";
    const description = property
      ? `Completa los pasos para confirmar tu reserva en ${property.title}.`
      : "Completa los pasos para confirmar tu reserva.";
    const imageUrl =
      property?.images && property.images.length > 0
        ? property.images[0]
        : null;

    return buildOgMetadata({
      title,
      description,
      path: `/venta/${token}`,
      imageUrl,
      noIndex: true,
    });
  } catch (error) {
    console.error("[venta metadata]", error);
    return {
      title: "Reserva tu estadía | FincasYa",
      description: "Completa los pasos para confirmar tu reserva.",
      robots: { index: false, follow: false },
    };
  }
}

export default async function VentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ validated?: string; bold?: string }>;
}) {
  const { token } = await params;
  const { validated, bold } = await searchParams;
  return (
    <Suspense fallback={null}>
      <VentaPageContent
        token={token}
        validatedParam={validated}
        boldReturnParam={bold}
      />
    </Suspense>
  );
}
