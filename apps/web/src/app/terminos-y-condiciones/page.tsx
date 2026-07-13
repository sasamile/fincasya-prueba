import { LegalCmsPublicPage } from '@/features/site-pages/views/LegalCmsPublicPage';
import { TERMINOS_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';

export default function Page() {
  return <LegalCmsPublicPage pageId="terminos" fallback={TERMINOS_DEFAULT} />;
}
