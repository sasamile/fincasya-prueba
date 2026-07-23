/** Layout raíz: tema claro por defecto. El inbox usa el scope `.inbox` (WhatsApp). */
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { Toaster } from 'sileo';
import { Toaster as SonnerToaster } from 'sonner';
import { ConsentBootstrap } from '@/features/legal/components/consent-bootstrap';
import { SiteVisitTracker } from '@/features/landing/components/SiteVisitTracker';
import { MetaPixel, MetaPixelRouteTracker } from '@/lib/meta-pixel';
import { buildOgMetadata, getPublicSiteOrigin } from '@/lib/og-image';
import { Providers } from './providers';
import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const homeOg = buildOgMetadata({
  title: 'FincasYa - Encuentra tu descanso ideal',
  description:
    'Alquiler de fincas exclusivas para tu descanso y recreación en Colombia.',
  path: '/',
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),
  ...homeOg,
  applicationName: 'FincasYa',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'FincasYa',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', sizes: '70x70', type: 'image/png' },
      { url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      {
        url: '/apple-touch-icon.png?v=2',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcut: ['/apple-touch-icon.png?v=2'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning data-accent="orange">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem("fincasya-admin-accent");if(a==="orange"||a==="green"||a==="blue"||a==="violet"){document.documentElement.dataset.accent=a;}}catch(e){}})();`,
          }}
        />
        <ConsentBootstrap />
      </head>
      <body className={`${poppins.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster position="top-right" options={{ fill: 'white' }} />
          <SonnerToaster richColors position="top-right" />
        </Providers>
        <MetaPixel />
        <MetaPixelRouteTracker />
        <SiteVisitTracker />
      </body>
    </html>
  );
}
