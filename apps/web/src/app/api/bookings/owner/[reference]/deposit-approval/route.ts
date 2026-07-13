import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const { estado = '' } = (await req.json()) as { estado?: string };
    const client = getConvexHttpClient();
    const b = await client.query(api.bookings.getByReference, {
      reference: decodeURIComponent(reference),
    });
    if (!b || !b._id) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    await client.mutation(api.bookings.saveDepositApproval, {
      id: b._id,
      estado,
      por: 'propietario',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[owner deposit-approval POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 400 },
    );
  }
}
