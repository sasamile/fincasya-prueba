import type { Metadata } from "next";
import { DirectBookPage } from "@/features/fincas/components/DirectBookPage";
import { buildOgMetadata } from "@/lib/og-image";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
    service?: string;
    groupType?: string;
    purpose?: string;
    eventType?: string;
    eventGuests?: string;
    eventGuestsCount?: string;
    eventServices?: string;
    eventDecoration?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildOgMetadata({
    title: "Reservar | FincasYa",
    description: "Completa tu reserva: cuenta, pago Bold y contrato por correo.",
    path: `/fincas/${slug}/book`,
    noIndex: true,
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  return (
    <DirectBookPage
      slug={slug}
      initialCheckIn={q.checkIn ?? ""}
      initialCheckOut={q.checkOut ?? ""}
      initialGuests={Math.max(1, Number(q.guests) || 1)}
      initialPets={q.pets === "1" ? 1 : 0}
      initialService={q.service === "1"}
      groupType={q.groupType ?? ""}
      purpose={q.purpose ?? ""}
      eventType={q.eventType ?? ""}
      eventGuests={q.eventGuests ?? ""}
      eventGuestsCount={q.eventGuestsCount ?? ""}
      eventServices={q.eventServices ?? ""}
      eventDecoration={q.eventDecoration ?? ""}
    />
  );
}
