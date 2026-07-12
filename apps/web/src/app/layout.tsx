/** Layout raíz: tema claro por defecto. El inbox usa el scope `.inbox` (WhatsApp). */
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { Toaster } from 'sileo';
import { Toaster as SonnerToaster } from 'sonner';
import { Providers } from './providers';
import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'FincasYa - Encuentra tu descanso ideal',
  description:
    'Reserva fincas verificadas en Anapoima, Melgar, Girardot, Villavicencio y más. Los expertos en alquiler.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
        <Providers>
          {children}
          {/* Toasts de sileo (igual que FincasYaWeb app/layout.tsx). */}
          <Toaster position="top-right" options={{ fill: 'white' }} />
          <SonnerToaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
