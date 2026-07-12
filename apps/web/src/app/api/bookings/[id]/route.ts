import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const client = getConvexHttpClient();
    await client.mutation(api.bookings.remove, { id: id as any });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/bookings DELETE]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
