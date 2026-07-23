import type { Metadata } from 'next';

/**
 * Manifiesto propio del panel: en iPhone, “Añadir a pantalla de inicio”
 * usa `start_url` del webmanifest (el de la landing es `/` y abría el home).
 */
export const metadata: Metadata = {
  applicationName: 'FincasYa Inbox',
  manifest: '/admin.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Inbox',
    statusBarStyle: 'black-translucent',
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
