import { LegalCmsPublicPage } from '@/features/site-pages/views/LegalCmsPublicPage';
import { CANCELACION_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';

export default function Page() {
  return <LegalCmsPublicPage pageId="cancelacion" fallback={CANCELACION_DEFAULT} />;
}
