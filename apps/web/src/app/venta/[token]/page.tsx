import type { Metadata } from "next";
import { VentaPortal } from "@/features/ventas/components/venta-portal";

export const metadata: Metadata = {
  title: "Tu reserva — FincasYa",
  description: "Completa tus datos y sube el comprobante para confirmar tu reserva.",
  robots: { index: false, follow: false },
};

export default async function VentaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VentaPortal token={token} />;
}
