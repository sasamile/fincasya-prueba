import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/** Edición directa de invitados desde el panel admin (sin bloqueo 24/12 h). */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const guests = Array.isArray(body.guests) ? body.guests : [];
    const client = getConvexHttpClient();
    const result = await client.mutation(api.checkinPortal.adminSaveGuests, {
      bookingId: id as Id<'bookings'>,
      guests,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/[id]/checkin-guests POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
