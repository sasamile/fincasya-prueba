import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const client = getConvexHttpClient();
    await client.mutation(api.bookings.acceptOwnerOffer, {
      reference: decodeURIComponent(reference),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[owner accept-offer POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 400 },
    );
  }
}
