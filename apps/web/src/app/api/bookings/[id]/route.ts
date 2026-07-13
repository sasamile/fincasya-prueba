import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';
import {
  parseBookingFormData,
  readBookingFormRequest,
} from '@/lib/bookings/parse-booking-form';

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const form = await readBookingFormRequest(request);
    const payload = await parseBookingFormData(form);
    const client = getConvexHttpClient();
    await client.mutation(api.bookings.adminUpdate, {
      id: id as Id<'bookings'>,
      ...payload,
    });
    return NextResponse.json({ ok: true, bookingId: id, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar la reserva.';
    console.error('[api/bookings PUT]', id, message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const client = getConvexHttpClient();
    await client.mutation(api.bookings.remove, { id: id as never });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/bookings DELETE]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
