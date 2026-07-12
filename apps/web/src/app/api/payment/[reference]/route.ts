import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const key = decodeURIComponent(reference).trim();
    if (!key) {
      return NextResponse.json({ error: 'Referencia inválida' }, { status: 400 });
    }
    const client = getConvexHttpClient();
    const data = await client.query(api.paymentPortal.getByReference, { key });
    if (!data) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[payment GET]', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el portal de pago' },
      { status: 500 },
    );
  }
}
