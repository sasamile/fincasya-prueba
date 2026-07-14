import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/**
 * Preview (dryRun) o envío real de plantilla Meta a la reserva.
 * Body: { templateKey: string, dryRun?: boolean }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const templateKey = String(body.templateKey ?? '').trim();
    if (!templateKey) {
      return NextResponse.json(
        { ok: false, error: 'templateKey es requerido' },
        { status: 400 },
      );
    }

    const client = getConvexHttpClient();
    const result = await client.action(api.checkinMessaging.sendTemplateToBooking, {
      bookingId: id as Id<'bookings'>,
      templateKey,
      dryRun: Boolean(body.dryRun),
    });

    if (!result?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.error || 'No se pudo enviar la plantilla',
          to: result?.to,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/checkin/[id]/send POST]', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error al enviar la plantilla de check-in',
      },
      { status: 500 },
    );
  }
}
