'use client';

import { Footer } from '@/features/landing/components/Footer';
import { LegalContent } from '@/features/site-pages/components/LegalContent';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

type LegalPageData = {
  heroTitle: string;
  heroSubtitle?: string;
  content: string;
};

function LegalHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <a href="/" className="text-2xl font-extrabold text-[#E8571F]">
          Fincas<span className="text-[#1A1A1A]">Ya</span>
        </a>
        <span className="rounded-full bg-[#FFF3ED] px-3 py-1 text-xs font-semibold text-[#E8571F]">
          Documento Legal
        </span>
      </div>
    </header>
  );
}

export function LegalCmsPublicPage({
  pageId,
  fallback,
}: {
  pageId: string;
  fallback: LegalPageData;
}) {
  const { data, loading } = useInternalPageContent<LegalPageData>(pageId, fallback);

  if (loading) {
    return (
      <main className="landing min-h-screen bg-white">
        <LegalHeader />
        <div className="mx-auto max-w-4xl px-4 py-24 text-center text-gray-500">Cargando...</div>
        <Footer />
      </main>
    );
  }

  if (!data?.content) {
    return (
      <main className="landing min-h-screen bg-white">
        <LegalHeader />
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Documento no disponible</h1>
          <p className="mt-2 text-sm text-gray-500">
            Todavía no hay contenido configurado para esta página.
          </p>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="landing min-h-screen bg-white">
      <LegalHeader />
      <section className="bg-gradient-to-br from-[#E8571F] to-[#D14A15] px-4 py-14 text-center text-white">
        <h1 className="mb-2 text-3xl font-extrabold md:text-4xl">{data.heroTitle}</h1>
        {data.heroSubtitle ? (
          <p className="mx-auto max-w-2xl text-sm text-white/90 md:text-base">{data.heroSubtitle}</p>
        ) : null}
      </section>
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <LegalContent html={data.content} />
      </div>
      <Footer />
    </main>
  );
}
