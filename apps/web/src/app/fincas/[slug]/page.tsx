import { FincaDetailPage } from '@/features/fincas/FincaDetailPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <FincaDetailPage slug={slug} />;
}
