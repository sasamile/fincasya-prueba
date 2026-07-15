import type { Metadata } from "next";
import { CheckoutPageContent } from "@/features/checkout/components/checkout-page-content";
import { fetchCheckoutPortalSummary } from "@/features/checkout/api/checkout-portal.api";
import { buildOgMetadata } from "@/lib/og-image";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ reference: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const summary = await fetchCheckoutPortalSummary(reference);

  const title = summary?.propertyTitle
    ? `Check-out · ${summary.propertyTitle}`
    : "Check-out | FincasYa";
  const description = summary
    ? `Gestiona tu salida y la devolución del depósito de tu reserva en ${summary.propertyTitle} con FincasYa.`
    : "Gestiona tu salida y la devolución del depósito de tu reserva en FincasYa.";

  return buildOgMetadata({
    title,
    description,
    path: `/checkout/${reference}`,
    noIndex: true,
  });
}

export default async function CheckoutPage() {
  return <CheckoutPageContent />;
}
