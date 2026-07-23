'use client';

import { usePathname } from 'next/navigation';
import { CookieConsentBanner } from './CookieConsentBanner';
import { ChatAssistantWidget } from './ChatAssistantWidget';
import { WhatsappFab } from './WhatsappFab';

const HIDDEN_PREFIXES = ['/admin', '/checkin', '/anfitrion', '/dev-doc', '/_font-check'];

export function PublicSiteWidgets() {
  const pathname = usePathname() ?? '';

  const hidden = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (hidden) return null;

  return (
    <>
      <CookieConsentBanner />
      {/*
        Stack inferior derecha: por encima de la barra móvil de ficha (~72px)
        para no tapar «Disponibilidad». En desktop bajan un poco.
      */}
      <div className="fixed right-3 bottom-20 z-58 flex flex-col items-end gap-2 md:right-5 md:bottom-5">
        <ChatAssistantWidget />
        <WhatsappFab />
      </div>
    </>
  );
}
