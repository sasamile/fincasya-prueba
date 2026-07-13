import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const userAgent = req.headers.get('user-agent') ?? undefined;
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    undefined;

  try {
    const client = getConvexHttpClient();
    const result = await client.mutation(api.habeasData.submit, {
      fullName: String(payload.fullName ?? ''),
      documentType: String(payload.documentType ?? 'CC'),
      documentNumber: String(payload.documentNumber ?? ''),
      email: String(payload.email ?? ''),
      phone: payload.phone ? String(payload.phone) : undefined,
      requestType: String(payload.requestType ?? ''),
      description: String(payload.description ?? ''),
      userAgent,
      ipAddress,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'No pudimos procesar tu solicitud. Intenta de nuevo.';
    console.error('[api/habeas-data POST]', message, err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
