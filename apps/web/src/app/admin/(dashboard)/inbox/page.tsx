'use client';

/** Ruta `/inbox` — panel de operadores (inbox estilo WhatsApp), protegida. */
import InboxApp from '@/features/inbox/InboxApp';
import { RequireInboxAuth } from '@/features/auth/RequireInboxAuth';

export default function Page() {
  return (
    <RequireInboxAuth>
      <div className="inbox h-full min-h-0 flex-1 overflow-hidden">
        <InboxApp />
      </div>
    </RequireInboxAuth>
  );
}
