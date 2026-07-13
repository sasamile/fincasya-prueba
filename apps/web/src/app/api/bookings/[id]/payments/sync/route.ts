import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

/** Sincroniza abonos manuales al editar una reserva desde el modal admin. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const client = getConvexHttpClient();
    const result = await client.mutation(api.bookings.syncReservationAbono, {
      bookingId: id as Id<'bookings'>,
      paymentStatus: body.paymentStatus,
      abono: body.abono,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/[id]/payments/sync POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
