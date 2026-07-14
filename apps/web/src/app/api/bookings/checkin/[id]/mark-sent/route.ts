import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/** Marca/desmarca el check-in como enviado (etapa morado en calendario). */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const client = getConvexHttpClient();
    const result = await client.mutation(api.bookings.markCheckinSent, {
      id: id as Id<'bookings'>,
      sent: body.sent === undefined ? true : Boolean(body.sent),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/checkin/[id]/mark-sent POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
