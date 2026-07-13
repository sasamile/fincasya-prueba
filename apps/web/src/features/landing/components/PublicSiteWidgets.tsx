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
      <WhatsappFab />
      <ChatAssistantWidget />
    </>
  );
}
