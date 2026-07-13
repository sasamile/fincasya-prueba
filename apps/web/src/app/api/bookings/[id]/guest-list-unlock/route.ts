import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/** Override del equipo: habilitar/bloquear edición de lista de invitados. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const client = getConvexHttpClient();
    const result = await client.mutation(api.bookings.setGuestListUnlocked, {
      bookingId: id as Id<'bookings'>,
      unlocked: Boolean(body.unlocked),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/[id]/guest-list-unlock POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
