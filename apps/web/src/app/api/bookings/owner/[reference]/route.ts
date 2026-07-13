import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const client = getConvexHttpClient();
    const data = await client.query(api.bookings.getOwnerView, {
      reference: decodeURIComponent(reference),
    });
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error('[owner GET]', e);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
