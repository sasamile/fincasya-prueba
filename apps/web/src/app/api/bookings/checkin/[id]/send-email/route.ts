import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

type RouteParams = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/** Envía el correo de invitación al check-in al cliente de la reserva. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const client = getConvexHttpClient();
    const result = await client.action(
      api.notifications.sendCheckinInvitationEmail,
      { bookingId: id as Id<'bookings'> },
    );

    if (!result?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.error || 'No se pudo enviar el correo de check-in',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/bookings/checkin/[id]/send-email POST]', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error al enviar el correo de check-in',
      },
      { status: 500 },
    );
  }
}
