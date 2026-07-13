import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import {
  parseBookingFormData,
  readBookingFormRequest,
} from '@/lib/bookings/parse-booking-form';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? undefined;
  const year = searchParams.get('year') ?? undefined;
  const propertyId = searchParams.get('propertyId') ?? undefined;

  try {
    const client = getConvexHttpClient();
    const result = await client.query(api.bookings.list, {
      month,
      year,
      propertyId: propertyId as never,
      limit: 500,
    });
    const bookings = Array.isArray(result)
      ? result
      : (result as { bookings?: unknown[] })?.bookings ?? result;
    return NextResponse.json(bookings);
  } catch (error) {
    console.error('[api/bookings GET]', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await readBookingFormRequest(request);
    const payload = await parseBookingFormData(form);
    const client = getConvexHttpClient();
    const bookingId = await client.mutation(api.bookings.create, payload);
    return NextResponse.json({ id: bookingId, bookingId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo crear la reserva.';
    console.error('[api/bookings POST]', message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
