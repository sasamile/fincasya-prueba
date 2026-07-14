/** Layout raíz: tema claro por defecto. El inbox usa el scope `.inbox` (WhatsApp). */
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { Toaster } from 'sileo';
import { Toaster as SonnerToaster } from 'sonner';
import { ConsentBootstrap } from '@/features/legal/components/consent-bootstrap';
import { SiteVisitTracker } from '@/features/landing/components/SiteVisitTracker';
import { MetaPixel, MetaPixelRouteTracker } from '@/lib/meta-pixel';
import { Providers } from './providers';
import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://fincasya.com'),
  ),
  title: 'FincasYa - Encuentra tu descanso ideal',
  description:
    'Reserva fincas verificadas en Anapoima, Melgar, Girardot, Villavicencio y más. Los expertos en alquiler.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
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
