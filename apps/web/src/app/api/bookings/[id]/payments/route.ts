import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

/** Abonos de una reserva (modal admin / edición). */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const client = getConvexHttpClient();
    const summary = await client.query(api.bookings.getPaymentsByBooking, {
      bookingId: id as Id<'bookings'>,
    });
    if (!summary) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[api/bookings/[id]/payments GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}

/** Registrar un abono al crear una reserva nueva. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const client = getConvexHttpClient();
    const paymentId = await client.mutation(api.bookings.createPayment, {
      bookingId: id as Id<'bookings'>,
      type: body.type,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      status: 'PAID',
      verifiedBy:
        typeof body.verifiedBy === 'string' ? body.verifiedBy.trim() : undefined,
    });
    return NextResponse.json({ paymentId });
  } catch (error) {
    console.error('[api/bookings/[id]/payments POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
