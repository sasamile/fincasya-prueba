import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const { reason = '' } = (await req.json()) as { reason?: string };
    const client = getConvexHttpClient();
    await client.mutation(api.bookings.rejectOwnerOffer, {
      reference: decodeURIComponent(reference),
      reason,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[owner reject-offer POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 400 },
    );
  }
}
