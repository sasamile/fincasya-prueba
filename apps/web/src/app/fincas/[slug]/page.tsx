import type { Metadata } from "next";
import { FincaDetailPage } from "@/features/fincas/FincaDetailPage";
import { api, getConvexHttpClient } from "@/lib/convex-server";
import { buildOgMetadata } from "@/lib/og-image";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ modo?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const { modo } = await searchParams;
  const isSaleMode = modo === "venta";

  try {
    const client = getConvexHttpClient();
    const finca = await client.query(api.landing.getPropertyBySlug, { slug });
    if (!finca) {
      return {
        title: "Finca en Alquiler | FincasYa",
        description: "Encuentra tu finca ideal en FincasYa.",
      };
    }

    const title = finca.title || "Finca en Alquiler";
    const rawDescription =
      (isSaleMode && finca.saleDescription) ||
      finca.description ||
      "Reserva esta hermosa finca en FincasYa.";
    const description = rawDescription.slice(0, 160);
    const imageUrl =
      finca.images && finca.images.length > 0 ? finca.images[0] : null;
    const path = isSaleMode ? `/fincas/${slug}?modo=venta` : `/fincas/${slug}`;

    return buildOgMetadata({
      title: `${title} | FincasYa`,
      description,
      path,
      imageUrl,
    });
  } catch (error) {
    console.error("[fincas metadata]", error);
    return {
      title: "Finca en Alquiler | FincasYa",
      description: "Encuentra tu finca ideal en FincasYa.",
    };
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { modo } = await searchParams;
  return <FincaDetailPage slug={slug} modoVenta={modo === "venta"} />;
}
