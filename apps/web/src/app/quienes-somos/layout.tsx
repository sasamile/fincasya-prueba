import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:
    '¿Quiénes Somos? | FincasYa - Expertos en Alquiler de Propiedades Turísticas',
  description:
    'Conozca más sobre FincasYa, la plataforma digital líder en el alquiler de fincas, villas y apartamentos turísticos en Colombia con más de 12 años de experiencia.',
  keywords: [
    'fincas',
    'alquiler de fincas',
    'turismo colombia',
    'fincasya',
    'casas campestres',
    'vacaciones',
  ],
  openGraph: {
    title: '¿Quiénes Somos? | FincasYa',
    description:
      'Seguridad y confianza en el alquiler de propiedades turísticas en Colombia. Más de 12 años conectando viajeros con las mejores experiencias.',
    type: 'website',
    url: 'https://fincasya.com/quienes-somos',
    images: [
      {
        url: '/icons/fincasya-link-logo.jpg',
        width: 1200,
        height: 630,
        alt: 'FincasYa - ¿Quiénes Somos?',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '¿Quiénes Somos? | FincasYa',
    description:
      'Expertos en alquiler de propiedades turísticas en Colombia con más de 12 años de trayectoria.',
    images: ['/icons/fincasya-link-logo.jpg'],
  },
};

export default function QuienesSomosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
