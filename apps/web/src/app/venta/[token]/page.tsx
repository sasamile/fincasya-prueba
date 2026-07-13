import { Suspense } from "react";
import type { Metadata } from "next";
import { VentaPageContent } from "@/features/ventas/components/venta-page-content";

export const metadata: Metadata = {
  title: "Reserva tu estadía | FincasYa",
  description: "Completa los pasos para confirmar tu reserva.",
  robots: { index: false, follow: false },
};

export default async function VentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ validated?: string }>;
}) {
  const { token } = await params;
  const { validated } = await searchParams;
  return (
    <Suspense fallback={null}>
      <VentaPageContent token={token} validatedParam={validated} />
    </Suspense>
  );
}
