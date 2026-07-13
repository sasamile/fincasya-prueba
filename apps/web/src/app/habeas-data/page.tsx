import { HabeasDataPublicPage } from '@/features/site-pages/views/HabeasDataPublicPage';

export const metadata = {
  title: 'Habeas Data — Ejerce tus derechos | FincasYa',
  description:
    'Solicita acceso, rectificación, cancelación, oposición o revocatoria sobre tus datos personales. Formulario oficial Ley 1581 de 2012.',
};

export default function Page() {
  return <HabeasDataPublicPage />;
}
