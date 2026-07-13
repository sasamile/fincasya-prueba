import { FincaDetailPage } from '@/features/fincas/FincaDetailPage';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ modo?: string }>;
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { modo } = await searchParams;
  return <FincaDetailPage slug={slug} modoVenta={modo === 'venta'} />;
}
