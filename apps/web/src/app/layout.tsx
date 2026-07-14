/** Layout raíz: tema claro por defecto. El inbox usa el scope `.inbox` (WhatsApp). */
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { Toaster } from 'sileo';
import { Toaster as SonnerToaster } from 'sonner';
import { ConsentBootstrap } from '@/features/legal/components/consent-bootstrap';
import { SiteVisitTracker } from '@/features/landing/components/SiteVisitTracker';
import { MetaPixel, MetaPixelRouteTracker } from '@/lib/meta-pixel';
import { buildOgMetadata } from '@/lib/og-image';
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://fincasya.com'),
  ),
  ...homeOg,
  icons: { icon: '/favicon.svg' },
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
