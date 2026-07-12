import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Root } from './Root';
import './index.css';

const convexUrl =
  import.meta.env.VITE_CONVEX_URL ?? 'https://modest-husky-871.convex.cloud';
const convex = new ConvexReactClient(convexUrl);

// Reusa el root entre recargas HMR (evita el warning de createRoot duplicado).
const globals = globalThis as typeof globalThis & {
  __fincasyaRoot?: ReturnType<typeof createRoot>;
};
const root = (globals.__fincasyaRoot ??= createRoot(document.getElementById('root')!));

root.render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <Root />
    </ConvexProvider>
  </StrictMode>,
);
