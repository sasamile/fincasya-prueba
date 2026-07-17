import type { Metadata } from "next";
import { DirectBookSuccessPage } from "@/features/fincas/components/DirectBookSuccessPage";
import { buildOgMetadata } from "@/lib/og-image";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ ref?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return buildOgMetadata({
    title: "Reserva confirmada | FincasYa",
    description: "Tu anticipo y contrato de reserva en FincasYa.",
    path: "/fincas/book/success",
    noIndex: true,
  });
}

export default async function Page({ searchParams }: Props) {
  const { ref } = await searchParams;
  return <DirectBookSuccessPage reference={ref?.trim() ?? ""} />;
}
