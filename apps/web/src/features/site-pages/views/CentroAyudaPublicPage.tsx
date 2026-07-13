'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Search,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { CENTRO_DE_AYUDA_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import {
  PublicMarketingShell,
  fadeInUp,
} from '@/features/site-pages/components/PublicMarketingShell';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

type HelpData = typeof CENTRO_DE_AYUDA_DEFAULT;

export function CentroAyudaPublicPage() {
  const { data, loading } = useInternalPageContent<HelpData>(
    'centro-de-ayuda',
    CENTRO_DE_AYUDA_DEFAULT,
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) return <PublicMarketingShell loading />;
  const content = data;
  if (!content) return <PublicMarketingShell unavailable />;

  const faqs = content.faqs.filter((faq) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
    );
  });

  return (
    <PublicMarketingShell>
      <section className="relative overflow-hidden bg-black py-16 text-white lg:py-24">
        <div className="absolute inset-0 z-0 opacity-10 blur-3xl">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-orange-600" />
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="mb-4 text-3xl font-extrabold md:text-5xl">{content.heroTitle}</h1>
            <p className="mx-auto mb-10 max-w-xl text-lg text-white/80">{content.heroSubtitle}</p>
            <div className="mx-auto max-w-md">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={content.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-white/20 bg-white/10 py-4 pl-12 pr-4 text-white placeholder:text-white/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-secondary/30 py-16">
        <div className="container mx-auto max-w-2xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              FAQ
            </span>
            <h2 className="text-2xl font-extrabold md:text-3xl">{content.faqSectionTitle}</h2>
          </motion.div>
          <div className="divide-y space-y-0">
            {faqs.map((faq, i) => (
              <motion.div key={faq.question} {...fadeInUp} transition={{ delay: i * 0.05 }}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left text-base font-semibold transition-colors hover:text-primary"
                >
                  {faq.question}
                  <ChevronDown
                    className={`ml-3 h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === i ? 'max-h-60 pb-5' : 'max-h-0'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-linear-to-br from-primary to-orange-700 py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-2xl font-extrabold md:text-3xl">{content.ctaTitle}</h2>
            <p className="mx-auto mb-8 max-w-md text-white/90">{content.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={content.ctaWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-orange-600 transition-transform hover:scale-105"
              >
                <MessageCircle className="h-5 w-5" />
                Escríbenos por WhatsApp
              </a>
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white/50 px-6 py-3 font-bold text-white transition-colors hover:border-white"
              >
                Otros canales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicMarketingShell>
  );
}
