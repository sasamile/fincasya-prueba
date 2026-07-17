import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fechaEntrada = searchParams.get('fechaEntrada') ?? '';
  const fechaSalida = searchParams.get('fechaSalida') ?? '';
  const numeroPersonas = Number(searchParams.get('numeroPersonas') ?? '0') || undefined;
  const numeroMascotas = Number(searchParams.get('numeroMascotas') ?? '0') || undefined;
  const incluirServicio = searchParams.get('incluirServicio') === 'true';

  try {
    const client = getConvexHttpClient();
    const data = await client.query(api.fincas.calculateStayPrice, {
      propertyId: id as any,
      fechaEntrada,
      fechaSalida,
      numeroPersonas,
      numeroMascotas,
      incluirServicio,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/fincas calculate-stay-price]', error);
    return NextResponse.json({ total: 0, nights: [] });
  }
}
