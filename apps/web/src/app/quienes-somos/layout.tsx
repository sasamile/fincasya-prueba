import type { Metadata } from 'next';
import { buildOgMetadata } from '@/lib/og-image';

export const metadata: Metadata = buildOgMetadata({
  title: '¿Quiénes Somos? | FincasYa',
  description:
    'Seguridad y confianza en el alquiler de propiedades turísticas en Colombia. Más de 12 años conectando viajeros con las mejores experiencias.',
  path: '/quienes-somos',
});

export default function QuienesSomosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
