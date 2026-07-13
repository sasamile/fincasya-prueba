import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/** Observaciones visibles para el cliente en el portal de check-in. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const client = getConvexHttpClient();
    const result = await client.mutation(api.bookings.saveClientObservaciones, {
      id: id as Id<'bookings'>,
      valor: typeof body.valor === 'string' ? body.valor : '',
      actor: typeof body.actor === 'string' ? body.actor : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/[id]/client-observaciones POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
