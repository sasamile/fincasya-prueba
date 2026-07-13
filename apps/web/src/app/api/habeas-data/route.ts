import { NextResponse } from 'next/server';

function getBackendBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  return 'https://app.fincasya.cloud';
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const backendUrl = `${getBackendBaseUrl().replace(/\/$/, '')}/api/habeas-data`;

  try {
    const userAgent = req.headers.get('user-agent') ?? '';
    const forwardedFor =
      req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'Respuesta inesperada del servidor.' };
    }

    if (!res.ok) {
      const msg =
        (data as { message?: string | string[]; error?: string }).message ??
        (data as { error?: string }).error ??
        'No pudimos procesar tu solicitud.';
      const flatMsg = Array.isArray(msg) ? msg.join('. ') : msg;
      return NextResponse.json({ error: flatMsg }, { status: res.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('[habeas-data proxy] Error:', err);
    return NextResponse.json(
      {
        error:
          'No pudimos contactar el servidor. Por favor escríbenos directamente a comercial@fincasya.com.',
      },
      { status: 502 },
    );
  }
}
