import { LegalCmsPublicPage } from '@/features/site-pages/views/LegalCmsPublicPage';
import { PRIVACIDAD_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';

export default function Page() {
  return <LegalCmsPublicPage pageId="privacidad" fallback={PRIVACIDAD_DEFAULT} />;
}
