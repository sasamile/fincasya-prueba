import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

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
      propertyId: propertyId as any,
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
    const body = await request.json();
    const client = getConvexHttpClient();
    const id = await client.mutation(api.bookings.create, body);
    return NextResponse.json({ id });
  } catch (error) {
    console.error('[api/bookings POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
