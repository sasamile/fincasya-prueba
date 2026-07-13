import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const { nombre, contacto } = (await req.json()) as {
      nombre?: string;
      contacto?: string;
    };
    const client = getConvexHttpClient();
    const b = await client.query(api.bookings.getByReference, {
      reference: decodeURIComponent(reference),
    });
    if (!b || !b._id) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    await client.mutation(api.bookings.saveOwnerReceiver, {
      id: b._id,
      nombre,
      contacto,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[owner receiver POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 400 },
    );
  }
}
