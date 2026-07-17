'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { Button } from '@/components/ui/button';

interface DirectBookSuccessPageProps {
  reference: string;
}

type FinalizeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ok';
      contractUrl?: string;
      contractCode?: string;
      alreadyDone?: boolean;
      emailOk?: boolean;
    }
  | { status: 'error'; message: string };

export function DirectBookSuccessPage({ reference }: DirectBookSuccessPageProps) {
  const booking = useQuery(
    api.directBooking.getByReferencePublic,
    reference ? { reference } : 'skip',
  );
  const [finalize, setFinalize] = useState<FinalizeState>({ status: 'idle' });
  const started = useRef(false);

  useEffect(() => {
    if (!reference || started.current) return;
    if (booking === undefined) return;
    if (booking === null) {
      setFinalize({
        status: 'error',
        message: 'No encontramos esa reserva. Revisa el enlace o contacta a un asesor.',
      });
      return;
    }
    if (booking.contractUrl) {
      setFinalize({
        status: 'ok',
        contractUrl: booking.contractUrl,
        contractCode: booking.contractCode,
        alreadyDone: true,
        emailOk: true,
      });
      return;
    }

    started.current = true;
    setFinalize({ status: 'loading' });
    void fetch('/api/bookings/direct/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          contractUrl?: string;
          contractCode?: string;
          alreadyDone?: boolean;
          email?: { ok?: boolean };
        };
        if (!res.ok) {
          setFinalize({
            status: 'error',
            message: data.error ?? 'No se pudo generar el contrato.',
          });
          return;
        }
        setFinalize({
          status: 'ok',
          contractUrl: data.contractUrl,
          contractCode: data.contractCode,
          alreadyDone: data.alreadyDone,
          emailOk: data.email?.ok !== false,
        });
      })
      .catch(() => {
        setFinalize({
          status: 'error',
          message: 'Error de red al finalizar la reserva.',
        });
      });
  }, [reference, booking]);

  return (
    <div className="landing min-h-screen bg-background">
      <Navbar isHome={false} />
      <main className="mx-auto max-w-lg px-4 py-16">
        {!reference ? (
          <div className="text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Falta la referencia</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              El enlace de retorno de Bold no trae la reserva.
            </p>
          </div>
        ) : finalize.status === 'loading' ||
          finalize.status === 'idle' ||
          booking === undefined ? (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#fe4a19]" />
            <h1 className="mt-4 text-xl font-semibold">Confirmando tu pago…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Generamos el contrato y lo enviamos a tu correo.
            </p>
          </div>
        ) : finalize.status === 'error' ? (
          <div className="text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Hubo un problema</h1>
            <p className="mt-2 text-sm text-muted-foreground">{finalize.message}</p>
            {booking?.boldPaymentUrl ? (
              <Button asChild className="mt-6 bg-[#fe4a19] hover:bg-[#fe4a19]/90">
                <a href={booking.boldPaymentUrl}>Reintentar pago Bold</a>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 text-xl font-semibold">¡Reserva lista!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {booking?.propertyTitle
                ? `Pago recibido para ${booking.propertyTitle}.`
                : 'Pago recibido.'}
              {finalize.contractCode
                ? ` Contrato ${finalize.contractCode}.`
                : ''}
              {finalize.emailOk
                ? ' Te enviamos el PDF al correo registrado.'
                : ' El contrato está listo; si no llega el correo, descárgalo aquí.'}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {finalize.contractUrl ? (
                <Button asChild className="bg-[#fe4a19] hover:bg-[#fe4a19]/90">
                  <a
                    href={finalize.contractUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Descargar contrato
                  </a>
                </Button>
              ) : null}
              {booking?.propertySlug ? (
                <Button asChild variant="outline">
                  <Link href={`/fincas/${encodeURIComponent(booking.propertySlug)}`}>
                    Volver a la finca
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/">Ir al inicio</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
