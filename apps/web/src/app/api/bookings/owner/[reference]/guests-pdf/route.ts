import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// TODO: generar PDF de invitados (diferido, sin backend PDF en prueba)
export async function GET() {
  return NextResponse.json({ error: 'pdf_no_disponible' }, { status: 501 });
}
