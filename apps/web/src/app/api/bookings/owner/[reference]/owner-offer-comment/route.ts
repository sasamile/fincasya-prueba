import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const { comment = '' } = (await req.json()) as { comment?: string };
    const client = getConvexHttpClient();
    await client.mutation(api.bookings.commentOwnerOffer, {
      reference: decodeURIComponent(reference),
      comment,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[owner owner-offer-comment POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 400 },
    );
  }
}
