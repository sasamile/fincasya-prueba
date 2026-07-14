'use client';

import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/features/legal/hooks/use-cookie-consent';

export function CookieConsentBanner() {
  const { status, isLoading, accept, reject } = useCookieConsent();

  if (isLoading || status !== 'pending') return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-60 px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-black/6 bg-white px-3 py-3 text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.10)] sm:flex-row sm:items-center sm:gap-5 sm:px-4 sm:py-3.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fe4a19]/10 sm:h-10 sm:w-10">
            <Cookie className="h-[18px] w-[18px] text-[#fe4a19] sm:h-5 sm:w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-tight text-foreground sm:text-sm">
              Usamos cookies para mejorar tu experiencia
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-600 sm:mt-1 sm:text-xs sm:leading-relaxed">
              Usamos cookies propias y de terceros (Google Analytics, Meta) para
              analizar el tráfico, personalizar contenido y mostrar publicidad
              relevante. Puedes aceptarlas o rechazarlas en cualquier momento.
            </p>
            <p className="mt-1 text-[11px] text-neutral-600 sm:text-xs">
              <Link
                href="/politica-de-privacidad"
                className="font-semibold text-[#fe4a19] hover:underline"
              >
                Política de Privacidad
              </Link>
              <span className="mx-1">·</span>
              <Link
                href="/habeas-data"
                className="font-semibold text-[#fe4a19] hover:underline"
              >
                Habeas Data
              </Link>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center justify-end gap-2 sm:pl-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-neutral-200 px-4 text-xs font-semibold shadow-none sm:text-sm"
            onClick={reject}
          >
            Rechazar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg bg-[#fe4a19] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#fe4a19]/90 sm:text-sm"
            onClick={accept}
          >
            Aceptar todas
          </Button>
        </div>
      </div>
    </div>
  );
}
