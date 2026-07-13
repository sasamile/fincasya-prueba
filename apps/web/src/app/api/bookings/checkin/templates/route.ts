import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

/** Plantillas WhatsApp de check-in / salida (mismo catálogo que envío manual). */
export async function GET() {
  try {
    const client = getConvexHttpClient();
    const templates = await client.query(api.campaignBroadcast.listTemplates, {});
    return NextResponse.json(templates);
  } catch (error) {
    console.error('[api/bookings/checkin/templates GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    );
  }
}
