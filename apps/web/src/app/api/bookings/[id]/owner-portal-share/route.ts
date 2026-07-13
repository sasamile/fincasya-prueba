import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/** Visibilidad de datos en el portal del propietario (/anfitrion). */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const client = getConvexHttpClient();
    const result = await client.mutation(api.bookings.saveOwnerPortalShare, {
      id: id as Id<'bookings'>,
      showGuestList:
        typeof body.showGuestList === 'boolean' ? body.showGuestList : undefined,
      showPlates:
        typeof body.showPlates === 'boolean' ? body.showPlates : undefined,
      showEmpleada:
        typeof body.showEmpleada === 'boolean' ? body.showEmpleada : undefined,
      showInternalNotes:
        typeof body.showInternalNotes === 'boolean'
          ? body.showInternalNotes
          : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/[id]/owner-portal-share POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
