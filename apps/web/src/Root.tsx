/**
 * Router raíz de la app web de FincasYa.
 *  - `/`        → landing pública (marketing + catálogo, conectado a Convex).
 *  - `/inbox/*` → panel de operadores (inbox estilo WhatsApp).
 * Todo corre sobre el mismo cliente Convex (sin backend Nest).
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import InboxApp from './features/inbox/InboxApp';
import { LandingPage } from './features/landing/LandingPage';

export function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/inbox/*" element={<InboxApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
